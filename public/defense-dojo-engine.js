/** A free, isolated exercise: simulated time only, with no pet or save state. */
export const DOJO_ROUNDS = Object.freeze([
  Object.freeze({ monster: 'obsidian', name: '暗星装甲兽', move: '装甲重击', lesson: '先学会守住正面', hint: '看到预警就架起双臂，稳稳挡住第一击。', warningMs: 2800 }),
  Object.freeze({ monster: 'lava', name: '熔岩角兽', move: '熔核冲击', lesson: '寻找完美时机', hint: '试着等到进度条的金色区域，再架起 X 防御。', warningMs: 2400 }),
  Object.freeze({ monster: 'cosmic', name: '宇宙电光兽', move: '电光突袭', lesson: '完成最后的考验', hint: '这次预警更短。留意倒计时，守住最后一击。', warningMs: 2000 }),
]);

export const DOJO_TIMING = Object.freeze({ prepareMs: 1600, feedbackMs: 2000, perfectMs: 350 });

export class DefenseDojoEngine {
  constructor() { this.reset(); }

  reset() {
    this.status = 'ready';
    this.phase = 'prepare';
    this.paused = false;
    this.roundIndex = 0;
    this.elapsed = 0;
    this.phaseElapsed = 0;
    this.guardAt = null;
    this.results = [];
  }

  start() {
    if (this.status === 'running') return false;
    this.reset();
    this.status = 'running';
    return true;
  }

  setPaused(value) {
    if (this.status !== 'running') return false;
    this.paused = Boolean(value);
    return true;
  }

  defend() {
    if (this.status !== 'running' || this.paused || this.phase !== 'warning' || this.guardAt !== null) return false;
    // One press holds the pose until impact. Repeated input cannot improve timing.
    this.guardAt = this.phaseElapsed;
    return true;
  }

  step(ms) {
    if (!Number.isFinite(ms) || ms <= 0 || this.status !== 'running' || this.paused) return;
    let remaining = ms;
    while (remaining > 0 && this.status === 'running') {
      const duration = this.phase === 'prepare' ? DOJO_TIMING.prepareMs
        : this.phase === 'warning' ? DOJO_ROUNDS[this.roundIndex].warningMs : DOJO_TIMING.feedbackMs;
      const delta = Math.min(remaining, duration - this.phaseElapsed);
      this.phaseElapsed += delta;
      this.elapsed += delta;
      remaining -= delta;
      if (this.phaseElapsed < duration) break;
      this.phaseElapsed = 0;
      if (this.phase === 'prepare') this.phase = 'warning';
      else if (this.phase === 'warning') {
        const leadMs = this.guardAt === null ? null : duration - this.guardAt;
        this.results.push({ round: this.roundIndex + 1, outcome: leadMs === null ? 'missed' : leadMs <= DOJO_TIMING.perfectMs ? 'perfect' : 'blocked', leadMs });
        this.phase = 'feedback';
      } else if (this.roundIndex + 1 < DOJO_ROUNDS.length) {
        this.roundIndex++;
        this.guardAt = null;
        this.phase = 'prepare';
      } else {
        this.status = 'complete';
        this.phase = 'complete';
        this.guardAt = null;
      }
    }
  }

  snapshot() {
    const round = DOJO_ROUNDS[this.roundIndex];
    const remainingMs = this.phase === 'warning' ? Math.max(0, round.warningMs - this.phaseElapsed) : 0;
    return {
      status: this.status, phase: this.phase, paused: this.paused,
      roundIndex: this.roundIndex, round, elapsed: this.elapsed, phaseElapsed: this.phaseElapsed,
      remainingMs, warningProgress: this.phase === 'warning' ? this.phaseElapsed / round.warningMs : 0,
      perfectWindow: this.phase === 'warning' && remainingMs <= DOJO_TIMING.perfectMs,
      guarding: this.guardAt !== null,
      results: this.results.map(result => ({ ...result })),
      blocked: this.results.filter(result => result.outcome !== 'missed').length,
      perfect: this.results.filter(result => result.outcome === 'perfect').length,
    };
  }
}
