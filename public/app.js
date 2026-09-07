import { heroSVG, monsterSVG } from './characters.js';
import { openBattle, MONSTERS } from './battle.js';
import { SAVE_KEY, LEGACY_KEY, freshState, sanitizeState, passTime, levelInfo, mutate, care, dailyReady, claimDaily, startExpedition, settleExpedition } from './pet-state.js';

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
let poseTimer, toastTimer, lastPet = 0, audioContext;
try {
  lastStoredRaw = localStorage.getItem(SAVE_KEY);
  const raw = lastStoredRaw || localStorage.getItem(LEGACY_KEY);
  if (raw) {
    try { state = sanitizeState(JSON.parse(raw)); }
    catch {
      localStorage.setItem(`${SAVE_KEY}-recovery`, raw);
      storageMessage = '旧存档无法读取，已保留原始备份并开始新的冒险。';
    }
  }
} catch { storageOK = false; }
passTime(state);
$('petHero').innerHTML = heroSVG('home');
decorate();

function syncExternalState() {
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
function save() {
  try {
    // Do not replace newer progress from another tab with a stale in-memory copy.
    if (syncExternalState()) notify('已同步另一个页面的新进度。');
    lastStoredRaw = JSON.stringify(state); localStorage.setItem(SAVE_KEY, lastStoredRaw); storageOK = true;
  }
  catch { storageOK = false; }
  $('saveStatus').innerHTML = `<i></i>${storageOK ? '已自动存档' : '暂时无法存档'}`;
  $('saveStatus').classList.toggle('error', !storageOK);
  $('saveStatus').title = storageOK ? '进度已保存在当前浏览器，可在设置中导出备份' : '浏览器存储不可用，请在设置中导出备份';
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
  if (level > before) { say(`新的光芒！银河升到 Lv. ${level} 啦，谢谢你陪我长大。`, true); floatReward(`升级！Lv. ${level}`); sound('win'); }
}
const sceneNames = { base:'星光基地', moon:'静谧月海', sunset:'落日之城' };
function render() {
  const level = levelInfo(state.xp);
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
  for (const id of ['feedBtn','trainBtn','defendBtn','transformBtn','fightBtn']) $(id).disabled = busy || battleActive || state.sleeping;
  for (const id of ['restBtn','petBtn']) $(id).disabled = busy || battleActive;
  $('sceneBtn').disabled = busy || battleActive;
  $('difficultySelect').value = state.difficulty;
  $('soundBtn').setAttribute('aria-pressed', state.sound); $('soundBtn').setAttribute('aria-label', state.sound ? '关闭音效' : '开启音效');
  $('soundBtn').title = state.sound ? '关闭音效' : '开启音效'; $('soundBtn').innerHTML = icon(state.sound ? 'sound' : 'mute');
  const completed = [state.daily.fed >= 1, state.daily.training >= 1, state.daily.battles >= 1];
  ['dailyFeed','dailyTrain','dailyBattle'].forEach((id, index) => { $(id).classList.toggle('done', completed[index]); $(id).querySelector('.task-check').textContent = completed[index] ? '✓' : ''; });
  $('missionCount').textContent = `${completed.filter(Boolean).length} / 3`;
  $('claimBtn').disabled = busy || battleActive || state.daily.claimed || !dailyReady(state);
  $('claimBtn').classList.toggle('ready', dailyReady(state) && !state.daily.claimed);
  $('claimTitle').textContent = state.daily.claimed ? '星光礼已领取' : '今日星光礼';
  $('claimSubtitle').textContent = state.daily.claimed ? '明天再一起收集光芒' : '完成计划 · 15 星光 + 25 经验';
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
$('defendBtn').onclick = () => {
  if (busy || battleActive || state.sleeping) return;
  say('双手交叉——X！这一次，换我来守护你。'); playAction('defend', '银河屏障 · X 交叉防御', 2400); sound('block');
};
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
  if (busy || battleActive) return;
  if (!startExpedition(state)) { say('出发需要 15 活力和 10 饱食度，先吃饱、休息好吧！'); notify('先补充星光或休息，银河准备好就能出发。'); return; }
  battleActive = true; save(); render();
  try {
    let resultSaved = false;
    const recordResult = result => {
      if (resultSaved) return;
      resultSaved = true; syncExternalState();
      settleExpedition(state, result, monsterId); save(); render();
    };
    currentBattle = openBattle({ monsterId, difficulty: state.difficulty, onSound: sound, onResult: recordResult, onComplete: result => {
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

function openInfo(title, content, eyebrow = 'GALAXY COMPANION') {
  if (battleActive) return;
  $('dialogTitle').textContent = title; $('dialogEyebrow').textContent = eyebrow; $('dialogContent').innerHTML = content;
  decorate($('infoDialog')); if (!$('infoDialog').open) $('infoDialog').showModal();
}
$('closeDialog').onclick = () => $('infoDialog').close();
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
$('helpBtn').onclick = () => openInfo('你好，银河的新搭档。', `<p class="dialog-lede">你的小小奥特曼不会死亡，也不用急着完成什么。喂点星光、摸摸他，一起慢慢长大就好。</p><div class="guide-grid"><div class="guide-item"><b>01 / 好好照顾</b><p>喂食免费：+25 饱食、+5 活力、+5 心情。特训消耗 8 饱食、12 活力，获得 20 经验和 5 星光。点击银河可摸摸他。</p></div><div class="guide-item"><b>02 / 休息与变身</b><p>休息每 3 秒恢复 8 活力，可随时唤醒。「银河变身」让小伙伴变成光之巨人；「防御练习」可在基地练习 X 姿势。</p></div><div class="guide-item"><b>03 / 选择出击</b><p>每场战斗消耗 15 活力、10 饱食。1 银河拳积攒光能，2 银河光线消耗光能，3 满能量释放终结。绿色区域攻击更强。</p></div><div class="guide-item"><b>04 / 交叉双臂，守护你</b><p>怪兽预警时按 4 或点 X 防御，普通格挡减伤 90%，最后一小段时间完美格挡可免伤。5 可闪避，战斗中可点暂停；离开页面会自动暂停。</p></div></div><p class="guide-note">完成战斗可推进每日计划，撤退不计入；胜利获得 40 经验与 20 星光，失败也有 5 经验。星光可以解锁场景。进度仅存当前浏览器，换设备前请到设置中导出存档。离线状态最多结算 8 小时。</p>`, 'NEW PARTNER HANDBOOK');
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
function showSettings() {
  openInfo('把你们的故事，好好收藏。', `<p class="dialog-lede">${storageOK ? '当前进度会自动保存在这个浏览器。' : '当前浏览器暂时无法存储，请及时导出进度。'}不同设备、浏览器或网址之间不会自动同步；导出一份存档，就可以带银河一起出发。</p><div class="settings-block"><h3>备份与恢复</h3><p>导出 JSON 文件到本机，在另一个浏览器导入即可继续。导入前会展示进度并等待你确认。</p><div class="settings-actions"><button class="dialog-button primary" id="exportBtn">导出当前存档 ↓</button><button class="dialog-button" id="importBtn">导入存档 ↑</button></div><input type="file" id="importFile" accept=".json,application/json" hidden><div id="importFeedback" role="status"></div></div><div class="settings-block"><h3>你的银河档案</h3><p>Lv. ${levelInfo(state.xp).level} · ${state.stars} 星光 · ${state.wins} 次守护成功<br>自动保存：${storageOK ? '正常' : '不可用，请导出备份'} · 音效：${state.sound ? '开启' : '关闭'}<br>存档只留在你选择的浏览器或导出文件中，无需登录。</p></div>`, 'SAVE YOUR LITTLE UNIVERSE');
  $('exportBtn').onclick = () => {
    passTime(state); save();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `galaxy-companion-${new Date().toISOString().slice(0,10)}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('importFeedback').textContent = '已开始下载存档。请妥善保存这份文件。';
  };
  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      if (file.size > 100000) throw new Error('存档文件过大，请选择银河小伙伴导出的 JSON 文件。');
      const imported = sanitizeState(JSON.parse(await file.text()));
      $('importFeedback').innerHTML = `<div class="save-preview"><p>发现存档：Lv. ${levelInfo(imported.xp).level} · ${imported.stars} 星光 · ${imported.wins} 次守护成功</p><p>导入将替换当前进度。建议先导出当前存档。</p><div class="settings-actions"><button class="dialog-button primary" id="confirmImport">确认使用这份存档</button><button class="dialog-button" id="cancelImport">取消</button></div></div>`;
      $('confirmImport').onclick = () => {
        clearTimeout(poseTimer); busy = false; state = imported; passTime(state); setPose(state.sleeping ? 'sleep' : 'wave', state.sleeping ? 0 : 1300);
        save(); render(); $('infoDialog').close(); say('欢迎回来！带着我们的故事，继续冒险吧。'); notify(storageOK ? '存档已恢复并保存' : '存档已载入，但浏览器暂时无法保存，请及时导出');
      };
      $('cancelImport').onclick = () => { $('importFeedback').textContent = '已取消导入，当前进度保持不变。'; };
    } catch (error) { $('importFeedback').textContent = error instanceof SyntaxError ? '文件不是有效的 JSON 存档，当前进度保持不变。' : error.message; }
    e.target.value = '';
  };
}

// Read newer saves before user mutations, scheduled ticks, or a tab becomes active.
document.addEventListener('click', () => syncExternalState(), true);
document.addEventListener('change', () => syncExternalState(), true);
window.addEventListener('storage', event => { if (event.key === SAVE_KEY && event.newValue) syncExternalState(); });
setInterval(() => { if (!document.hidden) { syncExternalState(); passTime(state); render(); save(); } }, 3000);
document.addEventListener('visibilitychange', () => { syncExternalState(); passTime(state); save(); if (!document.hidden) render(); });
window.addEventListener('pagehide', () => { syncExternalState(); passTime(state); save(); });
if (state.sleeping) { setPose('sleep', 0); say('呼噜…欢迎回来，我还在星光里充电呢。'); }
else if (state.xp > 0 || state.fed > 0) { setPose('wave', 1500); say('你回来啦！银河一直在这里等你。'); }
render(); save();
if (storageMessage) { say(storageMessage); notify(storageMessage); }
else if (!storageOK) notify('浏览器存储不可用。游玩后记得在设置中导出进度。');
