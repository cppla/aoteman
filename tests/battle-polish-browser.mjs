import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://localhost:8789';
const output = new URL('../test-results/battle-polish/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

// A static harness exercises the real battle dialog without creating players,
// spending a player's energy, or modifying any save API data.
await page.route('**/battle-polish-harness', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/characters.css"><body style="background:#071923;font-family:sans-serif"><button id="launch">出发</button></body></html>' }));
await page.goto(`${base}/battle-polish-harness`);
async function open(options = {}) {
  await page.locator('#launch').focus();
  await page.evaluate(async options => {
    const { openBattle } = await import('/battle.js');
    window.battleHandle = openBattle({ ...options, onResult: result => { window.battleResult = result; } });
  }, options);
  await page.locator('.battle-dialog').waitFor();
}
async function close() {
  await page.locator('.battle-exit').click();
  await page.locator('[data-command="close"]').click();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'launch', 'Closing returns focus to the original launch control');
}
const button = action => page.locator(`[data-action="${action}"]`);

try {
  for (const [monsterId, skill] of [['obsidian', '黑曜震波'], ['lava', '熔核喷发'], ['cosmic', '跃迁突袭']]) {
    await open({ monsterId, heroName: '小光 <img src=x>' });
    assert.equal(await page.locator('.battle-skill-brief li').count(), 3);
    assert.match(await page.locator('.battle-skill-brief').textContent(), new RegExp(skill));
    assert.match(await page.locator('.battle-strategy').textContent(), /格挡|收手|预警|35%/);
    assert.match(await page.locator('.battle-hero-name').textContent(), /小光 <img src=x>/);
    assert.match(await page.locator('.ready-overlay h3').textContent(), /小光 <img src=x>/);
    assert.equal(await page.locator('.battle-dialog img').count(), 0, 'Partner names must render as text');
    await close();
  }

  await open({ monsterId: 'cosmic' });
  assert.equal(await page.locator('[data-command="start"]').evaluate(element => document.activeElement === element), true);
  await page.locator('[data-command="start"]').click();
  assert.equal(await button('beam').isDisabled(), true);
  assert.equal(await button('beam').locator('span').textContent(), '还差 30 光能');
  assert.equal(await button('special').locator('span').textContent(), '还差 100 光能');
  await page.keyboard.press('2');
  await page.waitForFunction(() => document.querySelector('.battle-log').textContent.includes('光能还差 30 点'));
  await button('punch').click();
  assert.equal(await page.locator('.battle-dialog').evaluate(element => document.activeElement === element), true, 'An action entering cooldown keeps keyboard focus in the battle');
  assert.match(await button('punch').locator('span').textContent(), /冷却 0\.[1-6]s/);
  assert.match(await button('beam').getAttribute('aria-label'), /冷却还剩.+还差/);
  await page.waitForTimeout(650);
  const hitsBefore = await page.evaluate(() => window.battleHandle.engine.snapshot().stats.punches);
  await page.locator('.battle-dialog').dispatchEvent('keydown', { key: '1', repeat: true, bubbles: true, cancelable: true });
  assert.equal(await page.evaluate(() => window.battleHandle.engine.snapshot().stats.punches), hitsBefore, 'Held numeric shortcut must not auto attack');

  await page.locator('.battle-warning.is-warning').waitFor();
  assert.equal(await page.locator('.battle-warning').getAttribute('aria-live'), 'off');
  const before = Number.parseFloat(await page.locator('.warning-time').textContent());
  await page.evaluate(() => {
    window.liveChanges = 0;
    window.liveObserver = new MutationObserver(mutations => { window.liveChanges += mutations.length; });
    window.liveObserver.observe(document.querySelector('.battle-log'), { childList: true, subtree: true, characterData: true });
  });
  await page.waitForTimeout(350);
  const after = Number.parseFloat(await page.locator('.warning-time').textContent());
  assert.ok(after < before, 'Visible warning countdown must keep moving');
  assert.equal(await page.evaluate(() => window.liveChanges), 0, 'Countdown must not repeatedly update the live announcement');
  await page.waitForFunction(() => document.querySelector('.battle-warning').classList.contains('is-perfect-window'));
  // Keyboard input has no hover-transition actionability wait, so it reaches
  // the deliberately short timing window just like the player's shortcut.
  await page.keyboard.press('4');
  assert.equal(await page.locator('.hero-actor').getAttribute('data-pose'), 'defend');
  assert.match(await page.locator('.battle-action-hint').textContent(), /不要出拳|出拳.*解除/);
  await page.waitForFunction(() => !window.battleHandle.engine.snapshot().currentAttack);
  assert.ok(await page.evaluate(() => window.battleHandle.engine.snapshot().stats.perfects > 0));
  await page.locator('[data-command="pause"]').click();
  assert.equal(await page.locator('[data-command="resume"]').evaluate(element => document.activeElement === element), true);
  const elapsed = await page.evaluate(() => window.battleHandle.engine.snapshot().elapsed);
  await page.keyboard.press('1');
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.battleHandle.engine.snapshot().elapsed), elapsed);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.pause-overlay').isVisible(), false);
  await page.locator('.battle-exit').click();
  assert.match(await page.locator('.battle-review').textContent(), /完美格挡.*连击.*没有受伤/);
  await page.locator('[data-command="close"]').click();

  // Resolve a real enemy attack through the engine's public time API. This
  // makes the no-defense review deterministic without waiting for a full loss.
  await open({ monsterId: 'lava' });
  await page.locator('[data-command="start"]').click();
  await page.evaluate(() => {
    const engine = window.battleHandle.engine;
    engine.step(engine.snapshot().nextAttackAt - engine.snapshot().elapsed);
    engine.step(engine.snapshot().attackRemaining);
  });
  await page.locator('.battle-exit').click();
  const damage = await page.evaluate(() => window.battleResult.damageTaken);
  assert.ok(damage > 0);
  assert.match(await page.locator('.battle-review').textContent(), new RegExp(`${damage} 点伤害.*还没有成功防御`));
  await page.locator('[data-command="close"]').click();

  for (const width of [375, 430, 768]) {
    await page.setViewportSize({ width, height: 860 });
    await open({ monsterId: 'cosmic', heroName: '每天都会变强的小小光之守护者' });
    assert.equal(await page.locator('.battle-dialog').evaluate(element => element.scrollWidth <= element.clientWidth), true, `No horizontal battle overflow at ${width}px`);
    await page.screenshot({ path: new URL(`briefing-${width}.png`, output).pathname, fullPage: true });
    await page.locator('[data-command="start"]').click();
    await button('defend').click();
    assert.equal(await page.locator('.hero-actor').getAttribute('data-pose'), 'defend');
    await page.screenshot({ path: new URL(`controls-${width}.png`, output).pathname, fullPage: true });
    await close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: all monster briefings; escaped partner names; energy and cooldown hints; repeat-key safety; quiet countdown; perfect X defense; pause and focus return; result advice; 375/430/768px touch layouts.');
} catch (error) {
  await page.screenshot({ path: new URL('failure.png', output).pathname, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await context.close();
  await browser.close();
}
