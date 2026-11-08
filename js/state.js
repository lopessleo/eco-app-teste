import * as P from './protocol.js';
import { NO_POLICY } from './classroom.js';
import { DEFAULT_LESSON } from './lesson.js';

// Estado compartilhado entre os módulos do app (o que vem do Eco, da sala e da conexão)
// e um "rádio" de eventos: quem recebe mensagens do Eco avisa, e cada módulo escuta só o que precisa.
// Assim um módulo pode mudar ou sair sem quebrar os outros.

export const S = {
  transport: null, // conexão com o Eco (Bluetooth ou emulador)
  car: null, // INFO recebido do Eco
  caps: null, // CAPS: versão da placa e o que ela tem ({ board, caps }); null = Eco antigo, com tudo
  pecas: null, // PORTS_INFO: o que o Eco percebeu em cada peça (P.PECAS -> P.PECA_ST)
  portCurrent: null, // PORT_CURRENT (ECOpro): corrente das portas de LED e dos motores
  ledProfile: null, // PORT_PROFILE_INFO: perfil dos módulos de LED
  encoder: null, // ENC_INFO: encoder das portas de motor (ECOpro)
  scene: null, // SCENE_INFO: cenário atual, liberados no kit e disponíveis nesta placa (documentos/cenarios.md)
  sensores: null, // SENSORS (fora do cenário carrinho): luz, sonar, fim de curso, encoder, giro
  calib: { ...P.DEFAULT_CALIB }, // calibração recebida do Eco
  carState: null, // último STATE
  carLesson: null, // tipo de aula padrão gravado no Eco (LESSON_INFO)
  baseStatus: P.BASE_STATUS.NONE, // a sala chega por este Eco (ECObase)? BASE_INFO
  baseKit: 0,
  lesson: { ...DEFAULT_LESSON }, // tipo de aula que vale agora (do professor, ou o do Eco fora da aula)
  upload: null, // atualização de firmware em andamento
  rcUpload: null, // atualização do ECOcontroller pelo Eco em andamento
  remoteInfo: null, // ECOcontroller pareado: { mac, fw, board, opts, battery, at }
  testUntil: 0, // teste "andar reto" da calibração
  classLink: null, // sala de aula
  policy: { ...NO_POLICY }, // comandos do professor em vigor
  signalBars: 0, // qualidade do sinal (0..4)
};

// O que um módulo de função oferece aos outros (api.programa, api.seguidor, api.pecas...). Quem usa chama
// api.x?.y(): sem o módulo, a chamada não faz nada — tirar um módulo não quebra os outros (tests/unit/modulos.test.mjs).
export const api = {};

export const lights = { headlight: false, left: false, right: false, hazard: false, police: false };

// Números para o professor, acumulados entre um envio de telemetria e outro
export const classDelta = { connMs: 0, driveMs: 0, distM: 0, horns: 0 };

// A placa tem o giroscópio? (o IMU é opcional na produção; o Eco avisa no INFO)
export const hasImu = () => !!(S.car && S.car.flags & P.INFO_FLAG.IMU);
// A placa tem esse recurso (P.CAP)? Sem CAPS (firmware antigo, protótipo) vale o que sempre teve: tudo
export const temCap = (cap) => !S.caps || !!(S.caps.caps & cap);
// recursos da placa usados nas telas: data-cap="signals" some na placa que não tem setas
export const CAP_DA_TELA = { signals: P.CAP.SIGNALS, voltage: P.CAP.VOLTAGE, dimmer: P.CAP.DIMMER, leds: P.CAP.LEDS, line: P.CAP.LINE };
// Calibração que vale: a manual + o que o Eco aprendeu
export const effCalib = () => P.effectiveCalib(S.calib, hasImu());
export const connected = () => !!S.transport?.connected;
export const send = (bytes) => S.transport?.send(bytes);

// ---------- Eventos ----------
// do Eco: 'state', 'info', 'calib', 'carLesson', 'lineResult', 'lineLap', 'turnDone', 'otaStatus', 'denied',
// 'progAck', 'progStatus', 'diagResult', 'log', 'baseInfo', 'classDown', 'caps'; do app: 'connection', 'policy' (policy, anterior), 'lesson',
// 'race', 'setMode', 'teacherMsg', 'teacherProgram'
const handlers = new Map();

export function on(event, fn) {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event).add(fn);
  return () => handlers.get(event).delete(fn);
}

export function emit(event, ...args) {
  for (const fn of handlers.get(event) ?? []) {
    try {
      fn(...args);
    } catch (err) {
      console.error(`erro no evento "${event}":`, err); // um módulo com erro não derruba os outros
    }
  }
}
