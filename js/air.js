// "Rádio da sala": ECObase (no notebook do professor) <-> Ecos, por ESP-NOW (o rádio Wi-Fi do ESP32 sem
// precisar de rede). Funciona junto com o Bluetooth do celular. Especificação: documentos/base.md.
// Usado pelo Eco (emulator/carcore.js -> firmware), pelo servidor da sala (tools/kit.mjs) e pelo emulador.
//
// Quadro (até 250 bytes no ESP-NOW): [tipo, ...]. Base -> carro: 0xB0..0xBF. Carro -> base: 0xC0..0xCF.
// ECOcontroller <-> carro: 0xD0..0xDF (direto, sem a base; com a base o professor vê e manda igual).

export const AIR = {
  BEACON: 0xb0, // base -> todos (1 por segundo): [B0, kit u32, flags (1 = aceitando Ecos novos)]
  BIND: 0xb1, // base -> carro (pareando): [B1, kit u32] — o carro passa a ser deste kit
  UNBIND: 0xb2, // base -> carro: [B2, kit u32] — sai do kit
  POLICY: 0xb3, // base -> carro (1/s e quando muda): [B3, flags, maxSpeed, minutos que faltam (255 = sem limite)]
  DOWN: 0xb4, // base -> carro -> celular: pedaço de mensagem da sala [B4, seq, parte, partes, dados...]
  CMD: 0xb5, // base -> carro: uma mensagem do protocolo do app [B5, msg...] (técnico, firmware, nome...)
  HELLO: 0xc0, // carro -> base: [C0, kit u32, id u16, fw0, fw1, flags, cor | placa << 4, nome...]
  TELEM: 0xc1, // carro -> base (2 por segundo): [C1, corpo do STATE (12 bytes), cliente]
  UP: 0xc4, // celular -> carro -> base: pedaço de mensagem da sala [C4, seq, parte, partes, dados...]
  REPLY: 0xc5, // carro -> base: resposta a um CMD [C5, msg...]
  RC_PAIR: 0xd0, // controle -> todos (botão do controle segurado): [D0, layout, fw0, fw1]
  RC_BOUND: 0xd1, // carro -> controle (aceitou, botão do carro segurado): [D1, id u16, cor, nome...]
  RC_DRIVE: 0xd2, // controle -> carro (20/s mexendo, 5/s parado): [D2, esq i8, dir i8, botões, pilha %]
  RC_STATUS: 0xd3, // carro -> controle (2/s): [D3, flags, cor]
  RC_BYE: 0xd4, // controle -> carro: vai dormir (para sem pisca-alerta)
  RC_INFO: 0xd5, // controle -> carro (ao ligar e a cada RC_INFO_MS): [D5, fw0, fw1, placa, opções RC_OPT]
  RC_CMD: 0xd6, // base ou carro -> controle: [D6, msg...] (atualização de firmware)
  RC_REPLY: 0xd7, // controle -> quem mandou o RC_CMD: [D7, msg...]
};
// flags do HELLO
export const HELLO_FLAG = { PAIRING: 1, PHONE: 2, REMOTE: 4, IMU: 8 };
// flags da POLICY (o carro obedece mesmo sem celular: ECOcontroller, celular travado)
export const POLICY_FLAG = { PAUSED: 1, MUTED: 2, LIGHTS_OFF: 4, TIME_UP: 8 };
// quem está dirigindo o Eco agora (TELEM)
export const CLIENT = { NONE: 0, PHONE: 1, REMOTE: 2 };
// ECOcontroller (de botões): layout e botões do RC_DRIVE
// setas · volante (só com o acelerômetro do protótipo: inclinar o controle vira; ↑ acelera, ↓ freia/ré)
// 0 fica reservado (era o controle de duas alavancas, descartado em 30/10)
// STICKS = manetes (ECOcontroller Plus/Pro com manetes)
export const RC_LAYOUT = { TANK: 0, ARROWS: 1, TILT: 2, STICKS: 3 };
export const RC_BTN = { HORN: 1, HEADLIGHT: 2 }; // HEADLIGHT = farol ligado (o controle guarda o liga/desliga)
// flags do RC_STATUS (o LED do controle mostra)
export const RC_FLAG = { HELD: 1, LOW_BATTERY: 2, OBSTACLE: 4, PHONE: 8 };
// o que o ECOcontroller achou montado nele (RC_INFO)
export const RC_OPT = { STICKS: 1, IMU: 2, SCREEN: 4 };

export const AIR_BROADCAST = 'FFFFFFFFFFFF';
export const AIR_MAX = 250; // bytes por quadro ESP-NOW
export const TUNNEL_CHUNK = 180; // dados por pedaço (cabe no Bluetooth e no ESP-NOW)
export const BEACON_MS = 1000;
export const BASE_LOST_MS = 4000; // sem farol da base por isso: o carro considera a base fora
// política sem renovar por isso deixa de valer (o servidor manda a cada 1 s; folga para perdas no rádio)
export const POLICY_STALE_MS = 10000;
// a base sem ouvir o notebook por isso (a ECOsala foi fechada com a base ligada) para o farol: os Ecos soltam
export const HOST_LOST_MS = 6000;
export const HOST_HEARTBEAT_MS = 2000; // o servidor manda "H" para a base
export const HELLO_EVERY_MS = 5000; // o carro se apresenta de novo de tempos em tempos (a base pode ter reiniciado)
export const PAIRING_MS = 30000; // botão segurado: o carro aceita uma base nova por 30 s
export const TELEM_MS = 500;
export const TELEM_IDLE_MS = 1000; // Eco parado: telemetria 1 por segundo (o ar da sala fica mais livre)

// Canal do rádio: a base escolhe o mais limpo entre 1, 6 e 11 ao ligar (o Wi-Fi da escola costuma ocupar um deles).
// Quem perde a base procura nos 3: o Eco fica CHANNEL_DWELL_MS em cada (mais que o intervalo do farol) e o
// ECOcontroller, que procura o Eco, passa pelos 3 dentro desse tempo (RC_HUNT_DWELL_MS cada): eles se acham.
export const AIR_CHANNELS = [1, 6, 11];
export const AIR_DEFAULT_CHANNEL = 1;
export const CHANNEL_DWELL_MS = 1500;
export const RC_HUNT_DWELL_MS = 500;
export const RC_BUSY_MS = 3000; // controle mexendo há menos que isso: o Eco não troca de canal (não corta o controle)
export const nextChannel = (ch) => AIR_CHANNELS[(AIR_CHANNELS.indexOf(ch) + 1) % AIR_CHANNELS.length];
export const validChannel = (ch) => (AIR_CHANNELS.includes(ch) ? ch : AIR_DEFAULT_CHANNEL);
// Escolha do canal pela base: redes Wi-Fi ouvidas [{ ch, rssi }]; cada uma atrapalha o próprio canal e os vizinhos
// (canais a menos de 5 de distância se sobrepõem). Fica o de menor interferência; empate, o primeiro da lista.
export function chooseChannel(networks = []) {
  const score = (c) => networks.reduce((s, n) => s + 10 ** (n.rssi / 10) * Math.max(0, 1 - Math.abs(c - n.ch) / 5), 0);
  return AIR_CHANNELS.reduce((best, c) => (score(c) < score(best) - 1e-15 ? c : best), AIR_CHANNELS[0]);
}
export const TUNNEL_JOIN_MS = 10000; // pedaços de uma mensagem repetida (mesmo seq) se juntam por até 10 s
export const RC_SEND_MS = 50; // controle mexendo: 20 por segundo
export const RC_IDLE_MS = 200; // controle parado: "estou aqui" 5 por segundo
export const RC_HOLD_MS = 1000; // depois do controle mexer, o celular não toma o carro por esse tempo
export const RC_STATUS_MS = 500;
export const RC_LOST_MS = 1500; // controle sem resposta do carro: LED piscando devagar
export const RC_SLEEP_MS = 5 * 60 * 1000; // controle parado: dorme (pilha); qualquer botão acorda
export const RC_INFO_MS = 5000; // o controle diz quem é (firmware, placa, opções) ao Eco; ele conta à base e ao app
// atualização do controle: sem nenhum pedaço por isso, ele desiste (mais que os 20 s que quem envia insiste)
export const RC_OTA_IDLE_MS = 30000;
// repassando uma atualização, o Eco sem base não troca de canal (mais que os 10 s de espera do OTA_BEGIN)
export const RC_RELAY_HOLD_MS = 15000;

const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
const readU32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const encodeBeacon = (kit, pairing) => Uint8Array.of(AIR.BEACON, ...u32(kit), pairing ? 1 : 0);
export const decodeBeacon = (b) => ({ kit: readU32(b, 1), pairing: !!(b[5] & 1) });
export const encodeBind = (kit) => Uint8Array.of(AIR.BIND, ...u32(kit));
export const encodeUnbind = (kit) => Uint8Array.of(AIR.UNBIND, ...u32(kit));
export const decodeKit = (b) => readU32(b, 1);

export function encodePolicy({ paused = false, muted = false, lightsOff = false, timeUp = false, maxSpeed = 100, timeLeftMin = null }) {
  const f = (paused ? POLICY_FLAG.PAUSED : 0) | (muted ? POLICY_FLAG.MUTED : 0) | (lightsOff ? POLICY_FLAG.LIGHTS_OFF : 0) | (timeUp ? POLICY_FLAG.TIME_UP : 0);
  const left = timeLeftMin === null || timeLeftMin === undefined ? 255 : Math.max(0, Math.min(254, Math.round(timeLeftMin)));
  return Uint8Array.of(AIR.POLICY, f, Math.max(0, Math.min(100, Math.round(maxSpeed))), left);
}
export function decodePolicy(b) {
  const f = b[1];
  return {
    paused: !!(f & POLICY_FLAG.PAUSED), muted: !!(f & POLICY_FLAG.MUTED), lightsOff: !!(f & POLICY_FLAG.LIGHTS_OFF),
    timeUp: !!(f & POLICY_FLAG.TIME_UP), maxSpeed: Math.min(100, b[2]), timeLeftMin: b[3] === 255 ? null : b[3],
  };
}

export const encodeCmd = (msg) => Uint8Array.of(AIR.CMD, ...msg);
export const encodeReply = (msg) => Uint8Array.of(AIR.REPLY, ...msg);

// board: placa (0 protótipo, 1 ECOplus, 2 ECOpro) nos 4 bits de cima do byte da cor: o servidor da sala escolhe o
// firmware de cada Eco por ela (Eco de firmware antigo manda 0 = protótipo)
export function encodeHello({ kit = 0, id, fw, flags = 0, color = 0, name = '', board = 0 }) {
  return Uint8Array.of(AIR.HELLO, ...u32(kit), id & 0xff, (id >> 8) & 0xff, fw[0], fw[1], flags, (color & 7) | ((board & 15) << 4), ...enc.encode(name).subarray(0, 20));
}
export function decodeHello(b) {
  return { kit: readU32(b, 1), id: b[5] | (b[6] << 8), fw: [b[7], b[8]], flags: b[9], color: b[10] & 7, board: b[10] >> 4, name: dec.decode(b.subarray(11, 31)) };
}

// TELEM: o STATE do Eco (sem o byte do tipo) + quem está dirigindo
export const encodeTelem = (stateMsg, client) => Uint8Array.of(AIR.TELEM, ...stateMsg.subarray(1), client);
export const decodeTelem = (b) => ({ state: Uint8Array.of(0x81, ...b.subarray(1, 13)), client: b[13] ?? 0 });

// ---------- ECOcontroller ----------

const i8 = (v) => Math.max(-100, Math.min(100, Math.round(v))) & 0xff;
const s8 = (v) => (v > 127 ? v - 256 : v);
export const encodeRcPair = (layout, fw) => Uint8Array.of(AIR.RC_PAIR, layout & 3, fw[0], fw[1]);
export const decodeRcPair = (b) => ({ layout: b[1] & 3, fw: [b[2], b[3]] });
export const encodeRcBound = ({ id, color = 0, name = '' }) => Uint8Array.of(AIR.RC_BOUND, id & 0xff, (id >> 8) & 0xff, color & 7, ...enc.encode(name).subarray(0, 20));
export const decodeRcBound = (b) => ({ id: b[1] | (b[2] << 8), color: b[3] & 7, name: dec.decode(b.subarray(4, 24)) });
export const encodeRcDrive = ({ left, right, buttons = 0, battery = 100 }) => Uint8Array.of(AIR.RC_DRIVE, i8(left), i8(right), buttons & 0xff, Math.max(0, Math.min(100, Math.round(battery))));
// quadro estragado ou controle com defeito: nunca passa de -100..100 (o PWM máximo)
const c100 = (v) => Math.max(-100, Math.min(100, v));
export const decodeRcDrive = (b) => ({ left: c100(s8(b[1])), right: c100(s8(b[2])), buttons: b[3], battery: Math.min(100, b[4]) });
export const encodeRcInfo = ({ fw, board, opts = 0 }) => Uint8Array.of(AIR.RC_INFO, fw[0], fw[1], board & 0xff, opts & 0xff);
export const decodeRcInfo = (b) => ({ fw: [b[1], b[2]], board: b[3], opts: b[4] });
export const encodeRcCmd = (msg) => Uint8Array.of(AIR.RC_CMD, ...msg);
export const encodeRcReply = (msg) => Uint8Array.of(AIR.RC_REPLY, ...msg);
export const encodeRcStatus = (flags, color) => Uint8Array.of(AIR.RC_STATUS, flags & 0xff, color & 7);
export const decodeRcStatus = (b) => ({ flags: b[1], color: b[2] & 7 });

// Setas -> velocidade de cada lado (o mesmo no firmware do controle). Para frente/trás com lado = curva aberta.
export const RC_ARROW_SPEED = 80;
export const RC_ARROW_TURN = 60; // girar parado
export function arrowsToDrive({ up = false, down = false, left = false, right = false }) {
  const v = up === down ? 0 : up ? RC_ARROW_SPEED : -RC_ARROW_SPEED;
  const t = left === right ? 0 : left ? -1 : 1;
  if (!v) return [t * RC_ARROW_TURN, -t * RC_ARROW_TURN];
  if (!t) return [v, v];
  // curva: o lado de dentro anda a 30%
  return t < 0 ? [Math.round(v * 0.3), v] : [v, Math.round(v * 0.3)];
}

// Manetes (ECOcontroller Lite, ADS1115): leitura do ADC a ±4,096 V, 3,3 V = 26400. O centro é medido ao encaixar
export const RC_STICK_CENTER = 13200; // 1,65 V: manete no meio
export const RC_STICK_CENTER_TOL = 3000; // mediu longe disso ao encaixar = manete fora do centro: usa o nominal
export const RC_STICK_DEAD = 8; // % do curso: quase no meio = parado
export const stickCenter = (raw) => (Math.abs(raw - RC_STICK_CENTER) > RC_STICK_CENTER_TOL ? RC_STICK_CENTER : raw);
// span: do centro até o fim do curso (no ADS1115 é o próprio centro; no ADC do ESP32, ver abaixo)
export function stickAxis(raw, center, span = center) {
  const v = ((raw - center) * 100) / span;
  if (Math.abs(v) < RC_STICK_DEAD) return 0;
  return Math.round(Math.max(-100, Math.min(100, ((Math.abs(v) - RC_STICK_DEAD) * 100) / (100 - RC_STICK_DEAD))) * Math.sign(v));
}
// Manetes no ECOcontroller Plus/Pro: ADC do ESP32, em mV (placa.md, seção 11.3.1). Com manete de 10 kΩ e o pull-down de
// 100 kΩ, o centro fica em 1,61 V e o curso vai de 0,16 a 3,12 V. O ADC perde precisão no alto, então o curso cheio vale a
// partir de RC_STICK_ADC_SPAN_MV do centro, igual para os dois lados. Sem manetes, os 4 eixos ficam perto de 0 V.
export const RC_STICK_ADC_CENTER_MV = 1610;
export const RC_STICK_ADC_TOL_MV = 375;
export const RC_STICK_ADC_SPAN_MV = 1000;
export const RC_STICK_ADC_MIN_MV = 300; // qualquer eixo acima disso ao ligar = tem manetes (empurrada, ela zera só um eixo)
export const sticksMounted = (mv) => mv.some((v) => v > RC_STICK_ADC_MIN_MV);
export const stickCenterMv = (mv) => (Math.abs(mv - RC_STICK_ADC_CENTER_MV) > RC_STICK_ADC_TOL_MV ? RC_STICK_ADC_CENTER_MV : mv);
// [JOY1_X, JOY1_Y, JOY2_X, JOY2_Y] em % -> velocidade de cada lado. Normal: manete esquerda vira, direita acelera.
// Tanque: cada manete é um lado.
export function sticksToDrive([x1, y1, , y2], tanque) {
  if (tanque) return [y1, y2];
  const lim = (v) => Math.max(-100, Math.min(100, v));
  return [lim(y2 + x1), lim(y2 - x1)];
}

// Volante (controle com acelerômetro): inclinar para o lado faz a curva; parado, inclinar não faz nada (igual ao
// modo volante do app). tiltDeg: quanto o controle está inclinado (°, + = direita), já com o centro descontado.
export const RC_TILT_DEADZONE_DEG = 6; // quase reto = reto (a mão treme)
export const RC_TILT_FULL_DEG = 35; // inclinado assim = curva máxima
export const RC_TILT_INNER = 0.3; // na curva máxima o lado de dentro anda a 30 % (como nas setas)
export function tiltToDrive({ up = false, down = false, tiltDeg = 0 }) {
  const v = up === down ? 0 : up ? RC_ARROW_SPEED : -RC_ARROW_SPEED;
  if (!v) return [0, 0];
  const a = Math.abs(tiltDeg);
  const t = a <= RC_TILT_DEADZONE_DEG ? 0 : Math.min(1, (a - RC_TILT_DEADZONE_DEG) / (RC_TILT_FULL_DEG - RC_TILT_DEADZONE_DEG));
  if (!t) return [v, v];
  const inner = Math.round(v * (1 - (1 - RC_TILT_INNER) * t));
  return tiltDeg < 0 ? [inner, v] : [v, inner];
}

// ---------- Túnel: mensagens da sala (texto JSON) em pedaços ----------
// O celular manda a mesma mensagem que mandaria pelo Wi-Fi; o carro só repassa os pedaços. Quem junta é a
// outra ponta (servidor ou app). Pedaço perdido = a mensagem toda se perde (telemetria repete; o resto reenvia).

// seq para mandar `text`: o mesmo da última vez se o texto é igual (repetição), senão o próximo
export function seqFor(state, text) {
  if (text !== state.lastText) {
    state.seq = (state.seq + 1) & 0xff;
    state.lastText = text;
  }
  return state.seq;
}

export function chunkText(type, seq, text) {
  const data = enc.encode(text);
  const parts = Math.max(1, Math.ceil(data.length / TUNNEL_CHUNK));
  if (parts > 255) return [];
  const out = [];
  for (let i = 0; i < parts; i++) out.push(Uint8Array.of(type, seq & 0xff, i, parts, ...data.subarray(i * TUNNEL_CHUNK, (i + 1) * TUNNEL_CHUNK)));
  return out;
}

// Junta os pedaços (um por remetente). push(pedaço) -> texto completo ou null
export class Reassembler {
  constructor(timeoutMs = TUNNEL_JOIN_MS) {
    this.timeoutMs = timeoutMs;
    this.cur = null; // { seq, parts, got: [], n, at }
  }

  push(b, now = Date.now()) {
    if (b.length < 4) return null;
    const [, seq, part, parts] = b;
    if (!parts || part >= parts) return null;
    let c = this.cur;
    if (!c || c.seq !== seq || c.parts !== parts || now - c.at > this.timeoutMs) {
      c = this.cur = { seq, parts, got: new Array(parts), n: 0, at: now };
    }
    if (!c.got[part]) {
      c.got[part] = b.subarray(4);
      c.n++;
      c.at = now; // a janela anda enquanto chegam pedaços novos (repetições da mesma mensagem se somam)
    }
    if (c.n < parts) return null;
    this.cur = null;
    const total = c.got.reduce((a, x) => a + x.length, 0);
    const all = new Uint8Array(total);
    let o = 0;
    for (const x of c.got) {
      all.set(x, o);
      o += x.length;
    }
    return dec.decode(all);
  }
}

// MAC "A1B2C3D4E5F6" <-> bytes
export const macHex = (bytes) => Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
export const hex = (bytes) => Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('');
export const unhex = (s) => Uint8Array.from((s.match(/../g) ?? []).map((h) => parseInt(h, 16)));
