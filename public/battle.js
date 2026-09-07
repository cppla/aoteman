import { BattleEngine, MONSTERS, DIFFICULTIES, ACTIONS } from './battle-engine.js';
import { heroSVG, monsterSVG } from './characters.js';

export { MONSTERS };

let activeBattle = null;
const escapeHTML = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const formatTime = (ms) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const cooldownTime = (ms) => (Math.ceil(ms / 100) / 10).toFixed(1);
const setText = (element, value) => { if (element.textContent !== String(value)) element.textContent = value; };

const BRIEFINGS = {
  obsidian: { strategy: '重甲动作慢，先出拳积攒光能。看到冲撞预警就收手，格挡后再反击。', skills: [['装甲重击', '抬臂蓄力，X 防御稳住正面'], ['暗星冲撞', '预警较短，别连续贪拳'], ['黑曜震波', '蓄力较长，等绿色末段格挡']] },
  lava: { strategy: '喷发蓄力很长，但伤害最高。先观察进度条；怪兽生命降至 35% 时，所有攻势会加快。', skills: [['烈焰爪击', '利爪升温后落下，准备格挡'], ['熔核喷发', '本组最强一击，优先防御'], ['燃烧冲撞', '比喷发更快，及时停止出招']] },
  cosmic: { strategy: '跃迁突袭的预警最短。保留一次防御，等攻击落下后再释放光线。', skills: [['电光射线', '电弧聚拢时开始读秒'], ['跃迁突袭', '短促冲撞，看见预警就准备'], ['超新星脉冲', '蓄力较长，练习末段完美格挡']] },
};

function reviewBattle(result) {
  const taken = result.damageTaken || 0;
  if (taken > 0 && result.blocks === 0 && result.dodges === 0) return `本次承受了 ${taken} 点伤害，还没有成功防御。下次橙色预警出现时先点「X 防御」，保持到冲击结束再出拳。`;
  if (result.blocks > result.perfects) return `本次挡住 ${result.blocks} 次攻击，其中 ${result.perfects} 次完美。下一次试着在进度条进入绿色末段时点「X 防御」，可免伤并获得 24 光能。`;
  if (taken > 0) return `本次最高 ${result.maxCombo} 连击，但仍承受了 ${taken} 点伤害。下次预警时先停手，防御架起后不要出拳，避免解除防御后被击中、中断连击。`;
  if (result.perfects > 0) return `本次 ${result.perfects} 次完美格挡、${result.maxCombo} 连击，全程没有受伤。${result.specials > 0 ? '下一次在绿色攻击时机释放「银河终结」，让终结技也获得精准加成。' : '下一次把格挡获得的光能攒到 100，试试「银河终结」。'}`;
  if (result.maxCombo > 0) return `本次最高 ${result.maxCombo} 连击，没有受伤。下一次等攻击时机游标进入绿色区域再出拳，每次精准命中可多造成 35% 伤害。`;
  return '下次先用「银河拳」积攒光能；出现橙色预警就点「X 防御」，熟悉一轮攻防后再释放光线。';
}

const icons = {
  punch: '<path d="M7 12V6a2 2 0 0 1 4 0v4-6a2 2 0 0 1 4 0v6-4a2 2 0 0 1 4 0v7c0 4-2 7-6 7h-2c-2 0-3-1-4-3l-3-5a2 2 0 0 1 3-2l3 3"/>',
  beam: '<path d="m13 2-8 12h6l-1 8 9-13h-7l1-7Z"/>',
  special: '<path d="m12 2 2.5 6.5L21 6l-2.5 6.5L23 16l-7 .5L14 23l-4-6-7 2 2-7L1 8l7 .5L12 2Z"/>',
  defend: '<path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z"/><path d="m8 9 8 7m0-7-8 7"/>',
  dodge: '<path d="m13 3 5 5-5 5m-6-5h11m-7 3-5 5 5 5m6-5H6"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`;

function ensureStyles() {
  const href = new URL('./battle.css', import.meta.url).href;
  if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((link) => link.href === href)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.battleStyles = '';
  document.head.append(link);
}

/** Open a self-contained, keyboard- and touch-accessible combat dialog. */
export function openBattle({ monsterId = 'obsidian', difficulty = 'normal', heroName = '', onResult, onComplete, onSound } = {}) {
  if (activeBattle) {
    activeBattle.dialog.focus();
    return activeBattle.handle;
  }
  ensureStyles();
  let resultNotified = false;
  const notifyResult = (result) => {
    if (resultNotified || !result) return;
    resultNotified = true;
    onResult?.(result);
  };
  const engine = new BattleEngine({ monsterId, difficulty, onFinish: notifyResult });
  const monster = engine.monster;
  const briefing = BRIEFINGS[monster.id];
  const name = Array.from(String(heroName || '').trim()).slice(0, 24).join('') || '光之守护者';
  const escapedName = escapeHTML(name);
  const returnFocus = document.activeElement;
  engine.setPaused(true);
  const dialog = document.createElement('dialog');
  dialog.className = 'battle-dialog';
  dialog.setAttribute('aria-labelledby', 'battle-title');
  dialog.setAttribute('aria-describedby', 'battle-help');
  dialog.tabIndex = -1;
  dialog.innerHTML = `
    <div class="battle-shell">
      <header class="battle-heading">
        <div><p class="battle-eyebrow"><span></span> DEFENSE OPERATION <i>/</i> ${DIFFICULTIES[engine.difficulty].label}</p><h2 id="battle-title">城市防卫战</h2></div>
        <div class="battle-toolbar"><span class="battle-clock" aria-label="战斗时间">00:00</span><button type="button" class="battle-icon-button" data-command="pause" aria-label="暂停战斗" title="暂停 / 继续（P）" disabled>Ⅱ</button><button type="button" class="battle-icon-button battle-exit" data-command="retreat" aria-label="撤回基地" title="撤回基地">×</button></div>
      </header>
      <div class="battle-hud">
        <div class="fighter-hud hero-hud"><div class="fighter-meta"><span class="battle-hero-name" title="${escapedName}"><i class="status-light"></i> ${escapedName}</span><small>ULTRAMAN</small></div><div class="battle-health" role="progressbar" aria-label="${escapedName}生命值" aria-valuemin="0" aria-valuemax="${engine.state.heroMaxHp}" aria-valuenow="${engine.state.heroHp}"><span class="health-fill hero-health-fill"></span></div><div class="fighter-foot"><span class="hero-health-number">${engine.state.heroHp} / ${engine.state.heroMaxHp}</span><span class="hero-status">守护之光 · 就绪</span></div></div>
        <div class="battle-vs">VS</div>
        <div class="fighter-hud enemy-hud"><div class="fighter-meta"><span>${escapeHTML(monster.name)}</span><small>THREAT ${monster.threat}</small></div><div class="battle-health" role="progressbar" aria-label="怪兽生命值" aria-valuemin="0" aria-valuemax="${monster.hp}" aria-valuenow="${monster.hp}"><span class="health-fill enemy-health-fill"></span></div><div class="fighter-foot"><span class="monster-health-number">${monster.hp} / ${monster.hp}</span><span class="monster-status">${escapeHTML(monster.subtitle)}</span></div></div>
      </div>
      <div class="battle-arena" data-phase="ready">
        <div class="battle-nebula" aria-hidden="true"></div><div class="battle-orbit" aria-hidden="true"></div><div class="arena-coordinate">SECTOR 07 <span>35° 40′ N · TOKYO</span></div>
        <div class="battle-warning" aria-live="off"><span class="warning-symbol">!</span><div><strong class="warning-title">守护城市，光芒集结</strong><span class="warning-copy">观察攻击预警，双臂交叉抵挡冲击</span></div><span class="warning-time">READY</span><div class="warning-progress"><span></span><i title="完美格挡窗口"></i></div></div>
        <div class="battle-combo" aria-live="off"><b>0</b><span>连击 <small>COMBO</small></span></div>
        <svg class="battle-city" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="battle-windows" width="18" height="24" patternUnits="userSpaceOnUse"><rect x="5" y="6" width="3" height="5" fill="#648895" opacity=".32"/></pattern></defs><path d="M0 300V140h50v-45h52v80h32V68h64v102h40V120h48v65h34V74h28V38h16v36h32v104h36V136h60v64h40V98h58v50h30V76h50v98h38V126h54v53h28V99h36V39h12v60h35v109h43V141h44v31h34V84h53v93h22v-52h49v82h25V113h65V74h42v92h52V300Z" fill="#112b38"/><path d="M0 300V140h50v-45h52v80h32V68h64v102h40V120h48v65h34V74h28V38h16v36h32v104h36V136h60v64h40V98h58v50h30V76h50v98h38V126h54v53h28V99h36V39h12v60h35v109h43V141h44v31h34V84h53v93h22v-52h49v82h25V113h65V74h42v92h52V300Z" fill="url(#battle-windows)"/><path d="M0 300v-60h89v-28h84v31h54v-58h76v54h92v-35h71v30h129v-43h83v58h82v-63h70v45h96v-34h80v49h81v-60h67v114Z" fill="#0a202c"/></svg>
        <div class="arena-ground" aria-hidden="true"></div>
        <div class="battle-actor actor hero-actor" data-pose="idle" aria-label="${escapedName}">${heroSVG('battle-hero')}</div>
        <div class="battle-actor actor monster-actor" data-pose="idle" data-monster="${monster.id}" aria-label="${escapeHTML(monster.name)}">${monsterSVG(monster.id, 'battle-monster')}</div>
        <div class="battle-beam" aria-hidden="true"></div><div class="enemy-projectile" aria-hidden="true"></div><div class="battle-impact" aria-hidden="true"></div>
        <div class="damage-numbers" aria-hidden="true"></div><div class="battle-callout" aria-hidden="true"></div>
        <div class="arena-bottom-label"><span><i></i> LIVE COMBAT</span><span>光芒，因守护而存在。</span></div>
        <div class="battle-overlay ready-overlay"><div class="battle-overlay-card battle-ready-card"><p class="battle-eyebrow">THREAT BRIEFING · ${escapeHTML(monster.name)}</p><h3 title="${escapedName}，准备守护。">${escapedName}，准备守护。</h3><p class="battle-strategy">${escapeHTML(briefing.strategy)}</p><ul class="battle-skill-brief">${briefing.skills.map(([skill, hint]) => `<li><strong>${escapeHTML(skill)}</strong><span>${escapeHTML(hint)}</span></li>`).join('')}</ul><div class="battle-ready-tip">点「X 防御」或按 <kbd>4</kbd> · 绿色末段格挡：免伤 +24 光能</div><button type="button" class="battle-primary" data-command="start">开始守护 <span>↗</span></button></div></div>
        <div class="battle-overlay pause-overlay" hidden><div class="battle-overlay-card"><p class="battle-eyebrow">TAKE A BREATH</p><h3>光芒暂歇</h3><p class="pause-reason">战斗已暂停，所有计时已冻结。</p><button type="button" class="battle-primary" data-command="resume">继续战斗 <span>▶</span></button><button type="button" class="battle-text-button" data-command="retreat">撤回基地</button></div></div>
        <div class="battle-overlay result-overlay" hidden></div>
      </div>
      <div class="battle-console">
        <div class="battle-instruments"><div class="battle-energy"><div class="instrument-label"><span>光能储备 <small>LIGHT ENERGY</small></span><b><span class="energy-number">0</span><small> / 100</small></b></div><div class="energy-track" role="progressbar" aria-label="光能储备" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span><i style="left:30%"></i><i style="left:100%"></i></div><div class="energy-thresholds"><span>重拳 +9</span><span>光线 30</span><span>银河终结 100</span></div></div>
        <div class="battle-timing"><div class="instrument-label"><span>攻击时机 <small>PRECISION</small></span><b class="timing-label">等待好时机</b></div><div class="timing-track"><span class="timing-sweetspot"></span><i class="timing-cursor"></i></div><p>游标进入绿色区域出招，伤害 +35%</p></div></div>
        <p class="battle-action-hint">先观察怪兽招式，再开始守护。</p>
        <div class="battle-actions" role="group" aria-label="战斗操作">
          <button type="button" class="battle-action" data-action="punch" aria-keyshortcuts="1" title="重拳积攒 9 光能；精准出招再加 4 光能"><kbd>1</kbd>${icon('punch')}<strong>银河拳</strong><span>+9 光能</span><i class="action-cooldown"></i></button>
          <button type="button" class="battle-action" data-action="beam" aria-keyshortcuts="2" title="消耗 30 光能，释放银河光线"><kbd>2</kbd>${icon('beam')}<strong>银河光线</strong><span>消耗 30</span><i class="action-cooldown"></i></button>
          <button type="button" class="battle-action special-action" data-action="special" aria-keyshortcuts="3" title="消耗 100 光能，释放银河终结"><kbd>3</kbd>${icon('special')}<strong>银河终结</strong><span>消耗 100</span><i class="action-cooldown"></i></button>
          <button type="button" class="battle-action defend-action" data-action="defend" aria-keyshortcuts="4" title="双臂交叉 X 防御，减伤 90%；在预警最后一段出手可完美格挡"><kbd>4</kbd>${icon('defend')}<strong>X 防御</strong><span>减伤 90%</span><i class="action-cooldown"></i></button>
          <button type="button" class="battle-action" data-action="dodge" aria-keyshortcuts="5" title="接下来 0.48 秒免伤，冷却 2.1 秒；太早闪避会被命中"><kbd>5</kbd>${icon('dodge')}<strong>瞬身闪避</strong><span>免伤 0.48 秒</span><i class="action-cooldown"></i></button>
        </div>
        <div class="battle-feedback"><p class="battle-log" role="status" aria-live="polite">准备就绪。点击「开始守护」进入战斗。</p><span id="battle-help">按 1–5 出招 · P 暂停</span></div>
      </div>
    </div>`;

  document.body.append(dialog);
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const $ = (selector) => dialog.querySelector(selector);
  const elements = {
    arena: $('.battle-arena'), hero: $('.hero-actor'), monster: $('.monster-actor'),
    heroFill: $('.hero-health-fill'), monsterFill: $('.enemy-health-fill'),
    heroHealth: $('.hero-health-number'), monsterHealth: $('.monster-health-number'),
    heroBar: $('.hero-hud .battle-health'), monsterBar: $('.enemy-hud .battle-health'),
    heroStatus: $('.hero-status'), monsterStatus: $('.monster-status'),
    energy: $('.energy-number'), energyFill: $('.energy-track > span'), energyBar: $('.energy-track'),
    timingCursor: $('.timing-cursor'), timingLabel: $('.timing-label'),
    warning: $('.battle-warning'), warningTitle: $('.warning-title'), warningCopy: $('.warning-copy'),
    warningTime: $('.warning-time'), warningFill: $('.warning-progress > span'), perfectZone: $('.warning-progress > i'),
    combo: $('.battle-combo'), comboValue: $('.battle-combo b'), clock: $('.battle-clock'),
    pause: $('[data-command="pause"]'), readyOverlay: $('.ready-overlay'), pauseOverlay: $('.pause-overlay'),
    resultOverlay: $('.result-overlay'), log: $('.battle-log'), callout: $('.battle-callout'),
    beam: $('.battle-beam'), projectile: $('.enemy-projectile'), impact: $('.battle-impact'),
    actions: [...dialog.querySelectorAll('[data-action]')], actionHint: $('.battle-action-hint'),
  };
  let started = false;
  let closed = false;
  let settled = false;
  let resultShown = false;
  let frameId = 0;
  let lastFrame = performance.now();
  let lastWarning = '';
  let lastPerfectWarning = '';
  const timers = new Set();
  const later = (callback, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (!closed) callback(); }, ms);
    timers.add(id);
    return id;
  };
  let calloutTimer;
  let logTimer;

  function sound(name) {
    try { onSound?.(name); } catch { /* Sound is optional; combat must keep running. */ }
  }

  function animate(element, className, duration = 650) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    later(() => element.classList.remove(className), duration);
  }

  function announce(message) {
    if (!message) return;
    if (logTimer) { clearTimeout(logTimer); timers.delete(logTimer); }
    setText(elements.log, message);
  }

  function callout(text, kind = '') {
    if (calloutTimer) { clearTimeout(calloutTimer); timers.delete(calloutTimer); }
    elements.callout.textContent = text;
    elements.callout.className = `battle-callout visible ${kind}`;
    calloutTimer = later(() => { elements.callout.className = 'battle-callout'; }, 1350);
  }

  function damageNumber(text, target, kind = '') {
    const number = document.createElement('span');
    number.className = `damage-number ${target} ${kind}`;
    number.textContent = text;
    $('.damage-numbers').append(number);
    later(() => number.remove(), 1200);
  }

  function processEvents() {
    for (const event of engine.drainEvents()) {
      if (['start', 'pause', 'resume'].includes(event.type) && !started) continue;
      announce(event.message);
      if (event.type === 'hit') {
        sound(event.action === 'punch' ? 'punch' : 'beam');
        damageNumber(`−${event.damage}`, 'enemy', event.precise ? 'precise' : '');
        elements.impact.dataset.target = 'enemy';
        animate(elements.impact, 'active', 600);
        if (event.action !== 'punch') {
          elements.beam.dataset.power = event.action;
          animate(elements.beam, 'active', 820);
          if (event.action === 'special') { animate(elements.arena, 'ultimate', 1100); callout('银河终结', 'ultimate-callout'); }
        } else {
          animate(elements.hero, 'striking', 450);
        }
        if (event.precise && event.action !== 'special') callout('精准命中 +35%', 'precise-callout');
      } else if (['block', 'perfect', 'hurt', 'dodge'].includes(event.type)) {
        elements.projectile.dataset.kind = event.attack.kind;
        animate(elements.projectile, 'active', 650);
        animate(elements.monster, event.attack.kind === 'rush' ? 'rushing' : 'striking', 650);
        if (event.type === 'hurt') {
          sound('hurt');
          damageNumber(`−${event.damage}`, 'hero', 'hurt');
          animate(elements.arena, 'damaged', 500);
        } else if (event.type === 'dodge') {
          damageNumber('闪避', 'hero', 'good');
          callout('完美避开', 'precise-callout');
        } else {
          sound('block');
          elements.hero.dataset.shield = event.type;
          animate(elements.hero, 'shield-impact', 800);
          damageNumber(event.type === 'perfect' ? '0' : `−${event.damage}`, 'hero', 'good');
          callout(event.type === 'perfect' ? 'PERFECT · 完美格挡' : 'X 防御 · 减伤 90%', event.type === 'perfect' ? 'perfect-callout' : 'block-callout');
        }
      } else if (event.type === 'guard') {
        sound('block');
      } else if (event.type === 'enrage') {
        callout('怪兽狂暴 · 警戒升级', 'danger-callout');
      } else if (event.type === 'finish') {
        if (event.outcome === 'win') sound('win');
        later(showResult, event.outcome === 'retreat' ? 0 : 1000);
      }
    }
  }

  function render() {
    const s = engine.snapshot();
    const focusedAction = elements.actions.includes(document.activeElement) ? document.activeElement : null;
    elements.hero.dataset.pose = s.heroPose;
    elements.monster.dataset.pose = s.monsterPose;
    elements.arena.dataset.enraged = s.enraged ? 'true' : 'false';
    elements.arena.classList.toggle('is-paused', s.paused);
    elements.arena.dataset.phase = s.status === 'ended' ? 'ended' : !started ? 'ready' : s.paused ? 'paused' : s.currentAttack ? 'warning' : 'active';
    elements.heroFill.style.width = `${s.heroHp / s.heroMaxHp * 100}%`;
    elements.monsterFill.style.width = `${s.monsterHp / s.monsterMaxHp * 100}%`;
    elements.heroBar.setAttribute('aria-valuenow', s.heroHp);
    elements.monsterBar.setAttribute('aria-valuenow', s.monsterHp);
    elements.heroHealth.textContent = `${s.heroHp} / ${s.heroMaxHp}`;
    elements.monsterHealth.textContent = `${s.monsterHp} / ${s.monsterMaxHp}`;
    elements.heroStatus.textContent = s.heroHp <= s.heroMaxHp * 0.25 ? '能量灯闪烁 · 生命危急' : s.defending ? 'X 防御中 · 出招将解除' : '守护之光';
    elements.hero.classList.toggle('low-health', s.heroHp <= s.heroMaxHp * 0.25);
    elements.monsterStatus.textContent = s.enraged ? '⚠ 狂暴 · 攻势加快' : monster.subtitle;
    elements.monsterStatus.classList.toggle('is-enraged', s.enraged);
    elements.energy.textContent = Math.floor(s.energy);
    elements.energyFill.style.width = `${s.energy}%`;
    elements.energyBar.setAttribute('aria-valuenow', s.energy);
    elements.energyBar.classList.toggle('charged', s.energy >= 100);
    elements.timingCursor.style.left = `${s.timing * 100}%`;
    const precise = s.timing >= 0.67 && s.timing <= 0.85;
    elements.timingLabel.textContent = precise ? '精准窗口' : '等待好时机';
    elements.timingLabel.classList.toggle('is-precise', precise);
    elements.combo.classList.toggle('visible', s.combo > 1);
    elements.comboValue.textContent = s.combo;
    elements.clock.textContent = formatTime(s.elapsed);
    elements.pause.disabled = !started || s.status !== 'active';
    elements.pause.textContent = s.paused ? '▶' : 'Ⅱ';
    elements.pause.setAttribute('aria-label', s.paused ? '继续战斗' : '暂停战斗');
    elements.pauseOverlay.hidden = !started || !s.paused || s.status !== 'active';
    if (s.currentAttack) {
      const attack = s.currentAttack;
      const key = `${attack.id}-${attack.startedAt}`;
      if (key !== lastWarning) {
        lastWarning = key;
        setText(elements.warningTitle, attack.name);
      }
      const elapsedFraction = 1 - s.attackRemaining / attack.windup;
      setText(elements.warningTime, `${(s.attackRemaining / 1000).toFixed(1)}s`);
      elements.warningFill.style.width = `${elapsedFraction * 100}%`;
      elements.perfectZone.style.width = `${s.perfectWindow / attack.windup * 100}%`;
      elements.warning.classList.add('is-warning');
      elements.warning.classList.toggle('is-perfect-window', s.attackRemaining <= s.perfectWindow);
      const perfectWindow = s.attackRemaining <= s.perfectWindow;
      setText(elements.warningCopy, s.defending ? '保持防御，出拳会解除防御' : perfectWindow ? '现在点 X 防御！完美格挡时机' : attack.hint);
      // Countdown stays outside live regions. Announce the timing transition
      // once per attack, never on every animation frame or tenth of a second.
      if (started && !s.paused && perfectWindow && lastPerfectWarning !== key) {
        lastPerfectWarning = key;
        if (!s.defending) announce('现在点 X 防御，或按 4：完美格挡时机！');
      }
    } else {
      lastWarning = '';
      elements.warning.classList.remove('is-warning', 'is-perfect-window');
      setText(elements.warningTitle, !started ? '守护城市，光芒集结' : s.status === 'ended' ? '本次行动结束' : s.defending ? 'X 防御已架起 · 等待冲击' : '进攻窗口 · 积攒光能');
      setText(elements.warningCopy, !started ? '观察攻击预警，双臂交叉抵挡冲击' : s.status === 'ended' ? '守护的每一步，都值得铭记' : s.defending ? '等下一次冲击结束，再出招反击' : '在绿色时机区出拳，让每次攻击更有力量');
      setText(elements.warningTime, !started ? 'READY' : s.status === 'ended' ? 'END' : 'ATTACK');
      elements.warningFill.style.width = '0%';
    }
    const hint = !started ? '先观察怪兽招式，再开始守护。' : s.status === 'ended' ? '行动完成，查看本次复盘。' : s.paused ? '战斗已暂停，所有技能计时冻结。' : s.defending ? '已架起 X 防御，等冲击落下；出拳或闪避会解除防御。' : s.currentAttack ? s.attackRemaining <= s.perfectWindow ? '现在点「X 防御」！绿色末段可完美格挡。' : '橙色预警：点「X 防御」稳住，也可以等绿色末段再格挡。' : s.cooldown > 0 ? '攻击正在冷却，读秒结束后再出招；X 防御随时可用。' : s.energy >= 100 ? '光能已满！点「银河终结」释放必杀技。' : s.energy >= 30 ? '光线已就绪；也可以继续攒到 100 光能使用终结技。' : '点「银河拳」积攒光能，达到 30 后可释放光线。';
    setText(elements.actionHint, hint);
    elements.actionHint.dataset.tone = s.currentAttack || s.defending ? 'guard' : 'attack';
    for (const button of elements.actions) {
      const action = button.dataset.action;
      const cost = ACTIONS[action]?.cost || 0;
      const cooldown = action === 'dodge' ? s.dodgeCooldown : ['punch', 'beam', 'special'].includes(action) ? s.cooldown : 0;
      const shortfall = Math.max(0, Math.ceil(cost - s.energy));
      button.disabled = !started || s.paused || s.status !== 'active' || s.energy < cost || cooldown > 0 || (action === 'defend' && s.defending);
      button.classList.toggle('is-guarding', action === 'defend' && s.defending);
      button.classList.toggle('is-ready', action === 'special' && !button.disabled);
      button.classList.toggle('is-recommended', action === 'defend' && !!s.currentAttack && !s.defending);
      button.classList.toggle('is-unavailable', started && !s.paused && s.status === 'active' && (shortfall > 0 || cooldown > 0));
      button.querySelector('.action-cooldown').style.transform = `scaleX(${Math.min(1, cooldown / (action === 'dodge' ? 2100 : 1500))})`;
      let label = action === 'defend' ? s.defending ? '防御已架起' : s.currentAttack && s.attackRemaining <= s.perfectWindow ? '现在！完美格挡' : '减伤 90%' : action === 'dodge' ? '免伤 0.48 秒' : action === 'punch' ? '+9 光能' : `消耗 ${cost}`;
      if (cooldown > 0) label = `冷却 ${cooldownTime(cooldown)}s`;
      else if (shortfall > 0) label = `还差 ${shortfall} 光能`;
      setText(button.querySelector('span'), label);
      const availability = [cooldown > 0 ? `冷却还剩 ${cooldownTime(cooldown)} 秒` : '', shortfall > 0 ? `还差 ${shortfall} 光能` : ''].filter(Boolean).join('，');
      const accessibleLabel = `${button.querySelector('strong').textContent}，${availability || label}`;
      if (button.getAttribute('aria-label') !== accessibleLabel) button.setAttribute('aria-label', accessibleLabel);
    }
    // Native disabled buttons lose focus immediately. Keep numeric shortcuts
    // inside the dialog after a mouse/touch action starts its cooldown.
    if (focusedAction?.disabled) dialog.focus({ preventScroll: true });
  }

  function showResult() {
    if (resultShown || closed) return;
    const result = engine.snapshot().result;
    if (!result) return;
    resultShown = true;
    const won = result.outcome === 'win';
    const title = won ? '城市已被守护。' : result.outcome === 'lose' ? '英雄，也需要休息。' : '平安归来，光芒仍在。';
    const description = won ? `${monster.name}已被击退。每一份勇气，都让光更明亮。` : result.outcome === 'lose' ? '回基地补充能量。下次看到攻击预警，试试 X 防御。' : '调整状态，再一次出发。你的伙伴在基地等你。';
    const rewards = won ? '经验 +40 · 星光 +20' : result.outcome === 'lose' ? '勇气经验 +5' : '撤退不发放奖励';
    elements.resultOverlay.innerHTML = `<div class="battle-overlay-card battle-result-card"><div class="battle-result-mark ${won ? 'is-win' : ''}">${won ? '✧' : result.outcome === 'lose' ? '◇' : '↗'}</div><p class="battle-eyebrow">${won ? 'MISSION COMPLETE' : result.outcome === 'lose' ? 'LIGHT WILL RETURN' : 'RETURN TO BASE'}</p><h3>${title}</h3><p>${escapeHTML(description)}</p><div class="battle-result-stats"><div><strong>${won ? result.rank : '—'}</strong><span>行动评价</span></div><div><strong>${result.perfects}<small> / ${result.blocks}</small></strong><span>完美 / 总格挡</span></div><div><strong>${result.maxCombo}</strong><span>最高连击</span></div><div><strong>${formatTime(result.elapsed)}</strong><span>战斗用时</span></div></div><div class="battle-review"><strong>下次试试</strong><p>${escapeHTML(reviewBattle(result))}</p></div><div class="battle-score"><span>本次收获</span><strong>${rewards}</strong></div><button type="button" class="battle-primary" data-command="close">返回光之基地 <span>↗</span></button></div>`;
    elements.readyOverlay.hidden = true;
    elements.pauseOverlay.hidden = true;
    elements.resultOverlay.hidden = false;
    elements.resultOverlay.querySelector('button').focus({ preventScroll: true });
  }

  function start() {
    if (started || engine.state.status !== 'active') return;
    started = true;
    elements.readyOverlay.hidden = true;
    engine.setPaused(false);
    lastFrame = performance.now();
    announce('战斗开始！按 1 出拳积攒光能，看到预警按 4 防御。');
    dialog.focus({ preventScroll: true });
    render();
  }

  function pause(reason = '战斗已暂停，所有计时已冻结。') {
    if (!started || engine.state.status !== 'active') return;
    engine.setPaused(true);
    $('.pause-reason').textContent = reason;
    render();
    $('[data-command="resume"]').focus({ preventScroll: true });
  }

  function resume() {
    if (!started || document.hidden || engine.state.status !== 'active') return;
    engine.setPaused(false);
    lastFrame = performance.now();
    render();
    dialog.focus({ preventScroll: true });
  }

  function retreat() {
    if (engine.state.status === 'ended') { showResult(); return; }
    engine.retreat();
    processEvents();
    render();
    showResult();
  }

  function close() {
    if (closed) return;
    if (engine.state.status === 'active') engine.retreat();
    const result = engine.snapshot().result;
    notifyResult(result);
    closed = true;
    cancelAnimationFrame(frameId);
    for (const id of timers) clearTimeout(id);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', pagehide);
    document.body.style.overflow = previousOverflow;
    dialog.close();
    dialog.remove();
    activeBattle = null;
    if (!settled) {
      settled = true;
      onComplete?.(result);
    }
    if (returnFocus?.isConnected && !returnFocus.disabled) returnFocus.focus({ preventScroll: true });
  }

  function action(name) {
    const result = engine.act(name);
    const s = engine.snapshot();
    processEvents();
    if (!result.ok && result.reason === 'energy') announce(`光能还差 ${Math.ceil(result.required - s.energy)} 点。先用重拳或格挡积攒光能。`);
    else if (!result.ok && ['cooldown', 'dodge-cooldown'].includes(result.reason)) announce(`技能冷却还剩 ${cooldownTime(result.reason === 'dodge-cooldown' ? s.dodgeCooldown : s.cooldown)} 秒。`);
    render();
  }

  function visibility() { if (document.hidden) pause('已切到后台，战斗自动暂停。回来后点击继续。'); }
  function pagehide() { pause('页面暂时离开，战斗已安全暂停。'); }
  function loop(now) {
    if (closed) return;
    const delta = now - lastFrame;
    lastFrame = now;
    // A browser/system freeze must not silently fast-forward into several hits.
    if (delta > 1000 && started && !engine.state.paused && engine.state.status === 'active') pause('检测到页面暂时停顿，已自动暂停战斗。');
    else engine.step(delta);
    processEvents();
    render();
    frameId = requestAnimationFrame(loop);
  }

  dialog.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.action) { action(button.dataset.action); return; }
    const command = button.dataset.command;
    if (command === 'start') start();
    if (command === 'pause') engine.state.paused ? resume() : pause();
    if (command === 'resume') resume();
    if (command === 'retreat') retreat();
    if (command === 'close') close();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
    const actions = { '1': 'punch', '2': 'beam', '3': 'special', '4': 'defend', '5': 'dodge' };
    if (event.repeat && (actions[event.key] || event.key.toLowerCase() === 'p')) { event.preventDefault(); return; }
    if (actions[event.key]) { event.preventDefault(); if (started) action(actions[event.key]); }
    else if (event.key.toLowerCase() === 'p') { event.preventDefault(); engine.state.paused ? resume() : pause(); }
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (resultShown) close();
    else if (!started) retreat();
    else if (engine.state.status === 'ended') showResult();
    else engine.state.paused ? resume() : pause();
  });
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', pagehide);
  const handle = { pause, resume, retreat, close, engine };
  activeBattle = { dialog, handle };
  dialog.showModal();
  $('[data-command="start"]').focus({ preventScroll: true });
  render();
  frameId = requestAnimationFrame(loop);
  return handle;
}
