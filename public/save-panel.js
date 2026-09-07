import { sanitizeState, levelInfo } from './pet-state.js';

const escapeText = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const codePattern = /^gxy_[a-f0-9]{64}$/;
const summary = state => `Lv. ${levelInfo(state.xp).level} · ${state.xp} 经验 · ${state.stars} 星光 · ${state.wins} 次守护`;
const reasonLabel = reason => ({ initial:'初次保存', gameplay:'陪伴与冒险', autosave:'自动保存', save:'进度更新', import:'导入进度', 'conflict-resolution':'选择保留进度' }[reason] || (/^restore:\d+$/.test(reason || '') ? `恢复自版本 ${reason.split(':')[1]}` : '进度更新'));
const timeLabel = value => {
  const date = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false });
};
function download(value, name) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Settings show server acknowledgement separately from durable local changes. */
export function mountSavePanel(container, { sync, getState, onImport, notify, canModify = () => true }) {
  const $ = id => container.querySelector(`#${id}`);
  const info = sync?.getInfo() || {};
  const ready = () => { if (canModify()) return true; notify('正在核对服务器进度，请稍等后再操作。'); return false; };
  container.innerHTML = `
    <p class="dialog-lede">成长进度会自动保存到服务器，本机也留有备份。保存恢复码，换一台设备也能回到同一个银河身边。</p>
    <div class="cloud-summary"><div><span class="eyebrow">YOUR PROGRESS, SAFE AND SOUND</span><strong id="panelSyncStatus">正在检查存档</strong><p id="panelSyncMessage"></p></div><button class="dialog-button" id="syncNowBtn">立即同步 ↗</button></div>
    <div id="conflictSection"></div>
    <section class="settings-block"><h3>我的恢复码</h3><p>恢复码是这份存档的钥匙。请自己保管；在其他设备输入它，就能继续同一份进度。</p><div class="recovery-code-row"><input id="recoveryCode" type="password" readonly autocomplete="off" aria-label="我的存档恢复码" spellcheck="false"><button class="dialog-button" id="revealCodeBtn" aria-pressed="false">显示</button><button class="dialog-button" id="copyCodeBtn">复制</button></div><div class="settings-actions" style="margin-top:12px"><button class="dialog-button" id="recoveryDownloadBtn">下载恢复文件 ↓</button></div><p class="recovery-footnote">恢复文件包含恢复码及当前进度副本，请保存在自己的设备中。</p></section>
    <section class="settings-block"><h3>在这台设备继续已有存档</h3><p>输入另一台设备上的恢复码，先核对成长进度，再确认连接。当前本机进度会保留一份备份。</p><div class="recovery-connect-row"><input id="connectCode" type="password" autocomplete="off" aria-label="输入另一份存档恢复码" placeholder="粘贴 gxy_ 开头的恢复码" spellcheck="false"><button class="dialog-button" id="connectBtn">读取存档</button></div><div id="connectFeedback" role="status"></div></section>
    <section class="settings-block"><h3>进度文件备份</h3><p>导出 JSON 文件，可以独立保存现在的进度。导入前会展示进度，确认后作为新的存档版本保存。</p><div class="settings-actions"><button class="dialog-button primary" id="exportBtn">导出当前进度 ↓</button><button class="dialog-button" id="importBtn">导入进度 ↑</button></div><input type="file" id="importFile" accept=".json,application/json" hidden><div id="importFeedback" role="status"></div></section>
    <section class="settings-block"><h3>回看服务器历史</h3><p>每次保存都会留下版本记录。如需回到之前的进度，可以在这里选择；恢复前的版本仍保留在历史中。</p><button class="dialog-button" id="historyBtn">查看最近存档</button><div id="historyContent" role="status"></div></section>`;
  if (info.recoveryCode) $('recoveryCode').value = info.recoveryCode;
  $('revealCodeBtn').onclick = () => {
    const reveal = $('recoveryCode').type === 'password';
    $('recoveryCode').type = reveal ? 'text' : 'password';
    $('revealCodeBtn').textContent = reveal ? '隐藏' : '显示'; $('revealCodeBtn').setAttribute('aria-pressed', reveal);
  };
  const currentCode = () => sync?.getInfo().recoveryCode || '';
  $('copyCodeBtn').onclick = async () => {
    const code = currentCode(); if (!codePattern.test(code)) return notify('恢复码尚未生成，请稍后再试。');
    try { await navigator.clipboard.writeText(code); notify('恢复码已复制，请妥善保管。'); }
    catch { $('recoveryCode').type = 'text'; $('recoveryCode').focus(); $('recoveryCode').select(); notify('已选中恢复码，请长按或按复制快捷键复制。'); }
  };
  $('recoveryDownloadBtn').onclick = () => {
    const code = currentCode(); if (!codePattern.test(code)) return notify('恢复码尚未生成，请先导出进度文件。');
    download({ format:'galaxy-recovery', version:1, recoveryCode:code, state:getState() }, `galaxy-recovery-${new Date().toISOString().slice(0,10)}.json`);
    notify('已开始下载恢复文件。');
  };
  async function refreshConnection(code) {
    if (!sync) throw new Error('存档同步尚未初始化，请刷新页面后重试。');
    const head = await sync.connect(code);
    const target = $('connectFeedback');
    target.innerHTML = `<div class="save-preview"><p>找到服务器存档 · 版本 ${head.revision}</p><p>${escapeText(summary(sanitizeState(head.state)))}</p><p>确认后继续这份存档，当前本机副本会保留。</p><button class="dialog-button primary" id="activateProfileBtn">确认连接这份存档</button></div>`;
    $('activateProfileBtn').onclick = async event => {
      if (!ready()) return;
      event.target.disabled = true;
      try { await sync.activateProfile(code, head); mountSavePanel(container, { sync, getState, onImport, notify, canModify }); notify('已连接原来的存档，可以继续冒险了。'); }
      catch (error) { target.textContent = error.message; }
    };
  }
  $('connectBtn').onclick = async event => {
    event.target.disabled = true; $('connectFeedback').textContent = '正在读取服务器存档…';
    try { await refreshConnection($('connectCode').value.trim()); }
    catch (error) { $('connectFeedback').textContent = error.message; }
    finally { if ($('connectBtn')) $('connectBtn').disabled = false; }
  };
  $('syncNowBtn').onclick = async event => {
    if (!sync) return notify('同步服务尚未初始化，请先导出本机进度。');
    event.target.disabled = true;
    try { const result = await sync.flush(); showConflict(result); notify(result.status === 'synced' ? '进度已保存到服务器。' : result.message || '请检查存档状态。'); }
    finally { if ($('syncNowBtn')) $('syncNowBtn').disabled = false; }
  };
  $('exportBtn').onclick = () => { download(getState(), `galaxy-companion-${new Date().toISOString().slice(0,10)}.json`); $('importFeedback').textContent = '进度文件已开始下载。'; };
  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').onchange = async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 100000) throw new Error('文件过大，请选择银河小伙伴导出的 JSON 文件。');
      const raw = JSON.parse(await file.text());
      const recovery = raw.format === 'galaxy-recovery' && codePattern.test(raw.recoveryCode || '') ? raw.recoveryCode : null;
      const imported = sanitizeState(recovery ? raw.state : raw);
      const target = $('importFeedback');
      target.innerHTML = `<div class="save-preview"><p>文件中的进度：${escapeText(summary(imported))}</p><p>导入将替换当前进度，并保留当前本机副本及已同步的服务器历史。</p><div class="settings-actions">${recovery ? '<button class="dialog-button primary" id="connectRecoveryBtn">用恢复码连接服务器</button>' : ''}<button class="dialog-button ${recovery ? '' : 'primary'}" id="confirmImport">确认使用这份进度</button><button class="dialog-button" id="cancelImport">取消</button></div></div>`;
      $('confirmImport').onclick = () => {
        if (!ready()) return;
        try { localStorage.setItem(`aoteman-before-import-${Date.now()}`, JSON.stringify(getState())); }
        catch { target.textContent = '无法保留本机备份，请先导出当前进度后重试。'; return; }
        onImport(imported);
      };
      $('cancelImport').onclick = () => target.textContent = '已取消，当前进度保持不变。';
      if (recovery) $('connectRecoveryBtn').onclick = async () => {
        $('connectCode').value = recovery;
        try { await refreshConnection(recovery); $('connectFeedback').scrollIntoView({ block:'nearest' }); }
        catch (error) { target.textContent = `${error.message} 文件内的进度副本仍保留在下载文件中。`; }
      };
    } catch (error) { $('importFeedback').textContent = error instanceof SyntaxError ? '文件不是有效的 JSON 存档，当前进度保持不变。' : error.message; }
    event.target.value = '';
  };
  function showConflict(current = sync?.getInfo()) {
    const target = $('conflictSection'); if (!target) return;
    if (!current?.conflict) { target.innerHTML = ''; return; }
    const local = current.conflict.local?.state || current.conflict.local;
    const remote = current.conflict.server?.state || current.conflict.server;
    target.innerHTML = `<div class="conflict-panel"><h3>两份成长，都先保留下来。</h3><p>另一台设备也更新了这份存档。选择后会留下备份，未经选择不会覆盖服务器进度。</p><div class="save-comparison"><div><small>本机进度</small><strong>${escapeText(summary(sanitizeState(local)))}</strong></div><div><small>服务器进度</small><strong>${escapeText(summary(sanitizeState(remote)))}</strong></div></div><div class="settings-actions"><button class="dialog-button" id="downloadConflictBtn">先下载本机副本</button><button class="dialog-button" data-conflict="local">继续本机进度</button><button class="dialog-button primary" data-conflict="server">继续服务器进度</button></div><p id="conflictFeedback" role="status"></p></div>`;
    $('downloadConflictBtn').onclick = () => download(local, `galaxy-conflict-local-${Date.now()}.json`);
    target.querySelectorAll('[data-conflict]').forEach(button => button.onclick = async () => {
      if (!ready()) return;
      target.querySelectorAll('button').forEach(item => item.disabled = true);
      try { const result = await sync.resolveConflict(button.dataset.conflict); showConflict(result); notify(result.status === 'synced' ? '已按选择保存进度，原副本也已保留。' : result.message); }
      catch (error) { if ($('conflictFeedback')) $('conflictFeedback').textContent = error.message; target.querySelectorAll('button').forEach(item => item.disabled = false); }
    });
  }
  showConflict();
  $('historyBtn').onclick = async event => {
    if (!sync) return;
    event.target.disabled = true;
    const target = $('historyContent'); target.textContent = '正在读取存档历史…';
    try {
      const result = await sync.history(), versions = result.versions || [];
      target.innerHTML = versions.length ? `<div class="history-list">${versions.map(version => `<div class="history-row"><div><strong>版本 ${version.revision}</strong><small>${escapeText(timeLabel(version.createdAt))} · ${escapeText(reasonLabel(version.reason))}</small></div><span>${version.xp} 经验<br>${version.stars} 星光 · ${version.wins} 胜</span><button class="dialog-button" data-history="${version.revision}" ${version.revision === sync.getInfo().revision ? 'disabled' : ''}>${version.revision === sync.getInfo().revision ? '当前' : '恢复'}</button></div>`).join('')}</div><div id="restorePreview"></div>` : '暂时还没有服务器历史，请先完成一次同步。';
      target.querySelectorAll('[data-history]').forEach(button => button.onclick = () => {
        const version = versions.find(item => item.revision === Number(button.dataset.history));
        $('restorePreview').innerHTML = `<div class="save-preview"><p>准备恢复版本 ${version.revision}：${version.xp} 经验、${version.stars} 星光、${version.wins} 次守护。</p><p>当前已同步的版本仍可从历史中找回。请先完成待同步的进度。</p><button class="dialog-button primary" id="confirmRestoreBtn">确认恢复这个版本</button></div>`;
        $('restorePreview').scrollIntoView({ block:'nearest' });
        $('confirmRestoreBtn').onclick = async event => {
          if (!ready()) return;
          event.target.disabled = true;
          try { const result = await sync.restore(version.revision); if (result.status !== 'synced') throw new Error(result.message); mountSavePanel(container, { sync, getState, onImport, notify, canModify }); notify('已恢复历史进度，并保存为一个新版本。'); }
          catch (error) { if ($('restorePreview')) $('restorePreview').textContent = error.message; }
        };
      });
    } catch (error) { target.textContent = error.message; }
    finally { if ($('historyBtn')) $('historyBtn').disabled = false; }
  };
  const labels = { synced:'服务器已保存', pending:'进度等待同步', offline:'本机已保存 · 待同步', error:'同步需要处理', conflict:'两份进度待选择', loading:'连接存档中' };
  $('panelSyncStatus').textContent = `${labels[info.status] || '存档初始化中'}${info.revision ? ` · 版本 ${info.revision}` : ''}`;
  $('panelSyncMessage').textContent = info.message || '';
}
