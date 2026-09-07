import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
// Always target an isolated save volume. All player actions below use a fresh
// browser context and ordinary controls; the test never edits a player's save.
const base = process.env.BASE_URL || 'http://localhost:8789';
const output = new URL('../test-results/ally/', import.meta.url);
await mkdir(output, { recursive: true });
const health = await fetch(`${base}/api/healthz`);
assert.equal(health.status, 200);
assert.equal((await health.json()).storage, 'sqlite');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
const page = await context.newPage();
const errors = [];
const scrub = text => String(text).replace(/gxy_[a-f0-9]{64}/g, '[redacted]');
page.on('pageerror', error => errors.push(scrub(error.message)));
const ready = () => page.waitForFunction(() => !document.getElementById('feedBtn').disabled);
const synced = () => page.locator('#saveStatus[data-status="synced"]').waitFor({ state: 'attached', timeout: 20000 });
const growth = snapshot => ({ xp: snapshot.state.xp, wins: snapshot.state.wins, stars: snapshot.state.stars, defeated: snapshot.state.defeated, battles: snapshot.state.daily.battles });
let code;
async function serverState() {
  const response = await fetch(`${base}/api/v1/save`, { headers: { Authorization: `Bearer ${code}` } });
  assert.equal(response.status, 200);
  return response.json();
}
async function ui() {
  return page.evaluate(() => {
    const arena = document.querySelector('.battle-arena');
    const available = action => {
      const button = document.querySelector(`[data-action="${action}"]`);
      return Boolean(button && !button.disabled);
    };
    return {
      phase: arena.dataset.phase,
      assist: arena.dataset.assist,
      paused: arena.classList.contains('is-paused'),
      heroHp: Number.parseInt(document.querySelector('.hero-health-number').textContent, 10),
      monsterHp: Number.parseInt(document.querySelector('.monster-health-number').textContent, 10),
      energy: Number(document.querySelector('.energy-number').textContent),
      clock: document.querySelector('.battle-clock').textContent,
      warning: Number.parseFloat(document.querySelector('.warning-time').textContent),
      heroPose: document.querySelector('.battle-arena > .hero-actor').dataset.pose,
      allyPose: document.querySelector('.ally-actor')?.dataset.pose,
      punch: available('punch'), beam: available('beam'), defend: available('defend'),
      summon: available('summon'), link: available('link'),
    };
  });
}
async function waitForUi(predicate, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const state = await ui();
    if (predicate(state)) return state;
    assert.notEqual(state.phase, 'ended', 'Battle ended before the requested action became available');
    if (state.paused) await page.locator('[data-command="resume"]').click();
    await page.waitForTimeout(60);
  }
  assert.fail('Timed out waiting for the next combat condition');
}
async function beamAlignment() {
  // Read the painted SVG wrist and the ray's positioned origin in the same
  // animation frame. This catches percentage-based offsets at different sizes.
  return page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    const arena = document.querySelector('.battle-arena').getBoundingClientRect();
    const target = new DOMPoint(180, 225).matrixTransform(document.querySelector('.battle-arena .monster-rig').getScreenCTM());
    resolve([
      ['main', '.battle-beam', '.battle-arena > .hero-actor'],
      ['ally', '.ally-beam', '.ally-actor'],
    ].map(([name, beamSelector, actorSelector]) => {
      const beam = document.querySelector(beamSelector);
      const style = getComputedStyle(beam);
      const hand = new DOMPoint(235, 213).matrixTransform(document.querySelector(`${actorSelector} .hero-beam-flare`).getScreenCTM());
      const origin = { x: arena.x + Number.parseFloat(style.left), y: arena.y + Number.parseFloat(style.top) + beam.offsetHeight / 2 };
      const angle = Number.parseFloat(style.getPropertyValue('--ray-angle'));
      const length = Number.parseFloat(style.width);
      const end = { x: origin.x + length * Math.cos(angle), y: origin.y + length * Math.sin(angle) };
      return { name, originError: Math.hypot(origin.x - hand.x, origin.y - hand.y), targetError: Math.hypot(end.x - target.x, end.y - target.y) };
    }));
  })));
}
function assertAligned(rays, viewport) {
  for (const ray of rays) {
    assert.ok(ray.originError < 2, `${ray.name} ray begins at the wrist within 2px at ${viewport}`);
    assert.ok(ray.targetError < 2, `${ray.name} ray points at the monster chest within 2px at ${viewport}`);
  }
}

const actions = { punch: 0, beam: 0, defend: 0, summon: 0, link: 0 };
try {
  await page.goto(base);
  await ready(); await synced();
  code = await page.evaluate(() => JSON.parse(localStorage.getItem('aoteman-cloud-v1')).recoveryCode);
  const initial = await serverState();
  assert.equal(initial.state.xp, 0);
  assert.equal(initial.state.wins, 0);
  await page.selectOption('#monsterSelect', 'obsidian');
  await page.selectOption('#difficultySelect', 'easy');
  await synced();
  await page.click('#fightBtn');
  await page.locator('[data-command="start"]').click();
  assert.equal(await page.locator('[data-action="summon"]').isDisabled(), true, 'A healthy hero cannot request emergency rescue');
  assert.equal(await page.locator('.ally-slot').isVisible(), false, 'The partner does not appear before a summon');

  // Save a little light energy, then take genuine enemy hits. No engine handle,
  // localStorage mutation, injected HP, or write to the save API is used here.
  for (let index = 0; index < 2; index++) {
    await waitForUi(state => state.punch);
    await page.keyboard.press('1'); actions.punch++;
  }
  const charged = await ui();
  assert.ok(charged.energy >= 18);
  assert.equal(charged.summon, false, 'Stored energy alone cannot summon at healthy HP');
  const critical = await waitForUi(state => state.summon, 75000);
  assert.ok(critical.heroHp > 0 && critical.heroHp <= 45, 'Rescue becomes available at no more than 30% of easy-mode HP');
  // Summon during the next warning to prove the rescue actually interrupts it.
  await waitForUi(state => state.phase === 'warning');
  const beforeSummon = await ui();
  await page.keyboard.press('6'); actions.summon++;
  const rescued = await ui();
  assert.equal(rescued.heroHp, beforeSummon.heroHp + 38, 'Arrival restores ceil(25% × 150) HP');
  assert.equal(rescued.energy, 0, 'The distress signal spends all remaining light energy');
  assert.equal(rescued.assist, 'active');
  assert.notEqual(rescued.phase, 'warning', 'Arrival cancels the monster attack already being prepared');
  assert.equal(await page.locator('.ally-slot').isVisible(), true);
  assert.equal(await page.locator('.ally-actor svg').count(), 1, 'The ally has a separate visible character');
  assert.equal(await page.locator('.battle-arena > .hero-actor').count(), 1);
  assert.equal(await page.locator('[data-action="summon"]').count(), 0, 'The once-per-battle summon turns into the joint attack control');
  assert.equal(await page.locator('[data-action="link"]').isDisabled(), true, 'Joint beam requires replenishing light energy');
  await page.screenshot({ path: new URL('rescue-arrival.png', output).pathname, fullPage: true });

  await page.keyboard.press('p');
  const paused = await ui();
  assert.equal(paused.paused, true);
  await page.keyboard.press('6');
  await page.waitForTimeout(1100);
  const stillPaused = await ui();
  assert.equal(stillPaused.heroHp, paused.heroHp);
  assert.equal(stillPaused.monsterHp, paused.monsterHp, 'The ally cannot deal damage while the game is paused');
  assert.equal(stillPaused.clock, paused.clock, 'Battle time also freezes');
  await page.keyboard.press('p');
  const allyHit = await waitForUi(state => state.monsterHp < paused.monsterHp, 5000);
  assert.equal(allyHit.monsterHp, paused.monsterHp - 12, 'The partner punches automatically without a player attack');
  assert.equal(allyHit.heroHp, rescued.heroHp, 'The rescue window protects the recovering hero');

  while (!(await ui()).link) {
    await waitForUi(state => state.punch || state.link);
    if ((await ui()).link) break;
    await page.keyboard.press('1'); actions.punch++;
  }
  const beforeLink = await ui();
  assert.ok(beforeLink.energy >= 30);
  assert.ok(beforeLink.monsterHp > 54, 'The joint attack is exercised before the finishing blow');
  await page.keyboard.press('6'); actions.link++;
  const linked = await ui();
  assert.equal(linked.energy, beforeLink.energy - 30);
  assert.ok(linked.monsterHp <= beforeLink.monsterHp - 54, 'The two-hero beam deals real combat damage');
  assert.equal(linked.heroPose, 'beam');
  assert.equal(linked.allyPose, 'beam');
  assert.equal(await page.locator('.battle-beam.active').count(), 1);
  assert.equal(await page.locator('.ally-beam.active').count(), 1, 'Both beam effects appear for the coordinated attack');
  const desktopRays = await beamAlignment();
  assertAligned(desktopRays, '1440px');
  await page.locator('.battle-dialog').screenshot({ path: new URL('joint-beam.png', output).pathname });
  await page.keyboard.press('6');
  const repeated = await ui();
  assert.equal(repeated.energy, linked.energy, 'Repeated input during cooldown cannot spend energy twice');
  assert.equal(repeated.monsterHp, linked.monsterHp, 'Repeated input during cooldown cannot duplicate joint damage');
  await page.keyboard.press('p');
  const jointPaused = await ui();
  assert.equal(jointPaused.paused, true);
  await page.waitForTimeout(1100);
  assert.equal(await page.locator('.battle-beam.active').count(), 1, 'The main beam survives a pause longer than its normal animation');
  assert.equal(await page.locator('.ally-beam.active').count(), 1, 'The ally beam survives the same pause');
  const jointStillPaused = await ui();
  assert.equal(jointStillPaused.monsterHp, jointPaused.monsterHp);
  assert.equal(jointStillPaused.heroHp, jointPaused.heroHp);
  assert.equal(jointStillPaused.clock, jointPaused.clock);
  await page.keyboard.press('p');

  // Finish through real punches, beams and timed X guards while the partner
  // keeps attacking. The result must be saved before dismissing the dialog.
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const state = await ui();
    if (state.phase === 'ended') break;
    if (state.paused) await page.locator('[data-command="resume"]').click();
    else if (state.phase === 'warning' && state.warning <= 0.5) {
      if (state.defend) { await page.keyboard.press('4'); actions.defend++; }
    } else if (state.beam) { await page.keyboard.press('2'); actions.beam++; }
    else if (state.punch) { await page.keyboard.press('1'); actions.punch++; }
    await page.waitForTimeout(60);
  }
  await page.locator('.result-overlay:not([hidden])').waitFor({ timeout: 5000 });
  assert.match(await page.locator('.result-overlay h3').textContent(), /城市已被守护/);
  assert.equal(await page.locator('.battle-result-assist').isVisible(), true, 'The result credits the rescue and joint combat');
  await synced();
  const rewarded = await serverState();
  assert.equal(rewarded.state.xp, initial.state.xp + 40);
  assert.equal(rewarded.state.stars, initial.state.stars + 20);
  assert.equal(rewarded.state.wins, initial.state.wins + 1);
  assert.equal(rewarded.state.daily.battles, initial.state.daily.battles + 1);
  assert.deepEqual(rewarded.state.defeated, ['obsidian']);
  assert.equal(await page.locator('.battle-dialog').isVisible(), true);
  await page.screenshot({ path: new URL('victory-saved.png', output).pathname, fullPage: true });
  await page.reload(); await ready(); await synced();
  const refreshed = await serverState();
  assert.deepEqual(growth(refreshed), growth(rewarded), 'Reloading an already-settled rescue victory does not award it twice');

  // The separate layout harness uses only public engine actions and time steps
  // to reach the same scene quickly; it does not create or change saved players.
  await page.route('**/ally-layout-harness', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/characters.css"><body style="background:#071923;font-family:sans-serif"><button id="launch">出发</button></body></html>' }));
  await page.goto(`${base}/ally-layout-harness`);
  const layouts = [];
  for (const width of [375, 430, 768]) {
    await page.setViewportSize({ width, height: 860 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(async () => {
      const { openBattle } = await import('/battle.js');
      window.battleHandle = openBattle({ monsterId: 'obsidian', difficulty: 'easy' });
    });
    await page.locator('[data-command="start"]').click();
    await page.evaluate(() => {
      const engine = window.battleHandle.engine;
      engine.act('punch'); engine.step(600); engine.act('punch');
      for (let index = 0; index < 40 && engine.snapshot().heroHp > 45; index++) {
        const state = engine.snapshot();
        engine.step((state.currentAttack?.strikesAt ?? state.nextAttackAt) - state.elapsed);
      }
      // Setup was accelerated; leave only the arrival event to animate so the
      // screenshot never implies an old setup punch happened after the summon.
      engine.drainEvents();
      const outcome = engine.act('summon');
      if (!outcome.ok) throw new Error(`Unable to prepare rescue layout: ${outcome.reason}`);
    });
    await page.waitForFunction(() => document.querySelector('.battle-arena').dataset.assist === 'active');
    const layout = await page.evaluate(() => {
      const box = selector => {
        const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
        return { x, y, width, height };
      };
      const dialog = document.querySelector('.battle-dialog');
      const ids = [...dialog.querySelectorAll('[id]')].map(element => element.id);
      return {
        noOverflow: dialog.scrollWidth <= dialog.clientWidth,
        arena: box('.battle-arena'), hero: box('.battle-arena > .hero-actor'), ally: box('.ally-slot'),
        action: box('[data-action="link"]'), distinctIds: new Set(ids).size === ids.length,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      };
    });
    assert.equal(layout.noOverflow, true, `No horizontal dialog overflow at ${width}px`);
    assert.equal(layout.distinctIds, true, 'The main hero and ally SVG paint IDs do not collide');
    assert.ok(layout.ally.width > 30 && layout.ally.height > 30, 'The ally remains visible on a small screen');
    assert.ok(layout.ally.x >= layout.arena.x - 1 && layout.ally.x + layout.ally.width <= layout.arena.x + layout.arena.width + 1, 'The ally stays within the arena');
    assert.ok(Math.abs((layout.hero.x + layout.hero.width / 2) - (layout.ally.x + layout.ally.width / 2)) > layout.arena.width * 0.05, 'The two heroes occupy distinct positions');
    assert.ok(layout.action.height >= 42, 'The joint control remains a usable touch target');
    assert.equal(layout.reducedMotion, true);
    await page.screenshot({ path: new URL(`duo-${width}.png`, output).pathname, fullPage: true });
    await page.evaluate(() => {
      const engine = window.battleHandle.engine;
      while (engine.snapshot().energy < 30) {
        engine.step(Math.max(600, engine.snapshot().cooldown));
        engine.act('punch');
      }
      engine.step(engine.snapshot().cooldown);
      engine.drainEvents();
      const outcome = engine.act('link');
      if (!outcome.ok) throw new Error(`Unable to prepare joint beam layout: ${outcome.reason}`);
    });
    await page.waitForFunction(() => document.querySelector('.ally-beam').classList.contains('active'));
    assert.equal(await page.locator('.battle-arena > .hero-actor').getAttribute('data-pose'), 'beam');
    assert.equal(await page.locator('.ally-actor').getAttribute('data-pose'), 'beam');
    layout.rays = await beamAlignment();
    assertAligned(layout.rays, `${width}px`);
    await page.screenshot({ path: new URL(`joint-${width}.png`, output).pathname, fullPage: true });
    layouts.push({ width, ...layout });
    await page.locator('.battle-exit').click();
    await page.locator('[data-command="close"]').click();
  }
  assert.deepEqual(errors, [], 'The real rescue and responsive layouts produce no page exceptions');
  await writeFile(new URL('verification.json', output), JSON.stringify({
    result: 'pass', testedAt: new Date().toISOString(), actions,
    charged, critical, beforeSummon, rescued, paused, stillPaused, allyHit, beforeLink, linked, desktopRays, jointPaused, jointStillPaused,
    before: growth(initial), resultStillOpen: growth(rewarded), afterRefresh: growth(refreshed), layouts,
  }, null, 2));
  console.log('PASS: real low-HP rescue interrupts a warning, consumes remaining energy, heals and protects; separate ally auto-attacks; pause freezes both heroes; joint beam deals damage; SQLite records one victory before closing and survives refresh; 375/430/768px two-hero layouts remain usable.');
} catch (error) {
  await page.screenshot({ path: new URL('failure.png', output).pathname, fullPage: true }).catch(() => {});
  throw new Error(scrub(error.stack || error.message));
} finally {
  await context.close();
  await browser.close();
}
