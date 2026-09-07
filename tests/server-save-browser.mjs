import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { freshState } from '../public/pet-state.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://localhost:8789';
const output = new URL('../test-results/server-save/', import.meta.url);
await mkdir(output, { recursive:true });
const browser = await chromium.launch({ headless:true });
const contexts = [];
const pageErrors = [];
const readLocal = page => page.evaluate(() => JSON.parse(localStorage.getItem('aoteman-pet-v2')));
const readIdentity = page => page.evaluate(() => JSON.parse(localStorage.getItem('aoteman-cloud-v1')));
const ready = page => page.waitForFunction(() => !document.getElementById('feedBtn').disabled);
const synced = page => page.locator('#saveStatus[data-status="synced"]').waitFor({ state:'attached', timeout:20000 });
const head = async code => {
  const response = await fetch(`${base}/api/v1/save`, { headers:{Authorization:`Bearer ${code}`} });
  assert.equal(response.status, 200);
  return response.json();
};
async function makePage(initial, options = {}) {
  const context = await browser.newContext({ viewport:{width:1280,height:1000}, ...options }); contexts.push(context);
  if (initial) await context.addInitScript(raw => {
    if (!localStorage.getItem('aoteman-cloud-v1')) localStorage.setItem('ginga-pet-v1', raw);
  }, JSON.stringify(initial));
  const page = await context.newPage(); page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(base); await ready(page); await synced(page);
  return { context, page };
}
async function train(page) { await ready(page); await page.click('#trainBtn'); await ready(page); }
try {
  // Migrate the real legacy shape, keeping the exact pre-migration text intact.
  const legacy = { ...freshState(), version:1, xp:200, stars:65, wins:4, training:8, fed:6, food:90, energy:95 };
  const { context:aContext, page:a } = await makePage(legacy);
  const identity = await readIdentity(a), code = identity.recoveryCode;
  assert.match(code, /^gxy_[a-f0-9]{64}$/);
  const initial = await head(code);
  assert.equal(initial.state.xp, 200); assert.equal(initial.state.stars, 65); assert.equal(initial.state.wins, 4);
  assert.equal(initial.state.version, 2);
  assert.equal(await a.evaluate(() => localStorage.getItem('aoteman-before-server-migration')), JSON.stringify(legacy));
  await train(a); await synced(a);
  assert.equal((await head(code)).state.xp, 220);
  // A backend outage must retain the player's identity and every new action,
  // including across a complete page reload while the API remains unreachable.
  await aContext.route('**/api/**', route => route.abort('failed'));
  await train(a); await train(a);
  const offlineXp = (await readLocal(a)).xp; assert.equal(offlineXp, 260);
  assert.equal((await head(code)).state.xp, 220);
  await a.locator('#saveStatus[data-status="offline"]').waitFor({state:'attached'});
  assert.ok(await a.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('aoteman-cloud-v1:pending:'))));
  await a.reload(); await ready(a);
  assert.equal((await readLocal(a)).xp, 260); assert.equal((await readIdentity(a)).recoveryCode, code);
  await aContext.unroute('**/api/**'); await a.evaluate(() => dispatchEvent(new Event('online'))); await synced(a);
  assert.equal((await head(code)).state.xp, 260);
  // Use the visible recovery-code preview and confirmation on another device.
  const { page:b } = await makePage(null, { viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  await b.click('#settingsBtn'); await b.fill('#connectCode', code); await b.click('#connectBtn');
  await b.locator('#activateProfileBtn').waitFor();
  assert.equal((await readLocal(b)).xp, 0, 'Preview cannot replace the new device state');
  await b.click('#activateProfileBtn');
  await b.waitForFunction(id => JSON.parse(localStorage.getItem('aoteman-cloud-v1')).profileId === id, identity.profileId);
  await synced(b);
  assert.equal((await readLocal(b)).xp, 260);
  assert.equal((await readIdentity(b)).profileId, identity.profileId);
  assert.equal(await b.locator('#recoveryCode').getAttribute('type'), 'password');
  assert.equal(await b.evaluate(() => { const dialog=document.getElementById('infoDialog'); return dialog.scrollWidth<=dialog.clientWidth; }), true);
  await b.locator('#infoDialog').screenshot({path:new URL('mobile-save-panel.png',output).pathname});
  await b.click('#closeDialog');
  // Two divergent devices must preserve both branches and require a visible choice.
  await aContext.route('**/api/**', route => route.abort('failed'));
  await train(a); assert.equal((await readLocal(a)).xp, 280);
  await train(b); await train(b); await synced(b); assert.equal((await head(code)).state.xp, 300);
  await aContext.unroute('**/api/**'); await a.evaluate(() => dispatchEvent(new Event('online')));
  await a.locator('#saveStatus[data-status="conflict"]').waitFor({state:'attached',timeout:20000});
  assert.equal((await head(code)).state.xp, 300); assert.equal((await readLocal(a)).xp, 280);
  await a.click('#settingsBtn');
  const conflictDownload = a.waitForEvent('download'); await a.click('#downloadConflictBtn');
  const localBackup = await conflictDownload, localBackupPath = new URL('local-conflict.json',output).pathname;
  await localBackup.saveAs(localBackupPath); assert.equal(JSON.parse(await readFile(localBackupPath,'utf8')).xp,280);
  await a.click('[data-conflict="server"]');
  await a.waitForFunction(() => JSON.parse(localStorage.getItem('aoteman-pet-v2')).xp === 300);
  await synced(a);
  assert.equal((await readLocal(a)).xp,300);
  assert.ok(await a.evaluate(() => Object.keys(localStorage).some(key=>key.startsWith('aoteman-cloud-v1:backup:'))));
  // Historical restore is an explicit new revision; the previous head remains recoverable.
  const current = await head(code);
  await a.click('#historyBtn'); await a.locator(`[data-history="${initial.revision}"]`).click();
  await a.click('#confirmRestoreBtn');
  await a.waitForFunction(() => JSON.parse(localStorage.getItem('aoteman-pet-v2')).xp === 200);
  await synced(a);
  assert.equal((await head(code)).state.xp,200);
  await a.click('#historyBtn'); await a.locator(`[data-history="${current.revision}"]`).click(); await a.click('#confirmRestoreBtn');
  await a.waitForFunction(() => JSON.parse(localStorage.getItem('aoteman-pet-v2')).xp === 300);
  await synced(a);
  assert.equal((await head(code)).state.xp,300);
  await a.click('#recoveryDownloadBtn');
  await a.click('#closeDialog'); await a.reload(); await ready(a); await synced(a);
  assert.equal((await readLocal(a)).xp,300); assert.equal((await readIdentity(a)).recoveryCode,code);
  // Private reads never expose a save just because a caller knows its profile ID.
  const unauthenticated = await fetch(`${base}/api/v1/save`); assert.equal(unauthenticated.status,401);
  assert.equal((await fetch(`${base}/api/v1/profiles/${identity.profileId}`)).status,404);
  assert.deepEqual(pageErrors,[]);
  console.log('PASS: real SQLite API legacy migration, offline/reload/retry, recovery-code cross-device continuity, conflict preservation and explicit choice, history rollback/recovery, refresh persistence, mobile settings, private read boundaries, zero page errors.');
} catch(error) {
  for(let i=0;i<contexts.length;i++) for(const page of contexts[i].pages()) await page.screenshot({path:new URL(`failure-${i}.png`,output).pathname,fullPage:true}).catch(()=>{});
  throw error;
} finally { await browser.close(); }
