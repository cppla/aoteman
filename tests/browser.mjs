import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { freshState } from '../public/pet-state.js';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://localhost:8787';
const output = new URL('../test-results/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const contexts = [];
const stateOf = page => page.evaluate(() => JSON.parse(localStorage.getItem('aoteman-pet-v2')));
const ready = page => page.waitForFunction(() => !document.getElementById('feedBtn').disabled);
async function setup(options = {}, saved) {
  const context = await browser.newContext(options); contexts.push(context);
  if (saved) await context.addInitScript(value => localStorage.setItem('aoteman-pet-v2', JSON.stringify(value)), saved);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(base); await page.locator('#petHero svg').waitFor();
  return { context, page };
}
try {
  const { context, page } = await setup({ viewport: { width: 1440, height: 1000 } });
  assert.match(await page.title(), /银河小伙伴/);
  await page.screenshot({ path: new URL('base-desktop.png', output).pathname, fullPage: true });
  await page.click('#feedBtn'); await ready(page);
  assert.equal((await stateOf(page)).fed, 1);
  assert.equal(Math.round((await stateOf(page)).food), 97);
  await page.click('#trainBtn'); await ready(page);
  assert.equal((await stateOf(page)).xp, 20); assert.equal((await stateOf(page)).training, 1);
  await page.click('#restBtn'); assert.equal((await stateOf(page)).sleeping, true);
  assert.equal(await page.locator('#feedBtn').isDisabled(), true);
  const energy = (await stateOf(page)).energy;
  await page.waitForFunction(before => JSON.parse(localStorage.getItem('aoteman-pet-v2')).energy > before + 6, energy, { timeout: 7000 });
  await page.click('#restBtn'); await ready(page);
  await page.click('#defendBtn');
  assert.equal(await page.locator('#petHero').getAttribute('data-pose'), 'defend');
  await page.waitForTimeout(450);
  await page.screenshot({ path: new URL('x-defense-desktop.png', output).pathname, fullPage: true });
  await ready(page);
  await page.click('#transformBtn'); await ready(page);
  assert.equal(await page.locator('#transformBtn').getAttribute('aria-pressed'), 'true');
  await page.reload(); await ready(page); assert.equal((await stateOf(page)).grown, true); assert.equal((await stateOf(page)).xp, 20);
  // Actual export/import flow including a review step before replacement.
  await page.click('#settingsBtn');
  const downloadPromise = page.waitForEvent('download'); await page.click('#exportBtn');
  const download = await downloadPromise;
  const exportPath = new URL('exported-save.json', output).pathname; await download.saveAs(exportPath);
  assert.equal(JSON.parse(await readFile(exportPath, 'utf8')).xp, 20);
  const imported = { ...freshState(), food: 90, xp: 200, stars: 100, wins: 3, training: 6 };
  const importPath = new URL('import-save.json', output).pathname; await writeFile(importPath, JSON.stringify(imported));
  await page.locator('#importFile').setInputFiles(importPath); await page.locator('#confirmImport').waitFor();
  assert.equal((await stateOf(page)).xp, 20);
  await page.click('#confirmImport'); assert.equal((await stateOf(page)).xp, 200);
  await page.click('#sceneBtn'); await page.click('[data-scene-choice="moon"]');
  assert.equal((await stateOf(page)).scene, 'moon'); assert.equal((await stateOf(page)).stars, 70);
  await page.click('[data-scene-choice="moon"]'); assert.equal((await stateOf(page)).stars, 70);
  await page.click('#closeDialog');
  await page.click('#journalNav'); assert.ok(await page.locator('.achievement.unlocked').count() >= 2); await page.click('#closeDialog');
  await page.click('#archiveNav'); assert.equal(await page.locator('.monster-card').count(), 3); await page.click('#closeDialog');
  // A second tab must see new progress, never overwrite it with its old copy.
  const second = await context.newPage(); second.on('pageerror', error => errors.push(error.message));
  await second.goto(base); await ready(second); await second.click('#trainBtn'); await ready(second);
  await page.bringToFront(); await page.waitForFunction(() => JSON.parse(localStorage.getItem('aoteman-pet-v2')).xp === 220);
  await page.waitForTimeout(3300); assert.equal((await stateOf(page)).xp, 220);
  assert.match(await page.locator('#xpText').textContent(), /40 \/ 120/);
  await second.close();
  // Corrupt imports cannot replace current state.
  await page.click('#settingsBtn');
  await page.locator('#importFile').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') });
  await page.waitForFunction(() => document.getElementById('importFeedback').textContent.includes('不是有效'));
  assert.equal((await stateOf(page)).xp, 220); await page.click('#closeDialog');
  // Native mobile navigation and all dialogs remain reachable without overflow.
  for (const width of [375, 430, 768]) {
    const { page: mobile } = await setup({ viewport: { width, height: 844 }, isMobile: width < 768, hasTouch: true });
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `home overflow at ${width}`);
    assert.equal(await mobile.locator('#archiveNav').isVisible(), true);
    await mobile.click('#archiveNav');
    assert.equal(await mobile.locator('.monster-card').count(), 3);
    assert.equal(await mobile.evaluate(() => { const d = document.querySelector('#infoDialog'); return d.scrollWidth <= d.clientWidth; }), true, `dialog overflow at ${width}`);
    await mobile.click('#closeDialog');
    if (width === 375) await mobile.screenshot({ path: new URL('base-mobile.png', output).pathname, fullPage: true });
    await mobile.click('#fightBtn'); await mobile.locator('.battle-dialog').waitFor();
    await mobile.locator('[data-command="start"]').click();
    await mobile.locator('[data-action="defend"]').click();
    await mobile.waitForTimeout(400);
    assert.equal(await mobile.locator('.battle-arena > .hero-actor').getAttribute('data-pose'), 'defend');
    assert.equal(await mobile.evaluate(() => { const d = document.querySelector('.battle-dialog'); return d.scrollWidth <= d.clientWidth; }), true, `battle overflow at ${width}`);
    if (width === 375) await mobile.screenshot({ path: new URL('battle-mobile.png', output).pathname, fullPage: true });
    await mobile.locator('[data-command="pause"]').click();
    const time = await mobile.locator('.battle-clock').textContent();
    await mobile.waitForTimeout(1200); assert.equal(await mobile.locator('.battle-clock').textContent(), time);
    await mobile.locator('.battle-exit').click(); await mobile.locator('[data-command="close"]').click();
    assert.equal((await stateOf(mobile)).wins, 0);
  }
  const { page: low } = await setup({}, { ...freshState(), food: 0, energy: 0 });
  await low.click('#fightBtn'); assert.equal(await low.locator('.battle-dialog').count(), 0);
  await low.click('#trainBtn'); assert.equal((await stateOf(low)).xp, 0);
  await low.click('#feedBtn'); await ready(low); await low.click('#restBtn');
  await low.waitForTimeout(6300); assert.ok((await stateOf(low)).energy >= 15);
  const { page: reduced } = await setup({ reducedMotion: 'reduce' });
  await reduced.click('#defendBtn'); assert.equal(await reduced.locator('#petHero').getAttribute('data-pose'), 'defend');
  assert.deepEqual(errors, [], 'Browser exceptions or HTTP failures');
  console.log('PASS: Chromium desktop and 375/430/768px layouts, real X pose, care/recovery, transformation, persistence, JSON export/import review, corrupt import, scene purchase, codex, achievements, cross-tab sync, mobile battle controls/pause/retreat and reduced motion.');
} catch (error) {
  for (let index = 0; index < contexts.length; index++) for (const page of contexts[index].pages()) {
    await page.screenshot({ path: new URL(`failure-${index}.png`, output).pathname, fullPage: true }).catch(() => {});
  }
  throw error;
} finally { await browser.close(); }
