import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleEngine, MONSTERS } from '../public/battle-engine.js';

const create = (options = {}) => new BattleEngine({ random: () => 0, ...options });
const telegraph = (game) => {
  game.step(game.snapshot().nextAttackAt - game.snapshot().elapsed);
  return game.snapshot().currentAttack;
};

test('ordinary X defense reduces actual incoming damage by 90% across the whole warning window', () => {
  for (const delay of [0, 200, 600, 1000]) {
    const game = create();
    const attack = telegraph(game);
    game.step(delay);
    assert.equal(game.act('defend').ok, true);
    assert.equal(game.snapshot().heroPose, 'defend');
    game.step(attack.strikesAt - game.snapshot().elapsed);
    const state = game.snapshot();
    assert.equal(state.heroHp, 118);
    assert.equal(state.stats.damageTaken, 2);
    assert.equal(state.stats.blocks, 1);
    assert.equal(state.stats.perfects, 0);
    assert.equal(state.energy, 10);
    assert.equal(state.defending, false, 'a block protects one enemy attack');
  }
});

test('a late X defense blocks all damage and grants perfect-block energy', () => {
  const game = create();
  const attack = telegraph(game);
  game.step(attack.windup - 240);
  game.act('defend');
  game.step(240);
  assert.equal(game.snapshot().heroHp, 120);
  assert.equal(game.snapshot().energy, 24);
  assert.equal(game.snapshot().stats.perfects, 1);
  assert.equal(game.snapshot().stats.blocks, 1);
});

test('repeated defense presses do not turn an early guard into a perfect guard', () => {
  const game = create();
  const attack = telegraph(game);
  game.act('defend');
  game.step(attack.windup - 100);
  assert.equal(game.act('defend').reason, 'already-defending');
  game.step(100);
  assert.equal(game.snapshot().stats.perfects, 0);
  assert.equal(game.snapshot().stats.damageTaken, 2);
});

test('energy gates beam and ultimate, and only a successful action spends energy', () => {
  const game = create();
  assert.deepEqual(game.act('beam'), { ok: false, reason: 'energy', required: 30 });
  assert.deepEqual(game.act('special'), { ok: false, reason: 'energy', required: 100 });
  assert.equal(game.snapshot().monsterHp, 240);
  for (let i = 0; i < 4; i++) {
    assert.equal(game.act('punch').ok, true);
    game.step(560);
  }
  const energy = game.snapshot().energy;
  const beam = game.act('beam');
  assert.equal(beam.ok, true);
  assert.equal(game.snapshot().energy, energy - 30 + (beam.precise ? 4 : 0));
  assert.equal(game.snapshot().stats.punches, 4);
  assert.equal(game.snapshot().stats.beams, 1);
  const afterBeam = game.snapshot().energy;
  assert.equal(game.act('beam').reason, 'cooldown');
  assert.equal(game.snapshot().energy, afterBeam);
});

test('pausing freezes warning, health, energy, cooldown and all combat time', () => {
  const game = create();
  telegraph(game);
  game.act('punch');
  game.setPaused(true);
  const before = game.snapshot();
  game.step(60_000);
  assert.equal(game.act('defend').reason, 'paused');
  assert.deepEqual(game.snapshot(), before);
  game.setPaused(false);
  game.step(before.attackRemaining);
  assert.equal(game.snapshot().heroHp, 100);
});

test('galaxy finisher requires a genuinely full 100 energy and consumes the charge', () => {
  const game = create();
  for (let i = 0; i < 10; i++) {
    game.act('punch');
    game.step(560);
  }
  assert.ok(game.snapshot().energy >= 90 && game.snapshot().energy < 100);
  assert.deepEqual(game.act('special'), { ok: false, reason: 'energy', required: 100 });
  game.act('punch');
  game.step(560);
  assert.equal(game.snapshot().energy, 100);
  const result = game.act('special');
  assert.equal(result.ok, true);
  assert.equal(game.snapshot().energy, result.precise ? 4 : 0);
  assert.equal(game.snapshot().stats.specials, 1);
});

test('successful dodge requires the strike to arrive within its 480ms window', () => {
  const game = create();
  const attack = telegraph(game);
  game.step(attack.windup - 300);
  game.act('dodge');
  assert.equal(game.act('dodge').reason, 'dodge-cooldown');
  game.step(300);
  assert.equal(game.snapshot().stats.dodges, 1);
  assert.equal(game.snapshot().heroHp, 120);
  const early = create();
  const earlyAttack = telegraph(early);
  early.act('dodge');
  early.step(earlyAttack.windup);
  assert.equal(early.snapshot().stats.dodges, 0);
  assert.equal(early.snapshot().heroHp, 100);
});

test('attacking cancels a held defense', () => {
  const game = create();
  const attack = telegraph(game);
  game.act('defend');
  game.act('punch');
  game.step(attack.windup);
  assert.equal(game.snapshot().heroHp, 100);
  assert.equal(game.snapshot().stats.blocks, 0);
});

test('unanswered attacks cause defeat and subsequent ticks and actions cannot change the result', () => {
  let settlements = 0;
  const game = create({ onFinish: () => settlements++ });
  game.step(120_000);
  const state = game.snapshot();
  assert.equal(state.result.outcome, 'lose');
  assert.equal(state.heroHp, 0);
  assert.equal(state.heroPose, 'defeat');
  game.step(100_000);
  game.retreat();
  game.finish('win');
  assert.equal(game.act('punch').reason, 'ended');
  assert.equal(settlements, 1);
  assert.deepEqual(game.snapshot(), state);
});

test('defeating a monster produces one victory with bounded HP and recorded statistics', () => {
  let settlements = 0;
  const game = create({ onFinish: () => settlements++ });
  for (let i = 0; i < 50 && game.snapshot().status === 'active'; i++) {
    game.act(game.snapshot().energy >= 30 ? 'beam' : 'punch');
    game.step(1000);
  }
  const state = game.snapshot();
  assert.equal(state.result.outcome, 'win');
  assert.equal(state.monsterHp, 0);
  assert.equal(state.stats.damageDealt, MONSTERS[0].hp);
  assert.ok(state.result.score > 0);
  assert.ok(state.result.maxCombo > 0);
  assert.equal(game.retreat().outcome, 'win');
  assert.equal(settlements, 1);
});

test('large and small simulation steps resolve the same attack sequence deterministically', () => {
  const whole = create();
  const split = create();
  whole.step(14_000);
  for (let i = 0; i < 140; i++) split.step(100);
  assert.deepEqual(whole.snapshot(), split.snapshot());
});

test('retreat while paused is final, idempotent and reports no victory reward', () => {
  let settlements = 0;
  const game = create({ onFinish: () => settlements++ });
  game.step(1200);
  game.setPaused(true);
  const result = game.retreat();
  assert.equal(result.outcome, 'retreat');
  assert.equal(result.score, 0);
  assert.equal(game.retreat(), result);
  assert.equal(settlements, 1);
});

test('invalid inputs and snapshot mutation cannot corrupt live state', () => {
  const game = create({ monsterId: 'missing', difficulty: 'missing' });
  const before = game.snapshot();
  game.step(-1);
  game.step(Infinity);
  game.step(NaN);
  assert.equal(game.act('missing').reason, 'unknown-action');
  assert.deepEqual(game.snapshot(), before);
  const snapshot = game.snapshot();
  snapshot.stats.blocks = 999;
  snapshot.heroHp = -1;
  assert.equal(game.snapshot().stats.blocks, 0);
  assert.equal(game.snapshot().heroHp, 120);
});
