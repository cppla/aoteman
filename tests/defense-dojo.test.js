import test from 'node:test';
import assert from 'node:assert/strict';
import { DefenseDojoEngine, DOJO_ROUNDS, DOJO_TIMING } from '../public/defense-dojo-engine.js';

const warning = engine => { engine.start(); engine.step(DOJO_TIMING.prepareMs); };

test('exercise lasts 18 seconds and finishes three misses without pet rewards', () => {
  const engine = new DefenseDojoEngine();
  assert.equal(engine.defend(), false);
  engine.start();
  engine.step(18000);
  const s = engine.snapshot();
  assert.equal(s.status, 'complete');
  assert.equal(s.elapsed, 18000);
  assert.deepEqual(s.results.map(r => r.outcome), ['missed', 'missed', 'missed']);
  assert.equal(s.blocked, 0);
  assert.equal(s.perfect, 0);
  assert.equal('xp' in s, false);
  assert.equal('stars' in s, false);
  engine.step(50000);
  assert.equal(engine.snapshot().elapsed, 18000);
});

test('early guard remains held to impact; input spam cannot turn it perfect', () => {
  const engine = new DefenseDojoEngine();
  warning(engine);
  assert.equal(engine.defend(), true);
  engine.step(DOJO_ROUNDS[0].warningMs - 100);
  assert.equal(engine.defend(), false);
  engine.step(100);
  assert.equal(engine.snapshot().results[0].outcome, 'blocked');
  assert.equal(engine.snapshot().results[0].leadMs, 2800);
});

test('perfect boundary is inclusive at 350 ms and ordinary one millisecond earlier', () => {
  for (const [lead, expected] of [[351, 'blocked'], [350, 'perfect'], [1, 'perfect']]) {
    const engine = new DefenseDojoEngine();
    warning(engine);
    engine.step(2800 - lead);
    engine.defend();
    engine.step(lead);
    assert.equal(engine.snapshot().results[0].outcome, expected);
  }
});

test('a press at or after impact cannot retroactively block or start next round', () => {
  const engine = new DefenseDojoEngine();
  warning(engine);
  engine.step(2800);
  assert.equal(engine.defend(), false);
  assert.equal(engine.snapshot().results[0].outcome, 'missed');
  engine.step(2000);
  assert.equal(engine.defend(), false);
});

test('pause freezes every phase and preserves an already raised guard', () => {
  for (const phaseTime of [800, 2000, 4450]) {
    const engine = new DefenseDojoEngine();
    engine.start();
    engine.step(phaseTime);
    engine.defend();
    engine.setPaused(true);
    const frozen = engine.snapshot();
    engine.step(99999);
    assert.deepEqual(engine.snapshot(), frozen);
    assert.equal(engine.defend(), false);
    engine.setPaused(false);
    engine.step(100);
    assert.equal(engine.snapshot().elapsed, frozen.elapsed + 100);
  }
});

test('each round requires a fresh guard and reset clears all previous scores', () => {
  const engine = new DefenseDojoEngine();
  warning(engine);
  engine.defend();
  engine.step(2800 + 2000 + 1600 + 2400);
  assert.deepEqual(engine.snapshot().results.map(r => r.outcome), ['blocked', 'missed']);
  engine.step(100000);
  assert.equal(engine.start(), true);
  assert.deepEqual(engine.snapshot().results, []);
  assert.equal(engine.snapshot().guarding, false);
  assert.equal(engine.snapshot().elapsed, 0);
});

test('variable frame durations have the same result as a single step', () => {
  const one = new DefenseDojoEngine();
  const many = new DefenseDojoEngine();
  one.start(); many.start();
  one.step(17371);
  let total = 0;
  while (total < 17371) { const step = Math.min(17371 - total, 137); many.step(step); total += step; }
  assert.deepEqual(many.snapshot(), one.snapshot());
  const before = one.snapshot();
  for (const value of [-1, 0, Infinity, NaN, '100']) one.step(value);
  assert.deepEqual(one.snapshot(), before);
});

test('snapshot results cannot mutate future scores', () => {
  const engine = new DefenseDojoEngine();
  warning(engine);
  engine.step(2800);
  engine.snapshot().results[0].outcome = 'perfect';
  assert.equal(engine.snapshot().perfect, 0);
});
