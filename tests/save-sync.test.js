import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { SaveSync, SYNC_KEY } from '../public/save-sync.js';

class MemoryStorage {
  data = new Map();
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}
class Locks {
  last = Promise.resolve();
  request(_name, task) {
    const pending = this.last.then(task);
    this.last = pending.catch(() => {});
    return pending;
  }
}
const clone = value => JSON.parse(JSON.stringify(value));
const state = xp => ({ xp, stars: xp / 2, wins: 0 });
const reply = (status, data) => ({ status, ok: status < 400, json: async () => clone(data) });
function fakeServer() {
  const profiles = new Map(), mutations = new Map();
  let requests = [], offline = false, rejectAuth = 0, loseCreate = false, loseWrite = false, hook = null;
  const fetch = async (path, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : undefined;
    // Keep credentials out of assertion diagnostics and test output.
    requests.push({ path, method: options.method, mutationId: body?.mutationId, baseRevision: body?.baseRevision, state: body?.state });
    if (offline) throw new TypeError('network unavailable');
    if (hook) await hook(path, body);
    const code = options.headers?.Authorization?.replace('Bearer ', '');
    if (path === '/api/v1/profiles') {
      if (!profiles.has(body.recoveryCode)) profiles.set(body.recoveryCode, { profileId: `profile-${profiles.size + 1}`, revision: 1, state: clone(body.state), updatedAt: 1 });
      if (loseCreate) { loseCreate = false; throw new TypeError('response lost'); }
      return reply(200, profiles.get(body.recoveryCode));
    }
    if (rejectAuth) return reply(rejectAuth, { error: { code: 'invalid_recovery_code', message: 'invalid credential' } });
    const current = profiles.get(code);
    if (!current) return reply(404, { error: { message: 'missing profile' } });
    if (path === '/api/v1/history') return reply(200, { versions: [{ revision: current.revision, xp: current.state.xp }] });
    if (options.method === 'PUT' || path === '/api/v1/restore') {
      const key = `${current.profileId}:${body.mutationId}`;
      if (mutations.has(key)) return reply(200, { ...current, mutationRevision: mutations.get(key).revision });
      if (body.baseRevision !== current.revision) return reply(409, { error: { code: 'revision_conflict', message: 'conflict' }, current });
      const next = { ...current, revision: current.revision + 1, state: clone(body.state ?? state(body.revision * 10)), updatedAt: current.updatedAt + 1 };
      profiles.set(code, next); mutations.set(key, clone(next));
      if (loseWrite) { loseWrite = false; throw new TypeError('response lost'); }
      return reply(200, next);
    }
    return reply(200, current);
  };
  return { fetch, profiles, mutations, requests,
    set offline(value) { offline = value; }, set rejectAuth(value) { rejectAuth = value; },
    set loseCreate(value) { loseCreate = value; }, set loseWrite(value) { loseWrite = value; },
    set hook(value) { hook = value; },
    advance(code, next) { const old = profiles.get(code); profiles.set(code, { ...old, state: clone(next), revision: old.revision + 1 }); },
  };
}
function client(server, options = {}) {
  return new SaveSync({ storage: new MemoryStorage(), fetch: server.fetch, crypto: webcrypto,
    eventTarget: null, locks: false, pollMs: 0, debounceMs: 100000, timeoutMs: 500, ...options });
}

// These tests exercise persistence and causality, not DOM behavior.
test('first migration creates one durable identity and preserves existing browser JSON', async t => {
  const server = fakeServer(), storage = new MemoryStorage();
  storage.setItem('legacy-game', '{"xp":123}');
  const sync = client(server, { storage }); t.after(() => sync.dispose());
  await sync.start(state(123));
  assert.equal(sync.getInfo().status, 'synced');
  assert.equal(server.profiles.size, 1);
  assert.equal(JSON.parse(storage.getItem(SYNC_KEY)).revision, 1);
  assert.equal(storage.getItem('legacy-game'), '{"xp":123}');
  assert.equal([...storage.data.keys()].filter(key => key.includes(':backup:')).length, 1);
});

test('offline pending snapshots survive refresh and replay in order', async t => {
  const server = fakeServer(), storage = new MemoryStorage();
  const one = client(server, { storage }); t.after(() => one.dispose());
  await one.start(state(1)); server.offline = true;
  one.enqueue(state(2)); one.enqueue(state(3));
  await one.flush();
  assert.equal(one.getInfo().status, 'offline');
  assert.equal(one.getInfo().pending, 2);
  one.dispose(); server.offline = false;
  const applied = [], two = client(server, { storage, onState: s => applied.push(s.xp) }); t.after(() => two.dispose());
  await two.start(state(3));
  assert.equal(two.getInfo().revision, 3);
  assert.equal(two.getInfo().pending, 0);
  assert.equal([...server.profiles.values()][0].state.xp, 3);
  assert.deepEqual(applied, []);
});

test('lost create response retries the same identity and initial snapshot after refresh', async t => {
  const server = fakeServer(), storage = new MemoryStorage(); server.loseCreate = true;
  const one = client(server, { storage }); t.after(() => one.dispose());
  await one.start(state(30));
  const originalCode = one.getInfo().recoveryCode;
  one.enqueue(state(40)); one.dispose();
  const two = client(server, { storage }); t.after(() => two.dispose());
  await two.start(state(40));
  assert.equal(two.getInfo().recoveryCode === originalCode, true);
  assert.equal(server.profiles.size, 1);
  assert.equal([...server.profiles.values()][0].state.xp, 40);
});

test('lost save response reuses mutation ID and does not increment revision twice', async t => {
  const server = fakeServer(), storage = new MemoryStorage();
  const one = client(server, { storage }); t.after(() => one.dispose());
  await one.start(state(1)); server.loseWrite = true;
  one.enqueue(state(2)); await one.flush(); one.dispose();
  assert.equal(one.getInfo().pending, 1);
  const two = client(server, { storage }); t.after(() => two.dispose());
  await two.start(state(2));
  const writes = server.requests.filter(request => request.method === 'PUT');
  assert.equal(writes.length, 2);
  assert.equal(writes[0].mutationId, writes[1].mutationId);
  assert.equal(two.getInfo().revision, 2);
  assert.equal(two.getInfo().pending, 0);
});

test('a new action during an in-flight request cannot be replaced by its response', async t => {
  const server = fakeServer(), applied = [];
  const sync = client(server, { onState: s => applied.push(s.xp) }); t.after(() => sync.dispose());
  await sync.start(state(1));
  let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  server.hook = async (path) => {
    if (path === '/api/v1/save' && !release) { entered(); await new Promise(resolve => { release = resolve; }); }
  };
  sync.enqueue(state(2)); const flushing = sync.flush(); await waiting;
  sync.enqueue(state(3)); release(); await flushing;
  assert.equal([...server.profiles.values()][0].state.xp, 3);
  assert.equal(sync.getInfo().revision, 3);
  assert.deepEqual(applied, []);
});

test('409 retains local and remote branches and never applies remote without a choice', async t => {
  const server = fakeServer(), applied = [];
  const sync = client(server, { onState: s => applied.push(s.xp) }); t.after(() => sync.dispose());
  await sync.start(state(1));
  server.advance(sync.getInfo().recoveryCode, state(90));
  sync.enqueue(state(20)); await sync.flush();
  assert.equal(sync.getInfo().status, 'conflict');
  assert.equal(sync.getInfo().conflict.local.xp, 20);
  assert.equal(sync.getInfo().conflict.server.state.xp, 90);
  assert.equal(sync.getInfo().pending, 1);
  assert.deepEqual(applied, []);
  await sync.resolveConflict('server');
  assert.deepEqual(applied, [90]);
  assert.equal(sync.getInfo().pending, 0);
  const backups = [...sync.storage.data].filter(([key]) => key.includes(':backup:')).map(([, raw]) => JSON.parse(raw));
  assert.equal(backups.some(backup => backup.reason === 'conflict-server' && backup.state.xp === 20), true);
});

test('explicit local conflict choice creates a new revision after preserving both snapshots', async t => {
  const server = fakeServer(), sync = client(server); t.after(() => sync.dispose());
  await sync.start(state(1)); server.advance(sync.getInfo().recoveryCode, state(100));
  sync.enqueue(state(20)); await sync.flush();
  await sync.resolveConflict('local');
  assert.equal(sync.getInfo().status, 'synced');
  assert.equal([...server.profiles.values()][0].state.xp, 20);
  assert.equal(sync.getInfo().revision, 3);
});

for (const status of [401, 404]) test(`${status} preserves identity and pending work without creating a replacement`, async t => {
  const server = fakeServer(), sync = client(server); t.after(() => sync.dispose());
  await sync.start(state(1)); const code = sync.getInfo().recoveryCode;
  sync.enqueue(state(2)); server.rejectAuth = status;
  await sync.flush(); await sync.flush();
  assert.equal(sync.getInfo().status, 'error');
  assert.equal(sync.getInfo().pending, 1);
  assert.equal(sync.getInfo().recoveryCode === code, true);
  assert.equal(server.requests.filter(request => request.path === '/api/v1/profiles').length, 1);
});

test('recovery code validation is strict and preview never activates or discards local data', async t => {
  const server = fakeServer(), one = client(server), two = client(server);
  t.after(() => { one.dispose(); two.dispose(); });
  await one.start(state(1)); await two.start(state(99));
  const old = one.getInfo().profileId, calls = server.requests.length;
  await assert.rejects(one.connect('not-a-valid-code'), /恢复码格式/);
  assert.equal(server.requests.length, calls);
  const preview = await one.connect(two.getInfo().recoveryCode);
  assert.equal(preview.state.xp, 99);
  assert.equal(one.getInfo().profileId, old);
  one.enqueue(state(5));
  await one.activateProfile(two.getInfo().recoveryCode, preview);
  assert.equal(one.getInfo().profileId, two.getInfo().profileId);
  const backups = [...one.storage.data].filter(([key]) => key.includes(':backup:')).map(([, raw]) => JSON.parse(raw));
  assert.equal(backups.some(backup => backup.reason === 'switch-profile' && backup.pending[0]?.state.xp === 5), true);
});

test('simultaneous tab branches remain distinct and conflict rather than blind overwrite', async t => {
  const server = fakeServer(), storage = new MemoryStorage(), locks = new Locks();
  const one = client(server, { storage, locks }), two = client(server, { storage, locks });
  t.after(() => { one.dispose(); two.dispose(); });
  await one.start(state(1)); await two.start(state(1));
  one.enqueue(state(10)); two.enqueue(state(20));
  await Promise.all([one.flush(), two.flush()]);
  assert.equal(one.getInfo().status, 'conflict');
  assert.equal(one.getInfo().pending, 1);
  assert.equal([...server.profiles.values()][0].revision, 2);
});

test('HTTP fallback without Web Locks also protects stale tab writes with revision CAS', async t => {
  const server = fakeServer(), storage = new MemoryStorage();
  const one = client(server, { storage }), two = client(server, { storage });
  t.after(() => { one.dispose(); two.dispose(); });
  await one.start(state(1)); await two.start(state(1));
  one.enqueue(state(10)); await one.flush();
  two.enqueue(state(20)); await two.flush();
  assert.equal(two.getInfo().status, 'conflict');
  assert.equal([...server.profiles.values()][0].state.xp, 10);
});

test('restore is durable, returns a new revision, and keeps the previous state backed up', async t => {
  const server = fakeServer(), applied = [], sync = client(server, { onState: s => applied.push(s.xp) });
  t.after(() => sync.dispose());
  await sync.start(state(5)); sync.enqueue(state(30)); await sync.flush();
  assert.equal((await sync.history()).versions.length, 1);
  await sync.restore(1);
  assert.equal(sync.getInfo().revision, 3);
  assert.equal([...server.profiles.values()][0].state.xp, 10);
  assert.equal(applied.at(-1), 10);
  const backups = [...sync.storage.data].filter(([key]) => key.includes(':backup:')).map(([, raw]) => JSON.parse(raw));
  assert.equal(backups.some(backup => backup.reason === 'before-restore' && backup.state.xp === 30), true);
});


test('lost-response retry keeps its original mutation revision when another device advances the head', async t => {
  const server = fakeServer(), applied = [], sync = client(server, { onState: s => applied.push(s.xp) });
  t.after(() => sync.dispose());
  await sync.start(state(1));
  server.loseWrite = true;
  sync.enqueue(state(2)); await sync.flush();
  sync.enqueue(state(3));
  server.advance(sync.getInfo().recoveryCode, state(90));
  await sync.flush();
  assert.equal(sync.getInfo().status, 'conflict');
  assert.equal(sync.getInfo().conflict.local.xp, 3);
  assert.equal(sync.getInfo().conflict.server.state.xp, 90);
  const writes = server.requests.filter(request => request.method === 'PUT');
  assert.equal(writes.at(-1).baseRevision, 2);
  assert.equal([...server.profiles.values()][0].revision, 3);
  assert.equal([...server.profiles.values()][0].state.xp, 90);
  assert.deepEqual(applied, []);
});

test('reconnecting the same profile archives pending work and cannot replay it over the chosen preview', async t => {
  const server = fakeServer(), sync = client(server); t.after(() => sync.dispose());
  await sync.start(state(1)); sync.enqueue(state(30));
  const code = sync.getInfo().recoveryCode, preview = await sync.connect(code);
  await sync.activateProfile(code, preview); await sync.flush();
  assert.equal(sync.getInfo().pending, 0);
  assert.equal([...server.profiles.values()][0].state.xp, 1);
  assert.equal([...sync.storage.data].filter(([key]) => key.includes(':backup:')).length, 2);
});

test('first launch offline retains its recovery identity and every new action until reconnect', async t => {
  const server = fakeServer(), storage = new MemoryStorage(); server.offline = true;
  const one = client(server, { storage }); t.after(() => one.dispose());
  await one.start(state(7)); const originalCode = one.getInfo().recoveryCode;
  one.enqueue(state(8)); one.dispose();
  const two = client(server, { storage }); t.after(() => two.dispose());
  await two.start(state(8));
  assert.equal(two.getInfo().status, 'offline');
  assert.equal(two.getInfo().pending, 2);
  assert.equal(two.getInfo().recoveryCode === originalCode, true);
  server.offline = false; await two.flush();
  assert.equal(server.profiles.size, 1);
  assert.equal(two.getInfo().revision, 2);
  assert.equal([...server.profiles.values()][0].state.xp, 8);
});

test('remote polling cannot replace an action made while its GET is in flight', async t => {
  const server = fakeServer(), applied = [], sync = client(server, { onState: s => applied.push(s.xp) });
  t.after(() => sync.dispose()); await sync.start(state(1));
  let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  server.hook = async path => {
    if (path === '/api/v1/save' && !release) { entered(); await new Promise(resolve => { release = resolve; }); }
  };
  const polling = sync.flush(); await waiting;
  sync.enqueue(state(20)); release(); await polling;
  assert.deepEqual(applied, []);
  assert.equal(sync.getInfo().status, 'pending');
  await sync.flush();
  assert.equal([...server.profiles.values()][0].state.xp, 20);
});

test('a second tab pending snapshot prevents a stale synced badge even before its flush', async t => {
  const server = fakeServer(), storage = new MemoryStorage();
  const one = client(server, { storage }), two = client(server, { storage });
  t.after(() => { one.dispose(); two.dispose(); });
  await one.start(state(1)); await two.start(state(1));
  two.enqueue(state(20));
  assert.equal(one.getInfo().pending, 1);
  assert.equal(one.getInfo().status, 'pending');
});

test('a delayed GET cannot display an older head than another tab has already confirmed', async t => {
  const server = fakeServer(), storage = new MemoryStorage(), applied = [];
  let delaying = false, release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const fetch = async (...args) => {
    const response = await server.fetch(...args);
    if (delaying && args[0] === '/api/v1/save' && args[1].method === 'GET') {
      delaying = false; entered(); await new Promise(resolve => { release = resolve; });
    }
    return response;
  };
  const one = client(server, { storage, fetch, onState: s => applied.push(s.xp) }), two = client(server, { storage });
  t.after(() => { one.dispose(); two.dispose(); });
  await one.start(state(1)); await two.start(state(1));
  delaying = true; const polling = one.flush(); await waiting;
  two.enqueue(state(20)); await two.flush();
  release(); await polling;
  assert.equal(one.getInfo().revision, 2);
  assert.deepEqual(applied, [20]);
  assert.match(one.getInfo().message, /第 2 版/);
});

test('profile activation immediately shows loading and serializes background flush without Web Locks', async t => {
  const server = fakeServer(), statuses = [], one = client(server, { onStatus: info => statuses.push(info.status) }), two = client(server);
  t.after(() => { one.dispose(); two.dispose(); });
  await one.start(state(1)); await two.start(state(99));
  const code = two.getInfo().recoveryCode, preview = await one.connect(code);
  let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  server.hook = async path => {
    if (path === '/api/v1/save' && !release) { entered(); await new Promise(resolve => { release = resolve; }); }
  };
  const activating = one.activateProfile(code, preview);
  assert.equal(one.getInfo().transition, true);
  assert.equal(one.getInfo().status, 'loading');
  await waiting; const requests = server.requests.length;
  const polling = one.flush();
  await Promise.resolve();
  assert.equal(server.requests.length, requests);
  assert.equal(one.getInfo().profileId !== two.getInfo().profileId, true);
  release(); const result = await activating; await polling;
  assert.equal(result.status, 'synced'); assert.equal(result.transition, false);
  assert.equal(one.getInfo().profileId, two.getInfo().profileId);
  assert.equal(one.localState.xp, 99);
  assert.equal(statuses.at(-1), 'synced');
});

test('activation waits for a previously started old-profile GET before switching identity', async t => {
  const server = fakeServer(), storage = new MemoryStorage();
  let delaying = false, release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const fetch = async (...args) => {
    const response = await server.fetch(...args);
    if (delaying && args[0] === '/api/v1/save') {
      delaying = false; entered(); await new Promise(resolve => { release = resolve; });
    }
    return response;
  };
  const one = client(server, { storage, fetch }), two = client(server);
  t.after(() => { one.dispose(); two.dispose(); });
  await one.start(state(1)); await two.start(state(90));
  const code = two.getInfo().recoveryCode, preview = await one.connect(code);
  delaying = true; const polling = one.flush(); await waiting;
  const activating = one.activateProfile(code, preview);
  assert.equal(one.getInfo().status, 'loading');
  release(); await polling; await activating;
  assert.equal(JSON.parse(storage.getItem(SYNC_KEY)).profileId, two.getInfo().profileId);
  assert.equal(one.localState.xp, 90);
  one.enqueue(state(95)); await one.flush();
  assert.equal(server.profiles.get(code).state.xp, 95);
});

test('a new action during profile activation preserves the original profile and cancels the switch', async t => {
  const server = fakeServer(), one = client(server), two = client(server);
  t.after(() => { one.dispose(); two.dispose(); });
  await one.start(state(1)); await two.start(state(99));
  const oldCode = one.getInfo().recoveryCode, code = two.getInfo().recoveryCode, preview = await one.connect(code);
  let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  server.hook = async path => {
    if (path === '/api/v1/save' && !release) { entered(); await new Promise(resolve => { release = resolve; }); }
  };
  const activating = one.activateProfile(code, preview); await waiting;
  one.enqueue(state(30)); release();
  await assert.rejects(activating, /本机产生了新进度/);
  assert.equal(one.getInfo().transition, false);
  assert.equal(one.getInfo().recoveryCode === oldCode, true);
  assert.equal(one.getInfo().pending, 1);
  assert.equal(one.localState.xp, 30);
  await one.flush();
  assert.equal(server.profiles.get(oldCode).state.xp, 30);
  assert.equal(server.profiles.get(code).state.xp, 99);
});

test('an action made during history restore must conflict rather than silently undo the restore', async t => {
  const server = fakeServer(), sync = client(server); t.after(() => sync.dispose());
  await sync.start(state(50));
  let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  server.hook = async path => {
    if (path === '/api/v1/restore' && !release) { entered(); await new Promise(resolve => { release = resolve; }); }
  };
  const restoring = sync.restore(1);
  assert.equal(sync.getInfo().status, 'loading'); assert.equal(sync.getInfo().transition, true);
  await waiting; sync.enqueue(state(60)); release(); const result = await restoring;
  assert.equal(result.transition, false);
  assert.equal(result.status, 'conflict');
  assert.equal(result.conflict.local.xp, 60);
  assert.equal(result.conflict.server.state.xp, 10);
  assert.equal([...server.profiles.values()][0].state.xp, 10);
});

test('local conflict choice cannot overwrite server progress created after the displayed comparison', async t => {
  const server = fakeServer(), sync = client(server); t.after(() => sync.dispose());
  await sync.start(state(1));
  server.advance(sync.getInfo().recoveryCode, state(90)); sync.enqueue(state(20)); await sync.flush();
  server.advance(sync.getInfo().recoveryCode, state(100));
  const result = await sync.resolveConflict('local');
  assert.equal(result.status, 'conflict'); assert.equal(result.transition, false);
  assert.equal(result.conflict.local.xp, 20); assert.equal(result.conflict.server.state.xp, 100);
  assert.equal([...server.profiles.values()][0].state.xp, 100);
  await sync.resolveConflict('local');
  assert.equal([...server.profiles.values()][0].state.xp, 20);
  assert.equal(sync.getInfo().status, 'synced');
});

test('new actions during conflict resolution are retained and require a fresh choice', async t => {
  const server = fakeServer(), sync = client(server); t.after(() => sync.dispose());
  await sync.start(state(1)); server.advance(sync.getInfo().recoveryCode, state(90));
  sync.enqueue(state(20)); await sync.flush();
  let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  server.hook = async path => {
    if (path === '/api/v1/save' && !release) { entered(); await new Promise(resolve => { release = resolve; }); }
  };
  const resolving = sync.resolveConflict('server'); await waiting;
  assert.equal(sync.getInfo().status, 'loading');
  sync.enqueue(state(30)); release(); await assert.rejects(resolving, /又有新进度/);
  assert.equal(sync.getInfo().status, 'conflict');
  assert.equal(sync.getInfo().transition, false);
  assert.equal(sync.getInfo().conflict.local.xp, 30);
  assert.equal([...server.profiles.values()][0].state.xp, 90);
});
