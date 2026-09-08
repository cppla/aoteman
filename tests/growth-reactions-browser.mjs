import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { freshState } from '../public/pet-state.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://localhost:8789';
const output = new URL('../test-results/growth-reactions/', import.meta.url);
await mkdir(output, { recursive:true });
const browser = await chromium.launch({ headless:true });
const contexts = [], errors = [];
const ready = page => page.waitForFunction(() => !document.getElementById('feedBtn').disabled);
const synced = page => page.locator('#saveStatus[data-status="synced"]').waitFor({ state:'attached', timeout:20000 });
const local = page => page.evaluate(() => JSON.parse(localStorage.getItem('aoteman-pet-v2')));
const response = page => page.locator('.growth-reaction:not([hidden])');
const identity = page => page.evaluate(() => JSON.parse(localStorage.getItem('aoteman-cloud-v1')));
async function head(page) {
  const { recoveryCode } = await identity(page);
  const result = await fetch(`${base}/api/v1/save`, { headers:{ Authorization:`Bearer ${recoveryCode}` } });
  assert.equal(result.status, 200); return (await result.json()).state;
}
async function makePage(fixture, options = {}) {
  const context = await browser.newContext({ viewport:{ width:834, height:1194 }, hasTouch:true, isMobile:true, ...options });
  contexts.push(context);
  await context.addInitScript(raw => {
    if (!localStorage.getItem('aoteman-cloud-v1')) localStorage.setItem('ginga-pet-v1', raw);
  }, JSON.stringify(fixture));
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base); await ready(page); await synced(page);
  assert.equal(await response(page).count(), 0, 'Existing XP is not a new reward');
  return page;
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const badge = await page.locator('.growth-reaction-badge').boundingBox();
  const habitat = await page.locator('#habitat').boundingBox();
  assert.ok(badge.x >= habitat.x && badge.x + badge.width <= habitat.x + habitat.width, 'Reward badge fits the habitat');
  assert.equal(await page.locator('.growth-reaction').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
}
try {
  assert.equal((await fetch(`${base}/api/healthz`)).status, 200);
  const initial = { ...freshState(), xp:70, fed:1 };
  initial.daily = { ...initial.daily, fed:1, training:1, battles:1 };
  const page = await makePage(initial);
  await page.locator('#trainBtn').tap();
  assert.equal(await page.locator('#petHero').getAttribute('data-pose'), 'train');
  await response(page).waitFor(); await synced(page);
  assert.equal(await response(page).getAttribute('data-kind'), 'levelup');
  assert.equal(await page.locator('#petHero').getAttribute('data-pose'), 'levelup');
  assert.match(await page.locator('.growth-reaction-copy strong').textContent(), /Lv\. 2/);
  assert.equal(await page.locator('.growth-reaction-xp').textContent(), '+20 XP');
  assert.match(await page.locator('#speech').textContent(), /长大啦/);
  assert.equal((await head(page)).xp, 90);
  assert.equal(await page.locator('#feedBtn').isEnabled(), true, 'Celebration does not disable care controls');
  await noOverflow(page);
  await page.waitForTimeout(550);
  await page.locator('#habitat').screenshot({ path:new URL('ipad-levelup.png', output).pathname });

  // A touch during the celebration immediately owns the pose; stale visual
  // timers cannot reset a subsequent care animation.
  await page.locator('#feedBtn').tap();
  assert.equal(await response(page).count(), 0);
  assert.equal(await page.locator('#petHero').getAttribute('data-pose'), 'eat');
  await ready(page); await page.locator('#trainBtn').tap(); await page.waitForTimeout(1450);
  assert.equal(await page.locator('#petHero').getAttribute('data-pose'), 'train');
  await response(page).waitFor();
  assert.equal(await response(page).getAttribute('data-kind'), 'earned');
  assert.equal(await page.locator('#petHero').getAttribute('data-pose'), 'salute');
  await synced(page); assert.equal((await head(page)).xp, 110);

  // A gift is saved inside its dialog, then the companion responds on return.
  await page.locator('#journeyBtn').tap();
  await page.locator('[data-milestone-action="first_meal"]').tap(); await synced(page);
  assert.equal(await response(page).count(), 0, 'No growth effect plays behind a dialog');
  assert.equal((await head(page)).xp, 120);
  assert.equal(await page.locator('[data-milestone-action="first_meal"]').isDisabled(), true);
  await page.locator('#closeDialog').tap(); await response(page).waitFor();
  assert.equal(await page.locator('.growth-reaction-xp').textContent(), '+10 XP');
  assert.equal(await page.locator('#petHero').getAttribute('data-pose'), 'salute');
  await page.reload(); await ready(page); await synced(page);
  assert.equal(await response(page).count(), 0, 'Reload does not replay the claimed gift');
  assert.equal((await head(page)).xp, 120);
  await page.locator('#journeyBtn').tap();
  assert.equal(await page.locator('[data-milestone-action="first_meal"]').isDisabled(), true);
  await page.locator('#closeDialog').tap(); assert.equal(await response(page).count(), 0);

  await page.locator('#claimBtn').tap(); await response(page).waitFor(); await synced(page);
  assert.equal(await page.locator('.growth-reaction-xp').textContent(), '+25 XP');
  assert.equal((await head(page)).xp, 145); assert.equal((await local(page)).daily.claimed, true);
  await page.locator('#petBtn').tap(); const firstLine = await page.locator('#speech').textContent();
  await ready(page); const pats = (await local(page)).pats;
  await page.locator('#petBtn').tap();
  assert.equal(await page.locator('#petHero').getAttribute('data-pose'), 'nod');
  assert.notEqual(await page.locator('#speech').textContent(), firstLine);
  assert.equal((await local(page)).pats, pats, 'A friendly rapid repeat does not farm rewards');

  // Reduced-motion users still receive the reward and an intentional static pose.
  const reduced = await makePage({ ...freshState(), xp:70 }, { reducedMotion:'reduce', viewport:{ width:1194, height:834 } });
  await reduced.locator('#trainBtn').tap(); await response(reduced).waitFor();
  assert.equal(await response(reduced).getAttribute('data-kind'), 'levelup');
  assert.equal(await reduced.locator('.growth-reaction-halo i').first().evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.ok(await reduced.locator('#petHero .hero-right-arm').evaluate(el => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).a) < .9), 'Reduced motion keeps an actual raised-arm pose, not an identity transform');
  await noOverflow(reduced);
  await reduced.locator('#habitat').screenshot({ path:new URL('ipad-reduced-motion.png', output).pathname });

  // Actual victory crosses a level boundary. Rewards persist while the result
  // is open; the level-up response waits for the battle and return-home pose.
  const battle = await makePage({ ...freshState(), xp:50, difficulty:'easy' }, { viewport:{ width:1194, height:834 } });
  await battle.locator('#fightBtn').tap(); await battle.locator('[data-command="start"]').tap();
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const ui = await battle.evaluate(() => {
      const arena = document.querySelector('.battle-arena');
      const available = action => !document.querySelector(`[data-action="${action}"]`).disabled;
      return { phase:arena.dataset.phase, warning:parseFloat(document.querySelector('.warning-time').textContent), paused:arena.classList.contains('is-paused'), punch:available('punch'), beam:available('beam'), defend:available('defend') };
    });
    if (ui.phase === 'ended') break;
    if (ui.paused) await battle.locator('[data-command="resume"]').tap();
    else if (ui.phase === 'warning' && ui.warning <= .5) { if (ui.defend) await battle.keyboard.press('4'); }
    else if (ui.beam) await battle.keyboard.press('2');
    else if (ui.punch) await battle.keyboard.press('1');
    await battle.waitForTimeout(80);
  }
  await battle.locator('.result-overlay:not([hidden])').waitFor(); await synced(battle);
  assert.match(await battle.locator('.result-overlay h3').textContent(), /城市已被守护/);
  assert.equal((await head(battle)).xp, 90); assert.equal((await head(battle)).wins, 1);
  assert.equal(await response(battle).count(), 0);
  await battle.locator('[data-command="close"]').tap();
  await response(battle).waitFor();
  assert.equal(await response(battle).getAttribute('data-kind'), 'levelup');
  assert.equal(await battle.locator('.growth-reaction-xp').textContent(), '+40 XP');
  assert.equal(await battle.locator('#petHero').getAttribute('data-pose'), 'levelup');
  await battle.reload(); await ready(battle); await synced(battle);
  assert.equal(await response(battle).count(), 0); assert.equal((await head(battle)).xp, 90);
  assert.equal((await head(battle)).wins, 1);
  assert.deepEqual(errors, []);
  console.log('PASS: iPad touch training level-up, visible XP/salute, nonblocking controls and timer ownership, once-only milestone and daily feedback, reload without replay, friendly repeat touches without extra rewards, reduced-motion pose, real battle XP saved before close and level-up shown only on return.');
} catch (error) {
  for (let i = 0; i < contexts.length; i++) for (const page of contexts[i].pages()) await page.screenshot({ path:new URL(`failure-${i}.png`, output).pathname, fullPage:true }).catch(() => {});
  throw error;
} finally { await browser.close(); }
