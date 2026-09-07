import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
// Run against an isolated Docker volume, never a real player's deployment.
const base = process.env.BASE_URL || 'http://localhost:8789';
const output = new URL('../test-results/battle-save/', import.meta.url);
await mkdir(output, { recursive: true });
const health = await fetch(`${base}/api/healthz`);
assert.equal(health.status, 200, 'The isolated save API must be healthy');
assert.equal((await health.json()).storage, 'sqlite');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
const page = await context.newPage();
const errors = [];
const scrub = text => String(text).replace(/gxy_[a-f0-9]{64}/g, '[redacted]');
page.on('pageerror', error => errors.push(scrub(error.message)));
const ready = () => page.waitForFunction(() => !document.getElementById('feedBtn').disabled);
const synced = () => page.locator('#saveStatus[data-status="synced"]').waitFor({ state: 'attached', timeout: 20000 });
const localState = () => page.evaluate(() => JSON.parse(localStorage.getItem('aoteman-pet-v2')));
let code;
async function serverState() {
  const response = await fetch(`${base}/api/v1/save`, { headers: { Authorization: `Bearer ${code}` } });
  assert.equal(response.status, 200, 'Authenticated save read must succeed');
  return response.json();
}
const growth = snapshot => ({ xp: snapshot.state.xp, wins: snapshot.state.wins, stars: snapshot.state.stars, defeated: snapshot.state.defeated, blocks: snapshot.state.blocks, battles: snapshot.state.daily.battles });

try {
  // A clean browser starts a synthetic player through the ordinary UI. The test
  // never injects game state, calls BattleEngine, or writes reward data to API.
  await page.goto(base);
  await ready(); await synced();
  code = await page.evaluate(() => JSON.parse(localStorage.getItem('aoteman-cloud-v1')).recoveryCode);
  const initial = await serverState();
  assert.equal(initial.state.xp, 0);
  assert.equal(initial.state.wins, 0);
  assert.deepEqual(initial.state.defeated, []);
  await page.selectOption('#monsterSelect', 'obsidian');
  await page.selectOption('#difficultySelect', 'easy');
  await synced();
  await page.click('#fightBtn');
  await page.locator('.battle-dialog').waitFor();
  await page.locator('[data-command="start"]').click();

  // Read only visible controls and react with real keyboard events. Attack in
  // open windows; guard the final 0.5 s of a warning and hold through impact.
  const actions = { punch: 0, beam: 0, defend: 0 };
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const ui = await page.evaluate(() => {
      const arena = document.querySelector('.battle-arena');
      const available = action => !document.querySelector(`[data-action="${action}"]`).disabled;
      return {
        phase: arena.dataset.phase,
        warning: Number.parseFloat(document.querySelector('.warning-time').textContent),
        paused: arena.classList.contains('is-paused'),
        punch: available('punch'), beam: available('beam'), defend: available('defend'),
        heroPose: document.querySelector('.battle-arena > .hero-actor').dataset.pose,
      };
    });
    if (ui.phase === 'ended') break;
    if (ui.paused) {
      await page.locator('[data-command="resume"]').click();
    } else if (ui.phase === 'warning' && ui.warning <= 0.5) {
      if (ui.defend) {
        await page.keyboard.press('4'); actions.defend++;
        assert.equal(await page.locator('.battle-arena > .hero-actor').getAttribute('data-pose'), 'defend');
      }
    } else if (ui.beam) {
      await page.keyboard.press('2'); actions.beam++;
    } else if (ui.punch) {
      await page.keyboard.press('1'); actions.punch++;
    }
    await page.waitForTimeout(80);
  }

  await page.locator('.result-overlay:not([hidden])').waitFor({ timeout: 5000 });
  assert.match(await page.locator('.result-overlay h3').textContent(), /城市已被守护/);
  assert.ok(actions.punch > 0 && actions.beam > 0 && actions.defend > 0, 'Real attacks and X defense must all have been used');
  await synced();
  // Do not close the result. Server reads at this exact point must already
  // contain all rewards, eliminating the former refresh-before-close loss.
  assert.equal(await page.locator('.battle-dialog').isVisible(), true);
  assert.equal(await page.locator('.result-overlay').isVisible(), true);
  const rewarded = await serverState();
  assert.equal(rewarded.state.xp, initial.state.xp + 40);
  assert.equal(rewarded.state.stars, initial.state.stars + 20);
  assert.equal(rewarded.state.wins, initial.state.wins + 1);
  assert.equal(rewarded.state.daily.battles, initial.state.daily.battles + 1);
  assert.deepEqual(rewarded.state.defeated, ['obsidian']);
  assert.ok(rewarded.state.blocks > 0);
  assert.equal((await localState()).xp, rewarded.state.xp);
  await page.screenshot({ path: new URL('won-before-closing.png', output).pathname, fullPage: true });

  // Refresh while the result is still open. After cloud reconciliation, both
  // local and SQLite state must equal the once-awarded result, including after
  // a second reload and another normal user interaction.
  await page.reload(); await ready(); await synced();
  assert.equal(await page.locator('.battle-dialog').count(), 0);
  const afterRefresh = await serverState();
  assert.deepEqual(growth(afterRefresh), growth(rewarded));
  assert.equal((await localState()).wins, 1);
  await page.click('#petBtn'); await ready(); await synced();
  await page.reload(); await ready(); await synced();
  const afterSecondRefresh = await serverState();
  assert.deepEqual(growth(afterSecondRefresh), growth(rewarded));
  assert.equal((await localState()).xp, 40);
  assert.deepEqual(errors, [], 'The battle/save flow must have no page exceptions');
  await page.screenshot({ path: new URL('after-refresh.png', output).pathname, fullPage: true });
  await writeFile(new URL('verification.json', output), JSON.stringify({
    result: 'pass', testedAt: new Date().toISOString(), actions,
    before: growth(initial), resultStillOpen: growth(rewarded),
    afterRefresh: growth(afterRefresh), afterSecondRefresh: growth(afterSecondRefresh),
    revisions: [initial.revision, rewarded.revision, afterRefresh.revision, afterSecondRefresh.revision],
  }, null, 2));
  console.log('PASS: real keyboard victory with X defense; SQLite already has +40 XP, +20 stars, +1 win, defeated monster and block stats while result remains open; two refreshes do not duplicate rewards.');
} catch (error) {
  await page.screenshot({ path: new URL('failure.png', output).pathname, fullPage: true }).catch(() => {});
  throw new Error(scrub(error.stack || error.message));
} finally {
  await context.close();
  await browser.close();
}
