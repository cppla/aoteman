import { levelInfo } from './pet-state.js';

export const growthTitle = level => level < 3 ? '初生之光' : level < 6 ? '闪耀新星' : level < 10 ? '星际勇士' : '银河守护者';

/** Presentation only: only explicit, already-earned rewards enter this queue. */
export function mountGrowthReactions({ habitat, hero, isBlocked, onPose, onSay, onSound }) {
  if (!document.querySelector('link[data-growth-reactions]')) {
    const style = document.createElement('link');
    style.rel = 'stylesheet'; style.href = new URL('./growth-reactions.css', import.meta.url).href;
    style.dataset.growthReactions = ''; document.head.append(style);
  }
  const overlay = document.createElement('div');
  overlay.className = 'growth-reaction'; overlay.hidden = true;
  overlay.innerHTML = `<div class="growth-reaction-halo" aria-hidden="true"><i></i><i></i>${Array.from({ length:8 }, (_, i) => `<b style="--spark:${i}">✦</b>`).join('')}</div><div class="growth-reaction-badge" role="status" aria-live="polite" aria-atomic="true"><span class="growth-reaction-emblem" aria-hidden="true">✧</span><span class="growth-reaction-copy"><small></small><strong></strong></span><span class="growth-reaction-xp"></span></div>`;
  habitat.append(overlay);
  let pending = null, active = null, timer, destroyed = false;
  const invoke = (callback, ...args) => { try { callback?.(...args); } catch { /* A visual response must never interrupt saving. */ } };
  function clearActive() {
    clearTimeout(timer); active = null;
    overlay.hidden = true; delete overlay.dataset.kind;
    delete habitat.dataset.growthReaction; delete hero.dataset.growthReaction;
  }
  function flush() {
    if (destroyed || active || !pending || document.hidden || isBlocked()) return;
    const event = pending; pending = null; active = event;
    const before = levelInfo(event.beforeXP).level, after = levelInfo(event.afterXP).level;
    const leveled = after > before, kind = leveled ? 'levelup' : 'earned';
    const title = leveled ? `Lv. ${after} · ${growthTitle(after)}` : `${event.name}又进步啦`;
    const speech = leveled ? `我长大啦！现在是 Lv. ${after}，谢谢你陪我一起变强！` : event.source === 'train' ? '这次出拳更有力了！给你一个英雄敬礼。' : event.source === 'battle' ? '勇敢的光收到了！下次，我们也一起守护。' : '这份成长礼，我会好好珍惜。我们一起发光！';
    overlay.querySelector('.growth-reaction-copy small').textContent = leveled ? '新的光芒，因你而闪耀' : event.source === 'train' ? '特训完成 · 英雄敬礼' : event.source === 'battle' ? '守护归来 · 勇气收到了' : '我们的成长，又多了一点';
    overlay.querySelector('.growth-reaction-copy strong').textContent = title;
    overlay.querySelector('.growth-reaction-xp').textContent = `+${event.afterXP - event.beforeXP} XP`;
    overlay.dataset.kind = kind; habitat.dataset.growthReaction = kind; hero.dataset.growthReaction = kind;
    overlay.hidden = false;
    invoke(onPose, leveled ? 'levelup' : 'salute', leveled ? 3200 : 2400);
    invoke(onSay, speech);
    if (leveled) invoke(onSound, 'win');
    timer = setTimeout(() => { clearActive(); flush(); }, leveled ? 4200 : 3100);
  }
  function reward({ beforeXP, afterXP, name, source }) {
    if (destroyed || !Number.isFinite(beforeXP) || !Number.isFinite(afterXP) || afterXP <= beforeXP) return;
    // Several gifts claimed in one dialog become one visible thank-you on return.
    pending = pending ? { ...pending, afterXP, name, source } : { beforeXP, afterXP, name, source };
    flush();
  }
  const onVisible = () => { if (!document.hidden) flush(); };
  document.addEventListener('visibilitychange', onVisible);
  return {
    reward, flush,
    interrupt: clearActive,
    reset() { pending = null; clearActive(); },
    destroy() { destroyed = true; pending = null; clearActive(); document.removeEventListener('visibilitychange', onVisible); overlay.remove(); },
  };
}
