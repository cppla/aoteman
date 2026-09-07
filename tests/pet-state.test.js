import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { freshState, sanitizeState, care, passTime, levelInfo, startExpedition, settleExpedition, claimDaily, dayKey, MILESTONES, milestoneProgress, claimMilestone, renameCompanion } from '../public/pet-state.js';
const names = JSON.parse(readFileSync(new URL('./fixtures/growth-names.json', import.meta.url)));
const now = 1788739200000;
test('care changes real resources and prevents sleeping actions', () => {
  const s = freshState(now);
  assert.equal(care(s, 'feed', now).ok, true); assert.equal(s.food, 97);
  care(s, 'train', now); assert.equal(s.xp, 20); assert.equal(s.stars, 5);
  care(s, 'rest', now); assert.equal(care(s, 'train', now).ok, false);
  passTime(s, now + 6000); assert.equal(s.energy, 89);
});
test('offline decay is capped and pet remains recoverable from zero', () => {
  const s = freshState(now); passTime(s, now + 86400000 * 30);
  assert.equal(s.food, 56); assert.equal(s.energy, 68);
  s.food = s.energy = 0; assert.equal(startExpedition(s, s.updated), false);
  care(s, 'feed', s.updated); care(s, 'rest', s.updated); passTime(s, s.updated + 6000);
  assert.ok(s.energy > 15); assert.ok(s.food > 10);
});
test('save validation migrates v1, caps values and rejects invalid data', () => {
  const s = sanitizeState({ ...freshState(now), version: 1, food: 900, xp: -7, scene: 'script', journal: [{text: '<hello>', at: now}] }, now);
  assert.equal(s.version, 2); assert.equal(s.food, 100); assert.equal(s.xp, 0); assert.equal(s.scene, 'base');
  assert.throws(() => sanitizeState({ version: 7 }, now));
  assert.throws(() => sanitizeState({ version: 2, food: '72' }, now));
});
test('expedition cost, outcomes, progression and once-only daily reward', () => {
  const s = freshState(now); care(s, 'feed', now); care(s, 'train', now);
  assert.equal(startExpedition(s, now), true); assert.equal(s.energy, 58);
  settleExpedition(s, { outcome: 'win', blocks: 3 }, 'obsidian', now);
  assert.equal(s.wins, 1); assert.equal(s.blocks, 3); assert.deepEqual(s.defeated, ['obsidian']);
  assert.equal(claimDaily(s, now), true); assert.equal(s.xp, 85); assert.equal(s.stars, 40);
  assert.equal(claimDaily(s, now), false); assert.equal(s.xp, 85);
  assert.equal(levelInfo(s.xp).level, 2);
  settleExpedition(s, { outcome: 'retreat', blocks: 0 }, 'lava'); assert.equal(s.xp, 85);
});
test('daily rollover resets before a stale reward can be claimed', () => {
  const beforeMidnight = new Date(2026, 8, 7, 23, 59, 59).getTime();
  const s = freshState(beforeMidnight);
  Object.assign(s.daily, { fed: 1, training: 1, battles: 1 });
  assert.equal(claimDaily(s, beforeMidnight + 2000), false);
  assert.equal(s.xp, 0); assert.equal(s.stars, 0);
  assert.equal(s.daily.date, dayKey(beforeMidnight + 2000)); assert.equal(s.daily.claimed, false);
});
test('old saves gain optional growth fields without resetting existing progress', () => {
  const legacy = { ...freshState(now), version: 1, xp: 320, stars: 80, wins: 3 };
  delete legacy.companionName; delete legacy.milestones;
  const s = sanitizeState(legacy, now);
  assert.equal(s.version, 2); assert.equal(s.xp, 320); assert.equal(s.stars, 80);
  assert.equal(s.companionName, '银河'); assert.deepEqual(s.milestones, []);
});
test('companion names share Unicode validation fixtures with the save API', () => {
  for (const { input, name } of names.valid) {
    const s = freshState(now);
    assert.equal(renameCompanion(s, input, now).ok, true);
    assert.equal(s.companionName, name);
    assert.equal(sanitizeState({ ...s, companionName: input }, now).companionName, name);
  }
  for (const input of names.invalid) {
    const s = freshState(now), before = structuredClone(s);
    assert.equal(renameCompanion(s, input, now + 1000).ok, false);
    assert.deepEqual(s, before, 'invalid rename must not mutate the existing save');
    assert.throws(() => sanitizeState({ ...s, companionName: input }, now));
  }
});
test('milestone validation filters unknown and duplicate claimed IDs', () => {
  const s = sanitizeState({ ...freshState(now), milestones: ['first_meal', 'first_meal', '__proto__', {}, ['first_guard'], 'galaxy_guardian'] }, now);
  assert.deepEqual(s.milestones, ['first_meal', 'galaxy_guardian']);
  assert.deepEqual(sanitizeState({ ...s, milestones: { first_guard: true } }, now).milestones, []);
  assert.equal(milestoneProgress(s, 'first_meal').claimed, true);
  assert.deepEqual(milestoneProgress(s, 'unknown'), { current: 0, target: 0, ready: false, claimed: false });
});
test('all eight milestones gate their rewards and can only be claimed once across reloads', () => {
  assert.equal(MILESTONES.length, 8);
  for (const milestone of MILESTONES) {
    let s = freshState(now);
    assert.equal(claimMilestone(s, milestone.id, now).ok, false);
    if (milestone.metric === 'level') s.xp = 180;
    else if (milestone.metric === 'unlocked') s.unlocked = ['base', 'moon', 'sunset'];
    else if (milestone.metric === 'defeated') s.defeated = ['obsidian', 'lava', 'cosmic'];
    else s[milestone.metric] = milestone.target;
    assert.equal(milestoneProgress(s, milestone).ready, true);
    const xp = s.xp, stars = s.stars;
    const result = claimMilestone(s, milestone.id, now);
    assert.equal(result.ok, true); assert.equal(result.milestone.id, milestone.id);
    assert.deepEqual(result.reward, milestone.reward);
    assert.equal(s.xp, xp + milestone.reward.xp); assert.equal(s.stars, stars + milestone.reward.stars);
    assert.equal(milestoneProgress(s, milestone.id).ready, false);
    s = sanitizeState(JSON.parse(JSON.stringify(s)), now);
    assert.equal(claimMilestone(s, milestone.id, now).ok, false);
    assert.equal(s.xp, xp + milestone.reward.xp); assert.equal(s.stars, stars + milestone.reward.stars);
  }
});
test('milestone progress uses valid distinct discoveries and canonical requirements', () => {
  const s = freshState(now);
  s.unlocked = ['base', 'base', 'unknown', {}, 'moon'];
  s.defeated = ['obsidian', 'obsidian', 'invented', [], 'lava'];
  assert.equal(milestoneProgress(s, 'new_horizons').current, 2);
  assert.equal(milestoneProgress(s, 'galaxy_guardian').current, 2);
  assert.equal(claimMilestone(s, 'galaxy_guardian', now).ok, false);
  assert.equal(milestoneProgress(s, { id: 'first_victory', target: 0, metric: 'food' }).ready, false);
  assert.equal(claimMilestone(s, '__proto__', now).ok, false);
  assert.equal(s.stars, 0); assert.deepEqual(s.milestones, []);
});
