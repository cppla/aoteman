import { MILESTONES, milestoneProgress } from './pet-state.js';

const escapeText = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const actionLabels = { feed:'去喂一颗星光', train:'开始特训', defend:'去实战练格挡', fight:'出发守护宇宙', scenes:'看看新的风景', journey:'继续一起特训' };

export function mountJourneyPanel(container, { getState, onClaim, onAction, canAct }) {
  container.innerHTML = `<p class="dialog-lede">从第一颗星光，到守护整个宇宙。已经完成的成长也会计入，每一站的礼物只能领取一次。</p>
    <div class="journey-dialog-intro"><span class="journey-emblem" aria-hidden="true">✧</span><div><span class="eyebrow">A JOURNEY WE SHARE</span><strong id="journeyDialogName"></strong><p id="journeyDialogCount"></p></div></div>
    <div class="milestone-grid">${MILESTONES.map((milestone, index) => `<article class="milestone-card" data-milestone="${milestone.id}">
      <div class="milestone-top"><span class="milestone-number">${String(index + 1).padStart(2,'0')}</span><span class="milestone-state"></span></div>
      <h3>${escapeText(milestone.title)}</h3><p>${escapeText(milestone.description)}</p>
      <div class="milestone-progress"><span></span><b></b></div><div class="meter"><span></span></div>
      <div class="milestone-reward"><span>✧ ${milestone.reward.stars} 星光</span><span>+${milestone.reward.xp} 经验</span></div>
      <button class="dialog-button milestone-button" data-milestone-action="${milestone.id}"></button>
    </article>`).join('')}</div><p class="journey-note">防御训练场帮助练习时机；守护、格挡和怪兽收集目标需要在真实战斗中完成。</p>`;
  for (const button of container.querySelectorAll('[data-milestone-action]')) button.onclick = () => {
    if (!canAct()) return;
    const milestone = MILESTONES.find(item => item.id === button.dataset.milestoneAction);
    const progress = milestoneProgress(getState(), milestone);
    if (progress.claimed) return;
    if (progress.ready) { onClaim(milestone.id); update(); }
    else onAction(milestone.action);
  };
  function update() {
    const state = getState();
    container.querySelector('#journeyDialogName').textContent = `${state.companionName}的成长航线`;
    container.querySelector('#journeyDialogCount').textContent = `${state.milestones.length} / ${MILESTONES.length} 站已收藏`;
    for (const milestone of MILESTONES) {
      const card = container.querySelector(`[data-milestone="${milestone.id}"]`);
      const progress = milestoneProgress(state, milestone), complete = progress.claimed || progress.ready;
      card.dataset.status = progress.claimed ? 'claimed' : progress.ready ? 'ready' : 'growing';
      card.querySelector('.milestone-state').textContent = progress.claimed ? '✓ 礼物已收藏' : progress.ready ? '礼物可以领取' : '正在一起成长';
      card.querySelector('.milestone-progress span').textContent = complete ? '这一站，做到了' : '成长进度';
      card.querySelector('.milestone-progress b').textContent = `${Math.min(progress.current, progress.target)} / ${progress.target}`;
      card.querySelector('.meter span').style.width = `${Math.min(100, progress.current / progress.target * 100)}%`;
      const button = card.querySelector('button');
      button.textContent = progress.claimed ? '已经收藏 ✓' : progress.ready ? '领取这一站的礼物 ↗' : `${actionLabels[milestone.action] || '继续成长'} ↗`;
      button.classList.toggle('primary', progress.ready);
      button.disabled = !canAct() || progress.claimed;
    }
  }
  update();
  return { update };
}

/** Recommendation follows current needs, so it never asks a sleeping/full pet to eat. */
export function companionSuggestion(state) {
  if (state.sleeping) return { action:'rest', label:'轻轻唤醒', title:'正在梦里收集星光', copy:'让伙伴继续休息，或轻轻唤醒他，开始今天的故事。' };
  if (state.energy < 20) return { action:'rest', label:'去休息', title:'先充一点能量吧', copy:'活力有点低，休息每 3 秒恢复 8 点，充好电再出发。' };
  if (state.food < 35) return { action:'feed', label:'喂点星光', title:'肚子有一点点饿', copy:'先吃一颗星光。照顾好自己，也是成为英雄的一部分。' };
  if (state.mood < 40) return { action:'pet', label:'摸摸伙伴', title:'想要你的一点陪伴', copy:'轻轻摸摸伙伴，给他一个温柔的回应。' };
  if (MILESTONES.some(item => milestoneProgress(state, item).ready)) return { action:'journey', label:'去领成长礼', title:'有一份成长礼物等着你', copy:'刚刚的努力被记住了，到成长航线收藏这一站的奖励。' };
  if (state.fed === 0 && state.food < 99) return { action:'feed', label:'第一次喂食', title:'我们的故事，从一颗星光开始', copy:'喂点星光，让小伙伴认识这位新搭档。' };
  if (state.training === 0) return { action:'train', label:'一起特训', title:'试着打出第一记银河拳', copy:'特训获得经验和星光，也会点亮你们的成长航线。' };
  if (state.wins === 0) return { action:'dojo', label:'练习 X 防御', title:'出发前，先学会保护自己', copy:'免费练习 3 轮预警与格挡，再去迎接第一场守护。' };
  return { action:'journey', label:'看看下一站', title:'下一个小目标，一起完成', copy:'特训、探索新的家、认识更多怪兽，选择今天想做的事。' };
}
