import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium, webkit } = require('playwright');
// Isolated synthetic profiles only. Neither the live deployment nor existing
// browser storage is read or modified by this test.
const base = process.env.BASE_URL || 'http://localhost:8789';
const selected = (process.env.IPAD_BROWSERS || 'chromium,webkit').split(',');
const output = new URL('../test-results/ipad/', import.meta.url);
await mkdir(output, { recursive: true });
const errors = [], results = [];
const scrub = value => String(value).replace(/gxy_[a-f0-9]{64}/g, '[redacted]');
const ready = page => page.waitForFunction(() => document.querySelector('#feedBtn')?.disabled === false);
const synced = page => page.locator('#saveStatus[data-status="synced"]').waitFor({ state: 'attached', timeout: 20000 });
const cases = [
  { name: 'ipad-portrait', width: 834, height: 1194 },
  { name: 'ipad-landscape', width: 1194, height: 834 },
  { name: 'safari-portrait-bars', width: 834, height: 1050 },
  { name: 'safari-landscape-bars', width: 1194, height: 750 },
  { name: 'ipad-split-view', width: 600, height: 834 },
  { name: 'phone-375', width: 375, height: 812 },
  { name: 'phone-430', width: 430, height: 932 },
];
const settings = viewport => ({ viewport, screen: viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
function watch(page) { page.on('pageerror', error => errors.push(scrub(error.message))); }

async function layout(page) {
  return page.evaluate(() => {
    const visible = visualViewport;
    const bounds = { left: visible?.offsetLeft || 0, top: visible?.offsetTop || 0, width: visible?.width || innerWidth, height: visible?.height || innerHeight };
    const rect = element => {
      const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
      return { x, y, width, height, right, bottom };
    };
    const dialog = document.querySelector('.battle-dialog');
    const controls = [...document.querySelectorAll('.battle-action, .battle-toolbar button')].map(button => {
      const box = rect(button), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return { action: button.dataset.action || button.dataset.command, ...box, hit: hit === button || button.contains(hit) };
    });
    const ids = [...dialog.querySelectorAll('[id]')].map(element => element.id);
    return {
      bounds, controls, scale: visible?.scale || 1,
      touch: 'ontouchstart' in window && matchMedia('(pointer: coarse)').matches,
      maxTouchPoints: navigator.maxTouchPoints,
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      dialogOverflow: dialog.scrollWidth > dialog.clientWidth + 1,
      dialogScroll: dialog.scrollTop,
      dialog: rect(dialog), arena: rect(document.querySelector('.battle-arena')),
      heroes: ['.battle-arena > .hero-actor', '.ally-slot', '.second-ally-slot'].map(selector => rect(document.querySelector(selector))),
      paintedHeroes: ['.battle-arena > .hero-actor .hero-rig', '.ally-actor .hero-rig', '.second-ally-actor .hero-rig'].map(selector => rect(document.querySelector(selector))),
      idsUnique: ids.length === new Set(ids).size,
      phase: document.querySelector('.battle-arena').dataset.phase,
    };
  });
}
function assertLayout(value, name) {
  assert.equal(value.touch, true, `${name}: browser reports a touch device`);
  assert.equal(value.pageOverflow, false, `${name}: no horizontal page overflow`);
  assert.equal(value.dialogOverflow, false, `${name}: no horizontal battle overflow`);
  assert.ok(value.scale > 0.99 && value.scale < 1.01, `${name}: controls do not require browser page scaling`);
  assert.equal(value.idsUnique, true, `${name}: the three SVG rigs use distinct paint IDs`);
  assert.equal(value.controls.length, 8, `${name}: six actions plus pause and exit exist`);
  for (const control of value.controls) {
    assert.ok(control.width >= 44 && control.height >= 44, `${name}: ${control.action} is at least 44×44px, received ${control.width}×${control.height}`);
    assert.ok(control.x >= value.bounds.left - 1 && control.y >= value.bounds.top - 1 && control.right <= value.bounds.left + value.bounds.width + 1 && control.bottom <= value.bounds.top + value.bounds.height + 1,
      `${name}: ${control.action} is completely visible without battle scrolling: ${JSON.stringify(control)}`);
    assert.equal(control.hit, true, `${name}: ${control.action} can be reached directly by a finger`);
  }
  for (const [index, hero] of value.heroes.entries()) {
    assert.ok(hero.width >= 60 && hero.height >= 70, `${name}: hero ${index + 1} stays legible`);
    // SVG viewBoxes intentionally include transparent side padding. Validate
    // the painted fighter, rather than clipping its invisible wrapper. Landing
    // may enter from above; the horizontal silhouette must remain complete.
    const painted = value.paintedHeroes[index];
    assert.ok(painted.x >= value.arena.x - 2 && painted.right <= value.arena.right + 2,
      `${name}: hero ${index + 1} silhouette stays within the combat arena`);
  }
  const centers = value.heroes.map(box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 }));
  for (let i = 0; i < centers.length; i++) for (let j = i + 1; j < centers.length; j++) {
    assert.ok(Math.hypot(centers[i].x - centers[j].x, centers[i].y - centers[j].y) > value.arena.width * 0.06, `${name}: heroes ${i + 1} and ${j + 1} occupy distinct positions`);
  }
}
async function rays(page) {
  return page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    const arena = document.querySelector('.battle-arena').getBoundingClientRect();
    const target = new DOMPoint(180, 225).matrixTransform(document.querySelector('.monster-rig').getScreenCTM());
    resolve([
      ['galaxy', '.battle-arena > .hero-actor', '.battle-beam'],
      ['tiga', '.ally-actor', '.ally-beam'],
      ['zero', '.second-ally-actor', '.second-ally-beam'],
    ].map(([name, actor, ray]) => {
      const beam = document.querySelector(ray), style = getComputedStyle(beam);
      const hand = new DOMPoint(235, 213).matrixTransform(document.querySelector(`${actor} .hero-beam-flare`).getScreenCTM());
      const origin = { x: arena.x + parseFloat(style.left), y: arena.y + parseFloat(style.top) + beam.offsetHeight / 2 };
      const angle = parseFloat(style.getPropertyValue('--ray-angle')), length = parseFloat(style.width);
      return {
        name, active: beam.classList.contains('active'), pose: document.querySelector(actor).dataset.pose,
        originError: Math.hypot(origin.x - hand.x, origin.y - hand.y),
        targetError: Math.hypot(origin.x + length * Math.cos(angle) - target.x, origin.y + length * Math.sin(angle) - target.y),
      };
    }));
  })));
}
function assertRays(value, name) {
  for (const ray of value) {
    assert.equal(ray.active, true, `${name}: ${ray.name} fires simultaneously`);
    assert.equal(ray.pose, 'beam', `${name}: ${ray.name} performs the finishing pose`);
    assert.ok(ray.originError < 2, `${name}: ${ray.name} ray starts at its own wrist (${ray.originError.toFixed(2)}px)`);
    assert.ok(ray.targetError < 2, `${name}: ${ray.name} ray hits the monster (${ray.targetError.toFixed(2)}px)`);
  }
}
async function heroFeedbackAnchor(page, selector, label) {
  await page.locator(selector).last().waitFor({ state: 'visible' });
  const anchor = await page.evaluate(selector => {
    const number = [...document.querySelectorAll(selector)].at(-1).getBoundingClientRect();
    const head = document.querySelector('.battle-arena > .hero-actor .hero-head').getBoundingClientRect();
    const second = document.querySelector('.second-ally-actor .hero-head')?.getBoundingClientRect();
    const numberCenter = number.x + number.width / 2, heroCenter = head.x + head.width / 2;
    return { numberCenter, heroCenter, centerError: Math.abs(numberCenter - heroCenter), secondAllyCenter: second ? second.x + second.width / 2 : null };
  }, selector);
  // The number is anchored at event time; the main hero can subsequently
  // recoil or breathe a little. This tolerance still detects the old 24% lane,
  // which placed the player's loss/heal over Zero instead of the main hero.
  assert.ok(anchor.centerError < 12, `${label}: feedback starts above the main hero (${anchor.centerError.toFixed(2)}px from the head center)`);
  if (anchor.secondAllyCenter !== null) assert.ok(anchor.centerError < Math.abs(anchor.numberCenter - anchor.secondAllyCenter), `${label}: feedback belongs to the main hero, not Zero`);
  return anchor;
}

async function publicSetup(page, joint = false) {
  // This is explicitly a layout harness. Public combat actions/time stepping
  // accelerate the scene; real play and saving are tested separately below.
  return page.evaluate(joint => {
    const engine = window.ipadBattle.engine;
    if (!joint) {
      engine.act('punch'); engine.step(600); engine.act('punch');
      for (let i = 0; i < 50 && engine.snapshot().heroHp > 45; i++) {
        const state = engine.snapshot();
        engine.step((state.currentAttack?.strikesAt ?? state.nextAttackAt) - state.elapsed);
      }
      engine.drainEvents();
      const result = engine.act('summon');
      if (!result.ok) throw new Error(`Public summon setup failed: ${result.reason}`);
    } else {
      while (engine.snapshot().energy < 30) {
        engine.step(Math.max(600, engine.snapshot().cooldown));
        const result = engine.act('punch');
        if (!result.ok) throw new Error(`Public charge setup failed: ${result.reason}`);
      }
      engine.step(engine.snapshot().cooldown); engine.drainEvents();
      const result = engine.act('link');
      if (!result.ok) throw new Error(`Public joint setup failed: ${result.reason}`);
    }
    return engine.snapshot();
  }, joint);
}

async function layoutSuite(browser, name) {
  const context = await browser.newContext(settings({ width: 834, height: 1194 }));
  const page = await context.newPage(); watch(page);
  await page.route('**/ipad-layout-harness', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/characters.css"><link rel="stylesheet" href="/growth.css"><body style="margin:0;background:#071923;font-family:sans-serif"><button id="launch">出发</button></body></html>' }));
  try {
    await page.goto(`${base}/ipad-layout-harness`);
    const layouts = [];
    for (const viewport of cases) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: viewport.name === 'ipad-split-view' ? 'reduce' : 'no-preference' });
      await page.evaluate(async () => {
        const { openBattle } = await import('/battle.js');
        window.ipadResults = [];
        window.ipadBattle = openBattle({ monsterId: 'obsidian', difficulty: 'easy', onResult: result => window.ipadResults.push(result) });
      });
      await page.locator('[data-command="start"]').tap();
      await publicSetup(page);
      await page.waitForFunction(() => document.querySelector('.battle-arena').dataset.assist === 'active');
      const healingAnchor = await heroFeedbackAnchor(page, '.damage-number.hero.good', `${name}/${viewport.name}/arrival-heal`);
      const measured = await layout(page);
      assertLayout(measured, `${name}/${viewport.name}`);
      await page.waitForTimeout(1000); // Let both arrival animations land before the three finishing poses.
      await publicSetup(page, true);
      await page.waitForFunction(() => document.querySelector('.second-ally-beam')?.classList.contains('active'));
      const beams = await rays(page);
      assertRays(beams, `${name}/${viewport.name}`);
      await page.waitForTimeout(180); // Photograph the visible beam peak, not its transparent first frame.
      await page.screenshot({ path: new URL(`${name}-${viewport.name}-triple-beam.png`, output).pathname });
      layouts.push({ ...viewport, ...measured, rays: beams, healingAnchor });
      await page.locator('[data-action="defend"]').tap();
      assert.equal(await page.locator('.battle-arena > .hero-actor').getAttribute('data-pose'), 'defend', 'A live battle can immediately show X defense after a nonlethal joint strike');
      await page.locator('.battle-exit').tap();
      await page.locator('[data-command="close"]').tap();
      assert.equal(await page.evaluate(() => window.ipadResults.length), 1, 'Leaving the layout battle settles only once');
    }

    // Rotation preserves exactly the same in-memory battle. Pausing first
    // makes equality meaningful despite real browser frame timing.
    await page.setViewportSize({ width: 834, height: 1194 });
    await page.evaluate(async () => {
      const { openBattle } = await import('/battle.js');
      window.ipadResults = [];
      window.ipadBattle = openBattle({ monsterId: 'obsidian', difficulty: 'easy', onResult: result => window.ipadResults.push(result) });
    });
    await page.locator('[data-command="start"]').tap(); await publicSetup(page);
    await page.waitForFunction(() => document.querySelector('.battle-arena').dataset.assist === 'active');
    await page.locator('[data-command="pause"]').tap();
    const before = await page.evaluate(() => window.ipadBattle.engine.snapshot());
    await page.setViewportSize({ width: 1194, height: 834 });
    await page.waitForTimeout(180);
    const landscape = await page.evaluate(() => window.ipadBattle.engine.snapshot());
    assert.deepEqual(landscape, before, 'Rotating a paused battle does not reset HP, light energy, partners or time');
    await page.setViewportSize({ width: 834, height: 1050 });
    await page.waitForTimeout(180);
    assert.deepEqual(await page.evaluate(() => window.ipadBattle.engine.snapshot()), before, 'Changing browser-bar space also preserves the same battle');
    await page.locator('[data-command="resume"]').tap();
    await page.waitForTimeout(120);
    const resumed = await page.evaluate(() => window.ipadBattle.engine.snapshot());
    assert.ok(resumed.elapsed > before.elapsed, 'The same battle resumes after rotating');
    assert.equal(resumed.heroHp, before.heroHp);
    assert.equal(await page.evaluate(() => window.ipadResults.length), 0, 'Rotation cannot settle or duplicate rewards');

    const realHit = await page.evaluate(() => {
      const engine = window.ipadBattle.engine, before = engine.snapshot();
      engine.drainEvents();
      for (let i = 0; i < 10 && engine.snapshot().heroHp === before.heroHp; i++) {
        const state = engine.snapshot();
        engine.step(Math.max(1, (state.currentAttack?.strikesAt ?? state.nextAttackAt) - state.elapsed));
      }
      const after = engine.snapshot();
      if (after.heroHp >= before.heroHp || after.status !== 'active') throw new Error('Public time stepping did not produce an ordinary survivable hit');
      return { beforeHp: before.heroHp, afterHp: after.heroHp };
    });
    const damageAnchor = await heroFeedbackAnchor(page, '.damage-number.hero.hurt', `${name}/ordinary-hit`);

    // Headless browsers do not consistently mark another tab as foreground.
    // Send the actual visibilitychange event with a hidden visibility state;
    // this checks the app's Safari lifecycle handler, not a physical iPad tab.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.locator('.pause-overlay:not([hidden])').waitFor();
    const hidden = await page.evaluate(() => window.ipadBattle.engine.snapshot());
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(() => window.ipadBattle.engine.snapshot()), hidden, 'Visibility loss freezes both ally schedules and enemy time');
    await page.evaluate(() => { delete document.visibilityState; delete document.hidden; });
    await page.locator('[data-command="resume"]').tap();
    await page.locator('.battle-exit').tap(); await page.locator('[data-command="close"]').tap();
    assert.equal(await page.evaluate(() => window.ipadResults.length), 1);

    // A lethal three-way finisher must remain a three-way finishing pose until
    // the visual strike completes, even though rewards settle immediately.
    await page.evaluate(async () => {
      const { openBattle } = await import('/battle.js');
      window.ipadResults = [];
      window.ipadBattle = openBattle({ monsterId: 'obsidian', difficulty: 'easy', onResult: result => window.ipadResults.push(result) });
    });
    await page.locator('[data-command="start"]').tap(); await publicSetup(page);
    await page.waitForFunction(() => document.querySelector('.battle-arena').dataset.assist === 'active');
    await page.waitForTimeout(1000);
    const lethal = await page.evaluate(() => {
      const engine = window.ipadBattle.engine;
      for (let i = 0; i < 12 && (engine.snapshot().energy < 30 || engine.snapshot().monsterHp > 84); i++) {
        engine.step(Math.max(600, engine.snapshot().cooldown));
        const action = engine.act('punch');
        if (!action.ok) throw new Error(`Public lethal charge failed: ${action.reason}`);
      }
      engine.step(engine.snapshot().cooldown);
      const before = engine.snapshot();
      if (before.monsterHp <= 0 || before.monsterHp > 84) throw new Error('Lethal beam setup did not reach a live target at <=84 HP');
      engine.drainEvents();
      const action = engine.act('link');
      if (!action.ok) throw new Error(`Public lethal link failed: ${action.reason}`);
      return { beforeHp: before.monsterHp, after: engine.snapshot(), results: window.ipadResults.length };
    });
    assert.equal(lethal.after.result.outcome, 'win');
    assert.equal(lethal.results, 1, 'Victory settles immediately, before the finishing animation ends');
    await page.waitForFunction(() => document.querySelector('.second-ally-beam')?.classList.contains('active'));
    assertRays(await rays(page), `${name}/lethal-three-way-finisher`);
    assert.equal(await page.locator('.result-overlay').isVisible(), false, 'The result panel does not cover the lethal finishing move');
    await page.waitForTimeout(220);
    assert.equal(await page.locator('.battle-arena > .hero-actor').getAttribute('data-pose'), 'beam');
    assert.equal(await page.locator('.ally-actor').getAttribute('data-pose'), 'beam');
    assert.equal(await page.locator('.second-ally-actor').getAttribute('data-pose'), 'beam');
    await page.screenshot({ path: new URL(`${name}-lethal-triple-beam.png`, output).pathname });
    await page.locator('.result-overlay:not([hidden])').waitFor();
    assert.equal(await page.locator('.battle-arena > .hero-actor').getAttribute('data-pose'), 'victory');
    assert.equal(await page.locator('.ally-actor').getAttribute('data-pose'), 'victory');
    assert.equal(await page.locator('.second-ally-actor').getAttribute('data-pose'), 'victory');
    assert.equal(await page.evaluate(() => window.ipadResults.length), 1, 'Completing the animation cannot award victory twice');
    await page.locator('[data-command="close"]').tap();
    results.push({ browser: name, evidence: 'touch viewport layout harness with public combat actions and accelerated engine time', layouts, rotation: 'preserved', visibilityHandler: 'paused and frozen', damageFeedback: { ...realHit, ...damageAnchor }, lethalFinisher: { enemyHp: lethal.beforeHp, settledImmediately: true, threeBeamPosesBeforeVictory: true } });
  } catch (error) {
    await page.screenshot({ path: new URL(`${name}-layout-failure.png`, output).pathname, fullPage: true }).catch(() => {});
    throw error;
  } finally { await context.close(); }
}

async function realTouchSuite(browser, name) {
  const context = await browser.newContext(settings({ width: 1194, height: 834 }));
  const page = await context.newPage(); watch(page);
  const state = () => page.evaluate(() => {
    const arena = document.querySelector('.battle-arena');
    const enabled = action => { const button = document.querySelector(`[data-action="${action}"]`); return Boolean(button && !button.disabled); };
    return {
      phase: arena.dataset.phase, assist: arena.dataset.assist, paused: arena.classList.contains('is-paused'),
      heroHp: parseInt(document.querySelector('.hero-health-number').textContent, 10),
      monsterHp: parseInt(document.querySelector('.monster-health-number').textContent, 10),
      energy: Number(document.querySelector('.energy-number').textContent),
      warning: parseFloat(document.querySelector('.warning-time').textContent),
      clock: document.querySelector('.battle-clock').textContent,
      punch: enabled('punch'), beam: enabled('beam'), defend: enabled('defend'), summon: enabled('summon'), link: enabled('link'),
    };
  });
  const until = async (predicate, timeout = 10000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const value = await state();
      if (predicate(value)) return value;
      assert.notEqual(value.phase, 'ended', 'Touch battle ended before the intended action');
      if (value.paused) await page.locator('[data-command="resume"]').tap();
      await page.waitForTimeout(50);
    }
    assert.fail('Touch battle did not reach the intended condition in time');
  };
  let code;
  const saved = async () => {
    const response = await fetch(`${base}/api/v1/save`, { headers: { Authorization: `Bearer ${code}` } });
    assert.equal(response.status, 200); return response.json();
  };
  try {
    await page.goto(base); await ready(page); await synced(page);
    code = await page.evaluate(() => JSON.parse(localStorage.getItem('aoteman-cloud-v1')).recoveryCode);
    const initial = await saved();
    // Home can scroll naturally. Each care action must remain a large,
    // reachable touch target in landscape and portrait.
    const home = [];
    for (const viewport of cases.slice(0, 2)) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const selector of ['#petBtn', '#feedBtn', '#trainBtn', '#restBtn', '#defendBtn', '#fightBtn', '#settingsBtn']) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        const box = await page.locator(selector).boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, `${name}/${viewport.name}: ${selector} is at least a 44px touch target`);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      home.push(viewport.name);
    }
    await page.locator('#feedBtn').tap();
    await page.waitForFunction(() => document.querySelector('#petHero').dataset.pose === 'eat');
    await ready(page); await synced(page);
    assert.equal((await saved()).state.fed, initial.state.fed + 1, 'A real finger tap feeds and saves once');
    await page.locator('#trainBtn').tap();
    await page.waitForFunction(() => document.querySelector('#petHero').dataset.pose === 'train');
    await page.locator('.growth-reaction[data-kind="earned"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#petHero').getAttribute('data-pose'), 'salute', 'The trained hero visibly responds with a salute on iPad');
    assert.equal(await page.locator('.growth-reaction-xp').textContent(), '+20 XP');
    await ready(page); await synced(page);
    assert.equal((await saved()).state.training, initial.state.training + 1);
    await page.locator('#petBtn').tap();
    await page.waitForFunction(() => document.querySelector('.growth-reaction').hidden);
    assert.match(await page.locator('#petHero').getAttribute('data-pose'), /wave|nod/, 'A finger tap can immediately interrupt the growth overlay with a new response');
    await ready(page); await synced(page);
    await page.selectOption('#monsterSelect', 'obsidian');
    await page.selectOption('#difficultySelect', 'easy');
    await synced(page);
    const beforeBattle = await saved();
    await page.locator('#fightBtn').tap(); await page.locator('[data-command="start"]').tap();
    assert.equal((await state()).summon, false);
    await page.locator('[data-action="punch"]').tap();
    const first = await state();
    // Two immediate physical taps at the same coordinate must not bypass the
    // disabled/cooldown gate. Locator.tap() would wait for re-enablement.
    const punch = await page.locator('[data-action="punch"]').boundingBox();
    await page.touchscreen.tap(punch.x + punch.width / 2, punch.y + punch.height / 2);
    await page.touchscreen.tap(punch.x + punch.width / 2, punch.y + punch.height / 2);
    const repeated = await state();
    assert.equal(repeated.energy, first.energy);
    assert.equal(repeated.monsterHp, first.monsterHp, 'Rapid finger taps cannot produce duplicate cooldown attacks');
    await until(value => value.punch); await page.locator('[data-action="punch"]').tap();
    const critical = await until(value => value.summon, 75000);
    assert.ok(critical.heroHp > 0 && critical.heroHp <= 45);
    await until(value => value.phase === 'warning');
    const beforeSummon = await state();
    await page.locator('[data-action="summon"]').tap();
    const rescued = await state();
    assert.equal(rescued.heroHp, beforeSummon.heroHp + 38);
    assert.equal(rescued.energy, 0); assert.equal(rescued.assist, 'active');
    assert.equal(await page.locator('.ally-actor svg').count(), 1);
    assert.equal(await page.locator('.second-ally-actor svg').count(), 1);
    assertLayout(await layout(page), `${name}/real-touch-trio`);
    const allyHit = await until(value => value.monsterHp < rescued.monsterHp);
    const secondHit = await until(value => value.monsterHp < allyHit.monsterHp);
    assert.equal(allyHit.monsterHp, rescued.monsterHp - 12);
    assert.equal(secondHit.monsterHp, allyHit.monsterHp - 14);
    while (!(await state()).link) {
      await until(value => value.punch || value.link);
      if (!(await state()).link) await page.locator('[data-action="punch"]').tap();
    }
    const beforeLink = await state();
    assert.ok(beforeLink.monsterHp > 84, 'The touch finishing move is visible before victory');
    await page.locator('[data-action="link"]').tap();
    const linked = await state();
    assert.equal(linked.energy, beforeLink.energy - 30);
    assert.ok(linked.monsterHp <= beforeLink.monsterHp - 84);
    assertRays(await rays(page), `${name}/real-touch-joint`);
    await page.waitForTimeout(170);
    await page.screenshot({ path: new URL(`${name}-real-touch-trio.png`, output).pathname });
    await page.locator('[data-command="pause"]').tap();
    const paused = await state();
    await page.setViewportSize({ width: 834, height: 1194 });
    await page.waitForTimeout(160);
    const rotated = await state();
    assert.equal(rotated.heroHp, paused.heroHp); assert.equal(rotated.monsterHp, paused.monsterHp);
    assert.equal(rotated.energy, paused.energy); assert.equal(rotated.clock, paused.clock);
    await page.locator('[data-command="resume"]').tap();
    assertLayout(await layout(page), `${name}/real-touch-rotated`);
    const deadline = Date.now() + 40000;
    while (Date.now() < deadline) {
      const value = await state();
      if (value.phase === 'ended') break;
      if (value.paused) await page.locator('[data-command="resume"]').tap();
      else if (value.phase === 'warning' && value.warning <= 0.7) {
        if (value.defend) await page.locator('[data-action="defend"]').tap();
      } else if (value.beam) await page.locator('[data-action="beam"]').tap();
      else if (value.punch) await page.locator('[data-action="punch"]').tap();
      await page.waitForTimeout(50);
    }
    await page.locator('.result-overlay:not([hidden])').waitFor({ timeout: 5000 });
    assert.match(await page.locator('.result-overlay h3').textContent(), /城市已被守护/);
    await synced(page);
    const reward = await saved();
    assert.equal(reward.state.xp, beforeBattle.state.xp + 40);
    assert.equal(reward.state.stars, beforeBattle.state.stars + 20);
    assert.equal(reward.state.wins, beforeBattle.state.wins + 1);
    assert.equal(reward.state.daily.battles, beforeBattle.state.daily.battles + 1);
    await page.reload(); await ready(page); await synced(page);
    const afterReload = await saved();
    for (const key of ['xp', 'stars', 'wins']) assert.equal(afterReload.state[key], reward.state[key], `Refresh keeps ${key} without duplicate rewards`);
    assert.equal(afterReload.state.daily.battles, reward.state.daily.battles);
    results.push({ browser: name, evidence: 'real touch controls, no combat state injection, isolated SQLite save', home, critical, rescued, allyHit, secondHit, beforeLink, linked, rotation: 'preserved', savedBeforeClosing: true, rewardAfterReload: { xp: afterReload.state.xp, stars: afterReload.state.stars, wins: afterReload.state.wins } });
  } catch (error) {
    await page.screenshot({ path: new URL(`${name}-touch-failure.png`, output).pathname, fullPage: true }).catch(() => {});
    throw error;
  } finally { await context.close(); }
}

const health = await fetch(`${base}/api/healthz`);
assert.equal(health.status, 200);
assert.equal((await health.json()).storage, 'sqlite');
for (const name of selected) {
  const type = { chromium, webkit }[name];
  assert.ok(type, `Unsupported browser selection: ${name}`);
  const browser = await type.launch({ headless: true });
  try {
    if (process.env.IPAD_REAL_ONLY !== '1') await layoutSuite(browser, name);
    if (process.env.IPAD_LAYOUT_ONLY !== '1' && (name === 'webkit' || !selected.includes('webkit'))) await realTouchSuite(browser, name);
  } finally { await browser.close(); }
}
assert.deepEqual(errors, [], 'iPad touch layouts and combat have no browser exceptions');
const verificationFile = process.env.IPAD_LAYOUT_ONLY === '1' ? 'verification-layout.json' : process.env.IPAD_REAL_ONLY === '1' ? 'verification-touch.json' : 'verification.json';
await writeFile(new URL(verificationFile, output), JSON.stringify({
  result: 'pass', testedAt: new Date().toISOString(),
  scope: 'macOS Playwright WebKit/Chromium with iPad-sized touch viewports; not physical iPad or Mobile Safari hardware validation',
  results,
}, null, 2));
console.log(`PASS: ${selected.join(' + ')} touch browser checks. ${results.some(result => result.layouts) ? 'Portrait/landscape/browser bars/split view/phones: all six controls visible and 44px; three distinct heroes and wrist-aligned rays; rotation and visibility pause. ' : ''}${results.some(result => result.savedBeforeClosing) ? 'Real finger-tap care and three-hero victory saved once in isolated SQLite and preserved after reload. ' : 'Real save/physical-play flow was not selected in this run. '}Physical iPad validation remains separate.`);
