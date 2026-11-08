// Modo programação, núcleo: os blocos, a tradução para as instruções que o Eco executa,
// a estimativa de tempo e o envio do programa (ProgramClient). O editor visual fica em program-editor.js.
// Quem executa é o Eco (emulator/progvm.js no emulador, progvm.cpp no firmware).

import { DRIVE_MODEL, MELODIES, PROG_OP as OP, PROG_MAX, PROG_PART, PROG_CMD, PROG_STATE, encodeProgLoad, encodeProgRun } from './protocol.js';

// abre: o bloco tem um "fim" (o que fica entre eles é repetido / só roda se...)
// needs: sensor necessário ('sonar', 'light', 'imu')
export const BLOCKS = {
  forward: { icon: '⬆️', label: 'Frente', unit: 'cm', def: 30, min: 5, max: 300, step: 5, cat: 'move', anda: true },
  back: { icon: '⬇️', label: 'Ré', unit: 'cm', def: 30, min: 5, max: 300, step: 5, cat: 'move', anda: true },
  left: { icon: '↩️', label: 'Girar ←', unit: '°', def: 90, min: 15, max: 720, step: 15, cat: 'move', anda: true },
  right: { icon: '↪️', label: 'Girar →', unit: '°', def: 90, min: 15, max: 720, step: 15, cat: 'move', anda: true },
  wait: { icon: '⏳', label: 'Esperar', unit: 's', def: 1, min: 0.5, max: 10, step: 0.5, cat: 'move' },
  until: { icon: '🧱', label: 'Andar até obstáculo', unit: 'cm', def: 20, min: 5, max: 100, step: 5, cat: 'move', needs: 'sonar', anda: true },
  repeat: { icon: '🔁', label: 'Repetir', unit: '×', def: 2, min: 0, max: 20, step: 1, cat: 'ctrl', opens: true, zero: 'sempre' },
  repeatUntil: { icon: '🔁', label: 'Repetir até obstáculo', unit: 'cm', def: 20, min: 5, max: 100, step: 5, cat: 'ctrl', opens: true, needs: 'sonar' },
  ifObstacle: { icon: '❓', label: 'Se obstáculo perto', unit: 'cm', def: 30, min: 5, max: 100, step: 5, cat: 'ctrl', opens: true, needs: 'sonar' },
  ifBump: { icon: '💥', label: 'Se bateu', cat: 'ctrl', opens: true, needs: 'imu' },
  ifLine: { icon: '🛤️', label: 'Se vê a linha', cat: 'ctrl', opens: true, needs: 'light' },
  followLine: { icon: '🛤️', label: 'Seguir a linha', unit: 's', def: 5, min: 0, max: 60, step: 1, cat: 'ctrl', needs: 'light', zero: 'até a chegada', anda: true },
  horn: { icon: '📯', label: 'Buzina', unit: 's', def: 0.5, min: 0.5, max: 3, step: 0.5, cat: 'fun' },
  lights: { icon: '💡', label: 'Farol', choices: ['liga', 'desliga'], def: 0, cat: 'fun' },
  music: { icon: '🎵', label: 'Música', choices: MELODIES.map((m) => m.name), def: 0, cat: 'fun' },
  blink: { icon: '✨', label: 'Piscar', cat: 'fun' },
  end: { icon: '⤴️', label: 'Fim' },
};
export const CATEGORIES = [
  { id: 'move', label: 'Mover' },
  { id: 'ctrl', label: 'Repetir e sensores' },
  { id: 'fun', label: 'Luz e som' },
  { id: 'cena', label: '🧩 Cenário' }, // os blocos do cenário (blocos-cenario.js): só aparece quando há
];
// cenário maquete (casinha, elevador…): os blocos que andam (anda: true) não aparecem
export const blocosVisiveis = { maquete: false };
export const MAX_STEPS = PROG_MAX;

const OPS = {
  forward: (v) => [OP.FORWARD, v],
  back: (v) => [OP.BACK, v],
  left: (v) => [OP.TURN, -v],
  right: (v) => [OP.TURN, v],
  wait: (v) => [OP.WAIT, Math.round(v * 100)],
  horn: (v) => [OP.HORN, Math.round(v * 100)],
  lights: (v) => [OP.LIGHTS, v === 0 ? 1 : 0],
  music: (v) => [OP.MUSIC, MELODIES[v]?.id ?? 1],
  blink: () => [OP.BLINK, 0],
  until: (v) => [OP.UNTIL_OBSTACLE, v],
  followLine: (v) => [OP.FOLLOW_LINE, Math.round(v * 10)],
  repeat: (v) => [OP.REPEAT, v],
  repeatUntil: (v) => [OP.REPEAT_UNTIL_OBSTACLE, v],
  ifObstacle: (v) => [OP.IF_OBSTACLE, v],
  ifBump: () => [OP.IF_BUMP, 0],
  ifLine: () => [OP.IF_LINE, 0],
  end: () => [OP.END, 0],
};

// blocos do cenário (blocos-cenario.js): troca os de antes pelos do cenário atual. maquete: esconde os que andam
let extras = [];
export function setBlocosCenario({ blocos = {}, ops = {} } = {}, maquete = false) {
  for (const t of extras) {
    delete BLOCKS[t];
    delete OPS[t];
  }
  extras = Object.keys(blocos);
  Object.assign(BLOCKS, blocos);
  Object.assign(OPS, ops);
  blocosVisiveis.maquete = maquete;
}

// Programa salvo antigo ({ repeat, steps } sem blocos de "fim"): vira o formato novo
export function normalizeProgram(p) {
  // blocos que não existem aqui (de outro cenário) saem; um "fim" que ficou sem par sai, e um bloco que abre sem o fim
  // ganha um no final
  let d = 0;
  const steps = (p?.steps ?? []).filter((s) => BLOCKS[s.type]).filter((s) => {
    if (s.type === 'end') {
      if (!d) return false;
      d--;
    } else if (BLOCKS[s.type].opens) d++;
    return true;
  });
  for (; d > 0; d--) steps.push({ type: 'end', value: 0 });
  const repeat = Math.max(1, Math.round(p?.repeat ?? 1));
  if (repeat > 1 && steps.length) {
    return { name: p.name ?? '', from: p.from ?? '', steps: [{ type: 'repeat', value: repeat }, ...steps, { type: 'end', value: 0 }] };
  }
  return { name: p?.name ?? '', from: p?.from ?? '', steps };
}

// par de cada bloco que abre e do seu "fim"; null se estiver desequilibrado
export function matchBlocks(steps) {
  const match = new Array(steps.length).fill(-1);
  const open = [];
  steps.forEach((s, i) => {
    if (BLOCKS[s.type]?.opens) open.push(i);
    else if (s.type === 'end' && open.length) {
      const j = open.pop();
      match[i] = j;
      match[j] = i;
    }
  });
  return open.length || match.some((m, i) => steps[i].type === 'end' && m < 0) ? null : match;
}

// profundidade (quantos "repetir/se" envolvem cada bloco), para o editor desenhar
export function depths(steps) {
  let d = 0;
  return steps.map((s) => {
    if (s.type === 'end') d = Math.max(0, d - 1);
    const here = d;
    if (BLOCKS[s.type]?.opens) d++;
    return here;
  });
}

// sensores que o programa precisa (para avisar antes de rodar)
export function needs(program) {
  return [...new Set(program.steps.map((s) => BLOCKS[s.type]?.needs).filter(Boolean))];
}

// Programa -> instruções [[op, arg], ...] (o índice é o do bloco)
export function compile(program) {
  return program.steps.map((s) => OPS[s.type](s.value));
}
// bloco que este cenário não tem (programa de outro cenário): o editor marca e não deixa rodar
export const temBloco = (type) => !!BLOCKS[type];

// ---------- Tempo estimado ----------

// Velocidade de uma roda (m/s) para a fração e (0..1) da velocidade total, já depois do maxSpeed
export function wheelSpeed(calib, e) {
  const { MIN_DUTY, MOTOR_D0 } = DRIVE_MODEL;
  if (e <= 0) return 0;
  const duty = MIN_DUTY + (1 - MIN_DUTY) * Math.min(1, e);
  const vFull = (calib.rpm / 60) * Math.PI * (calib.wheelMm / 1000);
  return vFull * Math.max(0, (duty - MOTOR_D0) / (1 - MOTOR_D0)) * (calib.distAdj / 100);
}

// Velocidade estimada (m/s) com o comando speedPct, e a correção de tempo das rampas (igual ao progvm.js)
export function speedEstimate(calib, config, speedPct) {
  const { MIN_DUTY, MOTOR_D0, ACCEL_PER_S, DECEL_PER_S } = DRIVE_MODEL;
  const e = (speedPct / 100) * (config.maxSpeed / 100);
  const duty = MIN_DUTY + (1 - MIN_DUTY) * e;
  const vFull = (calib.rpm / 60) * Math.PI * (calib.wheelMm / 1000);
  const v = vFull * Math.max(0.05, (duty - MOTOR_D0) / (1 - MOTOR_D0));
  const rampFix = (e / ACCEL_PER_S[config.accel] - e / DECEL_PER_S) / 2;
  return { v, rampFix };
}

// Tempo de motor ligado para andar `cm` ou girar `deg`
export function moveMs(type, value, ctx) {
  const { v, rampFix } = speedEstimate(ctx.calib, ctx.config, ctx.speedPct);
  let s;
  if (type === 'forward' || type === 'back') s = value / 100 / (v * (ctx.calib.distAdj / 100));
  else s = ((value * Math.PI) / 180) * (ctx.calib.trackMm / 1000) / (2 * v * (ctx.calib.turnAdj / 100));
  return Math.max(100, (s + rampFix) * 1000);
}

const GAP_MS = 300; // igual ao progvm.js

// { ms, exact }: exact = false se depende de sensores ("até obstáculo", "se...") ou repete para sempre
export function estimate(program, ctx) {
  const steps = program.steps;
  const match = matchBlocks(steps);
  if (!match) return { ms: 0, exact: false };
  let exact = true;
  const block = (from, to) => {
    let ms = 0;
    for (let i = from; i < to; i++) {
      const s = steps[i];
      switch (s.type) {
        case 'forward': case 'back': case 'left': case 'right':
          ms += moveMs(s.type, s.value, ctx) + GAP_MS;
          break;
        case 'wait': case 'horn': ms += s.value * 1000; break;
        case 'blink': ms += 1500; break;
        case 'music': ms += 200; break;
        case 'followLine': ms += s.value ? s.value * 1000 + 1000 : 0; exact = false; break;
        case 'until': exact = false; break;
        case 'repeat': {
          const inner = block(i + 1, match[i]);
          if (s.value === 0) exact = false;
          ms += inner * (s.value || 1);
          i = match[i];
          break;
        }
        case 'repeatUntil': case 'ifObstacle': case 'ifBump': case 'ifLine':
          exact = false;
          ms += block(i + 1, match[i]);
          i = match[i];
          break;
        default: break;
      }
    }
    return ms;
  };
  return { ms: block(0, steps.length), exact };
}

// ---------- Envio e execução (no Eco) ----------

const ACK_TIMEOUT_MS = 400;
const ACK_TRIES = 6;

// Manda o programa em pedaços (cada um confirmado pelo Eco), dá o "play" e acompanha o PROG_STATUS.
export class ProgramClient {
  constructor(send) {
    this.send = send;
    this.id = Math.floor(Math.random() * 200);
    this.running = false;
    this.load = null; // envio em andamento (antes do "play"); parar ou outro envio cancela
    this.waitAck = null;
    this.onstep = null; // (índice do bloco)
    this.onend = null; // (estado PROG_STATE, erro PROG_ERR)
  }

  // true: começou; false: cancelado antes do "play" (tocou em parar, ou outro programa começou a ser enviado)
  // auto: automação (cenário maquete): fica gravada no Eco e roda sem o app
  async run(program, speedPct, { auto = false } = {}) {
    if (this.running) this.stop();
    const load = (this.load = {});
    const instrs = compile(program);
    this.id = (this.id + 1) & 0xff;
    const id = this.id;
    const parts = Math.ceil(instrs.length / PROG_PART);
    for (let part = 0; part < parts; part++) {
      const pkt = encodeProgLoad(id, part, parts, instrs.slice(part * PROG_PART, (part + 1) * PROG_PART));
      const ack = await this._sendWithAck(pkt, id, part, load);
      if (this.load !== load) return false;
      if (!ack) {
        this.load = null;
        throw new Error('O Eco não respondeu. Chegue mais perto e tente de novo.');
      }
      if (!ack.ok) {
        this.load = null;
        throw new Error('O programa tem algum problema (um "repetir" ou "se" sem o fim?).');
      }
    }
    this.load = null;
    this.running = true;
    this.startedAt = performance.now();
    this.send(encodeProgRun(id, auto ? PROG_CMD.AUTO : PROG_CMD.RUN, speedPct));
    return true;
  }

  stop() {
    this.load = null; // ainda enviando: cancela (o Eco não recebe o "play")
    if (!this.running) return;
    this.send(encodeProgRun(this.id, PROG_CMD.STOP));
    this._end(PROG_STATE.STOPPED, 0);
  }

  async _sendWithAck(pkt, id, part, load) {
    for (let k = 0; k < ACK_TRIES && this.load === load; k++) {
      this.send(pkt);
      const ack = await new Promise((resolve) => {
        this.waitAck = { id, part, resolve };
        setTimeout(() => resolve(null), ACK_TIMEOUT_MS);
      });
      this.waitAck = null;
      if (ack) return ack;
    }
    return null;
  }

  onAck(a) {
    const w = this.waitAck;
    if (w && a.id === w.id && a.part === w.part) w.resolve(a);
  }

  onStatus(st) {
    if (st.id !== this.id || !this.running) return;
    if (st.state === PROG_STATE.RUNNING) this.onstep?.(st.pc);
    else this._end(st.state, st.err);
  }

  // o Eco desconectou no meio: ele mesmo para (depois de 3 s sem o app)
  lost() {
    this.load = null;
    if (this.running) this._end(PROG_STATE.STOPPED, 0);
  }

  _end(state, err) {
    this.running = false;
    this.onend?.(state, err, performance.now() - (this.startedAt ?? performance.now()));
  }
}
