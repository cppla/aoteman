import { heroSVG, monsterSVG } from './characters.js';
import { openBattle, MONSTERS } from './battle.js';
import { SAVE_KEY, LEGACY_KEY, freshState, sanitizeState, passTime, levelInfo, mutate, care, dailyReady, claimDaily, startExpedition, settleExpedition, MILESTONES, milestoneProgress, claimMilestone, renameCompanion } from './pet-state.js';
import { SaveSync } from './save-sync.js';
import { mountSavePanel } from './save-panel.js';
import { mountJourneyPanel, companionSuggestion } from './growth-panel.js';
import { openDefenseDojo } from './defense-dojo.js';

const $ = id => document.getElementById(id);
const paths = {
  spark: '<path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8Z"/><path d="m19 2 .8 2.2L22 5l-2.2.8L19 8l-.8-2.2L16 5l2.2-.8Z"/>',
  bolt: '<path d="m14 2-9 12h7l-2 8 9-12h-7Z"/>',
  food: '<path d="M4 11h16c0 5-3 9-8 9s-8-4-8-9ZM3 11h18M9 20v2h6v-2M8 3c-2 2 2 3 0 5M12 2c-2 2 2 3 0 5M16 3c-2 2 2 3 0 5"/>',
  heart: '<path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 6l-1.1-1.2a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-9.4a5.5 5.5 0 0 0 0-7.8Z"/>',
  moon: '<path d="M20 15.3A8.7 8.7 0 0 1 8.7 4 8.7 8.7 0 1 0 20 15.3Z"/><path d="M17 2v5m-2.5-2.5h5M21 8v3m-1.5-1.5h3"/>',
  shield: '<path d="m12 2 9 4v6c0 5-6 9-9 10-3-1-9-5-9-10V6Z"/><path d="m8 8 8 8m0-8-8 8"/>',
  swords: '<path d="m14 4 6-2-2 6L6 20l-2-2ZM3 15l6 6M9 9l-3-5-4-2 2 6 3 3m8 4 5 5m-5 1 6-6"/>',
  mute: '<path d="M11 3 5 8H2v8h3l6 5ZM16 9l6 6m0-6-6 6"/>',
  sound: '<path d="M11 3 5 8H2v8h3l6 5ZM15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  settings: '<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="9" cy="5" r="2" fill="var(--bg)"/><circle cx="16" cy="12" r="2" fill="var(--bg)"/><circle cx="8" cy="19" r="2" fill="var(--bg)"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  gift: '<path d="M3 8h18v4H3ZM5 12v10h14V12M12 8v14"/><path d="M12 8C2 8 5-2 12 8Zm0 0c10 0 7-10 0 0Z"/>',
  landscape: '<rect x="2" y="3" width="20" height="18" rx="3"/><path d="m2 17 6-6 5 5 3-3 6 6"/><circle cx="16" cy="8" r="2"/>',
  orbit: '<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="12" ry="5" transform="rotate(-40 12 12)"/><path d="M6 3h.01M20 19h.01"/>',
  trophy: '<path d="M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v4a4 4 0 0 0 4 4m10-8h4v4a4 4 0 0 1-4 4M12 15v5m-5 2h10m-8-2h6"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
const decorate = (root = document) => root.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const escapeText = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state = freshState(), storageOK = true, storageMessage = '', busy = false, battleActive = false, currentBattle = null, lastStoredRaw = null;
let poseTimer, toastTimer, lastPet = 0, audioContext, currentDojo, journeyView;
let dojoActive = false;
let cloud, cloudBooting = true, cloudInfo = { status: 'loading', message: '正在连接服务器存档' };
try {
  lastStoredRaw = localStorage.getItem(SAVE_KEY);
  const raw = lastStoredRaw || localStorage.getItem(LEGACY_KEY);
  if (raw) {
    try { state = sanitizeState(JSON.parse(raw)); }
    catch {
      localStorage.setItem(`${SAVE_KEY}-recovery`, raw);
      storageMessage = '旧存档无法读取，已保留原始备份并开始新的冒险。';
    }
    if (!localStorage.getItem('aoteman-before-server-migration')) localStorage.setItem('aoteman-before-server-migration', raw);
  }
} catch { storageOK = false; }
passTime(state);
$('petHero').innerHTML = heroSVG('home');
decorate();
$('journeyRoute').innerHTML = MILESTONES.map((item, index) => `<button class="journey-stop" data-journey="${item.id}"><span class="route-point">${String(index + 1).padStart(2, '0')}</span><strong>${escapeText(item.title)}</strong><small>一起完成</small></button>`).join('');

function syncExternalState() {
  // The API sync layer owns cross-tab revisions; a shared cache is not authoritative.
  if (cloud) return false;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw && raw !== lastStoredRaw) {
      const incoming = sanitizeState(JSON.parse(raw));
      state = incoming; lastStoredRaw = raw; passTime(state);
      if (!battleActive) { clearTimeout(poseTimer); busy = false; $('petHero').dataset.pose = state.sleeping ? 'sleep' : 'idle'; }
      render(); return true;
    }
  } catch { /* Preserve the current playable state when another write is invalid. */ }
  return false;
}
function save({ server = true, reason = 'gameplay' } = {}) {
  try {
    // Do not replace newer progress from another tab with a stale in-memory copy.
    if (syncExternalState()) notify('已同步另一个页面的新进度。');
    lastStoredRaw = JSON.stringify(state); localStorage.setItem(SAVE_KEY, lastStoredRaw); storageOK = true;
  }
  catch { storageOK = false; }
  if (server && cloud) cloud.enqueue(state, { reason });
  updateSaveStatus();
}
function updateSaveStatus(info = cloudInfo) {
  const wasTransitioning = Boolean(cloudInfo.transition);
  cloudInfo = info;
  const labels = { loading: '连接存档中', synced: '服务器已保存', pending: '正在同步进度', offline: '本机已保存 · 待同步', conflict: '两份进度待选择', error: '存档同步需处理' };
  const status = info.status || 'loading';
  $('saveStatus').innerHTML = `<i></i>${labels[status] || '检查存档状态'}`;
  $('saveStatus').dataset.status = status;
  $('saveStatus').classList.toggle('error', ['offline','conflict','error'].includes(status) || !storageOK);
  $('saveStatus').title = info.message || labels[status];
  const banner = $('cloudBanner');
  banner.hidden = !['offline','conflict','error'].includes(status) && storageOK;
  $('cloudBannerText').textContent = !storageOK ? '浏览器暂时不能保存本机备份，请下载进度文件并检查服务器同步状态。' : status === 'conflict' ? '另一台设备也更新了进度。两份存档都已保留，请选择要继续的一份。' : status === 'offline' ? '暂时连不上服务器，进度已留在本机，连接恢复后继续同步。' : info.message || '存档同步需要处理，请打开存档设置。';
  const panelStatus = $('panelSyncStatus');
  if (panelStatus) panelStatus.textContent = `${labels[status] || '检查存档状态'}${info.revision ? ` · 版本 ${info.revision}` : ''}`;
  const panelMessage = $('panelSyncMessage'); if (panelMessage) panelMessage.textContent = info.message || '';
  if (wasTransitioning !== Boolean(info.transition)) render();
}
function notify(text) {
  clearTimeout(toastTimer); $('toast').textContent = text; $('toast').hidden = false;
  toastTimer = setTimeout(() => $('toast').hidden = true, 3500);
}
function say(text, journal = false) {
  $('speech').textContent = text; $('activityText').textContent = text;
  if (journal) { state.journal.unshift({ text, at: Date.now() }); state.journal = state.journal.slice(0, 30); }
}
function sound(kind = 'pet') {
  if (!state.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') void audioContext.resume().catch(() => {});
    const notes = { pet:[587,784], feed:[440,660,880], train:[220,330], punch:[160,90], beam:[350,750,1050], block:[660,990], hurt:[170,120], win:[523,659,784,1047], transform:[261,392,523,784], sleep:[392,330,261] };
    (notes[kind] || notes.pet).forEach((freq, i) => {
      const osc = audioContext.createOscillator(), gain = audioContext.createGain(), time = audioContext.currentTime + i * .085;
      osc.type = ['punch','hurt'].includes(kind) ? 'triangle' : 'sine'; osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(.07, time + .015); gain.gain.exponentialRampToValueAtTime(.001, time + .2);
      osc.connect(gain); gain.connect(audioContext.destination); osc.start(time); osc.stop(time + .22);
    });
  } catch { /* Sound is optional; gameplay remains available. */ }
}
function floatReward(text) {
  const el = document.createElement('div'); el.className = 'reward-float'; el.textContent = text;
  $('habitat').append(el); setTimeout(() => el.remove(), 1800);
}
function setPose(pose, duration = 1500) {
  clearTimeout(poseTimer); $('petHero').dataset.pose = pose;
  if (duration) poseTimer = setTimeout(() => { $('petHero').dataset.pose = state.sleeping ? 'sleep' : 'idle'; busy = false; render(); }, duration);
}
function playAction(pose, text, duration = 1500) {
  busy = true; setPose(pose, duration); if (text) floatReward(text); render();
}
function leveled(before) {
  const level = levelInfo(state.xp).level;
  if (level > before) { say(`新的光芒！${state.companionName}升到 Lv. ${level} 啦，谢谢你陪我长大。`, true); floatReward(`升级！Lv. ${level}`); sound('win'); }
}
const sceneNames = { base:'星光基地', moon:'静谧月海', sunset:'落日之城' };
function render() {
  const saveBusy = cloudBooting || cloudInfo.transition || dojoActive;
  const level = levelInfo(state.xp);
  $('companionName').textContent = state.companionName === '银河' ? '银河奥特曼' : state.companionName;
  $('welcomeCopy').textContent = `照顾${state.companionName}，陪他长大。今天也一起守护这片宇宙。`;
  $('petBtn').setAttribute('aria-label', `摸摸${state.companionName}奥特曼`);
  $('renameBtn').disabled = saveBusy || busy || battleActive;
  for (const key of ['food','energy','mood']) {
    const val = Math.round(state[key]); $(key + 'Value').innerHTML = `${val}<small>/100</small>`;
    $(key + 'Fill').style.width = `${val}%`; $(key + 'Bar').setAttribute('aria-valuenow', val);
  }
  $('levelBadge').innerHTML = `LV.<b>${level.level}</b>`;
  $('rankTitle').textContent = `${level.level < 3 ? '初生之光' : level.level < 6 ? '闪耀新星' : level.level < 10 ? '星际勇士' : '银河守护者'} · 你的宇宙搭档`;
  $('xpText').textContent = level.level === 100 ? 'MAX · 银河守护者' : `${level.remaining} / ${level.needed} XP`;
  $('xpFill').style.width = `${Math.min(100, level.remaining / level.needed * 100)}%`;
  $('xpBar').setAttribute('aria-valuenow', level.remaining); $('xpBar').setAttribute('aria-valuemax', level.needed);
  for (const key of ['stars','wins','training']) $(key + 'Value').textContent = state[key].toLocaleString('zh-CN');
  $('dayValue').textContent = String(Math.floor((Date.now() - state.born) / 86400000) + 1).padStart(2, '0');
  $('habitat').dataset.scene = state.scene; $('sceneLabel').textContent = sceneNames[state.scene];
  $('habitat').classList.toggle('sleeping', state.sleeping); $('habitat').classList.toggle('grown', state.grown);
  $('transformBtn').setAttribute('aria-pressed', state.grown); $('transformText').textContent = state.grown ? '变回小伙伴' : '银河变身';
  $('moodTag').textContent = state.sleeping ? '星光充电中' : state.food < 25 ? '有点饿啦' : state.energy < 25 ? '需要休息' : state.mood < 40 ? '想要摸摸' : '元气满满';
  $('restTitle').textContent = state.sleeping ? '轻轻唤醒' : '星光休息'; $('restSubtitle').textContent = state.sleeping ? '每 3 秒恢复 8 活力' : '恢复活力，做个好梦';
  for (const id of ['feedBtn','trainBtn','defendBtn','transformBtn','fightBtn']) $(id).disabled = busy || battleActive || state.sleeping || saveBusy;
  for (const id of ['restBtn','petBtn']) $(id).disabled = busy || battleActive || saveBusy;
  $('sceneBtn').disabled = busy || battleActive || saveBusy;
  for (const id of ['soundBtn','difficultySelect','monsterSelect']) $(id).disabled = saveBusy;
  $('difficultySelect').value = state.difficulty;
  $('soundBtn').setAttribute('aria-pressed', state.sound); $('soundBtn').setAttribute('aria-label', state.sound ? '关闭音效' : '开启音效');
  $('soundBtn').title = state.sound ? '关闭音效' : '开启音效'; $('soundBtn').innerHTML = icon(state.sound ? 'sound' : 'mute');
  const completed = [state.daily.fed >= 1, state.daily.training >= 1, state.daily.battles >= 1];
  ['dailyFeed','dailyTrain','dailyBattle'].forEach((id, index) => { $(id).classList.toggle('done', completed[index]); $(id).querySelector('.task-check').textContent = completed[index] ? '✓' : ''; });
  $('missionCount').textContent = `${completed.filter(Boolean).length} / 3`;
  $('claimBtn').disabled = busy || battleActive || saveBusy || state.daily.claimed || !dailyReady(state);
  $('claimBtn').classList.toggle('ready', dailyReady(state) && !state.daily.claimed);
  $('claimTitle').textContent = state.daily.claimed ? '星光礼已领取' : '今日星光礼';
  $('claimSubtitle').textContent = state.daily.claimed ? '明天再一起收集光芒' : '完成计划 · 15 星光 + 25 经验';
  const suggestion = companionSuggestion(state);
  $('suggestionTitle').textContent = suggestion.title;
  $('suggestionCopy').textContent = suggestion.copy;
  $('suggestionBtn').textContent = `${suggestion.label} ↗`;
  $('suggestionBtn').disabled = busy || battleActive || saveBusy;
  $('journeyCount').textContent = `${state.milestones.length} / ${MILESTONES.length}`;
  const available = MILESTONES.filter(item => milestoneProgress(state, item).ready).length;
  $('journeyCopy').textContent = available ? `${available} 份成长礼物已经准备好，收藏我们一起做到的事。` : state.milestones.length === MILESTONES.length ? '八站航线全部点亮，接下来继续写属于你们的故事。' : '每一颗星光，都在让我们成为更好的搭档。';
  for (const milestone of MILESTONES) {
    const button = document.querySelector(`[data-journey="${milestone.id}"]`), progress = milestoneProgress(state, milestone);
    button.dataset.status = progress.claimed ? 'claimed' : progress.ready ? 'ready' : 'growing';
    button.querySelector('small').textContent = progress.claimed ? '已收藏 ✓' : progress.ready ? '领取成长礼' : `${Math.min(progress.current, progress.target)} / ${progress.target}`;
    button.setAttribute('aria-label', `${milestone.title}，${button.querySelector('small').textContent}`);
  }
  journeyView?.update();
}

for (const [id, action, pose, text, reward, duration] of [
  ['feedBtn','feed','eat','啊呜！是星星的味道，充满能量啦。','饱食 +25 · 活力 +5',1800],
  ['trainBtn','train','train','银河出拳！每天进步一点点。','经验 +20 · 星光 +5',1800]
]) $(id).addEventListener('click', () => {
  if (busy || battleActive) return;
  const before = levelInfo(state.xp).level, result = care(state, action);
  if (!result.ok) return say(result.message);
  say(text, true); playAction(pose, reward, duration); sound(action); leveled(before); save(); render();
});
$('restBtn').onclick = () => {
  if (busy || battleActive) return;
  care(state, 'rest'); setPose(state.sleeping ? 'sleep' : 'wave', state.sleeping ? 0 : 1300);
  say(state.sleeping ? '呼噜…让我在星光里做个好梦。' : '醒来啦！又是闪闪发光的一天。', true);
  sound(state.sleeping ? 'sleep' : 'pet'); save(); render();
};
$('petBtn').onclick = () => {
  if (busy || battleActive) return;
  if (state.sleeping) return say('呼噜…梦里也在守护你呢。');
  if (Date.now() - lastPet < 4000) return say('嘿嘿，我也好喜欢和你待在一起！');
  lastPet = Date.now(); care(state, 'pet'); say('收到你的能量啦！最喜欢你了。');
  playAction('wave', '心情 +6 ♡', 1350); sound('pet'); save(); render();
};
$('defendBtn').onclick = launchDojo;
function launchDojo() {
  if (busy || battleActive || dojoActive || state.sleeping || cloudBooting || cloudInfo.transition) return;
  dojoActive = true;
  say('双手交叉——X！一起练习保护自己的时机。');
  setPose('defend', 0); render();
  const done = () => { dojoActive = false; currentDojo = null; setPose(state.sleeping ? 'sleep' : 'idle', 0); render(); $('defendBtn').focus(); };
  try { currentDojo = openDefenseDojo({ heroName: state.companionName, onSound: kind => sound(kind === 'defend' ? 'block' : kind), onClose: done }); }
  catch (error) { done(); console.error(error); notify('训练场暂时无法打开，请刷新后重试。'); }
}
$('transformBtn').onclick = () => {
  if (busy || battleActive || state.sleeping) return;
  state.grown = !state.grown; say(state.grown ? '星光汇聚——银河变身！' : '变回小小的我，继续陪在你身边。', true);
  playAction('transform', state.grown ? '光之巨人 · 觉醒' : '小小银河 · 回归', 1700); sound('transform'); save();
};
$('claimBtn').onclick = () => {
  const before = levelInfo(state.xp).level; if (!claimDaily(state)) return;
  say('今天的星光计划完成！谢谢你陪我度过闪亮的一天。', true); notify('星光 +15 · 经验 +25');
  playAction('victory', '今日计划完成！', 1600); sound('win'); leveled(before); save(); render();
};
$('soundBtn').onclick = () => { state.sound = !state.sound; sound('pet'); save(); render(); notify(state.sound ? '音效已开启' : '音效已关闭'); };
$('difficultySelect').onchange = e => { state.difficulty = e.target.value; save(); };
const monsterDescriptions = {
  obsidian: '暗星装甲兽出现在基地外，银河准备好了吗？',
  lava: '熔岩角兽正在蓄积火焰，准备好交叉防御！',
  cosmic: '宇宙电光兽穿过星际裂隙，注意它的攻击预警。'
};
// Keep the selection independent of the pet render cycle.
$('monsterSelect').onchange = e => { $('enemyDescription').textContent = monsterDescriptions[e.target.value]; document.querySelector('.mission-number').textContent = String(e.target.selectedIndex + 1).padStart(2, '0'); };
function launch(monsterId = $('monsterSelect').value) {
  if (busy || battleActive || dojoActive || cloudBooting || cloudInfo.transition) return;
  if (!startExpedition(state)) { say('出发需要 15 活力和 10 饱食度，先吃饱、休息好吧！'); notify('先补充星光或休息，银河准备好就能出发。'); return; }
  battleActive = true; save(); render();
  try {
    let resultSaved = false;
    const recordResult = result => {
      if (resultSaved) return;
      resultSaved = true; syncExternalState();
      settleExpedition(state, result, monsterId); save(); render();
    };
    currentBattle = openBattle({ monsterId, heroName: state.companionName, difficulty: state.difficulty, onSound: sound, onResult: recordResult, onComplete: result => {
      if (!battleActive) return;
      const before = levelInfo(state.xp).level;
      recordResult(result); battleActive = false; currentBattle = null;
      const name = MONSTERS.find(m => m.id === monsterId)?.name || '怪兽';
      say(result.outcome === 'win' ? `${name}击破！经验 +40，星光 +20，我们守护了这片宇宙。` : result.outcome === 'lose' ? '勇敢尝试，也是成长。获得 5 经验，整备后我们再出发！' : '银河平安归来。补充能量后，随时可以再次出发。', true);
      if (result.outcome === 'win') playAction('victory', '守护成功！', 2000);
      leveled(before); save(); render(); $('fightBtn').focus();
    }});
  } catch (error) {
    battleActive = false; currentBattle = null; mutate(state, { food: 10, energy: 15 }); save(); render();
    console.error(error); notify('战斗未能启动，已退还出发消耗。请刷新后重试。');
  }
}
$('fightBtn').onclick = () => launch();

const canInteract = () => !busy && !battleActive && !dojoActive && !cloudBooting && !cloudInfo.transition;
function performAction(action) {
  if (!canInteract()) return notify('伙伴正在忙，等一下就好。');
  if (action === 'journey') return showJourney();
  if (action === 'scenes') return showScenes();
  if (state.sleeping && action !== 'rest') { notify('伙伴正在休息，先轻轻唤醒他吧。'); return; }
  const ids = { feed:'feedBtn', train:'trainBtn', rest:'restBtn', pet:'petBtn', dojo:'defendBtn' };
  if (ids[action]) $(ids[action]).click();
  else if (['fight','defend'].includes(action)) launch();
}
$('suggestionBtn').onclick = () => performAction(companionSuggestion(state).action);
$('journeyBtn').onclick = () => showJourney();
$('journeyNav').onclick = () => showJourney();
$('journeyRoute').onclick = event => {
  const button = event.target.closest('[data-journey]');
  if (button) showJourney(button.dataset.journey);
};
function showJourney(focusId) {
  if (battleActive || dojoActive) return;
  openInfo('我们的成长航线', '', 'EIGHT LITTLE STEPS / A UNIVERSE AHEAD');
  journeyView = mountJourneyPanel($('dialogContent'), {
    getState: () => state, canAct: canInteract,
    onClaim: id => {
      if (!canInteract()) return;
      const before = levelInfo(state.xp).level, result = claimMilestone(state, id);
      if (!result.ok) return notify(result.message);
      say(`成长航线 · ${result.milestone.title}，我们一起做到了！`, true);
      sound('win'); leveled(before); save({ reason: `milestone:${id}` }); render();
      notify(`成长礼已收藏：${result.reward.stars} 星光 + ${result.reward.xp} 经验。`);
    },
    onAction: action => { $('infoDialog').close(); journeyView = null; performAction(action === 'journey' ? 'train' : action); }
  });
  if (focusId) $('dialogContent').querySelector(`[data-milestone="${focusId}"]`)?.scrollIntoView({ block:'nearest' });
}
$('renameBtn').onclick = () => {
  if (!canInteract()) return;
  openInfo('给这道光，起个名字。', `<p class="dialog-lede">以后，每一天都陪这个名字一起长大。昵称会跟着存档保存，也可以随时修改。</p><form class="name-form" id="nameForm"><label for="companionNameInput">你想怎样称呼小伙伴？</label><input id="companionNameInput" autocomplete="off" spellcheck="false" maxlength="24" required aria-describedby="nameHint nameFeedback"><div class="name-meta"><span id="nameHint">最多 12 个字符</span><span id="nameCount"></span></div><button class="dialog-button primary" type="submit" id="saveNameBtn">就叫这个名字 ↗</button><p class="name-feedback" id="nameFeedback" role="status"></p></form>`, 'A NAME FOR YOUR LITTLE LIGHT');
  const input = $('companionNameInput'); input.value = state.companionName;
  const count = () => { $('nameCount').textContent = `${[...input.value.trim()].length} / 12`; };
  input.oninput = () => { count(); input.removeAttribute('aria-invalid'); $('nameFeedback').textContent = ''; };
  $('nameForm').onsubmit = event => {
    event.preventDefault();
    if (!canInteract()) return;
    if (input.value.trim() === state.companionName) { $('infoDialog').close(); return; }
    const result = renameCompanion(state, input.value);
    if (!result.ok) { $('nameFeedback').textContent = result.message; input.setAttribute('aria-invalid','true'); input.focus(); return; }
    say(`从今天起，请叫我${state.companionName}。我们的故事，继续发光。`, true);
    save({ reason: 'rename' }); render(); $('infoDialog').close();
    setPose(state.sleeping ? 'sleep' : 'wave', state.sleeping ? 0 : 1400); sound('pet');
    notify(`你好，${state.companionName}！昵称已保存，正在同步到服务器。`);
  };
  count(); input.focus(); input.select();
};

function openInfo(title, content, eyebrow = 'GALAXY COMPANION') {
  if (battleActive || dojoActive) return;
  journeyView = null;
  $('dialogTitle').textContent = title; $('dialogEyebrow').textContent = eyebrow; $('dialogContent').innerHTML = content;
  decorate($('infoDialog')); if (!$('infoDialog').open) $('infoDialog').showModal();
}
$('closeDialog').onclick = () => $('infoDialog').close();
$('infoDialog').addEventListener('close', () => { journeyView = null; });
$('baseNav').onclick = () => { $('infoDialog').close(); $('habitat').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }); };
$('archiveNav').onclick = () => {
  openInfo('认识宇宙里的对手', `<p class="dialog-lede">看清预警，稳稳防御。每一次交锋，都是一起变强的机会。</p><div class="dialog-grid">${MONSTERS.map((monster, i) => `<article class="monster-card"><div class="monster-art"><div class="actor monster-actor" data-pose="idle">${monsterSVG(monster.id, `codex-${monster.id}`)}</div></div><h3>${escapeText(monster.name)}</h3><span class="mini-tag">${state.defeated.includes(monster.id) ? '✓ 已成功守护' : ['星际装甲 · 初阶','熔岩冲击 · 进阶','电光突袭 · 挑战'][i]}</span><p>${['坚硬的暗星装甲下，藏着一颗发光核心。蓄力时间充足，适合练习 X 防御。','从火山星球而来的角兽。火焰冲击更凶猛，留意每一次攻击预警。','游走星云的电光怪兽。节奏更快，积攒光能，用银河终结抓住胜机。'][i]}</p><button class="dialog-button" data-challenge="${monster.id}">挑战这位对手 ↗</button></article>`).join('')}</div>`, 'FIELD GUIDE / 03 DISCOVERIES');
  $('dialogContent').querySelectorAll('[data-challenge]').forEach(button => button.onclick = () => {
    $('monsterSelect').value = button.dataset.challenge; $('monsterSelect').dispatchEvent(new Event('change')); $('infoDialog').close(); launch(button.dataset.challenge);
  });
};
$('journalNav').onclick = () => {
  const achievements = [
    ['food','第一颗星光','完成第一次喂食',state.fed >= 1],['bolt','银河特训生','累计训练 5 次',state.training >= 5],['shield','坚实的光','战斗格挡 3 次',state.blocks >= 3],
    ['trophy','初次守护','赢得第一场战斗',state.wins >= 1],['orbit','宇宙探索者','击败全部 3 种怪兽',state.defeated.length >= 3],['spark','闪耀新星','成长至 Lv. 3',levelInfo(state.xp).level >= 3]
  ];
  openInfo('每一点成长，都在发光。', `<p class="dialog-lede">${state.training} 次特训，${state.wins} 次守护，${state.blocks} 次成功格挡。我们的故事还在继续。</p><div class="achievement-grid">${achievements.map(([symbol,title,description,unlocked]) => `<div class="achievement ${unlocked ? 'unlocked' : ''}"><span data-icon="${symbol}"></span><b>${title}</b><small>${unlocked ? '已点亮 · ' : ''}${description}</small></div>`).join('')}</div><div class="card-overline" style="margin-bottom:12px">OUR RECENT MEMORIES / 最近 30 条</div>${state.journal.length ? `<ul class="journal-list">${state.journal.map(entry => `<li><time>${new Date(entry.at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})}</time><span>${escapeText(entry.text)}</span></li>`).join('')}</ul>` : '<p class="empty-journal">先喂一颗星光，写下故事的第一页吧。</p>'}`, 'GROWING TOGETHER');
};
$('helpBtn').onclick = () => openInfo('你好，银河的新搭档。', `<p class="dialog-lede">你的小小奥特曼不会死亡，也不用急着完成什么。喂点星光、摸摸他，一起慢慢长大就好。</p><div class="guide-grid"><div class="guide-item"><b>01 / 好好照顾</b><p>喂食免费：+25 饱食、+5 活力、+5 心情。特训消耗 8 饱食、12 活力，获得 20 经验和 5 星光。点击银河可摸摸他。</p></div><div class="guide-item"><b>02 / 休息与变身</b><p>休息每 3 秒恢复 8 活力，可随时唤醒。「银河变身」让小伙伴变成光之巨人；「防御练习」进入免费训练场，练习 3 轮预警与格挡，不消耗资源。</p></div><div class="guide-item"><b>03 / 选择出击</b><p>每场战斗消耗 15 活力、10 饱食。1 银河拳积攒光能，2 银河光线消耗光能，3 满能量释放终结。绿色区域攻击更强。</p></div><div class="guide-item"><b>04 / 交叉双臂，守护你</b><p>怪兽预警时按 4 或点 X 防御，普通格挡减伤 90%，最后一小段时间完美格挡可免伤。5 可闪避，战斗中可点暂停；离开页面会自动暂停。</p></div></div><p class="guide-note">完成战斗可推进每日计划，撤退不计入；胜利获得 40 经验与 20 星光，失败也有 5 经验。星光可以解锁场景。成长航线包含 8 个长期目标，每站都能领取一次奖励；点击状态卡的昵称按钮，可给伙伴起名字。进度会自动同步到服务器。换设备时输入同一恢复码，或下载恢复文件随身备份。离线状态最多结算 8 小时。</p>`, 'NEW PARTNER HANDBOOK');
$('sceneBtn').onclick = showScenes;
function showScenes() {
  openInfo('给银河，一个喜欢的家。', `<p class="dialog-lede">已收集 ${state.stars} 星光。用训练与守护得到的星光，解锁新的风景。</p><div class="dialog-grid">${[['base',0,'最初相遇的地方'],['moon',30,'和月亮一起安静发光'],['sunset',50,'把日落装进每一天']].map(([id,cost,desc]) => `<button class="scene-card ${id} ${state.scene === id ? 'selected' : ''}" data-scene-choice="${id}" data-cost="${cost}" aria-pressed="${state.scene === id}"><strong>${sceneNames[id]}</strong><small>${desc}</small><small>${state.scene === id ? '✓ 当前场景' : state.unlocked.includes(id) ? '已解锁 · 点击切换' : `${cost} 星光解锁`}</small></button>`).join('')}</div>`, 'A HOME AMONG THE STARS');
  $('dialogContent').querySelectorAll('[data-scene-choice]').forEach(button => button.onclick = () => {
    const id = button.dataset.sceneChoice, cost = Number(button.dataset.cost);
    if (!state.unlocked.includes(id)) {
      if (state.stars < cost) return notify(`还差 ${cost - state.stars} 星光，训练和守护都能收集。`);
      mutate(state, { stars: -cost }); state.unlocked.push(id); say(`解锁了${sceneNames[id]}！新的风景，和你一起看。`, true);
    }
    state.scene = id; save(); render(); showScenes();
  });
}
$('settingsBtn').onclick = showSettings;
$('saveStatus').onclick = showSettings;
$('cloudBannerBtn').onclick = showSettings;
function showSettings() {
  openInfo('把你们的故事，好好收藏。', '', 'SAVE YOUR LITTLE UNIVERSE');
  if (!$('infoDialog').open) return;
  mountSavePanel($('dialogContent'), {
    sync: cloud, getState: () => state, notify, canModify: () => !cloudBooting && !cloudInfo.transition,
    onImport: imported => {
      if (cloudBooting || cloudInfo.transition) { notify('正在核对服务器进度，请稍等后再导入。'); return; }
      clearTimeout(poseTimer); busy = false; state = imported; passTime(state);
      setPose(state.sleeping ? 'sleep' : 'wave', state.sleeping ? 0 : 1300);
      save({ reason: 'import' }); render(); $('infoDialog').close();
      say('带着我们的故事，继续冒险吧。');
      notify('进度已载入，服务器保存状态请看顶部提示。');
    }
  });
  updateSaveStatus();
}

// Read newer saves before user mutations, scheduled ticks, or a tab becomes active.
document.addEventListener('click', () => syncExternalState(), true);
document.addEventListener('change', () => syncExternalState(), true);
window.addEventListener('storage', event => { if (event.key === SAVE_KEY && event.newValue) syncExternalState(); });
setInterval(() => { if (!document.hidden && !cloudBooting) { passTime(state); render(); save({ server: false }); } }, 3000);
document.addEventListener('visibilitychange', () => { if (!cloudBooting) { passTime(state); save({ server: false }); if (document.hidden) void cloud?.flush(); } if (!document.hidden) render(); });
window.addEventListener('pagehide', () => { if (!cloudBooting) { passTime(state); save({ server: false }); void cloud?.flush(); } });
if (state.sleeping) { setPose('sleep', 0); say('呼噜…欢迎回来，我还在星光里充电呢。'); }
else if (state.xp > 0 || state.fed > 0) { setPose('wave', 1500); say('你回来啦！银河一直在这里等你。'); }
render(); save({ server: false });
try {
cloud = new SaveSync({
  onState: incoming => {
    try {
      state = sanitizeState(incoming); passTime(state);
      if (!busy && !battleActive && !dojoActive) $('petHero').dataset.pose = state.sleeping ? 'sleep' : 'idle';
      save({ server: false }); render();
    } catch { notify('服务器返回的存档暂时无法读取，本机备份已保留。'); }
  },
  onStatus: updateSaveStatus
});
await cloud.start(state);
}
catch { updateSaveStatus(cloud?.getInfo() || { status: 'error', message: '浏览器无法初始化存档同步，请先导出本机进度。' }); }
finally { cloudBooting = false; render(); }
if (storageMessage) { say(storageMessage); notify(storageMessage); }
else if (!storageOK) notify('浏览器存储不可用。游玩后记得在设置中导出进度。');
