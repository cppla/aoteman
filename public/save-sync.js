/** Durable browser outbox + optimistic, idempotent SQLite save API.
 * Recovery codes are credentials: they never belong in logs or public URLs.
 * Every queued snapshot has its own storage key, so other tabs cannot replace it.
 */
export const SYNC_KEY = 'aoteman-cloud-v1';
const PREFIX = `${SYNC_KEY}:`;
const CODE_PATTERN = /^gxy_[a-f0-9]{64}$/;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export class SaveSync {
  constructor(options = {}) {
    this.storage = options.storage ?? globalThis.localStorage;
    this.fetcher = options.fetch ?? globalThis.fetch?.bind(globalThis);
    this.crypto = options.crypto ?? globalThis.crypto;
    this.events = options.eventTarget ?? globalThis.window;
    this.locks = options.locks ?? globalThis.navigator?.locks;
    this.onState = options.onState ?? (() => {});
    this.onStatus = options.onStatus ?? (() => {});
    this.baseURL = options.baseURL ?? '';
    this.debounceMs = options.debounceMs ?? 500;
    this.pollMs = options.pollMs ?? 15000;
    this.timeoutMs = options.timeoutMs ?? 12000;
    this.now = options.now ?? Date.now;
    this.actor = this._id();
    this.sequence = 0;
    this.meta = null;
    this.localState = null;
    this.viewRevision = null;
    this.lastMutation = null;
    this.status = 'loading';
    this.message = '正在连接服务器存档…';
    this.disposed = false;
    this.started = false;
    this.running = null;
    this.transition = null;
    this.transitioning = false;
    this.timer = null;
    this.pollTimer = null;
    this._online = () => { void this.flush(); };
    this._storage = event => {
      if (event.key?.startsWith(SYNC_KEY)) {
        // The queue remains on disk. Refresh the server before applying any state.
        this._schedule();
        this._emit();
      }
    };
  }

  _id() {
    if (!this.crypto?.getRandomValues) throw new Error('浏览器无法生成安全恢复码，请更换浏览器。');
    const bytes = new Uint8Array(32);
    this.crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  _read(key) {
    const raw = this.storage.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch { throw new Error('本地同步记录损坏，原始数据仍已保留，请先导出本机存档。'); }
  }
  _write(key, value) { this.storage.setItem(key, JSON.stringify(value)); }
  _keys(prefix) {
    const keys = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    return keys;
  }
  _entries() {
    return this._keys(`${PREFIX}pending:`).map(key => ({ ...this._read(key), key }))
      .filter(item => item.recoveryCode === this.meta?.recoveryCode)
      .sort((a, b) => a.createdAt - b.createdAt || (a.actor === b.actor ? (a.sequence ?? 0) - (b.sequence ?? 0) : 0) || a.mutationId.localeCompare(b.mutationId));
  }
  _conflict() {
    for (const entry of this._entries()) {
      const server = this._read(`${PREFIX}conflict:${entry.mutationId}`);
      if (server) return { entry, server };
    }
    return null;
  }
  _backup(reason, data) {
    this._write(`${PREFIX}backup:${this.now()}:${this._id()}`, { reason, createdAt: this.now(), ...copy(data) });
  }
  _emit() { if (!this.disposed) this.onStatus(this.getInfo()); }
  _status(status, message) { this.status = status; this.message = message; this._emit(); }
  getInfo() {
    let entries = [], conflict = null;
    try {
      entries = this._entries();
      const found = this._conflict();
      if (found) conflict = {
        local: copy(entries.at(-1)?.state ?? this.localState),
        server: copy(found.server),
      };
    } catch { /* A storage failure is reported by the operation that encountered it. */ }
    const pending = entries.length + (this.meta?.create ? 1 : 0);
    const status = this.transitioning ? 'loading' : conflict ? 'conflict' : pending && this.status === 'synced' ? 'pending' : this.status;
    return {
      status,
      transition: this.transitioning,
      message: this.transitioning ? this.transitionMessage : conflict ? '两台设备的进度不同，两份均已保留，请选择保留哪份。' : status === 'pending' && this.status === 'synced' ? '本机有新进度等待同步到服务器。' : this.message,
      revision: this.meta?.revision ?? null,
      recoveryCode: this.meta?.recoveryCode ?? null,
      profileId: this.meta?.profileId ?? null,
      pending,
      conflict,
    };
  }
  _schedule() {
    if (this.disposed || this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, this.debounceMs);
    this.timer.unref?.();
  }
  async _lock(callback) {
    // HTTP deployments may lack Web Locks. Unique entries + server revision CAS
    // still preserve both branches; concurrent edits then surface as a conflict.
    if (this.locks?.request) return this.locks.request(SYNC_KEY, callback);
    return callback();
  }

  async start(initialState) {
    if (this.started) return this.flush();
    this.started = true;
    this.localState = copy(initialState);
    try {
      await this._lock(async () => {
        let meta = this._read(SYNC_KEY);
        if (!meta) {
          meta = { version: 1, recoveryCode: `gxy_${this._id()}`, revision: null,
            profileId: null, create: { state: copy(initialState) } };
          // Preserve the credential and original migration before the first request.
          this._backup('first-migration', { meta, state: initialState });
          this._write(SYNC_KEY, meta);
        }
        if (!CODE_PATTERN.test(meta.recoveryCode ?? '')) throw new Error('本地恢复码无效；已保留原始记录，请使用备份恢复码连接。');
        this.meta = meta;
        this.viewRevision = meta.revision;
        this.lastMutation = this._entries().filter(entry => same(entry.state, initialState)).at(-1)?.mutationId ?? null;
      });
      this.events?.addEventListener('online', this._online);
      this.events?.addEventListener('storage', this._storage);
      if (this.pollMs > 0) {
        this.pollTimer = setInterval(() => { void this.flush(); }, this.pollMs);
        this.pollTimer.unref?.();
      }
      return await this.flush();
    } catch (error) { this._failure(error); return this.getInfo(); }
  }

  enqueue(state, { reason = 'autosave' } = {}) {
    if (this.disposed) return false;
    this.localState = copy(state);
    try {
      if (!this.meta) throw new Error('服务器存档尚未初始化，本机进度仍由浏览器存档保留。');
      if (same(this._entries().at(-1)?.state ?? this.meta.state ?? this.meta.create?.state, state)) return true;
      const mutationId = this._id();
      // Snapshots are immutable. The next action receives a different key even
      // while this request is in flight or another tab is replaying this entry.
      const own = this._entries().filter(entry => entry.actor === this.actor).at(-1);
      const candidate = own?.mutationId ?? this.lastMutation;
      // An action made while restoring still starts from the pre-restore UI.
      // It must conflict with the restored head, never silently undo the restore.
      const predecessor = candidate && this._read(`${PREFIX}pending:${candidate}`)?.kind === 'restore' ? null : candidate;
      const entry = { mutationId, actor: this.actor, recoveryCode: this.meta.recoveryCode,
        baseRevision: this.viewRevision ?? 1, predecessor, state: copy(state),
        reason: String(reason).slice(0, 120), createdAt: this.now(), sequence: ++this.sequence, kind: 'save' };
      this._write(`${PREFIX}pending:${mutationId}`, entry);
      this.lastMutation = mutationId;
      this._status('pending', '进度已保存在本机，等待同步到服务器。');
      this._schedule();
      return true;
    } catch (error) { this._failure(error); return false; }
  }

  async _request(path, { method = 'GET', body, code = this.meta?.recoveryCode } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    timer.unref?.();
    try {
      const raw = body === undefined ? undefined : JSON.stringify(body);
      if (raw && new TextEncoder().encode(raw).byteLength > 100 * 1024) throw new Error('存档超过 100 KB，已保留本机进度，请导出备份。');
      const response = await this.fetcher(`${this.baseURL}${path}`, {
        method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(code ? { Authorization: `Bearer ${code}` } : {}) }, body: raw,
        signal: controller.signal, cache: 'no-store',
      });
      let data;
      try { data = await response.json(); }
      catch { throw new Error('服务器未返回有效存档，进度仍保存在本机。'); }
      if (!response.ok) {
        const error = new Error(data?.error?.message || '服务器存档请求失败。');
        error.status = response.status; error.data = data;
        throw error;
      }
      return data;
    } finally { clearTimeout(timer); }
  }
  _validateResponse(response) {
    if (!response?.profileId || !Number.isInteger(response.revision) || response.revision < 1 || !response.state || typeof response.state !== 'object') {
      throw new Error('服务器存档格式无效，已保留本机进度。');
    }
    return response;
  }
  _publish(response) {
    this._validateResponse(response);
    const stored = this._read(SYNC_KEY);
    if (stored && stored.recoveryCode !== this.meta.recoveryCode) throw new Error('另一个页面切换了存档，本页进度已保留，请刷新后连接。');
    if ((stored?.revision ?? 0) > response.revision) this.meta = stored;
    else {
      this.meta = { version: 1, recoveryCode: this.meta.recoveryCode, ...copy(response) };
      this._write(SYNC_KEY, this.meta);
    }
  }
  _apply(response, explicit = false) {
    if (this.disposed || (!explicit && this._entries().length)) return;
    if (!explicit && this.viewRevision !== null && response.revision < this.viewRevision) return;
    const changed = !same(this.localState, response.state);
    this.viewRevision = response.revision;
    this.localState = copy(response.state);
    this.lastMutation = null;
    if (changed || explicit) this.onState(copy(response.state));
  }
  _failure(error) {
    if (error.status === 401 || error.status === 404) {
      this._status('error', '服务器找不到此存档或恢复码无效。本机进度和恢复码已保留，不会新建覆盖。');
    } else if (error instanceof TypeError || error.name === 'AbortError') {
      this._status('offline', '服务器暂时无法连接，进度已保存在本机，联网后自动重试。');
    } else this._status('error', error.message || '同步失败，本机进度已保留。');
  }

  flush() {
    if (this.disposed || !this.meta) return Promise.resolve(this.getInfo());
    if (this.transition) return this.transition.then(() => this.getInfo(), () => this.getInfo());
    if (this.running) return this.running;
    clearTimeout(this.timer); this.timer = null;
    this.running = this._lock(() => this._flushLocked()).catch(error => this._failure(error))
      .then(() => this.getInfo()).finally(() => { this.running = null; });
    return this.running;
  }
  async _flushLocked() {
    const stored = this._read(SYNC_KEY);
    if (stored?.recoveryCode !== this.meta.recoveryCode) throw new Error('另一个页面切换了存档，本页进度已保留，请刷新后连接。');
    this.meta = stored;
    if (this.meta.create) {
      const response = await this._request('/api/v1/profiles', { method: 'POST', code: null,
        body: { recoveryCode: this.meta.recoveryCode, state: this.meta.create.state } });
      this._publish(response);
    }
    if (this._conflict()) { this._emit(); return; }
    // Every write is a compare-and-swap. A newer remote version cannot be
    // silently overwritten even when Web Locks are unavailable.
    while (!this.disposed) {
      const entries = this._entries();
      if (!entries.length) break;
      const entry = entries.find(item => !item.predecessor || !entries.some(other => other.mutationId === item.predecessor));
      if (!entry) throw new Error('待同步记录依赖异常，原始记录已保留。');
      const receipt = entry.predecessor ? this._read(`${PREFIX}receipt:${entry.predecessor}`) : null;
      const requestKey = `${PREFIX}request:${entry.mutationId}`;
      let request = this._read(requestKey);
      if (!request) {
        const baseRevision = receipt?.revision ?? entry.baseRevision;
        request = entry.kind === 'restore'
          ? { path: '/api/v1/restore', method: 'POST', body: { revision: entry.restoreRevision, baseRevision, mutationId: entry.mutationId } }
          : { path: '/api/v1/save', method: 'PUT', body: { state: entry.state, baseRevision, mutationId: entry.mutationId, reason: entry.reason } };
        this._write(requestKey, request);
      }
      let response;
      try { response = await this._request(request.path, request); }
      catch (error) {
        if (error.status === 409 && error.data?.current) {
          this._validateResponse(error.data.current);
          this._write(`${PREFIX}conflict:${entry.mutationId}`, error.data.current);
          this._status('conflict', '设备间进度冲突，两份均已保留，请选择保留哪份。');
          return;
        }
        throw error;
      }
      this._publish(response);
      // Persist the receipt before removing the request, so descendants and
      // restarted tabs can always establish their exact base revision.
      this._write(`${PREFIX}receipt:${entry.mutationId}`, { revision: response.mutationRevision ?? response.revision, createdAt: this.now() });
      this.storage.removeItem(entry.key);
      this.storage.removeItem(requestKey);
      this.storage.removeItem(`${PREFIX}conflict:${entry.mutationId}`);
      if (entry.actor === this.actor) this.viewRevision = response.mutationRevision ?? response.revision;
    }
    const response = this._validateResponse(await this._request('/api/v1/save'));
    this._publish(response);
    this._apply(this.meta);
    this._status(this._entries().length ? 'pending' : 'synced', this._entries().length
      ? '进度已保存在本机，等待同步到服务器。' : `已同步到服务器 · 第 ${this.meta.revision} 版`);
    this._pruneReceipts();
  }
  _pruneReceipts() {
    const needed = new Set(this._entries().map(entry => entry.predecessor).filter(Boolean));
    const keys = this._keys(`${PREFIX}receipt:`);
    // Keep recent receipts for tabs which have not yet received a storage event.
    if (keys.length < 200) return;
    for (const key of keys) {
      if (!needed.has(key.slice(`${PREFIX}receipt:`.length)) && this.now() - (this._read(key)?.createdAt ?? 0) > 86400000) this.storage.removeItem(key);
    }
  }

  async connect(code) {
    code = String(code).trim();
    if (!CODE_PATTERN.test(code)) throw new Error('恢复码格式不正确，应为 gxy_ 开头的完整恢复码。');
    return this._validateResponse(await this._request('/api/v1/save', { code }));
  }
  _transition(message, action) {
    if (this.transitioning) return Promise.reject(new Error('正在处理上一项存档操作，请稍候。'));
    this.transitioning = true;
    this.transitionMessage = message;
    this._status('loading', message);
    clearTimeout(this.timer); this.timer = null;
    this.transition = (async () => {
      try {
        if (this.running) await this.running;
        await this._lock(action);
      } catch (error) {
        this._failure(error);
        throw error;
      } finally {
        this.transitioning = false;
        this.transition = null;
        this._emit();
      }
      return this.getInfo();
    })();
    return this.transition;
  }
  async activateProfile(code, response) {
    code = String(code).trim();
    if (!CODE_PATTERN.test(code)) throw new Error('恢复码格式不正确。');
    this._validateResponse(response);
    return this._transition('正在连接选择的存档，请稍候…', async () => {
      const sequence = this.sequence;
      const originalEntries = new Set(this._entries().map(entry => entry.mutationId));
      // Refresh the preview under the requested credential before switching.
      const current = this._validateResponse(await this._request('/api/v1/save', { code }));
      if (this._read(SYNC_KEY)?.recoveryCode !== this.meta?.recoveryCode) throw new Error('另一个页面切换了存档，请刷新后再连接。');
      const previousEntries = this._entries();
      if (sequence !== this.sequence || previousEntries.some(entry => !originalEntries.has(entry.mutationId))) {
        throw new Error('连接期间本机产生了新进度，已保留这份进度；请再次确认连接。');
      }
      this._backup('switch-profile', { meta: this.meta, state: this.localState, pending: previousEntries });
      for (const entry of previousEntries) {
        this.storage.removeItem(entry.key);
        this.storage.removeItem(`${PREFIX}request:${entry.mutationId}`);
        this.storage.removeItem(`${PREFIX}conflict:${entry.mutationId}`);
      }
      this.meta = { version: 1, recoveryCode: code, ...copy(current) };
      this._write(SYNC_KEY, this.meta);
      this._apply(current, true);
      this._status('synced', `已连接服务器存档 · 第 ${current.revision} 版`);
    });
  }
  async resolveConflict(choice) {
    if (!['local', 'server'].includes(choice)) throw new Error('请选择本机或服务器进度。');
    return this._transition('正在按选择处理两份进度，请稍候…', async () => {
      const conflict = this._conflict();
      if (!conflict) { await this._flushLocked(); return; }
      const sequence = this.sequence;
      const originalEntries = new Set(this._entries().map(entry => entry.mutationId));
      const current = this._validateResponse(await this._request('/api/v1/save'));
      if (this._read(SYNC_KEY)?.recoveryCode !== this.meta?.recoveryCode) throw new Error('另一个页面切换了存档，请刷新后再处理。');
      const entries = this._entries();
      if (sequence !== this.sequence || entries.some(entry => !originalEntries.has(entry.mutationId))) {
        throw new Error('处理期间本机又有新进度，两份仍已保留，请重新选择。');
      }
      if (!this._read(conflict.entry.key)) { await this._flushLocked(); return; }
      // A local-over-server choice applies to the version shown in the preview.
      // If it changed, display the new comparison instead of overwriting unseen play.
      if (choice === 'local' && current.revision !== conflict.server.revision) {
        this._write(`${PREFIX}conflict:${conflict.entry.mutationId}`, current);
        this._status('conflict', '服务器又有新进度，已更新对比，请重新选择。');
        return;
      }
      const state = copy(entries.at(-1)?.state ?? this.localState);
      this._backup(`conflict-${choice}`, { meta: this.meta, state, pending: entries, server: current });
      let replacement;
      if (choice === 'local') {
        replacement = { mutationId: this._id(), actor: this.actor, recoveryCode: this.meta.recoveryCode,
          baseRevision: current.revision, predecessor: null, state, reason: 'conflict-resolution', createdAt: this.now(), sequence: ++this.sequence, kind: 'save' };
        this._write(`${PREFIX}pending:${replacement.mutationId}`, replacement);
      }
      for (const entry of entries) {
        this.storage.removeItem(entry.key);
        this.storage.removeItem(`${PREFIX}request:${entry.mutationId}`);
        this.storage.removeItem(`${PREFIX}conflict:${entry.mutationId}`);
      }
      this._publish(current);
      this.viewRevision = current.revision;
      this.lastMutation = replacement?.mutationId ?? null;
      if (choice === 'server') this._apply(current, true);
      else { this.localState = state; this.onState(copy(state)); }
      await this._flushLocked();
    });
  }
  async history() {
    if (!this.meta?.profileId) throw new Error('请先将存档同步到服务器。');
    return this._request('/api/v1/history');
  }
  async restore(revision) {
    if (!Number.isInteger(Number(revision)) || Number(revision) < 1) throw new Error('存档版本无效。');
    return this._transition('正在恢复选择的历史版本，请稍候…', async () => {
      await this._flushLocked();
      if (this._entries().length || !this.meta?.profileId || this.status !== 'synced') throw new Error('请先完成同步或解决冲突，再恢复历史版本。');
      this._backup('before-restore', { meta: this.meta, state: this.localState });
      const mutationId = this._id();
      this._write(`${PREFIX}pending:${mutationId}`, { mutationId, actor: this.actor,
        recoveryCode: this.meta.recoveryCode, baseRevision: this.meta.revision, predecessor: null,
        state: copy(this.localState), restoreRevision: Number(revision), kind: 'restore', reason: 'restore', createdAt: this.now(), sequence: ++this.sequence });
      this.lastMutation = mutationId;
      await this._flushLocked();
    });
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer); clearInterval(this.pollTimer);
    this.events?.removeEventListener('online', this._online);
    this.events?.removeEventListener('storage', this._storage);
  }
}
