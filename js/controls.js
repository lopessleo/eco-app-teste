// Controles de toque. Cada controle acompanha o seu próprio dedo (multitoque),
// então dá para usar as duas manetes, ou volante + pedal, ao mesmo tempo.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

class TouchControl {
  constructor(el) {
    this.el = el;
    this.pointer = null;
    el.addEventListener('pointerdown', (e) => {
      if (this.pointer !== null) return;
      this.pointer = e.pointerId;
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      this.onStart(e);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.pointer) this.onMove(e);
    });
    const end = (e) => {
      if (e.pointerId !== this.pointer) return;
      this.pointer = null;
      el.classList.remove('dragging');
      this.onEnd(e);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }

  get active() {
    return this.pointer !== null;
  }

  onStart(e) {
    this.onMove(e);
  }

  onMove() {}

  onEnd() {}
}

// Manete vertical com mola: -1 (trás) .. +1 (frente), volta ao centro ao soltar.
// onDetent: chamado ao passar pelo centro com o dedo (para vibrar e a criança sentir o "parado").
export class Lever extends TouchControl {
  constructor(el, { deadzone = 0.08, onDetent = null } = {}) {
    super(el);
    this.deadzone = deadzone;
    this.onDetent = onDetent;
    this.knob = el.querySelector('.knob');
    this.set(0);
  }

  onMove(e) {
    const r = this.el.getBoundingClientRect();
    const half = (r.height - this.knob.offsetHeight) / 2;
    const before = Math.sign(this.value);
    this.set(clamp((r.top + r.height / 2 - e.clientY) / half, -1, 1));
    if (before !== 0 && Math.sign(this.value) !== before) this.onDetent?.();
  }

  onEnd() {
    this.set(0);
  }

  set(v) {
    this.value = Math.abs(v) < this.deadzone ? 0 : v;
    this.el.style.setProperty('--pos', v.toFixed(3));
  }
}

// Pedal com dois jeitos:
//  'simple' (padrão): segurou = acelera aos poucos até o máximo; soltou = para
//  'proportional': a altura do dedo no pedal define a aceleração
// Acelerador por gesto: a partir de onde o dedo encostou, arrastar para cima vai para a frente e para baixo dá ré.
// value vai de -1 (ré) a +1 (frente); soltar para. Simples: a força cresce com o tempo. Proporcional: com a distância.
const PEDAL_FOLGA = 0.12; // arrasto mínimo para decidir o sentido (fração do curso)
const PEDAL_CURSO = 0.4; // curso total: fração da altura do pedal

export class Pedal extends TouchControl {
  constructor(el, mode = 'simple') {
    super(el);
    this.mode = mode;
    this.onDir = null; // avisa quando o sentido muda
    this.y0 = 0;
    this.dir = 0;
    this.amount = 0;
    this.pressedAt = 0;
    this.set(0);
  }

  onStart(e) {
    this.y0 = e.clientY;
    this._dir(0);
    this.amount = 0;
    this.set(0);
  }

  onMove(e) {
    const r = this.el.getBoundingClientRect();
    const d = (this.y0 - e.clientY) / (r.height * PEDAL_CURSO);
    this.amount = clamp(Math.abs(d), 0, 1);
    this._dir(this.amount < PEDAL_FOLGA ? 0 : Math.sign(d));
    if (this.mode === 'proportional') this.set(this.dir * this.amount);
  }

  onEnd() {
    this._dir(0);
    this.set(0);
  }

  _dir(d) {
    if (d === this.dir) return;
    this.dir = d;
    this.pressedAt = performance.now();
    if (d) this.onDir?.(d);
  }

  // chamado a cada quadro: no modo simples a aceleração cresce com o tempo
  update(now) {
    if (this.mode !== 'simple' || !this.active) return;
    this.set(this.dir ? this.dir * clamp(0.35 + (now - this.pressedAt) / 1500, 0, 1) : 0);
  }

  set(v) {
    this.value = v;
    this.el.style.setProperty('--pos', Math.abs(v).toFixed(3));
    this.el.classList.toggle('fwd', v > 0);
    this.el.classList.toggle('rev', v < 0);
  }
}

// Volante: gira acompanhando o dedo, -1 (esquerda) .. +1 (direita), volta ao centro ao soltar
export class SteeringWheel extends TouchControl {
  constructor(el, maxDeg = 120) {
    super(el);
    this.maxDeg = maxDeg;
    this.set(0);
  }

  _pointerAngle(e) {
    const r = this.el.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  }

  onStart(e) {
    this.last = this._pointerAngle(e);
  }

  onMove(e) {
    const a = this._pointerAngle(e);
    let d = a - this.last;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    this.last = a;
    this.set(clamp(this.angle + d, -this.maxDeg, this.maxDeg));
  }

  onEnd() {
    this.set(0);
  }

  set(deg) {
    this.angle = deg;
    this.value = deg / this.maxDeg;
    this.el.style.setProperty('--angle', `${deg.toFixed(1)}deg`);
  }
}

// Inclinação do celular (acelerômetro). Funciona com o celular em pé (como volante) ou deitado.
export class TiltSensor {
  constructor() {
    this.value = 0;
    this.angle = 0;
    this.offset = 0;
    this.maxDeg = 30;
    this.invert = false;
    this.available = false;
    this.started = false;
    this._onMotion = this._onMotion.bind(this);
  }

  async start() {
    if (this.started) return;
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      if ((await DeviceMotionEvent.requestPermission()) !== 'granted') throw new Error('Permissão negada');
    }
    window.addEventListener('devicemotion', this._onMotion);
    this.started = true;
  }

  calibrate() {
    this.offset = this.angle;
  }

  // Emulador no PC: recebe o ângulo pronto (graus, + = direita) no lugar do acelerômetro
  simulate(deg) {
    this.available = true;
    this.angle = deg;
    this._update();
  }

  _onMotion(e) {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x === null) return;
    this.available = true;
    // Converte do eixo do aparelho para o eixo da tela (paisagem)
    const a = ((screen.orientation?.angle ?? 0) * Math.PI) / 180;
    const sx = g.x * Math.cos(a) - g.y * Math.sin(a);
    const sy = g.x * Math.sin(a) + g.y * Math.cos(a);
    const deg = (Math.atan2(-sx, Math.hypot(sy, g.z)) * 180) / Math.PI;
    this.angle += (deg - this.angle) * 0.35; // filtro passa-baixa contra tremidas
    this._update();
  }

  _update() {
    let v = (this.angle - this.offset) / this.maxDeg;
    if (this.invert) v = -v;
    if (Math.abs(v) < 0.06) v = 0;
    this.value = clamp(v, -1, 1);
  }
}

// Botão que só dispara se for segurado (trava para os pais)
export function holdButton(el, ms, onHold, onTap) {
  let timer = null;
  el.style.setProperty('--hold-ms', `${ms}ms`);
  el.addEventListener('pointerdown', () => {
    el.classList.add('holding');
    timer = setTimeout(() => {
      timer = null;
      el.classList.remove('holding');
      onHold();
    }, ms);
  });
  const cancel = (tap) => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    el.classList.remove('holding');
    if (tap) onTap?.();
  };
  el.addEventListener('pointerup', () => cancel(true));
  el.addEventListener('pointerleave', () => cancel(false));
  el.addEventListener('pointercancel', () => cancel(false));
}
