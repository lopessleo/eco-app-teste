// Ronco de motor sintetizado no próprio celular, acompanhando a velocidade real do Eco.

export class EngineSound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  // O navegador só libera áudio depois de um toque: chamar em qualquer pointerdown
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const ctx = new AudioContext();
      const body = ctx.createOscillator(); // ronco principal
      const sub = ctx.createOscillator(); // grave
      const lfo = ctx.createOscillator(); // "pulsação" dos pistões
      const lfoGain = ctx.createGain();
      const tone = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const out = ctx.createGain();
      body.type = 'sawtooth';
      sub.type = 'square';
      lfo.type = 'sine';
      filter.type = 'lowpass';
      tone.gain.value = 0.5;
      lfoGain.gain.value = 0.35;
      out.gain.value = 0;
      lfo.connect(lfoGain).connect(tone.gain);
      body.connect(tone);
      sub.connect(tone);
      tone.connect(filter).connect(out).connect(ctx.destination);
      for (const o of [body, sub, lfo]) o.start();
      this.ctx = ctx;
      this.nodes = { body, sub, lfo, filter, out };
      this.set(0, false);
    } catch {
      // sem Web Audio: segue sem som
    }
  }

  // level: 0..1 (velocidade), running: conectado e ligado
  set(level, running) {
    if (!this.ctx) return;
    const { body, sub, lfo, filter, out } = this.nodes;
    const t = this.ctx.currentTime;
    const on = this.enabled && running;
    const f = 42 + level * 130;
    body.frequency.setTargetAtTime(f, t, 0.08);
    sub.frequency.setTargetAtTime(f / 2, t, 0.08);
    lfo.frequency.setTargetAtTime(14 + level * 30, t, 0.08);
    filter.frequency.setTargetAtTime(280 + level * 1100, t, 0.08);
    out.gain.setTargetAtTime(on ? 0.05 + level * 0.07 : 0, t, 0.12);
  }
}
