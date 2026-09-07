export const SAVE_KEY = 'aoteman-pet-v2';
export const LEGACY_KEY = 'ginga-pet-v1';
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
    sound: false, difficulty: 'normal', defeated: [],
    daily: { date: dayKey(now), fed: 0, training: 0, battles: 0, claimed: false },
    journal: []
  };
}
export function sanitizeState(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || ![1, 2].includes(raw.version)) throw new Error('这不是银河小伙伴的存档。');
  const state = freshState(now);
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
  state.unlocked = [...new Set(['base', ...(Array.isArray(raw.unlocked) ? raw.unlocked.filter(s => ['moon', 'sunset'].includes(s)) : [])])];
  if (state.unlocked.includes(raw.scene)) state.scene = raw.scene;
  state.defeated = [...new Set(Array.isArray(raw.defeated) ? raw.defeated.filter(s => ['obsidian', 'lava', 'cosmic'].includes(s)) : [])];
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
