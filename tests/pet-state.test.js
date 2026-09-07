import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, sanitizeState, care, passTime, levelInfo, startExpedition, settleExpedition, claimDaily, dayKey } from '../public/pet-state.js';
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
