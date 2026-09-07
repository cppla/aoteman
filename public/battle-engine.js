/** Deterministic combat rules. Time advances only through step(), never wall time. */
export const MONSTERS = Object.freeze([
  { id: 'obsidian', name: '暗星装甲兽', subtitle: '黑曜重甲 · 力量型', hp: 240, color: '#a99cff', threat: 'II', description: '厚重装甲之下，藏着重拳与冲撞。观察蓄力，抓住反击机会。' },
  { id: 'lava', name: '熔岩角兽', subtitle: '熔核喷发 · 爆发型', hp: 280, color: '#ffae78', threat: 'III', description: '怒火越盛，攻势越猛。喷发前的长蓄力，是积蓄光能的好时机。' },
  { id: 'cosmic', name: '宇宙电光兽', subtitle: '跃迁电弧 · 速度型', hp: 220, color: '#85d9ef', threat: 'III', description: '擅长瞬移与电光突袭。别贪攻击，留意每一次短促预警。' },
]);

export const DIFFICULTIES = Object.freeze({
  easy: { label: '见习', heroHp: 150, damage: 0.75, speed: 1.22, perfectWindow: 480 },
  normal: { label: '标准', heroHp: 120, damage: 1, speed: 1, perfectWindow: 340 },
  hard: { label: '精英', heroHp: 100, damage: 1.2, speed: 0.84, perfectWindow: 240 },
});

export const ACTIONS = Object.freeze({
  punch: { label: '银河拳', cost: 0, damage: 11, energy: 9, cooldown: 560, pose: 'punch' },
  beam: { label: '银河光线', cost: 30, damage: 38, energy: 0, cooldown: 1000, pose: 'beam' },
  special: { label: '银河终结', cost: 100, damage: 106, energy: 0, cooldown: 1500, pose: 'beam' },
});

const ATTACKS = Object.freeze({
  obsidian: [
    { id: 'claw', name: '装甲重击', hint: '抬起双臂，准备 X 防御', damage: 20, windup: 1700, kind: 'melee' },
    { id: 'rush', name: '暗星冲撞', hint: '冲撞即将到来，守住正面', damage: 24, windup: 1450, kind: 'rush' },
    { id: 'pulse', name: '黑曜震波', hint: '光核蓄力中，等最后一刻格挡', damage: 28, windup: 2250, kind: 'beam' },
  ],
  lava: [
    { id: 'claw', name: '烈焰爪击', hint: '利爪升温，准备 X 防御', damage: 21, windup: 1700, kind: 'melee' },
    { id: 'eruption', name: '熔核喷发', hint: '熔核即将喷发，准备迎击', damage: 31, windup: 2400, kind: 'beam' },
    { id: 'rush', name: '燃烧冲撞', hint: '灼热冲击正在逼近', damage: 25, windup: 1550, kind: 'rush' },
  ],
  cosmic: [
    { id: 'laser', name: '电光射线', hint: '电弧正在汇聚，准备防御', damage: 22, windup: 1650, kind: 'beam' },
    { id: 'blink', name: '跃迁突袭', hint: '短促突袭！立即准备格挡', damage: 19, windup: 1200, kind: 'rush' },
    { id: 'nova', name: '超新星脉冲', hint: '强力脉冲，等待完美格挡时机', damage: 30, windup: 2150, kind: 'beam' },
  ],
});

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export class BattleEngine {
  constructor({ monsterId = 'obsidian', difficulty = 'normal', random = Math.random, onFinish } = {}) {
    this.monster = MONSTERS.find((entry) => entry.id === monsterId) || MONSTERS[0];
    this.difficulty = DIFFICULTIES[difficulty] ? difficulty : 'normal';
    this.rules = DIFFICULTIES[this.difficulty];
    this.random = typeof random === 'function' ? random : Math.random;
    this.onFinish = onFinish;
    this.events = [];
    this.eventId = 0;
    this.attackIndex = Math.floor(clamp(this.random(), 0, 0.999) * 3);
    this.guardStartedAt = null;
    this.heroPoseUntil = 0;
    this.monsterPoseUntil = 0;
    this.state = {
      status: 'active', paused: false, elapsed: 0, heroHp: this.rules.heroHp,
      heroMaxHp: this.rules.heroHp, monsterHp: this.monster.hp, monsterMaxHp: this.monster.hp,
      energy: 0, maxEnergy: 100, combo: 0, maxCombo: 0, heroPose: 'idle', monsterPose: 'idle',
      defending: false, dodgeUntil: 0, dodgeReadyAt: 0, readyAt: 0, currentAttack: null,
      nextAttackAt: 1500, enraged: false, result: null,
      stats: { punches: 0, beams: 0, specials: 0, blocks: 0, perfects: 0, dodges: 0, precisionHits: 0, damageDealt: 0, damageTaken: 0 },
    };
    this.emit('start', { message: `${this.monster.name}出现了。观察预警，守护城市！` });
  }

  snapshot() {
    const s = this.state;
    const attack = s.currentAttack;
    return {
      ...s, stats: { ...s.stats }, currentAttack: attack ? { ...attack } : null,
      result: s.result ? { ...s.result } : null,
      timing: (s.elapsed % 1800) / 1800,
      cooldown: Math.max(0, s.readyAt - s.elapsed),
      dodgeCooldown: Math.max(0, s.dodgeReadyAt - s.elapsed),
      attackRemaining: attack ? Math.max(0, attack.strikesAt - s.elapsed) : 0,
      perfectWindow: this.rules.perfectWindow,
    };
  }

  emit(type, details = {}) {
    this.events.push({ id: ++this.eventId, type, at: this.state.elapsed, ...details });
  }

  drainEvents() {
    return this.events.splice(0);
  }

  setPaused(paused = true) {
    if (this.state.status !== 'active') return false;
    const next = Boolean(paused);
    if (this.state.paused !== next) {
      this.state.paused = next;
      this.emit(next ? 'pause' : 'resume', { message: next ? '战斗已暂停，所有计时冻结。' : '继续守护。' });
    }
    return true;
  }

  step(deltaMs) {
    const s = this.state;
    if (s.status !== 'active' || s.paused || !Number.isFinite(deltaMs) || deltaMs <= 0) return this.snapshot();
    const target = s.elapsed + deltaMs;
    // Advance each attack boundary in order, so a slow frame cannot skip a strike.
    while (s.status === 'active') {
      const deadline = s.currentAttack ? s.currentAttack.strikesAt : s.nextAttackAt;
      if (deadline > target) break;
      s.elapsed = deadline;
      if (s.currentAttack) this.resolveEnemyAttack();
      else this.startEnemyAttack();
    }
    if (s.status === 'active') s.elapsed = target;
    this.refreshPoses();
    return this.snapshot();
  }

  refreshPoses() {
    const s = this.state;
    if (s.status !== 'active') return;
    if (s.defending) s.heroPose = 'defend';
    else if (s.dodgeUntil > s.elapsed) s.heroPose = 'dodge';
    else if (this.heroPoseUntil <= s.elapsed) s.heroPose = 'idle';
    if (s.currentAttack) s.monsterPose = 'charge';
    else if (this.monsterPoseUntil <= s.elapsed) s.monsterPose = 'idle';
  }

  startEnemyAttack() {
    const s = this.state;
    const choices = ATTACKS[this.monster.id];
    const spec = choices[this.attackIndex++ % choices.length];
    const windup = Math.round(spec.windup * this.rules.speed * (s.enraged ? 0.84 : 1));
    s.currentAttack = { ...spec, startedAt: s.elapsed, strikesAt: s.elapsed + windup, windup };
    s.monsterPose = 'charge';
    this.emit('warning', { ...s.currentAttack, message: `${spec.name}！${spec.hint}` });
  }

  resolveEnemyAttack() {
    const s = this.state;
    const attack = s.currentAttack;
    if (!attack || s.status !== 'active') return;
    let damage = Math.round(attack.damage * this.rules.damage * (s.enraged ? 1.15 : 1));
    let type = 'hurt';
    let message = `${attack.name}命中，生命 -${damage}`;
    if (s.dodgeUntil >= s.elapsed && s.dodgeUntil > 0) {
      damage = 0;
      type = 'dodge';
      s.stats.dodges++;
      s.energy = clamp(s.energy + 5, 0, 100);
      message = '闪避成功！光能 +5';
    } else if (s.defending) {
      const remainingAtGuard = attack.strikesAt - this.guardStartedAt;
      const perfect = this.guardStartedAt >= attack.startedAt && remainingAtGuard <= this.rules.perfectWindow;
      s.stats.blocks++;
      if (perfect) {
        damage = 0;
        type = 'perfect';
        s.stats.perfects++;
        s.energy = clamp(s.energy + 24, 0, 100);
        this.addCombo();
        message = '完美格挡！伤害归零 · 光能 +24';
      } else {
        damage = Math.round(damage * 0.1);
        type = 'block';
        s.energy = clamp(s.energy + 10, 0, 100);
        message = `X 防御成功！减伤 90% · 光能 +10`;
      }
      s.heroPose = 'defend';
      this.heroPoseUntil = s.elapsed + 500;
    } else {
      s.combo = 0;
      s.heroPose = 'hurt';
      this.heroPoseUntil = s.elapsed + 600;
    }
    s.heroHp = Math.max(0, s.heroHp - damage);
    s.stats.damageTaken += damage;
    s.defending = false;
    this.guardStartedAt = null;
    s.currentAttack = null;
    s.monsterPose = 'attack';
    this.monsterPoseUntil = s.elapsed + 660;
    s.nextAttackAt = s.elapsed + Math.round(1900 * this.rules.speed * (s.enraged ? 0.9 : 1));
    this.emit(type, { damage, attack: { ...attack }, message });
    if (s.heroHp <= 0) this.finish('lose');
  }

  addCombo() {
    this.state.combo++;
    this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
  }

  act(action) {
    const s = this.state;
    if (s.status !== 'active') return { ok: false, reason: 'ended' };
    if (s.paused) return { ok: false, reason: 'paused' };
    if (action === 'defend') {
      if (s.defending) return { ok: false, reason: 'already-defending' };
      s.defending = true;
      s.dodgeUntil = 0;
      this.guardStartedAt = s.elapsed;
      s.heroPose = 'defend';
      this.emit('guard', { message: '双臂交叉，X 防御就绪。持续至下一次攻击；出招会解除防御。' });
      return { ok: true };
    }
    if (action === 'dodge') {
      if (s.dodgeReadyAt > s.elapsed) return { ok: false, reason: 'dodge-cooldown' };
      s.defending = false;
      this.guardStartedAt = null;
      s.dodgeUntil = s.elapsed + 480;
      s.dodgeReadyAt = s.elapsed + 2100;
      s.heroPose = 'dodge';
      this.heroPoseUntil = s.dodgeUntil;
      this.emit('evade', { message: '瞬身闪避：接下来 0.48 秒免伤。' });
      return { ok: true };
    }
    const spec = ACTIONS[action];
    if (!spec) return { ok: false, reason: 'unknown-action' };
    if (s.readyAt > s.elapsed) return { ok: false, reason: 'cooldown' };
    if (s.energy < spec.cost) return { ok: false, reason: 'energy', required: spec.cost };
    const timing = (s.elapsed % 1800) / 1800;
    const precise = timing >= 0.67 && timing <= 0.85;
    const comboBonus = 1 + Math.min(s.combo, 10) * 0.035;
    const damage = Math.round(spec.damage * comboBonus * (precise ? 1.35 : 1));
    const actualDamage = Math.min(s.monsterHp, damage);
    s.energy = clamp(s.energy - spec.cost + spec.energy + (precise ? 4 : 0), 0, 100);
    s.monsterHp = Math.max(0, s.monsterHp - damage);
    s.stats.damageDealt += actualDamage;
    s.stats[`${action === 'special' ? 'special' : action === 'beam' ? 'beam' : 'punch'}${action === 'punch' ? 'es' : 's'}`]++;
    if (precise) s.stats.precisionHits++;
    this.addCombo();
    s.defending = false;
    this.guardStartedAt = null;
    s.dodgeUntil = 0;
    s.heroPose = spec.pose;
    this.heroPoseUntil = s.elapsed + (action === 'punch' ? 430 : 780);
    s.readyAt = s.elapsed + spec.cooldown;
    if (!s.currentAttack) {
      s.monsterPose = 'hurt';
      this.monsterPoseUntil = s.elapsed + 400;
    }
    this.emit('hit', { action, damage: actualDamage, precise, message: `${precise ? '精准命中 · ' : ''}${spec.label} -${actualDamage}` });
    if (s.monsterHp <= 0) this.finish('win');
    else if (!s.enraged && s.monsterHp <= s.monsterMaxHp * 0.35) {
      s.enraged = true;
      this.emit('enrage', { message: `${this.monster.name}进入狂暴！预警缩短，保持警惕。` });
    }
    return { ok: true, damage: actualDamage, precise };
  }

  retreat() { return this.finish('retreat'); }

  finish(outcome) {
    const s = this.state;
    if (s.status !== 'active') return s.result;
    if (!['win', 'lose', 'retreat'].includes(outcome)) return null;
    s.status = 'ended';
    s.paused = false;
    s.defending = false;
    s.currentAttack = null;
    s.heroPose = outcome === 'win' ? 'victory' : outcome === 'lose' ? 'defeat' : 'idle';
    s.monsterPose = outcome === 'win' ? 'defeat' : outcome === 'lose' ? 'victory' : 'idle';
    const score = outcome === 'win' ? Math.round(400 + s.heroHp * 2 + s.stats.perfects * 75 + s.maxCombo * 12 + Math.max(0, 120 - s.elapsed / 1000)) : 0;
    s.result = Object.freeze({ outcome, monsterId: this.monster.id, monsterName: this.monster.name, difficulty: this.difficulty,
      ...s.stats, maxCombo: s.maxCombo, elapsed: Math.round(s.elapsed), heroHp: s.heroHp, score,
      rank: outcome !== 'win' ? '—' : s.stats.damageTaken === 0 ? 'S+' : score >= 900 ? 'S' : score >= 720 ? 'A' : 'B' });
    this.emit('finish', { outcome, message: outcome === 'win' ? '任务完成！城市恢复了平静。' : outcome === 'lose' ? '能量耗尽。休息一下，再次出发。' : '已安全撤回基地。' });
    if (typeof this.onFinish === 'function') this.onFinish(s.result);
    return s.result;
  }
}
