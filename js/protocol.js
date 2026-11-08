// Protocolo binário entre o app e o Eco.
// O mesmo formato vale para o Bluetooth (BLE) e para o emulador (WebSocket).
// Especificação: documentos/protocolo.md — qualquer mudança aqui precisa ser feita também no firmware.

import { LESSON_BYTES, lessonFromBytes, lessonToBytes } from './lesson.js';

export const BLE_SERVICE = 'c0de0000-cafe-4b1d-9e2a-5a17ca12a000';
export const BLE_RX = 'c0de0001-cafe-4b1d-9e2a-5a17ca12a000'; // app -> carro (write without response)
export const BLE_TX = 'c0de0002-cafe-4b1d-9e2a-5a17ca12a000'; // carro -> app (notify)

export const MSG = {
  DRIVE: 0x01,
  CONFIG: 0x10,
  MELODY: 0x11,
  IDENTITY: 0x12,
  HELLO: 0x13,
  IDENTIFY: 0x14,
  CALIB: 0x15,
  LINE: 0x16,
  TURN: 0x17,
  PROG_LOAD: 0x18,
  PROG_RUN: 0x19,
  DIAG: 0x1a,
  LESSON: 0x1b,
  CLASS_UP: 0x1c,
  REMOTE: 0x1d, // [1d, op]: 0 = esquecer o ECOcontroller pareado
  PORT_LEARN: 0x1e, // [1e, porta de LED 0..3, tipo LED_KIND]: o técnico "ensina" o módulo encaixado (placa ECOpro)
  PORT_PROFILE: 0x1f, // [1f, op, comum u16, endereçável u16]: perfil dos módulos de LED (op PROFILE_OP)
  OTA_BEGIN: 0x20,
  OTA_DATA: 0x21,
  OTA_END: 0x22,
  OTA_ABORT: 0x23,
  ENC_CFG: 0x24, // [24, op ENC_OP, mm por pulso u16 (µm), bitola u16 (mm)]: encoder das portas de motor (ECOpro)
  SYS: 0x25, // [25]: pede SYS_INFO (memória livre e tempo do ciclo; bancada)
  SCENE: 0x26, // [26, op SCENE_OP, cenário, liberados u32]: cenário (documentos/cenarios.md)
  IO: 0x27, // [27, motor E i8, motor D i8, (r, g, b) × 4 luzes, som (Hz / 10)]: portas uma a uma (cenário maquete)
  TELA: 0x28, // [28, linha 0..3 (255 = limpa), texto ≤ 16]: escreve na telinha (módulo da expansão)
  SERVO: 0x29, // [29, servo 0..7, ângulo 0..180 (255 = solto)]: módulo de servos
  AJUSTE: 0x2b, // [2b, força do giro %, força mínima do giro %, partida forte ×10 ms, modo dos motores]: ajustes do Eco
  REMOTE_CMD: 0x2a, // [2a, msg...]: mensagem para o ECOcontroller pareado; o Eco só repassa (atualização sem a ECObase)
  STATE: 0x81,
  INFO: 0x82,
  DENIED: 0x83,
  CALIB_INFO: 0x84,
  OTA_STATUS: 0x85,
  LINE_RESULT: 0x86,
  TURN_DONE: 0x87,
  PROG_ACK: 0x88,
  PROG_STATUS: 0x89,
  DIAG_RESULT: 0x8a,
  LOG: 0x8b,
  LINE_LAP: 0x8c,
  LESSON_INFO: 0x8d,
  CLASS_DOWN: 0x8e,
  BASE_INFO: 0x8f,
  EXP_INFO: 0x90,
  LED_INFO: 0x91,
  CAPS: 0x92,
  PORTS_INFO: 0x93,
  PORT_CURRENT: 0x94,
  PORT_PROFILE_INFO: 0x95,
  ENC_INFO: 0x96,
  SYS_INFO: 0x97,
  SCENE_INFO: 0x98,
  SENSORS: 0x99,
  REMOTE_INFO: 0x9a, // [9a, mac ×6, fw0, fw1, placa, opções RC_OPT, pilha %]: o ECOcontroller pareado, ligado agora
  REMOTE_REPLY: 0x9b, // [9b, msg...]: resposta do ECOcontroller a um REMOTE_CMD
  AJUSTE_INFO: 0x9c, // [9c, igual ao AJUSTE]: os ajustes gravados no Eco (logo depois do HELLO e a cada AJUSTE)
};

// Versão da placa e o que ela tem (documentos/placa.md). CAPS: [0x92, placa, caps u16], logo depois do HELLO.
// Eco sem CAPS (firmware antigo, protótipo) = placa PROTOTIPO com tudo: o app mostra como antes.
// O app esconde o que a placa não tem (ex.: a ECOplus não tem setas nem modo polícia).
// ECOCONTROLLER e ECOCONTROLLER_PROTO não são Ecos: só existem na assinatura do firmware e no RC_INFO (sem BOARD_CAPS)
export const BOARD = { PROTOTIPO: 0, ECOPLUS: 1, ECOPRO: 2, ECOLITE: 3, ECOCONTROLLER: 4, ECOCONTROLLER_PROTO: 5 };
// SIGNALS = setas e modo polícia · DIMMER = brilho por canto · ADDRESSABLE = LED endereçável · VOLTAGE = mede a tensão
// da powerbank (aviso de bateria fraca) · LED_DETECT = descobre o tipo de módulo de LED · PORT_CURRENT = corrente por
// porta · MOTOR_INPUT = entrada digital na porta do motor (encoder, fim de curso) · WRONG_PORT = avisa peça na porta errada
// LEDS = tem portas de LED · LINE = tem sensores de linha nas tomadas (a ECOlite não tem nenhum dos dois)
export const CAP = { SIGNALS: 1, DIMMER: 2, ADDRESSABLE: 4, VOLTAGE: 8, LED_DETECT: 16, PORT_CURRENT: 32, MOTOR_INPUT: 64, WRONG_PORT: 128, LEDS: 256, LINE: 512 };
export const BOARD_CAPS = [
  CAP.SIGNALS | CAP.DIMMER | CAP.ADDRESSABLE | CAP.VOLTAGE | CAP.LED_DETECT | CAP.LEDS | CAP.LINE, // PROTOTIPO (placa do protótipo, mapa documentos/pinos.md)
  CAP.LEDS | CAP.LINE, // ECOPLUS (ESP32-C3): LED comum em 2 grupos, liga/desliga; sem medir tensão nem corrente
  CAP.SIGNALS | CAP.DIMMER | CAP.ADDRESSABLE | CAP.VOLTAGE | CAP.LED_DETECT | CAP.PORT_CURRENT | CAP.MOTOR_INPUT | CAP.WRONG_PORT | CAP.LEDS | CAP.LINE, // ECOPRO (C6)
  0, // ECOLITE (ESP32-C3): motores, buzzer e a expansão I2C; sem LEDs, sensores nas tomadas nem medição
];
export const encodeCaps = (board) => Uint8Array.of(MSG.CAPS, board & 0xff, BOARD_CAPS[board] & 0xff, (BOARD_CAPS[board] >> 8) & 0xff);
export const decodeCaps = (b) => ({ board: b[1], caps: b[2] | (b[3] << 8) });

// Módulos de LED (um por canto: dianteiro esq./dir., traseiro esq./dir.). O Eco descobre sozinho o que está em
// cada porta medindo a corrente (documentos/pinos.md): COMUM = só V+ e GND (acende pelo V+; brilho por PWM), ENDERECAVEL =
// WS2812 com dados no D− (cores), VAZIA = nada encaixado. LED_INFO: [0x91, tipo FE, tipo FD, tipo TE, tipo TD].
// DESCONHECIDO: algo puxa corrente na porta, mas não parece um módulo de LED (placa ECOpro: "ensinar módulo" no técnico)
export const LED_KIND = { NONE: 0, PLAIN: 1, ADDRESSABLE: 2, UNKNOWN: 3 };

// ---------- Conferência das peças (PORTS_INFO 0x93): o que o Eco percebe em cada peça ----------
// [0x93, n, n × estado], na ordem de PECAS. NA = esta placa não percebe essa peça (ex.: LED na ECOplus).
// Quem percebe: sensores de linha pela tensão do pino (todas), sonar pela presença (todas), motores pela corrente
// (ECOpro) ou pelo giroscópio andando reto (com IMU), LEDs pela corrente (placas que medem: LED_DETECT).
// O app mostra "🔌 Confira as peças" com o que a aula usa; o painel, um selo no cartão do aluno; o técnico, tudo.
export const PECAS = ['me', 'md', 'fe', 'fd', 'te', 'td', 'le', 'ld', 'son', 'cf'];
export const PECA_NOME = {
  me: 'motor esquerdo', md: 'motor direito', fe: 'LED da frente esquerda', fd: 'LED da frente direita',
  te: 'LED da traseira esquerda', td: 'LED da traseira direita', le: 'sensor de linha esquerdo', ld: 'sensor de linha direito', son: 'sonar',
  cf: 'controle com fio',
};
// OK · FALTA (não encaixada) · FROUXA (some e volta) · ERRADA (outra peça na tomada) · TRAVADA (roda presa: motor)
export const PECA_ST = { NA: 0, OK: 1, FALTA: 2, FROUXA: 3, ERRADA: 4, TRAVADA: 5 };
export const encodePortsInfo = (st) => Uint8Array.of(MSG.PORTS_INFO, st.length, ...st);
export const decodePortsInfo = (b) => Object.fromEntries(PECAS.map((id, i) => [id, i < b[1] ? b[2 + i] ?? 0 : 0]));
// PORT_CURRENT (só com a medição de corrente; o técnico vê ao vivo): [0x94, LED FE FD TE TD em décimos de mA u16,
// motor esq. e dir. em mA u16]
export function encodePortCurrent(ledMa, motorMa) {
  const v = [...ledMa.map((x) => Math.round(x * 10)), ...motorMa.map((x) => Math.round(x))].map((x) => Math.max(0, Math.min(65535, x)));
  return Uint8Array.of(MSG.PORT_CURRENT, ...v.flatMap((x) => [x & 0xff, x >> 8]));
}
export function decodePortCurrent(b) {
  const r = (i) => b[1 + i * 2] | (b[2 + i * 2] << 8);
  return { ledMa: [0, 1, 2, 3].map((i) => r(i) / 10), motorMa: [r(4), r(5)] };
}
// Perfil dos módulos de LED: corrente de repouso do LED comum e do endereçável (décimos de mA; 0 = não aprendido,
// usa o padrão). LER responde PORT_PROFILE_INFO; GRAVAR troca; RESTAURAR volta ao padrão.
export const PROFILE_OP = { LER: 0, GRAVAR: 1, RESTAURAR: 2 };
export const encodePortProfile = (op, comumMa = 0, endMa = 0) => {
  const c = Math.round(comumMa * 10), e = Math.round(endMa * 10);
  return Uint8Array.of(MSG.PORT_PROFILE, op, c & 0xff, c >> 8, e & 0xff, e >> 8);
};
export const decodePortProfile = (b) => ({ op: b[1], comumMa: (b[2] | (b[3] << 8)) / 10, endMa: (b[4] | (b[5] << 8)) / 10 });
// PORT_PROFILE_INFO: [0x95, comum u16, endereçável u16 (ensinados; décimos de mA, 0 = não), e o que o Eco aprendeu
// sozinho: LED comum u16 e aumento do endereçável u16 (décimos de mA), corrente dos motores andando E e D u16 (mA),
// tensão da tomada vazia do sensor de linha u16 (mV)]
export function encodePortProfileInfo(perfil, aprendido) {
  const v = [perfil.comumMa * 10, perfil.endMa * 10, aprendido.ledComumMa * 10, aprendido.ledRiseMa * 10,
    aprendido.motorRunMa[0], aprendido.motorRunMa[1], aprendido.ldrVazioMv].map((x) => Math.max(0, Math.min(65535, Math.round(x))));
  return Uint8Array.of(MSG.PORT_PROFILE_INFO, ...v.flatMap((x) => [x & 0xff, x >> 8]));
}
export function decodePortProfileInfo(b) {
  const r = (i) => b[1 + i * 2] | (b[2 + i * 2] << 8);
  const out = { comumMa: r(0) / 10, endMa: r(1) / 10 };
  if (b.length >= 15) out.aprendido = { ledComumMa: r(2) / 10, ledRiseMa: r(3) / 10, motorRunMa: [r(4), r(5)], ldrVazioMv: r(6) };
  return out;
}
export const encodePortLearn = (porta, tipo) => Uint8Array.of(MSG.PORT_LEARN, porta & 3, tipo & 3);

// ---------- Encoder nas portas de motor (placa ECOpro, CAP.MOTOR_INPUT; emulator/encoder.js) ----------
// tipo achado em cada roda · de onde vem o valor (média do tipo, sonar, técnico, giroscópio) · ENC_CFG op
export const ENC_KIND = { NONE: 0, DISCO: 1, MAGNETICO: 2, CHAVE: 3 };
export const ENC_FONTE = { MEDIA: 0, SONAR: 1, MANUAL: 2, GIRO: 3 };
export const ENC_OP = { LER: 0, MANUAL: 1, AUTO: 2 };
export const ENC_INFO_BYTES = 10;
const encU16 = (x) => Math.max(0, Math.min(65535, Math.round(x)));
// ENC_INFO: [0x96, tipo E, tipo D, fonte do mm/pulso, mm por pulso u16 (µm), bitola u16 (mm), fonte da bitola,
// sinal agora (bit 0 = E, bit 1 = D: fim de curso/botão)]
export function encodeEncInfo({ kinds, fonte, mmPulso, bitolaMm, bitolaFonte, levels }) {
  const um = encU16(mmPulso * 1000);
  const b = encU16(bitolaMm);
  return Uint8Array.of(MSG.ENC_INFO, kinds[0] & 3, kinds[1] & 3, fonte & 3, um & 0xff, um >> 8, b & 0xff, b >> 8, bitolaFonte & 3,
    (levels[0] ? 1 : 0) | (levels[1] ? 2 : 0));
}
export const decodeEncInfo = (b) => ({
  kinds: [b[1], b[2]], fonte: b[3], mmPulso: (b[4] | (b[5] << 8)) / 1000, bitolaMm: b[6] | (b[7] << 8), bitolaFonte: b[8],
  levels: [b[9] & 1, (b[9] >> 1) & 1],
});
export function encodeEncCfg(op, mmPulso = 0, bitolaMm = 0) {
  const um = encU16(mmPulso * 1000);
  const b = encU16(bitolaMm);
  return Uint8Array.of(MSG.ENC_CFG, op & 3, um & 0xff, um >> 8, b & 0xff, b >> 8);
}
// SYS_INFO: [0x97, memória livre u32, a menor desde que ligou u32 (bytes), ciclo médio u16, o maior u16 (µs, desde o
// último pedido), ligado há u32 (s)]. 0 = não medido (emulador). A bancada confere com SYS_LIMITES.
export const SYS_INFO_BYTES = 17;
export const SYS_LIMITES = { heapMinBytes: 30000, cicloMaxUs: 5000 }; // ciclo de 10 ms: no máximo metade ocupada
export const encodeSysReq = () => Uint8Array.of(MSG.SYS);
export function encodeSysInfo({ heapLivre, heapMin, cicloUs, cicloMaxUs, ligadoS }) {
  const u32 = (v) => { const x = Math.max(0, Math.min(0xffffffff, Math.round(v))) >>> 0; return [x & 0xff, (x >> 8) & 0xff, (x >> 16) & 0xff, x >>> 24]; };
  const u16 = (v) => { const x = Math.max(0, Math.min(65535, Math.round(v))); return [x & 0xff, x >> 8]; };
  return Uint8Array.of(MSG.SYS_INFO, ...u32(heapLivre), ...u32(heapMin), ...u16(cicloUs), ...u16(cicloMaxUs), ...u32(ligadoS));
}
export function decodeSysInfo(b) {
  const r32 = (i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
  return { heapLivre: r32(1), heapMin: r32(5), cicloUs: b[9] | (b[10] << 8), cicloMaxUs: b[11] | (b[12] << 8), ligadoS: r32(13) };
}
// ---------- Cenários (documentos/cenarios.md; o catálogo com nomes e telas fica em app/js/cenarios.js) ----------
// SCENE_PRECISA[n]: o que a placa precisa ter (CAP) para o cenário n · SCENE_VEICULO: bit n = o cenário anda como o
// Eco (DRIVE, freio, seguidor, giro exato); os outros são "maquete": cada porta comandada pelo IO ou pelo programa
export const SCENE_COUNT = 17;
export const SCENE_PRECISA = [0, CAP.LEDS, CAP.LEDS, CAP.MOTOR_INPUT, CAP.LINE, CAP.MOTOR_INPUT, CAP.LINE, CAP.MOTOR_INPUT, 0, CAP.LEDS, CAP.LEDS, CAP.DIMMER, CAP.LEDS, 0, CAP.MOTOR_INPUT, CAP.LEDS, CAP.DIMMER];
export const SCENE_VEICULO = (1 << 0) | (1 << 3) | (1 << 5) | (1 << 6) | (1 << 13); // Eco, laboratório, explorador, bichinho, desenhista
export const SCENE_TODOS = (1 << SCENE_COUNT) - 1;
export const SCENE_OP = { LER: 0, ESCOLHER: 1, LIBERAR: 2, DOAR: 3 };
export const SCENE_INFO_BYTES = 10;
export const ehVeiculo = (n) => !!((SCENE_VEICULO >>> n) & 1);
// a placa (CAP) roda o cenário n?
export const sceneServe = (n, caps) => n >= 0 && n < SCENE_COUNT && (SCENE_PRECISA[n] & caps) === SCENE_PRECISA[n];
const le32 = (v) => { const x = v >>> 0; return [x & 0xff, (x >> 8) & 0xff, (x >> 16) & 0xff, x >>> 24]; };
const rd32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
export const encodeScene = (op, cenario = 0, liberados = 0) => Uint8Array.of(MSG.SCENE, op & 3, cenario & 0xff, ...le32(liberados));
export const decodeScene = (b) => ({ op: b[1], cenario: b[2] ?? 0, liberados: b.length >= 7 ? rd32(b, 3) : 0 });
// SCENE_INFO: [0x98, cenário atual, liberados u32 (kit), disponíveis u32 (liberados que esta placa roda)]
export const encodeSceneInfo = (atual, liberados, disponiveis) => Uint8Array.of(MSG.SCENE_INFO, atual & 0xff, ...le32(liberados), ...le32(disponiveis));
export const decodeSceneInfo = (b) => ({ atual: b[1], liberados: rd32(b, 2), disponiveis: rd32(b, 6) });

// IO (maquete): motores -100..100 (% da velocidade, o limite do professor vale), cor de cada luz (o LED comum usa a
// mais forte das três como brilho), som em Hz/10 (0 = mudo). Vale como o DRIVE: sem IO por FAILSAFE_MS, os motores param
export const IO_BYTES = 16;
const s8 = (v) => Math.max(-100, Math.min(100, Math.round(v))) & 0xff;
const i8 = (x) => (x > 127 ? x - 256 : x);
export function encodeIo({ motores = [0, 0], cores = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], somHz = 0 }) {
  return Uint8Array.of(MSG.IO, s8(motores[0]), s8(motores[1]), ...cores.flatMap((c) => c.map((x) => Math.max(0, Math.min(255, Math.round(x))))),
    Math.max(0, Math.min(255, Math.round(somHz / 10))));
}
export const decodeIo = (b) => ({
  motores: [i8(b[1]), i8(b[2])], cores: [0, 1, 2, 3].map((k) => [b[3 + k * 3], b[4 + k * 3], b[5 + k * 3]]), somHz: b[15] * 10,
});

// SENSORS (fora do Eco, 10 por segundo): [0x99, luz E, luz D, sonar u16 (cm), sinais das portas de motor (bit 0 E,
// bit 1 D: fim de curso/botão), velocidade i16 (mm/s, encoder), distância andada u32 (mm), giro i16 (°/s), direção i16 (°),
// aceleração u8 (décimos de g, pico recente)]
export const SENSORS_BYTES = 17;
// + módulos (25 bytes): teclas u8 (bit k = tecla k+1 apertada) · temperatura i16 (°C × 10; -32768 = sem o módulo) ·
// umidade u8 (%; 255 = sem) · cor r, g, b u8 · cor classificada u8 (COR_CLASSE; 255 = sem o módulo)
export const SENSORS_MOD_BYTES = 25;
const s16 = (v) => { const x = Math.max(-32768, Math.min(32767, Math.round(v))) & 0xffff; return [x & 0xff, x >> 8]; };
const r16s = (b, i) => { const x = b[i] | (b[i + 1] << 8); return x > 32767 ? x - 65536 : x; };
export function encodeSensors({ luz = [0, 0], distCm = NO_DISTANCE, niveis = [0, 0], velMm = 0, odoMm = 0, giro = 0, direcao = 0, accelG = 0,
  teclas = 0, tempC = null, umid = null, cor = null, corClasse = null }) {
  return Uint8Array.of(MSG.SENSORS, luz[0] & 0xff, luz[1] & 0xff, distCm & 0xff, (distCm >> 8) & 0xff, (niveis[0] ? 1 : 0) | (niveis[1] ? 2 : 0),
    ...s16(velMm), ...le32(odoMm), ...s16(giro), ...s16(direcao), Math.max(0, Math.min(255, Math.round(accelG * 10))),
    teclas & 0xff, ...(tempC === null ? [0x00, 0x80] : s16(tempC * 10)), umid === null ? 255 : Math.max(0, Math.min(100, Math.round(umid))),
    ...(cor ?? [0, 0, 0]).map((x) => Math.max(0, Math.min(255, Math.round(x)))), corClasse === null ? 255 : corClasse & 0xff);
}
export const decodeSensors = (b) => ({
  luz: [b[1], b[2]], distCm: b[3] | (b[4] << 8), niveis: [b[5] & 1, (b[5] >> 1) & 1], velMm: r16s(b, 6), odoMm: rd32(b, 8),
  giro: r16s(b, 12), direcao: r16s(b, 14), accelG: b[16] / 10,
  ...(b.length >= SENSORS_MOD_BYTES ? {
    teclas: b[17], tempC: r16s(b, 18) === -32768 ? null : r16s(b, 18) / 10, umid: b[20] === 255 ? null : b[20],
    cor: b[24] === 255 ? null : [b[21], b[22], b[23]], corClasse: b[24] === 255 ? null : b[24],
  } : { teclas: 0, tempC: null, umid: null, cor: null, corClasse: null }),
});
// TELA: uma linha da telinha (texto simples: o que não for ASCII vira "?"); 255 = limpa
export function encodeTela(linha, texto = '') {
  const t = [...String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '')].slice(0, 16).map((c) => (c.charCodeAt(0) < 127 && c.charCodeAt(0) >= 32 ? c.charCodeAt(0) : 63));
  return Uint8Array.of(MSG.TELA, linha & 0xff, ...t);
}
export const decodeTela = (b) => ({ linha: b[1], texto: String.fromCharCode(...b.subarray(2, 18)) });
export const encodeServo = (servo, angulo) => Uint8Array.of(MSG.SERVO, servo & 7, angulo === null ? 255 : Math.max(0, Math.min(180, Math.round(angulo))));
export const decodeServo = (b) => ({ servo: b[1] & 7, angulo: b[2] === 255 ? null : Math.min(180, b[2]) });
export const decodeEncCfg = (b) => ({ op: b[1], mmPulso: (b[2] | (b[3] << 8)) / 1000, bitolaMm: b[4] | (b[5] << 8) });

// ---------- ECOsonar (I2C, na tomada de expansão; firmware/ecosonar/) ----------
// Um ATtiny85 lê o HC-SR04 e responde no I2C. Registradores (ler a partir do 0): 0 = 'S' (0x53, "sou o sonar"),
// 1 = versão, 2-3 = distância em cm (u16; 0xFFFF = nada à frente), 4 = contador de medidas (muda a cada medida nova),
// 5 = situação (bit 0: o HC-SR04 respondeu na última medida).
export const SONAR_ADDR = 0x57;
export const SONAR_ID = 0x53;
export const SONAR_REG = { ID: 0, VERSAO: 1, DIST: 2, CONTADOR: 4, SITUACAO: 5 };
export const SONAR_PERIOD_MS = 60; // uma medida a cada 60 ms (o eco de 4 m volta em ~24 ms)

// Porta de expansão (I2C, o mesmo barramento do IMU; documentos/expansao.md). O Eco conta o que achou nela.
// EXP_INFO: [0x90, flags, n, n × endereço I2C]. flags: WIRED = controle com fio ligado · FAULT = ligação errada
// (barramento preso: algo que não é módulo I2C foi ligado na porta; o IMU para junto até tirar).
export const EXP_FLAG = { WIRED: 1, FAULT: 2 };
export const EXP_WIRED_ADDR = 0x20; // ECOcontroller com fio: TCA9555 com A0..A2 no GND (documentos/placa.md, seção 11)
export const EXP_ADC_ADDR = 0x48; // ECOcontroller Lite com manetes: ADS1115 (AIN0..3 = JOY1_X, JOY1_Y, JOY2_X, JOY2_Y)
export const EXP_POLL_MS = 50; // leitura dos botões do controle com fio (20/s, como o controle sem fio)
export const EXP_SCAN_MS = 500; // procura módulos encaixados / tirados
// bits do byte lido do expansor (já invertido: 1 = apertado; os botões ligam o pino ao GND)
// bit n = porta n do TCA9555, botão apertado = 1. HORN é o A e LIGHT é o B; X, Y, L1 e R1 ainda sem função
export const WIRED_BTN = { UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8, HORN: 16, LIGHT: 32, X: 64, Y: 128, L1: 256, R1: 512, MODE: 1024 };
export const WIRED_MASK = 0x7ff; // P00..P12: o resto é reserva e LEDs de bateria

// Atualização de firmware (OTA)
export const OTA_CODE = { READY: 0, PROGRESS: 1, DONE: 2, ERROR: 3 };
// motivo do ERROR (byte 6 do OTA_STATUS): arquivo incompleto/CRC errado ou sem a assinatura da ecocreator
// WRONG_CHIP: firmware de outro chip (ex.: o do ESP32-C3 numa placa ECOpro, com ESP32-C6): recusado no primeiro pacote
// WRONG_BOARD: assinado pela ecocreator, mas para outra placa (a placa entra no texto assinado; mesmo chip, ex. protótipo × ECOplus)
export const OTA_REASON = { NONE: 0, CORRUPT: 1, SIGNATURE: 2, WRONG_CHIP: 3, WRONG_BOARD: 4 };
export const NOME_DA_PLACA = ['protótipo', 'ECOplus', 'ECOpro', 'ECOlite', 'ECOcontroller', 'ECOcontroller (protótipo)'];
// chip de cada placa, como vem no cabeçalho do firmware do ESP32 (byte 0 = 0xE9; bytes 12-13 = chip, u16)
export const IMAGE_MAGIC = 0xe9;
export const CHIP_ID = { ESP32: 0, ESP32S2: 2, ESP32C3: 5, ESP32S3: 9, ESP32C2: 12, ESP32C6: 13, ESP32H2: 16, ESP32P4: 18 };
export const CHIP_DA_PLACA = [CHIP_ID.ESP32C3, CHIP_ID.ESP32C3, CHIP_ID.ESP32C6, CHIP_ID.ESP32C3, CHIP_ID.ESP32C3, CHIP_ID.ESP32C3]; // na ordem de BOARD
// o primeiro pedaço do firmware é de outro chip? (só decide com um cabeçalho de ESP32 e um chip conhecido)
export function chipErrado(primeiros, board) {
  if (!primeiros || primeiros.length < 14 || primeiros[0] !== IMAGE_MAGIC) return false;
  const chip = primeiros[12] | (primeiros[13] << 8);
  return Object.values(CHIP_ID).includes(chip) && chip !== (CHIP_DA_PLACA[board] ?? CHIP_ID.ESP32C3);
}
export const OTA_CHUNK = 180; // bytes por pacote (cabe no MTU BLE típico)
export const OTA_WINDOW = 16; // pacotes por confirmação
export const OTA_MAX_BYTES = 1920 * 1024; // partição OTA do ESP32-C3 com 4 MB

// Modelo de acionamento do firmware. O app usa os mesmos números para estimar
// tempo de movimento no modo programação.
export const DRIVE_MODEL = {
  MIN_DUTY: 0.3, // PWM mínimo (zona morta do motor TT)
  MOTOR_D0: 0.135, // fração do PWM gasta só para vencer o atrito interno (corrente sem carga)
  ACCEL_PER_S: [0, 0.8, 1.6, 3.0], // por nível de aceleração (1 suave, 2 normal, 3 rápida)
  DECEL_PER_S: 4.0,
};

// Bits do byte "flags" do DRIVE (o que o app está pedindo).
// MUTE e LIGHTS_OFF vêm do professor (sala de aula): valem só enquanto chegam, nada é gravado no Eco.
export const DRIVE_FLAG = { HEADLIGHT: 1, LEFT: 2, RIGHT: 4, HAZARD: 8, HORN: 16, POLICE: 32, MUTE: 64, LIGHTS_OFF: 128 };
// Bits do byte "status" do STATE (BUMP: o acelerômetro sentiu uma batida, fica ligado ~300 ms)
export const STATUS = { FAILSAFE: 1, OBSTACLE: 2, LOW_VOLTAGE: 4, KEEPALIVE: 8, BUMP: 16 };
// Bits do byte "lights" do STATE (o que está aceso agora, já com o pisca aplicado)
export const LIGHT = { HEADLIGHT: 1, TAIL: 2, BRAKE: 4, REVERSE: 8, LEFT: 16, RIGHT: 32, POLICE: 64 };
// Bits do byte "flags" do INFO
// IMU: a placa tem o acelerômetro/giroscópio (é opcional na produção; o firmware procura no I2C ao ligar)
// REMOTE: tem um ECOcontroller pareado
export const INFO_FLAG = { DEFAULT_NAME: 1, LOCKED: 2, OWNER: 4, IMU: 8, REMOTE: 16 };

// Seguidor de linha. Porta de sensor: o que está ligado nela (o firmware reconhece sozinho)
// bits: SONAR e LIGHT podem estar juntos (BOTH) nas placas novas (sonar na expansão, sensores de linha nas tomadas deles)
export const PORT = { NONE: 0, SONAR: 1, LIGHT: 2, BOTH: 3 };
export const hasSonar = (port) => !!(port & PORT.SONAR);
export const hasLight = (port) => !!(port & PORT.LIGHT);
export const LINE_CMD = { STOP: 0, START: 1 };
export const LINE_FLAG = { DARK: 1, FINISH_STRIP: 2 }; // DARK: linha preta em chão claro
export const LINE_PHASE = { OFF: 0, CALIB: 1, FOLLOW: 2 };
// Por que a corrida acabou (LINE_RESULT)
export const LINE_END = { FINISH: 1, STOPPED: 2, NO_LINE: 3, NO_SENSOR: 4, FAILSAFE: 5 };

// ---------- Programas (modo programação, executados pelo Eco) ----------
// Cada bloco do editor vira uma instrução de 3 bytes [op, arg baixo, arg alto]; o índice da instrução é o
// índice do bloco (o app destaca o bloco que o Eco está executando). Blocos "abre" (repetir, se...)
// fecham com END; o Eco confere o casamento ao carregar.
export const PROG_OP = {
  FORWARD: 0x01, // cm
  BACK: 0x02, // cm
  TURN: 0x03, // graus, int16 (+ = direita)
  WAIT: 0x04, // centésimos de segundo
  HORN: 0x05, // centésimos de segundo
  LIGHTS: 0x06, // 1 liga, 0 desliga o farol
  MUSIC: 0x07, // id da melodia
  BLINK: 0x08,
  UNTIL_OBSTACLE: 0x09, // anda para frente até ter algo a menos de N cm (sonar)
  FOLLOW_LINE: 0x0a, // segue a linha por N décimos de segundo (0 = até a faixa de chegada)
  REPEAT: 0x10, // N vezes (0 = para sempre)
  REPEAT_UNTIL_OBSTACLE: 0x11, // repete até ter algo a menos de N cm
  IF_OBSTACLE: 0x12, // se tem algo a menos de N cm
  IF_BUMP: 0x13, // se bateu desde a última vez que perguntou (IMU)
  IF_LINE: 0x14, // se algum sensor de luz vê a linha
  // cenários (documentos/cenarios.md): sensor, comparação e valor no argumento (progSensor)
  IF_SENSOR: 0x15, // se o sensor está acima/abaixo do valor (abre bloco)
  REPEAT_UNTIL_SENSOR: 0x16, // repete até o sensor ficar acima/abaixo do valor
  IF_IGUAL: 0x17, // se o sensor é igual ao valor (abre bloco): tecla k, cor, fim de curso. Argumento: sensor (12-15), valor (0-11)
  REPEAT_UNTIL_IGUAL: 0x18, // repete até o sensor ficar igual ao valor
  END: 0x1f,
  // comandos gerais das portas (cenários maquete): porta e valor no argumento
  SET_MOTOR: 0x20, // porta (bits 8-15) e velocidade -100..100 (bits 0-7, com sinal)
  SET_LIGHT: 0x21, // porta 0..3 ou 15 = todas (bits 12-15), cor PROG_CORES (bits 8-11), brilho 0..100 (bits 0-7)
  TONE: 0x22, // toca o som em Hz até o próximo TONE (0 = para)
  WAIT_SENSOR: 0x23, // espera o sensor ficar acima/abaixo do valor
  SET_SERVO: 0x24, // servo (bits 8-15), ângulo 0..180 ou 255 = solto (bits 0-7)
  SHOW: 0x25, // telinha: tipo (bits 12-15: 0 = valor de um sensor (bits 8-11), 1 = carinha (bits 0-7), 2 = limpa)
  WAIT_IGUAL: 0x26, // espera o sensor ficar igual ao valor
};
export const PROG_OPENS = [PROG_OP.REPEAT, PROG_OP.REPEAT_UNTIL_OBSTACLE, PROG_OP.IF_OBSTACLE, PROG_OP.IF_BUMP, PROG_OP.IF_LINE,
  PROG_OP.IF_SENSOR, PROG_OP.REPEAT_UNTIL_SENSOR, PROG_OP.IF_IGUAL, PROG_OP.REPEAT_UNTIL_IGUAL];
export const progIgual = (sensor, valor) => ((sensor & 15) << 12) | (Math.max(0, Math.min(4095, Math.round(valor))));
// sensores dos blocos de cenário: luz 0..255 (mais = mais claro), sonar em cm, fim de curso/botão 0 ou 1
// LUZ_DIF = 1024 + (esquerda − direita): o girassol compara os dois olhos
// módulos: TECLA = a tecla apertada (1..8, a menor; 0 = nenhuma) · TEMP = °C × 10 + 400 · UMID = % · COR = COR_CLASSE
export const PROG_SENSOR = { LUZ_E: 0, LUZ_D: 1, DIST: 2, FIM_E: 3, FIM_D: 4, LUZ_DIF: 5, TECLA: 6, TEMP: 7, UMID: 8, COR: 9 };
export const progServo = (servo, angulo) => ((servo & 0xff) << 8) | (angulo === null ? 255 : Math.max(0, Math.min(180, Math.round(angulo))));
export const SHOW = { SENSOR: 0, CARA: 1, LIMPA: 2 };
export const progShow = (tipo, valor = 0, sensor = 0) => ((tipo & 15) << 12) | ((sensor & 15) << 8) | (valor & 0xff);
// carinhas da telinha (o bichinho, o pet do Eco…)
export const CARAS = ['feliz', 'triste', 'surpreso', 'dormindo', 'bravo', 'apaixonado'];
// cor que o sensor de cor viu (o Eco classifica): 0 = outra/nada
export const COR_CLASSE = { OUTRA: 0, VERMELHO: 1, VERDE: 2, AZUL: 3, AMARELO: 4, BRANCO: 5, PRETO: 6 };
export const COR_CLASSE_NOMES = ['outra', 'vermelho', 'verde', 'azul', 'amarelo', 'branco', 'preto'];
// argumento: sensor (bits 12-15), 1 = "acima de" (bit 11), valor 0..2047 (bits 0-10)
export const progSensor = (sensor, acima, valor) => ((sensor & 15) << 12) | (acima ? 0x800 : 0) | (Math.max(0, Math.min(2047, Math.round(valor))));
export const deProgSensor = (arg) => ({ sensor: arg >> 12, acima: !!(arg & 0x800), valor: arg & 0x7ff });
export const progMotor = (porta, vel) => ((porta & 0xff) << 8) | (Math.max(-100, Math.min(100, Math.round(vel))) & 0xff);
export const progLuz = (porta, cor, brilho) => ((porta & 15) << 12) | ((cor & 15) << 8) | Math.max(0, Math.min(100, Math.round(brilho)));
// cores do SET_LIGHT (o LED comum usa só o brilho)
export const PROG_CORES = [[255, 255, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 200, 0], [255, 100, 0], [160, 0, 255], [255, 80, 160], [0, 220, 255]];
export const PROG_COR_NOMES = ['branco', 'vermelho', 'verde', 'azul', 'amarelo', 'laranja', 'roxo', 'rosa', 'ciano'];
export const PROG_MAX = 64; // instruções
export const PROG_PART = 60; // instruções por pacote (180 bytes)
// AUTO (só nos cenários maquete): roda sem o app e fica gravado no Eco (liga sozinho ao ligar); STOP apaga
export const PROG_CMD = { STOP: 0, RUN: 1, AUTO: 2 };
// Estado no PROG_STATUS. ERROR traz o motivo: PROG_ERR
export const PROG_STATE = { IDLE: 0, RUNNING: 1, DONE: 2, STOPPED: 3, ERROR: 4 };
export const PROG_ERR = { NONE: 0, INVALID: 1, NO_SONAR: 2, NO_LIGHT: 3, LINK_LOST: 4, NO_PROGRAM: 5 };

// ---------- Diagnóstico e registro de erros ----------
// DIAG: testes de fábrica/suporte. O Eco responde DIAG_RESULT (ok: 1 passou, 0 falhou, 2 = alguém
// precisa olhar e confirmar, ex.: LEDs sem IMU). LOG_READ responde LOG com os últimos eventos gravados.
export const DIAG_TEST = { MOTOR_LEFT: 1, MOTOR_RIGHT: 2, LEDS: 3, BUZZER: 4, SENSORS: 5, LOG_READ: 6, LOG_CLEAR: 7 };
export const DIAG_OK = { FAIL: 0, PASS: 1, LOOK: 2, NA: 3 }; // NA: a placa não tem isso (ex.: a ECOplus não mede a tensão)
// Tipos de evento do registro (LOG). arg depende do tipo.
export const LOG_EVENT = {
  BOOT: 1, // arg: motivo do reinício (RESET_REASON)
  BROWNOUT: 2, // a tensão caiu e o ESP32 reiniciou
  FAILSAFE: 3, // perdeu o app andando
  LOW_BATTERY: 4,
  BUMP: 5,
  OTA_OK: 6,
  OTA_FAIL: 7,
  PROG_ERROR: 8, // arg: PROG_ERR
  EXP_FAULT: 9, // ligação errada na porta de expansão (barramento I2C preso)
  PECA: 10, // conferência das peças: arg = peça (índice em PECAS) × 8 + estado (PECA_ST)
  STALL: 11, // roda travada: arg = 0 esquerda, 1 direita (o motor parou para se proteger)
};
export const RESET_REASON = { POWER_ON: 1, BROWNOUT: 2, SOFTWARE: 3, WATCHDOG: 4, OTHER: 5 };
export const LOG_MAX = 24;

export const NO_DISTANCE = 0xffff;
export const NAME_MAX_BYTES = 20;
export const TOKEN_BYTES = 8;
export const DRIVE_INTERVAL_MS = 50;

export const MELODIES = [
  { id: 1, name: 'Fanfarra', icon: '🎺' },
  { id: 2, name: 'La Cucaracha', icon: '🎶' },
  { id: 3, name: 'Brilha estrelinha', icon: '⭐' },
  { id: 4, name: 'Parabéns', icon: '🎂' },
];

export const CAR_COLORS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#fb8c00', '#00acc1', '#ec407a'];

export const DEFAULT_CONFIG = {
  maxSpeed: 60, // % da velocidade total (10..100)
  accel: 2, // 1 suave, 2 normal, 3 rápida
  autoBrake: true,
  brakeDist: 30, // cm (5..60): onde o freio anti-colisão começa (mais cedo quando está rápido)
  autoSignal: false,
  reverseBeep: true,
  ledBrightness: 40, // % (5..100)
  ownerLock: false, // só o celular dono conecta
  silent: false, // sem buzina, músicas e bipes
};

// Calibração automática: o que está ligado (byte "auto" do CALIB)
// GYRO: com o IMU, corrige a direção andando reto (e aprende o alinhamento) e faz giros exatos
// SONAR: aprende a velocidade real andando reto em direção a algo que o sonar enxerga (opcional)
// RESET: só no CALIB enviado pelo app: zera o que foi aprendido
export const CALIB_AUTO = { GYRO: 1, SONAR: 2, RESET: 128 };

// Calibração do Eco (gravada nele). A manual vale sempre; a automática corrige o que sobrar.
export const DEFAULT_CALIB = {
  trim: 0, // -25..25: >0 freia o motor esquerdo (carro puxava para a direita), <0 freia o direito
  wheelMm: 65, // diâmetro da roda
  rpm: 190, // rotação da roda com PWM 100% em 5 V
  trackMm: 130, // distância entre as rodas
  distAdj: 100, // % — "pedi 50 cm, andou 45" -> 90
  turnAdj: 100, // % — mesmo para os giros
  auto: CALIB_AUTO.GYRO, // correções automáticas ligadas
  learnTrim: 0, // alinhamento aprendido pelo giroscópio (somado ao trim), -25..25 em passos de 0,5
  learnSpeed: 100, // % da velocidade calculada que o Eco anda de verdade (aprendido pelo sonar)
};

// ID de 16 bits (no ESP32 vem dos 2 últimos bytes do endereço MAC)
export const formatCarId = (id) => id.toString(16).toUpperCase().padStart(4, '0');
// o kit é o Eco: nome de fábrica "Eco 3F2A". Antes era "Carrinho 3F2A" (nomeAntigo): quem ainda tem o nome antigo de
// fábrica passa para o novo sozinho (carcore.js / carcore.cpp); um nome dado pelo técnico fica como está
export const defaultCarName = (id) => `Eco ${formatCarId(id)}`;
export const nomeAntigo = (id) => `Carrinho ${formatCarId(id)}`;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const toI8 = (v) => clamp(Math.round(v), -100, 100) & 0xff;
const fromI8 = (b) => (b << 24) >> 24;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Corta o nome em NAME_MAX_BYTES sem quebrar caracteres acentuados no meio
function nameBytes(name) {
  const out = [];
  for (const ch of String(name ?? '')) {
    const b = textEncoder.encode(ch);
    if (out.length + b.length > NAME_MAX_BYTES) break;
    out.push(...b);
  }
  return out;
}

const bool = (v, fallback) => (v === undefined ? fallback : !!v);

export function sanitizeConfig(c = {}) {
  const d = DEFAULT_CONFIG;
  return {
    maxSpeed: clamp(Math.round(num(c.maxSpeed, d.maxSpeed)), 10, 100),
    accel: clamp(Math.round(num(c.accel, d.accel)), 1, 3),
    autoBrake: bool(c.autoBrake, d.autoBrake),
    brakeDist: clamp(Math.round(num(c.brakeDist, d.brakeDist)), 5, 60),
    autoSignal: bool(c.autoSignal, d.autoSignal),
    reverseBeep: bool(c.reverseBeep, d.reverseBeep),
    ledBrightness: clamp(Math.round(num(c.ledBrightness, d.ledBrightness)), 5, 100),
    ownerLock: bool(c.ownerLock, d.ownerLock),
    silent: bool(c.silent, d.silent),
  };
}

const CONFIG_BYTES = 9;

function configBytes(config) {
  const c = sanitizeConfig(config);
  return [c.maxSpeed, c.accel, +c.autoBrake, c.brakeDist, +c.autoSignal, +c.reverseBeep, c.ledBrightness, +c.ownerLock, +c.silent];
}

function configFrom(b, o) {
  return sanitizeConfig({
    maxSpeed: b[o], accel: b[o + 1], autoBrake: b[o + 2], brakeDist: b[o + 3],
    autoSignal: b[o + 4], reverseBeep: b[o + 5], ledBrightness: b[o + 6], ownerLock: b[o + 7], silent: b[o + 8],
  });
}

export function sanitizeCalib(c = {}) {
  const d = DEFAULT_CALIB;
  return {
    trim: clamp(Math.round(num(c.trim, d.trim)), -25, 25),
    wheelMm: clamp(Math.round(num(c.wheelMm, d.wheelMm)), 20, 200),
    rpm: clamp(Math.round(num(c.rpm, d.rpm)), 30, 1000),
    trackMm: clamp(Math.round(num(c.trackMm, d.trackMm)), 50, 250),
    distAdj: clamp(Math.round(num(c.distAdj, d.distAdj)), 50, 150),
    turnAdj: clamp(Math.round(num(c.turnAdj, d.turnAdj)), 50, 150),
    auto: Math.round(num(c.auto, d.auto)) & (CALIB_AUTO.GYRO | CALIB_AUTO.SONAR),
    learnTrim: clamp(Math.round(num(c.learnTrim, d.learnTrim) * 2) / 2, -25, 25),
    learnSpeed: clamp(Math.round(num(c.learnSpeed, d.learnSpeed)), 50, 150),
  };
}

// Calibração que vale de fato: a manual + o que foi aprendido (se o aprendizado estiver ligado)
export function effectiveCalib(c, hasImu = true) {
  const gyro = hasImu && c.auto & CALIB_AUTO.GYRO;
  const sonar = c.auto & CALIB_AUTO.SONAR;
  return {
    ...c,
    trim: c.trim + (gyro ? c.learnTrim : 0),
    distAdj: sonar ? (c.distAdj * c.learnSpeed) / 100 : c.distAdj,
  };
}

const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
const u16 = (v) => [v & 0xff, (v >> 8) & 0xff];
const readU32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

// CRC-32 (o mesmo do zlib/esp_rom_crc32_le) para conferir o firmware recebido
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---------- app -> carro ----------

export function encodeDrive({ seq, left, right, flags }) {
  return Uint8Array.of(MSG.DRIVE, seq & 0xff, toI8(left), toI8(right), flags & 0xff);
}

// Motor ligado ao contrário, sem como trocar os fios: /app/?inverte=e (esquerdo), d (direito) ou ed (os dois).
// Só vale para o que o app dirige: programas e seguidor rodam no Eco e não passam por aqui.
export function inverteMotores(left, right, qual = '') {
  return [qual.includes('e') ? -left : left, qual.includes('d') ? -right : right];
}

// Com um motor invertido pelo app, o Eco vê um giro e o freio automático dele não dispara: o app aplica a mesma regra
// (bloqueia ir para a frente perto do obstáculo; girar e dar ré continuam livres).
export function freioNoApp(left, right, distCm, limiteCm) {
  if (distCm === NO_DISTANCE || distCm >= limiteCm || left + right <= 0) return [left, right];
  return [Math.min(left, 0), Math.min(right, 0)];
}

export function decodeDrive(b) {
  return { seq: b[1], left: fromI8(b[2]), right: fromI8(b[3]), flags: b[4] };
}

export function encodeConfig(config) {
  return Uint8Array.of(MSG.CONFIG, ...configBytes(config));
}

export function decodeConfig(b) {
  return configFrom(b, 1);
}

// dance: o Eco acende as luzes no ritmo da música (bit 7 do id)
export function encodeMelody(id, dance = false) {
  return Uint8Array.of(MSG.MELODY, (id & 0x7f) | (dance ? 0x80 : 0));
}

export function decodeMelody(b) {
  return { id: b[1] & 0x7f, dance: !!(b[1] & 0x80) };
}

// CALIB (app -> carro, grava) e CALIB_INFO (carro -> app) têm o mesmo corpo.
// Bytes 9-10 (aprendidos) só valem do carro para o app; reset = CALIB com o bit RESET no byte "auto".
// AJUSTE / AJUSTE_INFO: o que se acerta na página de ajustes do app, gravado no Eco.
// giroForca: força máxima girando no lugar (%) · giroMin: a mínima, que vence o atrito (%) · partida: força total por
// partida × 10 ms quando um motor sai do parado (motor fraco que não arranca) · motorModo: como o PWM aciona o motor
// (MOTOR_MODO; só a HAL do protótipo usa). O padrão é o de sempre; o protótipo de bancada tem o dele (firmware).
export const AJUSTE_BYTES = 5;
export const MOTOR_MODO = { ATUAL: 0, FORTE: 1, SILENCIOSO: 2 }; // 1 kHz fast decay · 1 kHz slow decay · 20 kHz slow decay
export const AJUSTE_PADRAO = { giroForca: 45, giroMin: 10, partida: 0, motorModo: MOTOR_MODO.ATUAL };
export function normalizeAjuste(a = {}) {
  const giroForca = clamp(Math.round(num(a.giroForca, AJUSTE_PADRAO.giroForca)), 20, 100);
  return {
    giroForca,
    giroMin: clamp(Math.round(num(a.giroMin, AJUSTE_PADRAO.giroMin)), 10, giroForca),
    partida: clamp(Math.round(num(a.partida, AJUSTE_PADRAO.partida)), 0, 30),
    motorModo: clamp(Math.round(num(a.motorModo, AJUSTE_PADRAO.motorModo)), 0, 2),
  };
}
export function encodeAjuste(a, type = MSG.AJUSTE) {
  const n = normalizeAjuste(a);
  return Uint8Array.of(type, n.giroForca, n.giroMin, n.partida, n.motorModo);
}
export const decodeAjuste = (b) => normalizeAjuste({ giroForca: b[1], giroMin: b[2], partida: b[3], motorModo: b[4] });

export function encodeCalib(calib, type = MSG.CALIB, reset = false) {
  const c = sanitizeCalib(calib);
  return Uint8Array.of(
    type, c.trim & 0xff, c.wheelMm, c.rpm & 0xff, c.rpm >> 8, c.trackMm, c.distAdj, c.turnAdj,
    c.auto | (reset ? CALIB_AUTO.RESET : 0), Math.round(c.learnTrim * 2) & 0xff, c.learnSpeed,
  );
}

export function decodeCalib(b) {
  const long = b.length >= 11; // firmware 0.3 e anteriores: 8 bytes, sem calibração automática
  return {
    ...sanitizeCalib({
      trim: fromI8(b[1]), wheelMm: b[2], rpm: b[3] | (b[4] << 8), trackMm: b[5], distAdj: b[6], turnAdj: b[7],
      auto: long ? b[8] : 0, learnTrim: long ? fromI8(b[9]) / 2 : 0, learnSpeed: long ? b[10] : 100,
    }),
    reset: long && !!(b[8] & CALIB_AUTO.RESET),
  };
}

// TURN: gira deg graus (+ = direita) medindo com o giroscópio; o Eco responde TURN_DONE
export function encodeTurn(id, deg, speed) {
  const d = clamp(Math.round(deg), -32000, 32000);
  return Uint8Array.of(MSG.TURN, id & 0xff, d & 0xff, (d >> 8) & 0xff, clamp(Math.round(speed), 10, 100));
}

export function decodeTurn(b) {
  return { id: b[1], deg: ((b[2] | (b[3] << 8)) << 16) >> 16, speed: clamp(b[4] || 50, 10, 100) };
}

// ---------- Programas ----------

// PROG_LOAD: um pedaço do programa. part = 0..parts-1; o Eco confirma com PROG_ACK
export function encodeProgLoad(id, part, parts, instrs) {
  const out = new Uint8Array(4 + instrs.length * 3);
  out.set([MSG.PROG_LOAD, id & 0xff, part, parts]);
  instrs.forEach(([op, arg], i) => out.set([op, arg & 0xff, (arg >> 8) & 0xff], 4 + i * 3));
  return out;
}

export function decodeProgLoad(b) {
  const instrs = [];
  for (let o = 4; o + 2 < b.length; o += 3) instrs.push([b[o], b[o + 1] | (b[o + 2] << 8)]);
  return { id: b[1], part: b[2], parts: b[3], instrs };
}

// ok: o pedaço chegou; no último, ok = 0 se o programa é inválido (blocos sem fechar, grande demais)
export const encodeProgAck = (id, part, ok) => Uint8Array.of(MSG.PROG_ACK, id & 0xff, part, ok ? 1 : 0);
export const decodeProgAck = (b) => ({ id: b[1], part: b[2], ok: !!b[3] });

export const encodeProgRun = (id, cmd, speed = 50) => Uint8Array.of(MSG.PROG_RUN, id & 0xff, cmd, clamp(Math.round(speed), 10, 100));
export const decodeProgRun = (b) => ({ id: b[1], cmd: b[2], speed: clamp(b[3] || 50, 10, 100) });

// PROG_STATUS: a cada troca de bloco e no fim. pc = índice do bloco
export const encodeProgStatus = (id, state, pc, err = 0) => Uint8Array.of(MSG.PROG_STATUS, id & 0xff, state, pc & 0xff, err);
export const decodeProgStatus = (b) => ({ id: b[1], state: b[2], pc: b[3], err: b[4] ?? 0 });

// ---------- Diagnóstico e registro ----------

export const encodeDiag = (test, arg = 0) => Uint8Array.of(MSG.DIAG, test, arg & 0xff);
export const decodeDiag = (b) => ({ test: b[1], arg: b[2] ?? 0 });

// value: int16 (ex.: graus que girou no teste do motor, medido pelo giroscópio)
export function encodeDiagResult(test, ok, value = 0) {
  const v = clamp(Math.round(value), -32000, 32000);
  return Uint8Array.of(MSG.DIAG_RESULT, test, ok, v & 0xff, (v >> 8) & 0xff);
}
export const decodeDiagResult = (b) => ({ test: b[1], ok: b[2], value: ((b[3] | (b[4] << 8)) << 16) >> 16 });

// LOG: contadores gerais + os últimos eventos (o mais novo por último)
// [0x8B, boots u16, brownouts u16, failsafes u16, lowBattery u16, n, n × (tipo, arg, boot u16, segundos u16)]
export function encodeLog({ boots, brownouts, failsafes, lowBattery, events }) {
  const ev = events.slice(-LOG_MAX);
  const out = [MSG.LOG, ...u16(boots), ...u16(brownouts), ...u16(failsafes), ...u16(lowBattery), ev.length];
  for (const e of ev) out.push(e.type, e.arg & 0xff, ...u16(e.boot), ...u16(Math.min(65535, Math.round(e.s))));
  return Uint8Array.from(out);
}

export function decodeLog(b) {
  const r16 = (o) => b[o] | (b[o + 1] << 8);
  const n = b[9] ?? 0;
  const events = [];
  for (let k = 0, o = 10; k < n && o + 5 < b.length + 1; k++, o += 6) {
    events.push({ type: b[o], arg: b[o + 1], boot: r16(o + 2), s: r16(o + 4) });
  }
  return { boots: r16(1), brownouts: r16(3), failsafes: r16(5), lowBattery: r16(7), events };
}

// ok = 0: o giro foi interrompido (failsafe, outro comando)
export function encodeTurnDone(id, deg, ok) {
  const d = clamp(Math.round(deg), -32000, 32000);
  return Uint8Array.of(MSG.TURN_DONE, id & 0xff, d & 0xff, (d >> 8) & 0xff, ok ? 1 : 0);
}

export function decodeTurnDone(b) {
  return { id: b[1], deg: ((b[2] | (b[3] << 8)) << 16) >> 16, ok: !!b[4] };
}

// versão [major, minor] e assinatura (64 bytes) do firmware assinado (app/js/ed25519.js): o Eco confere no fim
export function encodeOtaBegin(size, crc, version, signature) {
  return Uint8Array.of(MSG.OTA_BEGIN, ...u32(size), ...u32(crc), version[0], version[1], ...signature);
}

export function decodeOtaBegin(b) {
  const signed = b.length >= 75;
  return { size: readU32(b, 1), crc: readU32(b, 5), version: signed ? [b[9], b[10]] : null, signature: signed ? b.slice(11, 75) : null };
}

// ack = true no último pacote de cada janela: o Eco responde com OTA_STATUS
export function encodeOtaData(offset, data, ack) {
  const out = new Uint8Array(6 + data.length);
  out.set([MSG.OTA_DATA, ack ? 1 : 0, ...u32(offset)]);
  out.set(data, 6);
  return out;
}

export function decodeOtaData(b) {
  return { ack: !!(b[1] & 1), offset: readU32(b, 2), data: b.subarray(6) };
}

// ECOcontroller pareado, pelo Eco (documentos/controle.md): mac em hexadecimal, igual ao do rádio
export const REMOTE_INFO_BYTES = 12;
export const encodeRemoteInfo = ({ mac, fw, board, opts = 0, battery = 100 }) => Uint8Array.of(MSG.REMOTE_INFO, ...String(mac).match(/../g).map((h) => parseInt(h, 16)), fw[0], fw[1], board, opts, battery);
export const decodeRemoteInfo = (b) => ({
  mac: Array.from(b.subarray(1, 7), (x) => x.toString(16).padStart(2, '0')).join('').toUpperCase(),
  fw: [b[7], b[8]], board: b[9], opts: b[10], battery: b[11],
});
export const encodeRemoteCmd = (msg) => Uint8Array.of(MSG.REMOTE_CMD, ...msg);
export const encodeRemoteReply = (msg) => Uint8Array.of(MSG.REMOTE_REPLY, ...msg);

export const encodeOtaEnd = () => Uint8Array.of(MSG.OTA_END);
export const encodeOtaAbort = () => Uint8Array.of(MSG.OTA_ABORT);

export function encodeOtaStatus(code, offset, reason = OTA_REASON.NONE) {
  return Uint8Array.of(MSG.OTA_STATUS, code, ...u32(offset), reason);
}

export function decodeOtaStatus(b) {
  return { code: b[1], offset: readU32(b, 2), reason: b[6] ?? OTA_REASON.NONE };
}

export function encodeIdentity({ name, color }) {
  return Uint8Array.of(MSG.IDENTITY, color & 0xff, ...nameBytes(name));
}

export function decodeIdentity(b) {
  return { color: b[1] % CAR_COLORS.length, name: textDecoder.decode(b.subarray(2, 2 + NAME_MAX_BYTES)) };
}

// HELLO: primeira mensagem após conectar. O token identifica este celular (modo dono).
export function encodeHello(token) {
  return Uint8Array.of(MSG.HELLO, ...token.subarray(0, TOKEN_BYTES));
}

export function decodeHello(b) {
  return { token: b.slice(1, 1 + TOKEN_BYTES) };
}

export function encodeIdentify() {
  return Uint8Array.of(MSG.IDENTIFY);
}

// speed: velocidade de base do seguidor, % (10..100). laps: voltas até parar na faixa de chegada (1..9)
export function encodeLine({ cmd, speed = 40, flags = 0, laps = 1 }) {
  return Uint8Array.of(MSG.LINE, cmd & 0xff, clamp(Math.round(speed), 10, 100), flags & 0xff, clamp(Math.round(laps), 1, 9));
}

export function decodeLine(b) {
  return { cmd: b[1], speed: clamp(b[2] || 40, 10, 100), flags: b[3] ?? 0, laps: clamp(b[4] || 1, 1, 9) };
}

// LINE_LAP: completou uma volta (que não é a última). ms = tempo desde o começo, pelo relógio do Eco
export const encodeLineLap = (lap, ms) => Uint8Array.of(MSG.LINE_LAP, lap, ...u32(Math.max(0, Math.round(ms))));
export const decodeLineLap = (b) => ({ lap: b[1], ms: readU32(b, 2) });

// LESSON (app -> carro): grava o tipo de aula padrão deste Eco (o técnico escolhe; vale fora de uma aula).
// Sem corpo = só pedir o atual. O Eco responde LESSON_INFO (também logo depois do HELLO).
export const encodeLesson = (lesson) => Uint8Array.of(MSG.LESSON, ...(lesson ? lessonToBytes(lesson) : []));
export const encodeLessonInfo = (lesson) => Uint8Array.of(MSG.LESSON_INFO, ...lessonToBytes(lesson));
export const LESSON_MSG_BYTES = 1 + LESSON_BYTES;
export const decodeLesson = (b) => lessonFromBytes(b, 1);

// ---------- Sala pela ECObase (o celular não precisa de rede) ----------
// CLASS_UP / CLASS_DOWN: pedaços das mensagens da sala (o mesmo JSON do Wi-Fi), [tipo, seq, parte, partes, dados...]
// (app/js/air.js: chunkText e Reassembler). O carro só repassa para a base / para o app.
// BASE_INFO (carro -> app): [0x8F, situação, kit u32] — a sala chega por este Eco?
export const BASE_STATUS = { NONE: 0, LOST: 1, ONLINE: 2 }; // sem base · base vinculada mas fora de alcance · na sala

export const encodeLedInfo = (kinds) => Uint8Array.of(MSG.LED_INFO, ...kinds.slice(0, 4));
export const decodeLedInfo = (b) => [...b.subarray(1, 5)];

export function encodeExpInfo(flags, addrs = []) {
  return Uint8Array.of(MSG.EXP_INFO, flags, addrs.length, ...addrs);
}

export function decodeExpInfo(b) {
  const n = Math.min(b[2] ?? 0, b.length - 3);
  return { wired: !!(b[1] & EXP_FLAG.WIRED), fault: !!(b[1] & EXP_FLAG.FAULT), addrs: [...b.subarray(3, 3 + n)] };
}

export function encodeBaseInfo(status, kit = 0) {
  return Uint8Array.of(MSG.BASE_INFO, status, ...u32(kit));
}
export const decodeBaseInfo = (b) => ({ status: b[1], kit: readU32(b, 2) });

// ---------- carro -> app ----------

// linkRx: quantos DRIVE o Eco recebeu no último segundo (o esperado é 20)
// line: { port, phase, see: [esq, dir], light: [esq, dir] } (porta de sensor e seguidor de linha)
export function encodeState({ status, lights, left, right, distance, vbus, linkRx, line = null }) {
  const l = line ?? { port: PORT.NONE, phase: LINE_PHASE.OFF, see: [false, false], light: [0, 0] };
  const lineByte = (l.port & 3) | ((l.phase & 7) << 2) | (l.see[0] ? 32 : 0) | (l.see[1] ? 64 : 0);
  return Uint8Array.of(
    MSG.STATE, status & 0xff, lights & 0xff, toI8(left), toI8(right),
    distance & 0xff, (distance >> 8) & 0xff, vbus & 0xff, (vbus >> 8) & 0xff, Math.min(255, linkRx),
    lineByte, clamp(Math.round(l.light[0]), 0, 255), clamp(Math.round(l.light[1]), 0, 255),
  );
}

export function decodeState(b) {
  const lb = b[10] ?? 0; // firmware antigo (STATE de 10 bytes): sem porta de sensor
  return {
    status: b[1],
    lights: b[2],
    left: fromI8(b[3]),
    right: fromI8(b[4]),
    distance: b[5] | (b[6] << 8),
    vbus: b[7] | (b[8] << 8),
    linkRx: b[9],
    line: { port: lb & 3, phase: (lb >> 2) & 7, see: [!!(lb & 32), !!(lb & 64)], light: [b[11] ?? 0, b[12] ?? 0] },
  };
}

// LINE_RESULT: a corrida acabou. ms = tempo seguindo a linha, medido pelo relógio do Eco
export function encodeLineResult(code, ms) {
  return Uint8Array.of(MSG.LINE_RESULT, code & 0xff, ...u32(Math.max(0, Math.round(ms))));
}

export function decodeLineResult(b) {
  return { code: b[1], ms: readU32(b, 2) };
}

export const INFO_MIN_BYTES = 7 + CONFIG_BYTES;

export function encodeInfo({ fw, id, flags, color, config, name }) {
  return Uint8Array.of(MSG.INFO, fw[0], fw[1], id & 0xff, (id >> 8) & 0xff, flags & 0xff, color & 0xff, ...configBytes(config), ...nameBytes(name));
}

export function decodeInfo(b) {
  return {
    fw: [b[1], b[2]],
    id: b[3] | (b[4] << 8),
    flags: b[5],
    color: b[6] % CAR_COLORS.length,
    config: configFrom(b, 7),
    name: textDecoder.decode(b.subarray(INFO_MIN_BYTES)),
  };
}

export function encodeDenied() {
  return Uint8Array.of(MSG.DENIED);
}
