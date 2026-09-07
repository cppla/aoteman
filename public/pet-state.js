export const SAVE_KEY = 'aoteman-pet-v2';
export const LEGACY_KEY = 'ginga-pet-v1';
const SCENES = ['base', 'moon', 'sunset'];
const MONSTERS = ['obsidian', 'lava', 'cosmic'];
export const MILESTONES = Object.freeze([
  { id: 'first_meal', title: '第一份能量餐', description: '给小伙伴喂食 1 次', metric: 'fed', target: 1, reward: { xp: 10, stars: 5 }, action: 'feed' },
  { id: 'first_training', title: '迈出英雄第一步', description: '完成 1 次特训', metric: 'training', target: 1, reward: { xp: 10, stars: 5 }, action: 'train' },
  { id: 'first_guard', title: '守护的姿势', description: '在出征中成功防御 1 次', metric: 'blocks', target: 1, reward: { xp: 15, stars: 10 }, action: 'defend' },
  { id: 'first_victory', title: '第一次守护成功', description: '赢得 1 场出征', metric: 'wins', target: 1, reward: { xp: 20, stars: 15 }, action: 'fight' },
  { id: 'training_routine', title: '特训小能手', description: '累计完成 5 次特训', metric: 'training', target: 5, reward: { xp: 25, stars: 10 }, action: 'train' },
  { id: 'starlight_rank', title: '星光新星', description: '成长到 3 级', metric: 'level', target: 3, reward: { xp: 30, stars: 20 }, action: 'journey' },
  { id: 'new_horizons', title: '一起看更远的星空', description: '解锁全部 3 个场景', metric: 'unlocked', target: 3, reward: { xp: 40, stars: 25 }, action: 'scenes' },
  { id: 'galaxy_guardian', title: '银河守护者', description: '战胜全部 3 种怪兽', metric: 'defeated', target: 3, reward: { xp: 60, stars: 40 }, action: 'fight' },
].map(milestone => Object.freeze({ ...milestone, reward: Object.freeze(milestone.reward) })));
const MILESTONE_IDS = new Set(MILESTONES.map(milestone => milestone.id));
const validUnique = (values, allowed) => [...new Set(Array.isArray(values) ? values.filter(value => allowed.includes(value)) : [])];

function companionName(value) {
  // Count Unicode code points, so one astral emoji does not count as two.
  if (typeof value !== 'string' || /[\p{Cc}\p{Cs}]/u.test(value)) throw new Error('名字需要 1–12 个字，不能包含控制字符。');
  const name = value.trim();
  if (!name || [...name].length > 12) throw new Error('名字需要 1–12 个字，不能包含控制字符。');
  return name;
}
export const clamp = (value, max = 100) => Math.max(0, Math.min(max, value));
export const dayKey = (now = Date.now()) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
export function freshState(now = Date.now()) {
  return {
    version: 2, food: 72, energy: 80, mood: 85, xp: 0, stars: 0,
    wins: 0, training: 0, fed: 0, blocks: 0, pats: 0, born: now, updated: now,
    sleeping: false, grown: false, scene: 'base', unlocked: ['base'],
    sound: false, difficulty: 'normal', defeated: [], companionName: '银河', milestones: [],
    daily: { date: dayKey(now), fed: 0, training: 0, battles: 0, claimed: false },
    journal: []
  };
}
export function sanitizeState(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || ![1, 2].includes(raw.version)) throw new Error('这不是银河小伙伴的存档。');
  const state = freshState(now);
  if (Object.hasOwn(raw, 'companionName')) state.companionName = companionName(raw.companionName);
  state.milestones = [...new Set(Array.isArray(raw.milestones) ? raw.milestones.filter(id => MILESTONE_IDS.has(id)) : [])];
  for (const key of ['food', 'energy', 'mood']) {
    if (!Number.isFinite(raw[key])) throw new Error('存档中的状态数值不完整。');
    state[key] = clamp(raw[key]);
  }
  for (const key of ['xp', 'stars', 'wins', 'training', 'fed', 'blocks', 'pats']) {
    if (Number.isFinite(raw[key])) state[key] = Math.floor(clamp(raw[key], 10000000));
  }
  for (const key of ['born', 'updated']) {
    if (Number.isFinite(raw[key]) && raw[key] > 0) state[key] = Math.min(now, raw[key]);
  }
  for (const key of ['sleeping', 'grown', 'sound']) state[key] = raw[key] === true;
  if (['easy', 'normal'].includes(raw.difficulty)) state.difficulty = raw.difficulty;
  state.unlocked = [...new Set(['base', ...validUnique(raw.unlocked, SCENES)])];
  if (state.unlocked.includes(raw.scene)) state.scene = raw.scene;
  state.defeated = validUnique(raw.defeated, MONSTERS);
  if (raw.daily?.date === dayKey(now)) {
    for (const key of ['fed', 'training', 'battles']) state.daily[key] = Number.isFinite(raw.daily[key]) ? Math.floor(clamp(raw.daily[key], 100)) : 0;
    state.daily.claimed = raw.daily.claimed === true;
  }
  if (Array.isArray(raw.journal)) state.journal = raw.journal.filter(e => e && typeof e.text === 'string' && Number.isFinite(e.at)).slice(0, 30).map(e => ({ text: e.text.slice(0, 160), at: Math.min(now, Math.max(0, e.at)) }));
  return state;
}
export function passTime(state, now = Date.now()) {
  const secs = Math.min(28800, Math.max(0, (now - state.updated) / 1000));
  state.food = clamp(state.food - secs / 1800);
  state.mood = clamp(state.mood - secs / 3600);
  state.energy = clamp(state.energy + (state.sleeping ? secs * 8 / 3 : -secs / 2400));
  state.updated = now;
  if (state.daily.date !== dayKey(now)) state.daily = { date: dayKey(now), fed: 0, training: 0, battles: 0, claimed: false };
  return state;
}
export function levelInfo(xp) {
  let level = 1, remaining = xp, needed = 80;
  while (remaining >= needed && level < 100) { remaining -= needed; level++; needed = 80 + (level - 1) * 20; }
  return { level, remaining: level === 100 ? needed : remaining, needed };
}
export function renameCompanion(state, name, now = Date.now()) {
  let normalized;
  try { normalized = companionName(name); }
  catch (error) { return { ok: false, message: error.message }; }
  passTime(state, now);
  state.companionName = normalized;
  return { ok: true };
}
export function milestoneProgress(state, idOrMilestone) {
  const id = typeof idOrMilestone === 'string' ? idOrMilestone : idOrMilestone?.id;
  const milestone = MILESTONES.find(item => item.id === id);
  if (!milestone) return { current: 0, target: 0, ready: false, claimed: false };
  let current;
  if (milestone.metric === 'unlocked') current = validUnique(state.unlocked, SCENES).length;
  else if (milestone.metric === 'defeated') current = validUnique(state.defeated, MONSTERS).length;
  else if (milestone.metric === 'level') current = levelInfo(Number.isFinite(state.xp) ? Math.max(0, state.xp) : 0).level;
  else current = Number.isFinite(state[milestone.metric]) ? Math.floor(clamp(state[milestone.metric], 10000000)) : 0;
  const claimed = Array.isArray(state.milestones) && state.milestones.includes(id);
  return { current, target: milestone.target, ready: current >= milestone.target && !claimed, claimed };
}
export function claimMilestone(state, id, now = Date.now()) {
  const milestone = MILESTONES.find(item => item.id === id);
  if (!milestone) return { ok: false, message: '还没有这个成长里程碑。' };
  const progress = milestoneProgress(state, id);
  if (progress.claimed) return { ok: false, message: '这份成长奖励已经领过啦。' };
  if (!progress.ready) return { ok: false, message: '再努力一点，达成目标就能领取啦。' };
  state.milestones = [...new Set([...(Array.isArray(state.milestones) ? state.milestones.filter(item => MILESTONE_IDS.has(item)) : []), id])];
  mutate(state, milestone.reward, now);
  return { ok: true, reward: { ...milestone.reward }, milestone };
}
export function mutate(state, values, now = Date.now()) {
  passTime(state, now);
  for (const [key, value] of Object.entries(values)) {
    if (['food', 'energy', 'mood'].includes(key)) state[key] = clamp(state[key] + value);
    else if (['xp', 'stars', 'wins', 'training', 'fed', 'blocks', 'pats'].includes(key)) state[key] = Math.floor(clamp(state[key] + value, 10000000));
  }
  return state;
}
export function dailyReady(state) { return state.daily.fed >= 1 && state.daily.training >= 1 && state.daily.battles >= 1; }
export function claimDaily(state, now = Date.now()) {
  passTime(state, now);
  if (state.daily.claimed || !dailyReady(state)) return false;
  state.daily.claimed = true;
  mutate(state, { xp: 25, stars: 15 }, now);
  return true;
}
export function care(state, action, now = Date.now()) {
  passTime(state, now);
  if (action === 'rest') { state.sleeping = !state.sleeping; return { ok: true }; }
  if (state.sleeping) return { ok: false, message: '银河正在休息，先轻轻叫醒他吧。' };
  if (action === 'feed') {
    if (state.food >= 99) return { ok: false, message: '肚子已经圆滚滚啦，一起去活动一下吧！' };
    mutate(state, { food: 25, energy: 5, mood: 5, fed: 1 }, now); state.daily.fed++;
  } else if (action === 'train') {
    if (state.food < 8 || state.energy < 12) return { ok: false, message: '特训需要 8 饱食度、12 活力。先喂食或休息吧。' };
    mutate(state, { food: -8, energy: -12, mood: 4, training: 1, xp: 20, stars: 5 }, now); state.daily.training++;
  } else if (action === 'pet') mutate(state, { mood: 6, pats: 1 }, now);
  else return { ok: false, message: '还没有这个互动。' };
  return { ok: true };
}
export function startExpedition(state, now = Date.now()) {
  passTime(state, now);
  if (state.sleeping || state.food < 10 || state.energy < 15) return false;
  mutate(state, { food: -10, energy: -15 }, now);
  return true;
}
export function settleExpedition(state, result, monsterId, now = Date.now()) {
  mutate(state, { blocks: Number.isFinite(result.blocks) ? Math.max(0, result.blocks) : 0 }, now);
  if (result.outcome === 'win') {
    mutate(state, { xp: 40, stars: 20, mood: 10, wins: 1 }, now);
    if (!state.defeated.includes(monsterId)) state.defeated.push(monsterId);
    state.daily.battles++;
  } else if (result.outcome === 'lose') { mutate(state, { xp: 5 }, now); state.daily.battles++; }
}
