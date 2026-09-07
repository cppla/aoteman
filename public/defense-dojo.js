import { heroSVG, monsterSVG } from './characters.js';
import { DefenseDojoEngine, DOJO_ROUNDS, DOJO_TIMING } from './defense-dojo-engine.js';

let activeDojo = null;
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const shieldIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z"/><path d="m8 9 8 7m0-7-8 7"/></svg>';
const outcomeText = { blocked: '稳稳挡住', perfect: '完美格挡', missed: '未能挡住' };

/** Open a free practice dialog. This module never reads or changes player progress. */
export function openDefenseDojo({ onClose, onSound, heroName = '银河奥特曼' } = {}) {
  if (activeDojo) { activeDojo.dialog.focus(); return activeDojo.handle; }
  const stylesheet = new URL('./defense-dojo.css', import.meta.url).href;
  if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === stylesheet)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = stylesheet; document.head.append(link);
  }
  const engine = new DefenseDojoEngine();
  const dialog = document.createElement('dialog');
  dialog.className = 'dojo-dialog';
  dialog.tabIndex = -1;
  dialog.setAttribute('aria-labelledby', 'dojo-title');
  dialog.setAttribute('aria-describedby', 'dojo-description');
  dialog.innerHTML = `<div class="dojo-shell">
    <header class="dojo-header"><div><p class="dojo-eyebrow"><i></i> GALAXY TRAINING LAB <span>/ 01</span></p><h2 id="dojo-title">把勇敢，练成本能。</h2></div><div class="dojo-toolbar"><button type="button" data-dojo="pause" class="dojo-icon-button" aria-label="暂停训练" title="暂停训练（P / Esc）" disabled>Ⅱ</button><button type="button" data-dojo="close" class="dojo-icon-button" aria-label="返回基地" title="返回基地">×</button></div></header>
    <div class="dojo-mission"><span>${shieldIcon} X 防御训练场</span><p id="dojo-description">免费练习 · 不消耗体力 · 无成长奖励</p></div>
    <ol class="dojo-rounds" aria-label="三轮训练进度">${DOJO_ROUNDS.map((round, index) => `<li data-round="${index}"><span class="dojo-round-number">0${index + 1}</span><div><b>${round.lesson}</b><small class="dojo-round-result">${round.move}</small></div></li>`).join('')}</ol>
    <div class="dojo-stage" data-phase="ready" data-perfect="false">
      <div class="dojo-grid" aria-hidden="true"></div><div class="dojo-stage-orbit" aria-hidden="true"></div>
      <div class="dojo-stage-label"><span><i></i> 全息模拟 · 安全区域</span><small>NO DAMAGE</small></div>
      <div class="dojo-actor actor hero-actor" data-pose="idle">${heroSVG('dojo-hero')}</div>
      <div class="dojo-actor actor monster-actor" data-pose="idle">${monsterSVG('obsidian', 'dojo-monster')}</div>
      <div class="dojo-projectile" aria-hidden="true"></div><div class="dojo-impact" aria-hidden="true"></div>
      <div class="dojo-stage-names"><span>${escapeHTML(heroName)}</span><span class="dojo-monster-name">暗星装甲兽 · 模拟体</span></div>
      <div class="dojo-pause-screen" hidden><span class="dojo-pause-symbol">Ⅱ</span><h3>训练已暂停</h3><p class="dojo-pause-reason">所有倒计时已冻结，准备好再继续。</p><button type="button" data-dojo="resume" class="dojo-primary">继续训练 <span>▶</span></button><button type="button" data-dojo="close" class="dojo-text-button">返回基地</button></div>
    </div>
    <section class="dojo-console">
      <div class="dojo-intro"><div><p class="dojo-eyebrow">三轮演习 / 约 20 秒</p><h3>双臂交叉，守住每一次冲击。</h3><p>看到预警后，点一次 <strong>X 防御</strong>，双臂会保持到冲击结束。<br>在最后 <strong>0.35 秒</strong>的金色区间出手，可获得完美格挡。</p></div><button type="button" data-dojo="start" class="dojo-primary">开始训练 <span>↗</span></button></div>
      <div class="dojo-live" hidden><div class="dojo-instrument"><div class="dojo-timing-heading"><div><small class="dojo-phase-label">观察对手</small><h3 class="dojo-instruction">准备下一轮</h3></div><strong class="dojo-countdown" aria-hidden="true">准备</strong></div><div class="dojo-timing-track" role="progressbar" aria-label="怪兽攻击预警" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="dojo-timing-fill"></span><i class="dojo-perfect-zone"></i></div><div class="dojo-timing-legend"><span>观察预警 → 架起防御</span><span><i></i> 最后 0.35 秒</span></div></div><button type="button" data-dojo="defend" class="dojo-defend" aria-keyshortcuts="4 Space" aria-pressed="false" disabled>${shieldIcon}<span><strong>X 防御</strong><small>点一次 · 保持到冲击</small></span><kbd>4 / 空格</kbd></button></div>
      <div class="dojo-summary" hidden><div class="dojo-summary-heading"><div><p class="dojo-eyebrow">TRAINING COMPLETE</p><h3 class="dojo-summary-title">训练完成</h3><p class="dojo-summary-copy"></p></div><div class="dojo-score"><strong>0<small>/ 3</small></strong><span>成功防御</span></div></div><div class="dojo-result-list"></div><div class="dojo-summary-actions"><button type="button" data-dojo="restart" class="dojo-primary">再练一次 <span>↻</span></button><button type="button" data-dojo="close" class="dojo-secondary">返回基地</button></div></div>
      <p class="dojo-feedback" role="status" aria-live="polite">这是安全练习，受击也不会损失生命或成长进度。</p>
    </section>
    <footer class="dojo-footer"><span>实战防御成就需要在城市防卫战中完成。</span><span><kbd>P</kbd> 暂停 · <kbd>Esc</kbd> 暂停 / 返回</span></footer>
  </div>`;
  const $ = selector => dialog.querySelector(selector);
  const el = {
    stage: $('.dojo-stage'), hero: $('.hero-actor'), monster: $('.monster-actor'), monsterName: $('.dojo-monster-name'),
    intro: $('.dojo-intro'), live: $('.dojo-live'), summary: $('.dojo-summary'), feedback: $('.dojo-feedback'),
    pause: $('[data-dojo="pause"]'), pauseScreen: $('.dojo-pause-screen'), pauseReason: $('.dojo-pause-reason'),
    defend: $('[data-dojo="defend"]'), countdown: $('.dojo-countdown'), label: $('.dojo-phase-label'), instruction: $('.dojo-instruction'),
    track: $('.dojo-timing-track'), fill: $('.dojo-timing-fill'), zone: $('.dojo-perfect-zone'),
  };
  const previousFocus = document.activeElement;
  const previousOverflow = document.body.style.overflow;
  document.body.append(dialog);
  document.body.style.overflow = 'hidden';
  let closed = false;
  let frameId = 0;
  let lastFrame = performance.now();
  let lastPhase = '';
  let lastRound = 0;
  let summaryShown = false;
  let pauseShown = false;
  const sound = name => { try { onSound?.(name); } catch { /* Optional audio must not interrupt training. */ } };

  function advance(now = performance.now()) {
    const delta = now - lastFrame;
    lastFrame = now;
    if (engine.status === 'running' && !engine.paused && delta > 1000) {
      engine.setPaused(true);
      el.pauseReason.textContent = '检测到页面暂时停顿，训练已暂停。倒计时保留在停顿前的位置。';
      return;
    }
    engine.step(delta);
  }

  function render() {
    const s = engine.snapshot();
    const running = s.status === 'running';
    const result = s.results[s.roundIndex];
    el.stage.dataset.phase = s.status === 'ready' ? 'ready' : s.phase;
    el.stage.dataset.perfect = String(s.perfectWindow && !s.guarding);
    dialog.dataset.paused = String(s.paused);
    el.intro.hidden = s.status !== 'ready';
    el.live.hidden = !running;
    el.summary.hidden = s.status !== 'complete';
    el.pauseScreen.hidden = !s.paused;
    el.pause.disabled = !running || s.paused;
    el.defend.disabled = !running || s.paused || s.phase !== 'warning';
    el.defend.setAttribute('aria-pressed', String(s.guarding));
    el.defend.querySelector('strong').textContent = s.guarding ? 'X 防御已架起' : 'X 防御';
    el.defend.querySelector('small').textContent = s.guarding ? '保持姿势 · 等待冲击' : '点一次 · 保持到冲击';
    el.fill.style.width = `${s.warningProgress * 100}%`;
    el.track.setAttribute('aria-valuenow', String(Math.round(s.warningProgress * 100)));
    el.zone.style.width = `${DOJO_TIMING.perfectMs / s.round.warningMs * 100}%`;
    el.countdown.textContent = s.phase === 'warning' ? `${(Math.ceil(s.remainingMs / 10) / 100).toFixed(2)}s`
      : s.phase === 'prepare' ? `${Math.max(1, Math.ceil((DOJO_TIMING.prepareMs - s.phaseElapsed) / 1000))}` : '✓';
    el.countdown.dataset.outcome = result?.outcome || '';
    if (s.phase === 'feedback' && result?.outcome === 'missed') el.countdown.textContent = '再试试';
    el.hero.dataset.pose = s.status === 'complete' ? 'wave' : s.guarding && (s.phase === 'warning' || s.phase === 'feedback') ? 'defend'
      : s.phase === 'feedback' && result?.outcome === 'missed' && s.phaseElapsed < 550 ? 'hurt' : 'idle';
    if (lastRound !== s.roundIndex) {
      el.monster.innerHTML = monsterSVG(s.round.monster, `dojo-monster-${s.roundIndex}`);
      el.monsterName.textContent = `${s.round.name} · 模拟体`;
      lastRound = s.roundIndex;
    }
    el.monster.dataset.pose = s.phase === 'warning' ? 'charge' : s.phase === 'feedback' && s.phaseElapsed < 850 ? 'attack' : 'idle';
    el.stage.dataset.outcome = result?.outcome || '';
    el.stage.style.setProperty('--impact-fade', s.phase === 'feedback' ? Math.max(0, 1 - s.phaseElapsed / 650) : 0);
    const phaseKey = `${s.status}-${s.roundIndex}-${s.phase}-${s.perfectWindow}-${s.guarding}`;
    if (lastPhase !== phaseKey) {
      lastPhase = phaseKey;
      for (const item of dialog.querySelectorAll('[data-round]')) {
        const index = Number(item.dataset.round);
        item.dataset.state = s.results[index]?.outcome || (index === s.roundIndex ? 'current' : 'waiting');
        item.querySelector('.dojo-round-result').textContent = s.results[index] ? outcomeText[s.results[index].outcome] : DOJO_ROUNDS[index].move;
      }
      if (running) {
        el.label.textContent = `第 ${s.roundIndex + 1} 轮 / ${DOJO_ROUNDS.length} · ${s.round.move}`;
        if (s.phase === 'prepare') {
          el.instruction.textContent = s.round.lesson;
          el.feedback.textContent = s.round.hint;
        } else if (s.phase === 'warning') {
          el.instruction.textContent = s.guarding ? '双臂交叉，守住正面' : s.perfectWindow ? '就是现在！X 防御' : '怪兽蓄力中，准备迎击';
          el.feedback.textContent = s.guarding ? '防御会保持到本轮冲击结束，无需连续点击。' : s.perfectWindow ? '金色窗口已亮起！现在防御可完美格挡。' : '可以提前防御；等到金色区间出手，还能挑战完美格挡。';
        } else if (s.phase === 'feedback') {
          el.instruction.textContent = outcomeText[result.outcome];
          el.feedback.textContent = result.outcome === 'perfect' ? `漂亮！你在冲击前 ${(result.leadMs / 1000).toFixed(2)} 秒架起了防御。`
            : result.outcome === 'blocked' ? '成功挡住！下一轮可以再等一会儿，试试金色区间。' : '没关系，这是安全模拟。下次看到预警就先架起防御。';
          sound(result.outcome === 'missed' ? 'hurt' : 'block');
        }
      }
    }
    if (s.status === 'complete' && !summaryShown) {
      summaryShown = true;
      $('.dojo-summary-title').textContent = s.perfect === 3 ? '完美守护，三次全中！' : s.blocked === 3 ? '每一次冲击，都守住了。' : '练习结束，每次都在进步。';
      $('.dojo-summary-copy').textContent = `本次完成 ${s.perfect} 次完美格挡。${s.blocked === 3 ? '带着这份手感，去守护城市吧。' : '别着急，再练一次会更熟悉节奏。'}`;
      $('.dojo-score strong').innerHTML = `${s.blocked}<small>/ 3</small>`;
      $('.dojo-result-list').innerHTML = s.results.map((entry, index) => `<div data-outcome="${entry.outcome}"><span>0${index + 1} · ${DOJO_ROUNDS[index].move}</span><b>${outcomeText[entry.outcome]}</b><small>${entry.leadMs === null ? '下次提前准备' : `提前 ${(entry.leadMs / 1000).toFixed(2)} 秒`}</small></div>`).join('');
      el.feedback.textContent = `训练完成，成功防御 ${s.blocked} 次，其中完美格挡 ${s.perfect} 次。免费训练不会发放成长奖励。`;
      $('[data-dojo="restart"]').focus({ preventScroll: true });
    }
    if (s.paused && !pauseShown) $('[data-dojo="resume"]').focus({ preventScroll: true });
    pauseShown = s.paused;
  }

  function frame(now) {
    frameId = 0;
    if (closed) return;
    advance(now);
    render();
    schedule();
  }

  function schedule() {
    if (!closed && !frameId && engine.status === 'running' && !engine.paused) frameId = requestAnimationFrame(frame);
  }

  function pause(reason = '所有倒计时已冻结，准备好再继续。') {
    if (closed || engine.status !== 'running' || engine.paused) return;
    advance();
    engine.setPaused(true);
    cancelAnimationFrame(frameId); frameId = 0;
    el.pauseReason.textContent = reason;
    render();
    $('[data-dojo="resume"]').focus({ preventScroll: true });
  }

  function resume() {
    if (closed || document.hidden) return;
    lastFrame = performance.now();
    engine.setPaused(false);
    render();
    dialog.focus({ preventScroll: true });
    schedule();
  }

  function close() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(frameId);
    document.removeEventListener('visibilitychange', onVisibility);
    dialog.removeEventListener('keydown', onKeydown);
    dialog.removeEventListener('cancel', onCancel);
    dialog.removeEventListener('click', onClick);
    dialog.removeEventListener('close', close);
    if (dialog.open) dialog.close();
    dialog.remove();
    document.body.style.overflow = previousOverflow;
    activeDojo = null;
    // The host may re-enable the launch button while handling onClose.
    try { onClose?.(); }
    finally { if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); }
  }

  function start() {
    if (document.hidden) return;
    engine.start();
    lastFrame = performance.now(); lastPhase = ''; summaryShown = false;
    render();
    dialog.focus({ preventScroll: true });
    schedule();
  }

  function defend() {
    advance();
    if (engine.defend()) sound('defend');
    render();
  }

  function onClick(event) {
    const command = event.target.closest('[data-dojo]')?.dataset.dojo;
    if (command === 'close') close();
    if (command === 'start' || command === 'restart') start();
    if (command === 'pause') pause();
    if (command === 'resume') resume();
    if (command === 'defend') defend();
  }

  function onKeydown(event) {
    if (event.repeat) {
      if (event.code === 'Space' && (event.target === dialog || event.target === el.defend)) event.preventDefault();
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key.toLowerCase() === 'p') { event.preventDefault(); engine.paused ? resume() : pause(); return; }
    if (event.code !== 'Space' && event.key !== '4') return;
    // Preserve native Space activation for start, resume, return and retry buttons.
    const button = event.target.closest('button');
    if (event.code === 'Space' && button && button !== el.defend) return;
    if (engine.status === 'running' && !engine.paused) { event.preventDefault(); defend(); }
  }

  function onCancel(event) {
    event.preventDefault();
    if (engine.status === 'running' && !engine.paused) pause(); else close();
  }

  function onVisibility() {
    if (document.hidden) pause('你刚刚离开了页面，训练已自动暂停。所有倒计时已冻结。');
  }

  dialog.addEventListener('click', onClick);
  dialog.addEventListener('keydown', onKeydown);
  dialog.addEventListener('cancel', onCancel);
  dialog.addEventListener('close', close);
  document.addEventListener('visibilitychange', onVisibility);
  const handle = { close, dispose: close, pause, resume, dialog };
  activeDojo = { dialog, handle };
  dialog.showModal();
  render();
  $('[data-dojo="start"]').focus({ preventScroll: true });
  return handle;
}
