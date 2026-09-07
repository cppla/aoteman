import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSIST_RULES, BattleEngine, DIFFICULTIES } from '../public/battle-engine.js';

const create = (options = {}) => new BattleEngine({ random: () => 0, ...options });
const emergency = (options = {}) => {
  const game = create(options);
  game.state.heroHp = Math.floor(game.state.heroMaxHp * ASSIST_RULES.hpThreshold);
  game.state.energy = ASSIST_RULES.minEnergy;
  return game;
};
const strikeAt = (game, time) => {
  game.state.currentAttack = { id: 'test-strike', name: '重击', damage: 20, kind: 'melee', windup: time - game.state.elapsed, startedAt: game.state.elapsed, strikesAt: time };
};

test('rescue requires living critical health and at least 10 light energy on every difficulty', () => {
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    const game = emergency({ difficulty });
    game.state.heroHp = game.state.heroMaxHp * ASSIST_RULES.hpThreshold + 1;
    const healthy = game.snapshot();
    assert.equal(game.act('summon').reason, 'assist-health');
    assert.equal(healthy.assistAvailable, false);
    assert.deepEqual(game.snapshot(), healthy);
    game.state.heroHp--;
    game.state.energy = 9;
    assert.deepEqual(game.act('summon'), { ok: false, reason: 'energy', required: 10 });
    assert.equal(game.snapshot().assistAvailable, false);
    game.state.energy = 10;
    assert.equal(game.snapshot().assistAvailable, true);
    const hp = game.snapshot().heroHp;
    assert.equal(game.act('summon').heal, Math.ceil(game.state.heroMaxHp * 0.25));
    assert.equal(game.snapshot().heroHp, hp + Math.ceil(game.state.heroMaxHp * 0.25));
  }
  const dead = emergency();
  dead.state.heroHp = 0;
  assert.equal(dead.act('summon').reason, 'assist-health');
  assert.equal(dead.snapshot().ally.summoned, false);
});

test('summoning spends all remaining light energy once, interrupts a strike, and starts ally arrival', () => {
  const game = emergency();
  game.step(1500);
  game.act('defend');
  game.state.energy = 77;
  const attack = game.snapshot().currentAttack;
  const result = game.act('summon');
  const state = game.snapshot();
  assert.deepEqual(result, { ok: true, heal: 30, energySpent: 77 });
  assert.equal(state.heroHp, 66);
  assert.equal(state.energy, 0);
  assert.equal(state.currentAttack, null);
  assert.equal(state.nextAttackAt, state.elapsed + 1900);
  assert.equal(state.defending, false);
  assert.equal(state.monsterPose, 'stun');
  assert.equal(state.stats.summons, 1);
  assert.equal(state.shieldRemaining, 3000);
  assert.deepEqual(state.ally, { summoned: true, active: true, pose: 'transform', shieldUntil: 4500, nextAttackAt: 2300, linkReadyAt: 0 });
  const event = game.drainEvents().find((entry) => entry.type === 'summon');
  assert.deepEqual(event.interruptedAttack, attack);
  assert.equal(event.heal, 30);
  assert.equal(event.energySpent, 77);
  game.state.heroHp = 1;
  game.state.energy = 100;
  const used = game.snapshot();
  assert.equal(game.act('summon').reason, 'assist-used');
  assert.deepEqual(game.snapshot(), used, 'a second request cannot spend or heal');
});

test('rescue remains available during an attack cooldown and clears an active dodge', () => {
  const game = emergency();
  game.act('punch');
  game.act('dodge');
  assert.ok(game.snapshot().cooldown > 0);
  assert.equal(game.act('summon').ok, true);
  assert.equal(game.snapshot().dodgeUntil, 0);
  assert.equal(game.snapshot().heroPose, 'transform');
});

test('arrival protection takes priority over dodge and perfect guard without generating energy or stats', () => {
  for (const action of ['defend', 'dodge']) {
    const game = emergency();
    game.act('summon');
    strikeAt(game, 2999);
    game.step(2899);
    game.act(action);
    const hp = game.snapshot().heroHp;
    game.step(100);
    const state = game.snapshot();
    assert.equal(state.heroHp, hp);
    assert.equal(state.energy, 0);
    assert.equal(state.stats.blocks, 0);
    assert.equal(state.stats.perfects, 0);
    assert.equal(state.stats.dodges, 0);
    assert.equal(state.stats.damageTaken, 0);
    assert.equal(state.defending, false);
    const event = game.drainEvents().find((entry) => entry.type === 'assist-shield');
    assert.equal(event.damage, 0);
    assert.equal(event.attack.strikesAt, 2999);
  }
});

test('arrival protection expires at exactly 3 seconds and ordinary damage and defense resume', () => {
  const game = emergency();
  game.act('summon');
  strikeAt(game, 3000);
  game.step(3000);
  assert.equal(game.snapshot().shieldRemaining, 0);
  assert.equal(game.snapshot().heroHp, 46);
  assert.equal(game.snapshot().stats.damageTaken, 20);
  strikeAt(game, 4000);
  game.step(800);
  game.act('defend');
  game.step(200);
  assert.equal(game.snapshot().stats.perfects, 1);
  assert.equal(game.snapshot().energy, 24);
});

test('ally attacks on arrival then alternates independent punches and beams at fixed intervals', () => {
  const game = emergency();
  game.act('summon');
  game.state.nextAttackAt = 100_000;
  game.step(799);
  assert.equal(game.snapshot().monsterHp, 240);
  game.step(1);
  assert.equal(game.snapshot().ally.pose, 'punch');
  game.step(2400);
  assert.equal(game.snapshot().ally.pose, 'beam');
  game.step(2400);
  const state = game.snapshot();
  assert.equal(state.monsterHp, 198);
  assert.equal(state.stats.allyHits, 3);
  assert.equal(state.stats.allyDamage, 42);
  assert.equal(state.stats.damageDealt, 42);
  assert.equal(state.stats.punches, 0);
  assert.equal(state.stats.beams, 0);
  assert.equal(state.combo, 0);
  assert.equal(state.energy, 0);
  assert.deepEqual(game.drainEvents().filter((entry) => entry.type === 'ally-hit').map(({ at, action, damage }) => ({ at, action, damage })), [
    { at: 800, action: 'punch', damage: 12 },
    { at: 3200, action: 'beam', damage: 18 },
    { at: 5600, action: 'punch', damage: 12 },
  ]);
});

test('hero attacks and ally attacks damage the same monster without replacing each other', () => {
  const game = emergency();
  game.act('summon');
  const hit = game.act('punch');
  const hp = game.snapshot().monsterHp;
  game.step(800);
  assert.equal(game.snapshot().monsterHp, hp - 12);
  assert.equal(game.snapshot().stats.damageDealt, hit.damage + 12);
  assert.equal(game.snapshot().stats.punches, 1);
  assert.equal(game.snapshot().stats.allyHits, 1);
  assert.equal(game.snapshot().energy, 9);
});

test('joint beam spends exactly 30 energy, deals unmultiplied damage and poses both heroes', () => {
  const game = emergency();
  assert.equal(game.act('link').reason, 'assist-inactive');
  game.act('summon');
  assert.deepEqual(game.act('link'), { ok: false, reason: 'energy', required: 30 });
  game.step(1350); // Inside the usual precision window, after the first ally hit.
  game.state.combo = 10;
  game.state.energy = 60;
  game.act('defend');
  const before = game.snapshot();
  assert.deepEqual(game.act('link'), { ok: true, damage: 54 });
  const state = game.snapshot();
  assert.equal(state.monsterHp, before.monsterHp - 54);
  assert.equal(state.stats.damageDealt, before.stats.damageDealt + 54);
  assert.equal(state.stats.allyDamage, before.stats.allyDamage, 'joint damage is not double-counted as an autonomous ally hit');
  assert.equal(state.stats.allyHits, before.stats.allyHits);
  assert.equal(state.stats.linkAttacks, 1);
  assert.equal(state.stats.precisionHits, 0);
  assert.equal(state.energy, 30);
  assert.equal(state.heroPose, 'beam');
  assert.equal(state.ally.pose, 'beam');
  assert.equal(state.defending, false);
  assert.equal(state.cooldown, 1000);
  assert.equal(state.linkCooldown, 8000);
  assert.equal(state.ally.nextAttackAt, state.elapsed + 2400);
});

test('joint beam respects shared and dedicated cooldowns without spending on rejected attempts', () => {
  const game = emergency();
  game.act('summon');
  game.state.nextAttackAt = 100_000;
  game.state.energy = 100;
  game.act('punch');
  assert.equal(game.act('link').reason, 'cooldown');
  game.step(560);
  assert.equal(game.act('link').ok, true);
  const energy = game.snapshot().energy;
  assert.equal(game.act('link').reason, 'cooldown');
  assert.equal(game.act('punch').reason, 'cooldown');
  game.step(1000);
  assert.equal(game.act('link').reason, 'link-cooldown');
  assert.equal(game.snapshot().energy, energy);
  game.step(6999);
  assert.equal(game.act('link').reason, 'link-cooldown');
  game.step(1);
  assert.equal(game.act('link').ok, true);
  assert.equal(game.snapshot().stats.linkAttacks, 2);
});

test('pausing freezes ally arrival, automatic strikes, shield duration and joint cooldowns', () => {
  const game = emergency();
  game.setPaused(true);
  assert.equal(game.act('summon').reason, 'paused');
  game.setPaused(false);
  game.act('summon');
  game.setPaused(true);
  const arriving = game.snapshot();
  game.step(50_000);
  assert.deepEqual(game.snapshot(), arriving);
  assert.equal(game.act('link').reason, 'paused');
  game.setPaused(false);
  game.step(800);
  game.state.energy = 30;
  game.act('link');
  game.setPaused(true);
  const linked = game.snapshot();
  game.step(50_000);
  assert.deepEqual(game.snapshot(), linked);
  game.setPaused(false);
  game.step(2400);
  assert.equal(game.snapshot().stats.allyHits, 2);
});

test('large and small steps preserve the complete ally and enemy sequence', () => {
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    const whole = emergency({ difficulty });
    const split = emergency({ difficulty });
    whole.act('summon');
    split.act('summon');
    whole.step(20_000);
    for (let i = 0; i < 200; i++) split.step(100);
    assert.deepEqual(whole.snapshot(), split.snapshot());
    assert.deepEqual(whole.drainEvents(), split.drainEvents());
  }
});

test('an ally hit can trigger enrage and a final hit settles immediately and only once', () => {
  let settled = 0;
  const game = emergency({ onFinish: () => settled++ });
  game.state.monsterHp = 90;
  game.state.stats.damageDealt = 150;
  game.act('summon');
  game.state.nextAttackAt = 100_000;
  game.step(800);
  assert.equal(game.snapshot().enraged, true);
  assert.equal(game.drainEvents().filter((entry) => entry.type === 'enrage').length, 1);
  game.step(20_000);
  const state = game.snapshot();
  assert.equal(settled, 1);
  assert.equal(state.result.outcome, 'win');
  assert.equal(state.result.damageDealt, 240);
  assert.equal(state.result.allyDamage, 90);
  assert.equal(state.ally.active, false);
  assert.equal(state.ally.pose, 'victory');
  assert.equal(state.ally.nextAttackAt, 0);
  assert.equal(state.shieldRemaining, 0);
  assert.equal(game.act('summon').reason, 'ended');
  assert.equal(game.act('link').reason, 'ended');
  game.step(50_000);
  game.retreat();
  assert.equal(settled, 1);
  assert.deepEqual(game.snapshot(), state);
});

test('at a simultaneous deadline the ally can finish the monster before a lethal enemy strike', () => {
  let result;
  const game = emergency({ onFinish: (value) => { result = value; } });
  game.act('summon');
  game.state.heroHp = 1;
  game.state.monsterHp = 7;
  game.state.ally.shieldUntil = 0;
  strikeAt(game, 800);
  game.step(800);
  assert.equal(result.outcome, 'win');
  assert.equal(result.heroHp, 1);
  assert.equal(result.allyDamage, 7, 'overkill is capped at the actual remaining monster health');
  assert.equal(result.damageTaken, 0);
  assert.equal(game.drainEvents().some((entry) => entry.type === 'hurt'), false);
});

test('joint final hit is capped and recorded before the one-time finish callback', () => {
  let result;
  const game = emergency({ onFinish: (value) => { result = value; } });
  game.act('summon');
  game.state.energy = 30;
  game.state.monsterHp = 3;
  assert.deepEqual(game.act('link'), { ok: true, damage: 3 });
  assert.equal(result.linkAttacks, 1);
  assert.equal(result.damageDealt, 3);
  assert.equal(game.snapshot().energy, 0);
  assert.equal(game.snapshot().ally.active, false);
  assert.equal(game.snapshot().linkCooldown, 0);
});

test('defeat and retreat stop the ally, and snapshot mutation cannot corrupt its timers', () => {
  for (const outcome of ['lose', 'retreat']) {
    const game = emergency();
    game.act('summon');
    const copy = game.snapshot();
    copy.ally.nextAttackAt = 0;
    copy.ally.summoned = false;
    assert.equal(game.snapshot().ally.nextAttackAt, 800);
    assert.equal(game.snapshot().ally.summoned, true);
    game.finish(outcome);
    const ended = game.snapshot();
    assert.equal(ended.ally.active, false);
    assert.equal(ended.ally.pose, outcome === 'lose' ? 'defeat' : 'idle');
    assert.equal(ended.shieldRemaining, 0);
    game.step(10_000);
    assert.deepEqual(game.snapshot(), ended);
  }
});
