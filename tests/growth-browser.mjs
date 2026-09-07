import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chmod, mkdir, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://localhost:8789';
const output = new URL('../test-results/growth/', import.meta.url);
await mkdir(output, { recursive:true });
const browser = await chromium.launch({ headless:true });
const contexts = [], pageErrors = [];
const readLocal = page => page.evaluate(() => JSON.parse(localStorage.getItem('aoteman-pet-v2')));
const readIdentity = page => page.evaluate(() => JSON.parse(localStorage.getItem('aoteman-cloud-v1')));
const ready = page => page.waitForFunction(() => document.getElementById('feedBtn')?.disabled === false);
const synced = page => page.locator('#saveStatus[data-status="synced"]').waitFor({ state:'attached', timeout:20000 });
const card = (page, id) => page.locator(`[data-milestone="${id}"]`);
const rewardButton = (page, id) => page.locator(`[data-milestone-action="${id}"]`);
async function head(code) {
  const response = await fetch(`${base}/api/v1/save`, { headers:{ Authorization:`Bearer ${code}` } });
  assert.equal(response.status, 200);
  return response.json();
}
async function newPage(options = {}) {
  const context = await browser.newContext({ viewport:{ width:1280, height:1000 }, ...options });
  contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(base); await ready(page); await synced(page);
  return { context, page };
}
async function rename(page, value) {
  await ready(page); await page.click('#renameBtn');
  await page.fill('#companionNameInput', value); await page.click('#saveNameBtn');
  await page.locator('#infoDialog').waitFor({ state:'hidden' }); await synced(page);
}
async function assertNoOverflow(page) {
  const sizes = await page.evaluate(() => {
    const dialog = document.getElementById('infoDialog');
    return { pageWidth:document.documentElement.scrollWidth, viewport:innerWidth, dialogWidth:dialog.clientWidth, dialogScroll:dialog.scrollWidth };
  });
  assert.ok(sizes.pageWidth <= sizes.viewport, `Page width ${sizes.pageWidth} exceeds viewport ${sizes.viewport}`);
  assert.ok(sizes.dialogScroll <= sizes.dialogWidth, `Dialog scroll width ${sizes.dialogScroll} exceeds its width ${sizes.dialogWidth}`);
}
async function downloadJSON(page, selector, filename) {
  const pending = page.waitForEvent('download'); await page.click(selector);
  const download = await pending, path = new URL(filename, output).pathname;
  await download.saveAs(path); await chmod(path, 0o600);
  return JSON.parse(await readFile(path, 'utf8'));
}
try {
  const health = await fetch(`${base}/api/healthz`);
  assert.equal(health.status, 200, 'The isolated real SQLite API must be healthy');
  const { context:aContext, page:a } = await newPage();
  const identity = await readIdentity(a), code = identity.recoveryCode;
  assert.equal((await readLocal(a)).xp, 0);

  // Name validation stays visible, and literal markup remains inert text.
  await a.click('#renameBtn'); await a.fill('#companionNameInput', '一二三四五六七八九十一二三'); await a.click('#saveNameBtn');
  assert.equal(await a.locator('#companionNameInput').getAttribute('aria-invalid'), 'true');
  assert.match(await a.locator('#nameFeedback').textContent(), /1–12/);
  assert.equal((await readLocal(a)).companionName, '银河');
  assert.equal((await head(code)).state.companionName, '银河');
  await a.fill('#companionNameInput', '<b>星光</b>'); await a.click('#saveNameBtn');
  await a.locator('#infoDialog').waitFor({ state:'hidden' }); await synced(a);
  assert.equal(await a.locator('#companionName').textContent(), '<b>星光</b>');
  assert.equal(await a.locator('#companionName').evaluate(element => element.childElementCount), 0);
  await a.click('#journeyBtn');
  assert.equal(await a.locator('#journeyDialogName').textContent(), '<b>星光</b>的成长航线');
  assert.equal(await a.locator('#journeyDialogName').evaluate(element => element.childElementCount), 0);
  await a.click('#closeDialog');
  const name = '星河小光'; await rename(a, `  ${name}  `);
  assert.equal(await a.locator('#companionName').textContent(), name);
  assert.equal((await head(code)).state.companionName, name);

  // Earn the first milestone through real care buttons and claim it once.
  await a.click('#feedBtn'); await ready(a); await synced(a);
  assert.equal((await head(code)).state.fed, 1);
  await a.click('#journeyBtn');
  assert.equal(await card(a, 'first_meal').getAttribute('data-status'), 'ready');
  await rewardButton(a, 'first_meal').click(); await synced(a);
  assert.equal(await card(a, 'first_meal').getAttribute('data-status'), 'claimed');
  assert.equal(await rewardButton(a, 'first_meal').isDisabled(), true);
  let saved = (await head(code)).state;
  assert.equal(saved.xp, 10); assert.equal(saved.stars, 5); assert.deepEqual(saved.milestones, ['first_meal']);
  await a.reload(); await ready(a); await synced(a); await a.click('#journeyBtn');
  assert.equal(await rewardButton(a, 'first_meal').isDisabled(), true);
  assert.equal(await card(a, 'first_meal').getAttribute('data-status'), 'claimed');
  assert.equal((await head(code)).state.xp, 10, 'Reload cannot award a claimed gift again');

  // An unfinished milestone takes the player to the real training action.
  assert.equal(await card(a, 'first_training').getAttribute('data-status'), 'growing');
  await rewardButton(a, 'first_training').click();
  await a.locator('#infoDialog').waitFor({ state:'hidden' }); await ready(a); await synced(a);
  saved = (await head(code)).state;
  assert.equal(saved.training, 1); assert.equal(saved.xp, 30); assert.equal(saved.stars, 10);
  await a.click('#journeyBtn');
  assert.equal(await card(a, 'first_training').getAttribute('data-status'), 'ready');

  // A reward claimed while the API is unreachable survives reload and retries.
  await aContext.route('**/api/**', route => route.abort('failed'));
  await rewardButton(a, 'first_training').click();
  await a.locator('#saveStatus[data-status="offline"]').waitFor({ state:'attached' });
  assert.equal((await readLocal(a)).xp, 40); assert.equal((await head(code)).state.xp, 30);
  await a.reload(); await ready(a);
  assert.equal((await readIdentity(a)).recoveryCode, code);
  assert.equal((await readLocal(a)).companionName, name);
  assert.deepEqual((await readLocal(a)).milestones, ['first_meal', 'first_training']);
  await a.click('#journeyBtn');
  assert.equal(await card(a, 'first_training').getAttribute('data-status'), 'claimed');
  assert.equal(await rewardButton(a, 'first_training').isDisabled(), true);
  await a.click('#closeDialog');
  await aContext.unroute('**/api/**'); await a.evaluate(() => dispatchEvent(new Event('online'))); await synced(a);
  saved = (await head(code)).state;
  assert.equal(saved.xp, 40); assert.equal(saved.stars, 15); assert.equal(saved.companionName, name);
  assert.deepEqual(saved.milestones, ['first_meal', 'first_training']);

  // Recovery files include the Chinese name and claims; JSON export does too.
  await a.click('#settingsBtn');
  const recovery = await downloadJSON(a, '#recoveryDownloadBtn', 'synthetic-recovery.json');
  assert.equal(recovery.format, 'galaxy-recovery'); assert.equal(recovery.recoveryCode, code);
  assert.equal(recovery.state.companionName, name); assert.deepEqual(recovery.state.milestones, saved.milestones);
  const exported = await downloadJSON(a, '#exportBtn', 'synthetic-progress.json');
  assert.equal(exported.companionName, name); assert.deepEqual(exported.milestones, saved.milestones);
  assert.equal(exported.xp, 40); assert.equal(exported.stars, 15);
  await aContext.close();

  // A different mobile browser connects explicitly and retains every new field.
  const { page:b } = await newPage({ viewport:{ width:375, height:812 }, isMobile:true, hasTouch:true });
  await b.click('#settingsBtn'); await b.fill('#connectCode', code); await b.click('#connectBtn');
  await b.locator('#activateProfileBtn').waitFor();
  assert.equal((await readLocal(b)).companionName, '银河', 'Preview must not replace this device state');
  await b.click('#activateProfileBtn');
  await b.waitForFunction(profileId => JSON.parse(localStorage.getItem('aoteman-cloud-v1')).profileId === profileId, identity.profileId);
  await synced(b); assert.equal((await readLocal(b)).companionName, name);
  assert.deepEqual((await readLocal(b)).milestones, saved.milestones);
  assert.equal((await readLocal(b)).xp, 40); assert.equal((await readLocal(b)).stars, 15);
  assert.equal(await b.locator('#recoveryCode').getAttribute('type'), 'password');
  await assertNoOverflow(b); await b.click('#closeDialog');
  await b.click('#journeyBtn'); await assertNoOverflow(b);
  assert.equal(await b.locator('#journeyDialogName').textContent(), `${name}的成长航线`);
  assert.equal(await rewardButton(b, 'first_meal').isDisabled(), true);
  assert.equal(await rewardButton(b, 'first_training').isDisabled(), true);
  await b.locator('#infoDialog').screenshot({ path:new URL('mobile-growth-journey.png', output).pathname });
  await b.click('#closeDialog'); await b.click('#renameBtn');
  await b.fill('#companionNameInput', '🌟'.repeat(12));
  assert.equal(await b.locator('#nameCount').textContent(), '12 / 12');
  await assertNoOverflow(b);
  await b.locator('#infoDialog').screenshot({ path:new URL('mobile-nickname.png', output).pathname });
  await b.click('#closeDialog');
  await b.reload(); await ready(b); await synced(b);
  assert.equal(await b.locator('#companionName').textContent(), name);
  assert.deepEqual((await readLocal(b)).milestones, saved.milestones);
  assert.equal((await head(code)).state.xp, 40, 'Cross-device reload must not duplicate rewards');
  assert.deepEqual(pageErrors, []);
  console.log('PASS: real SQLite API nickname validation and safe rendering, care-earned milestone rewards, once-only claims after reload, unfinished-goal navigation, offline reward/reload/retry, complete recovery exports, cross-device recovery and 375px growth/name panels, zero page errors.');
} catch (error) {
  for (let i = 0; i < contexts.length; i++) for (const page of contexts[i].pages()) await page.screenshot({ path:new URL(`failure-${i}.png`, output).pathname, fullPage:true }).catch(() => {});
  throw error;
} finally { await browser.close(); }
