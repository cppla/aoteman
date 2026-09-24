import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState } from '../public/pet-state.js';

const require = createRequire(import.meta.url);
const { chromium, webkit } = require('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8789';
const origin = new URL(base).origin;
// This creates synthetic saves. Reject the live server and the previous local
// production port; use the native, temporary SQLite development server only.
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname), 'Ginga QA must use a loopback test server');
assert.notEqual(new URL(base).port, '8787', 'Do not create QA saves in the playable deployment');
const selected = (process.env.GINGA_BROWSERS || 'chromium,webkit').split(',');
const output = new URL('../test-results/ginga/', import.meta.url);
await mkdir(output, { recursive: true });
const results = [], errors = [], outsideRequests = [];
const scrub = value => String(value).replace(/gxy_[a-f0-9]{64}/g, '[redacted]');
const ready = page => page.waitForFunction(() => document.querySelector('#feedBtn')?.disabled === false);
const synced = page => page.locator('#saveStatus[data-status="synced"]').waitFor({ state: 'attached', timeout: 20000 });
const viewports = [
  { name: 'ipad-portrait', width: 834, height: 1194 },
  { name: 'ipad-landscape', width: 1194, height: 834 },
  { name: 'ipad-landscape-safari-bars', width: 1194, height: 750 },
];
const documentHead = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/characters.css"><link rel="stylesheet" href="/ginga-character.css"><link rel="stylesheet" href="/growth-reactions.css">';
function watch(page) {
  page.on('pageerror', error => errors.push(scrub(error.message)));
  page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) outsideRequests.push(request.url()); });
}
async function identity(page, selector) {
  return page.evaluate(async selector => {
    const actor = document.querySelector(selector);
    const images = [...actor.querySelectorAll('image')].map(image => image.getAttribute('href') || image.getAttribute('xlink:href'));
    const png = images.find(url => url?.includes('/assets/ginga/ginga-official.png'));
    if (!png) return { images, png: null };
    const loaded = new Image(); loaded.src = new URL(png, location.href).href; await loaded.decode();
    const head = actor.querySelector('.hero-head-anchor') || actor.querySelector('.hero-head');
    const headBox = head.getBoundingClientRect(), artBox = actor.querySelector('.hero-art').getBoundingClientRect();
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
    return { images, png, width: loaded.naturalWidth, height: loaded.naturalHeight,
      headRatio: headBox.height / artBox.height, headWidthRatio: headBox.width / artBox.width,
      uniqueIds: ids.length === new Set(ids).size,
      ariaLabel: actor.querySelector('.hero-art').getAttribute('aria-label'),
    };
  }, selector);
}
function assertIdentity(value, label) {
  assert.ok(value.png, `${label}: uses the television suit image instead of the old illustrated hero`);
  assert.equal(value.width, 403, `${label}: real source image decoded`);
  assert.equal(value.height, 948, `${label}: full-height source image decoded`);
  assert.ok(value.images.every(url => new URL(url, base).origin === origin), `${label}: character art is self-hosted`);
  assert.ok(value.headRatio > .045 && value.headRatio < .23, `${label}: head has adult proportions, received ${value.headRatio}`);
  assert.ok(value.headWidthRatio < .36, `${label}: main hero no longer has the oversized cartoon face`);
  assert.equal(value.uniqueIds, true, `${label}: all paint and clipping IDs are distinct`);
}
async function armVisibility(page, selector) {
  return page.evaluate(selector => {
    const actor = document.querySelector(selector);
    const visible = className => {
      let element = actor.querySelector(className), opacity = 1;
      if (!element) return false;
      while (element && element !== actor) {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        opacity *= Number(style.opacity); element = element.parentElement;
      }
      return opacity > .02;
    };
    return { neutral: visible('.hero-neutral-arms'), defense: visible('.hero-defense-arms'), beam: visible('.hero-beam-arms') };
  }, selector);
}
async function feedbackAnchor(page, label) {
  const number = page.locator('.damage-number.hero.good').last();
  await number.waitFor({ state: 'visible' });
  const value = await page.evaluate(() => {
    const hero = document.querySelector('.battle-arena > .hero-actor');
    const head = (hero.querySelector('.hero-head-anchor') || hero.querySelector('.hero-head')).getBoundingClientRect();
    const text = [...document.querySelectorAll('.damage-number.hero.good')].at(-1).getBoundingClientRect();
    return { horizontalError: Math.abs(text.x + text.width / 2 - head.x - head.width / 2), bottomFromHeadTop: text.bottom - head.y };
  });
  assert.ok(value.horizontalError < 12, `${label}: healing text follows the actual photograph's head (${value.horizontalError.toFixed(2)}px)`);
  assert.ok(value.bottomFromHeadTop < 24, `${label}: healing text appears above the face, not over the torso (bottom is ${value.bottomFromHeadTop.toFixed(2)}px from head top)`);
  return value;
}
async function contactSheet(page, name) {
  await page.route('**/ginga-pose-harness', route => route.fulfill({ contentType: 'text/html', body: `${documentHead}<body style="margin:0;background:#102735;color:#edf8ff;font-family:sans-serif"><main id="poses" style="padding:32px"><h1 style="font-size:24px">银河奥特曼 · 真人皮套动作检查</h1><p>渲染验收联系表：固定动画时间供人工检查；非战斗录像。</p><section style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px"></section></main></body></html>` }));
  await page.goto(`${base}/ginga-pose-harness`);
  await page.setViewportSize({ width: 1440, height: 1140 });
  await page.evaluate(async () => {
    const { heroSVG } = await import('/characters.js');
    const poses = ['idle', 'defend', 'beam', 'punch', 'salute', 'levelup'];
    document.querySelector('section').innerHTML = poses.map(pose => `<article style="border:1px solid #42606c;border-radius:18px;background:#173845;text-align:center;overflow:hidden"><h2 style="font-size:18px">${pose}</h2><div ${pose === 'salute' ? 'id="petHero"' : ''} class="actor hero-actor pose-${pose}" data-pose="${pose}" style="position:relative;width:300px;height:390px;margin:auto">${heroSVG(`contact-${pose}`)}</div></article>`).join('');
    // Home growth selectors use #petHero. Keep IDs unique while giving each
    // pose its own render check in a separate, scoped stylesheet rule below.
    const style = document.createElement('style');
    style.textContent = ['growth-reactions.css', 'ginga-character.css'].map(file => {
      const sheet = [...document.styleSheets].find(sheet => sheet.href?.endsWith(`/${file}`));
      return [...sheet.cssRules].filter(rule => rule.selectorText?.includes('#petHero')).map(rule => rule.cssText.replaceAll('#petHero', '.pose-levelup')).join('\n');
    }).join('\n');
    document.head.append(style);
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(resolve));
    for (const animation of document.getAnimations()) {
      animation.pause();
      const duration = Number(animation.effect.getTiming().duration);
      animation.currentTime = duration >= 2000 ? duration * .43 : duration * .48;
    }
  });
  await page.screenshot({ path: new URL(`${name}-pose-contact-sheet.png`, output).pathname, fullPage: true });
  const values = [];
  for (const pose of ['idle', 'defend', 'beam', 'punch', 'salute', 'levelup']) {
    const figure = await identity(page, `.pose-${pose}`); assertIdentity(figure, `${name}/${pose}`);
    const arms = await armVisibility(page, `.pose-${pose}`);
    if (pose === 'defend') assert.deepEqual(arms, { neutral: false, defense: true, beam: false }, `${name}: X guard has only crossed arms`);
    if (pose === 'beam') assert.deepEqual(arms, { neutral: false, defense: false, beam: true }, `${name}: beam pose hides relaxed arms`);
    values.push({ pose, identity: figure, arms });
  }
  return values;
}
async function homeGrowth(browser, name) {
  const context = await browser.newContext({ viewport: { width: 834, height: 1194 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await context.addInitScript(raw => {
    if (!localStorage.getItem('aoteman-cloud-v1')) localStorage.setItem('ginga-pet-v1', raw);
  }, JSON.stringify({ ...freshState(), xp: 70 }));
  const page = await context.newPage(); watch(page);
  try {
    await page.goto(base); await ready(page); await synced(page);
    const home = await identity(page, '#petHero'); assertIdentity(home, `${name}/home`);
    await page.screenshot({ path: new URL(`${name}-ipad-home.png`, output).pathname, fullPage: true });
    if (name === 'chromium') await page.locator('#habitat').screenshot({ path: new URL('ginga-realistic.png', output).pathname });
    await page.locator('#trainBtn').tap();
    await page.locator('.growth-reaction[data-kind="levelup"]:not([hidden])').waitFor();
    assert.equal(await page.locator('#petHero').getAttribute('data-pose'), 'levelup');
    await page.waitForTimeout(750);
    const raised = await page.locator('#petHero .hero-right-arm').evaluate(element => ({ transform: getComputedStyle(element).transform, animation: getComputedStyle(element).animationName }));
    assert.notEqual(raised.transform, 'none', `${name}: leveling moves the real suit arm`);
    assert.notEqual(raised.transform, 'matrix(1, 0, 0, 1, 0, 0)', `${name}: leveling arm is visibly raised`);
    await page.locator('#habitat').screenshot({ path: new URL(`${name}-levelup.png`, output).pathname });
    await synced(page);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('aoteman-pet-v2')).xp), 90);
    await page.locator('#trainBtn').tap();
    await page.locator('.growth-reaction[data-kind="earned"]:not([hidden])').waitFor();
    assert.equal(await page.locator('#petHero').getAttribute('data-pose'), 'salute');
    await page.waitForTimeout(650);
    await page.locator('#habitat').screenshot({ path: new URL(`${name}-salute.png`, output).pathname });
    await synced(page);
    const earned = await page.evaluate(() => JSON.parse(localStorage.getItem('aoteman-pet-v2')).xp);
    assert.equal(earned, 110);
    await page.reload(); await ready(page); await synced(page);
    assert.equal(await page.locator('.growth-reaction:not([hidden])').count(), 0, `${name}: changing the character does not replay growth rewards`);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('aoteman-pet-v2')).xp), earned);
    return { home, raised, xpAfterReload: earned };
  } catch (error) {
    await page.screenshot({ path: new URL(`${name}-home-failure.png`, output).pathname, fullPage: true }).catch(() => {}); throw error;
  } finally { await context.close(); }
}
async function trioLayouts(browser, name) {
  const context = await browser.newContext({ viewport: { width: 834, height: 1194 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage(); watch(page); const values = [];
  await page.route('**/ginga-battle-harness', route => route.fulfill({ contentType: 'text/html', body: `${documentHead}<body style="margin:0;background:#071923;font-family:sans-serif"><button>出发</button></body></html>` }));
  try {
    await page.goto(`${base}/ginga-battle-harness`);
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.evaluate(async () => {
        const { openBattle } = await import('/battle.js');
        window.gingaBattle = openBattle({ monsterId: 'obsidian', difficulty: 'easy' });
      });
      await page.locator('[data-command="start"]').tap();
      // Layout harness only: public commands/time steps accelerate a rescue.
      // No state edits, persistence hooks, or server save writes are involved.
      await page.evaluate(() => {
        const engine = window.gingaBattle.engine;
        engine.act('punch'); engine.step(600); engine.act('punch');
        for (let i = 0; i < 50 && engine.snapshot().heroHp > 45; i++) {
          const state = engine.snapshot(); engine.step((state.currentAttack?.strikesAt ?? state.nextAttackAt) - state.elapsed);
        }
        engine.drainEvents();
        const summon = engine.act('summon'); if (!summon.ok) throw new Error(summon.reason);
      });
      await page.waitForFunction(() => document.querySelector('.battle-arena').dataset.assist === 'active');
      const healing = await feedbackAnchor(page, `${name}/${viewport.name}`);
      if (viewport.height === 750) await page.screenshot({ path: new URL(`${name}-${viewport.name}-rescue.png`, output).pathname });
      const hero = await identity(page, '.battle-arena > .hero-actor'); assertIdentity(hero, `${name}/${viewport.name}`);
      const controls = await page.evaluate(() => [...document.querySelectorAll('.battle-action, .battle-toolbar button')].map(button => {
        const box = button.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return { action: button.dataset.action || button.dataset.command, x: box.x, y: box.y, width: box.width, height: box.height,
          inView: box.x >= -1 && box.y >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1, reachable: hit === button || button.contains(hit) };
      }));
      assert.equal(controls.length, 8);
      for (const button of controls) {
        assert.equal(button.inView, true, `${name}/${viewport.name}: ${button.action} is visible without scrolling`);
        assert.equal(button.reachable, true, `${name}/${viewport.name}: ${button.action} is reachable`);
        assert.ok(button.width >= 44 && button.height >= 44, `${name}/${viewport.name}: ${button.action} has a 44px touch target`);
      }
      await page.waitForTimeout(1000);
      await page.evaluate(() => {
        const engine = window.gingaBattle.engine;
        for (let i = 0; i < 12 && engine.snapshot().energy < 30; i++) {
          engine.step(Math.max(600, engine.snapshot().cooldown));
          const result = engine.act('punch'); if (!result.ok) throw new Error(result.reason);
        }
        engine.step(engine.snapshot().cooldown); engine.drainEvents();
        const result = engine.act('link'); if (!result.ok) throw new Error(result.reason);
      });
      await page.waitForFunction(() => document.querySelector('.second-ally-beam').classList.contains('active'));
      await page.waitForTimeout(160);
      // Freeze this render-harness frame through the public pause API before
      // measuring CSS/SVG geometry. WebKit can sample the animated wrist and
      // the preceding ray layout one compositor frame apart while moving.
      await page.evaluate(() => window.gingaBattle.engine.setPaused(true));
      await page.waitForFunction(() => document.querySelector('.battle-arena').classList.contains('is-paused'));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const headClearance = await page.evaluate(() => {
        const head = document.querySelector('.battle-arena > .hero-actor .hero-head-anchor').getBoundingClientRect();
        const warning = document.querySelector('.battle-warning').getBoundingClientRect();
        return { overlapWidth: Math.max(0, Math.min(head.right, warning.right) - Math.max(head.left, warning.left)), overlapHeight: Math.max(0, Math.min(head.bottom, warning.bottom) - Math.max(head.top, warning.top)) };
      });
      assert.ok(headClearance.overlapWidth < 1 || headClearance.overlapHeight < 1, `${name}/${viewport.name}: attack warning does not cover the real hero's head`);
      const rays = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
        const arena = document.querySelector('.battle-arena').getBoundingClientRect();
        const target = new DOMPoint(180, 225).matrixTransform(document.querySelector('.monster-rig').getScreenCTM());
        resolve([
          ['ginga', '.battle-arena > .hero-actor', '.battle-beam'],
          ['tiga', '.ally-actor', '.ally-beam'],
          ['zero', '.second-ally-actor', '.second-ally-beam'],
        ].map(([hero, actorSelector, beamSelector]) => {
          const actor = document.querySelector(actorSelector), beam = document.querySelector(beamSelector), style = getComputedStyle(beam);
          const hand = new DOMPoint(235, 213).matrixTransform(actor.querySelector('.hero-beam-flare').getScreenCTM());
          const x = arena.x + parseFloat(style.left), y = arena.y + parseFloat(style.top) + beam.offsetHeight / 2;
          const angle = parseFloat(style.getPropertyValue('--ray-angle')), length = parseFloat(style.width);
          return { hero, pose: actor.dataset.pose, active: beam.classList.contains('active'), originError: Math.hypot(x - hand.x, y - hand.y), targetError: Math.hypot(x + length * Math.cos(angle) - target.x, y + length * Math.sin(angle) - target.y) };
        }));
      })));
      for (const ray of rays) {
        assert.equal(ray.pose, 'beam'); assert.equal(ray.active, true);
        assert.ok(ray.originError < 2, `${name}/${viewport.name}: ${ray.hero} beam comes from its wrist (${ray.originError}px)`);
        assert.ok(ray.targetError < 2, `${name}/${viewport.name}: ${ray.hero} beam converges on the monster (${ray.targetError}px)`);
      }
      assert.deepEqual(await armVisibility(page, '.battle-arena > .hero-actor'), { neutral: false, defense: false, beam: true });
      // This is a frozen art-review frame. Hide only the pause sheet during
      // capture so the source images and poses remain visible for inspection.
      await page.screenshot({ path: new URL(`${name}-${viewport.name}-triple-beam.png`, output).pathname, style: '.pause-overlay { visibility:hidden !important; }' });
      await page.evaluate(() => window.gingaBattle.close());
      values.push({ ...viewport, hero, controls, rays, healing, headClearance });
    }
    return values;
  } catch (error) {
    await page.screenshot({ path: new URL(`${name}-battle-failure.png`, output).pathname, fullPage: true }).catch(() => {}); throw error;
  } finally { await context.close(); }
}

assert.equal((await fetch(`${base}/api/healthz`)).status, 200, 'Native test server is running');
for (const name of selected) {
  const browserType = { chromium, webkit }[name]; assert.ok(browserType, `Unknown browser ${name}`);
  const browser = await browserType.launch({ headless: true });
  try {
    const context = await browser.newContext(); const page = await context.newPage(); watch(page);
    const poses = await contactSheet(page, name); await context.close();
    const home = await homeGrowth(browser, name);
    const layouts = await trioLayouts(browser, name);
    results.push({ browser: name, poses, home, layouts });
    console.log(`PASS ${name}: real suit image, six render poses, touch growth and reload, three iPad battle viewports, all three wrist-aligned beams.`);
  } finally { await browser.close(); }
}
assert.deepEqual(errors, [], 'No browser exceptions');
assert.deepEqual(outsideRequests, [], 'No external requests are required to render the hero');
await writeFile(new URL('verification.json', output), JSON.stringify({ result: 'pass', testedAt: new Date().toISOString(), method: 'Native temporary SQLite server; real touch growth actions; public engine act/step/setPaused for frozen combat render harness; Chromium and WebKit device emulation, not physical iPad hardware.', results, errors, outsideRequests }, null, 2));
