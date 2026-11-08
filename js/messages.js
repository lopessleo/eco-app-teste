// Mensagens do Eco -> eventos (state.js). Usado pelo app da criança e pela página do técnico:
// cada mensagem vira um evento, e cada tela escuta só o que precisa.
// Tamanho mínimo de cada uma: mensagem curta demais (firmware antigo/pacote cortado) é ignorada.

import * as P from './protocol.js';
import { S, emit } from './state.js';

const DECODERS = {
  [P.MSG.STATE]: [10, P.decodeState, 'state', (v) => { S.carState = v; }],
  [P.MSG.INFO]: [P.INFO_MIN_BYTES, P.decodeInfo, 'info', (v) => { S.car = v; }],
  [P.MSG.CALIB_INFO]: [8, P.decodeCalib, 'calib', (v) => { S.calib = v; }],
  [P.MSG.LESSON_INFO]: [P.LESSON_MSG_BYTES, P.decodeLesson, 'carLesson', (v) => { S.carLesson = v; }],
  [P.MSG.TURN_DONE]: [5, P.decodeTurnDone, 'turnDone'],
  [P.MSG.OTA_STATUS]: [6, P.decodeOtaStatus, 'otaStatus'],
  [P.MSG.LINE_RESULT]: [6, P.decodeLineResult, 'lineResult'],
  [P.MSG.DENIED]: [1, () => null, 'denied'],
  [P.MSG.PROG_ACK]: [4, P.decodeProgAck, 'progAck'],
  [P.MSG.PROG_STATUS]: [5, P.decodeProgStatus, 'progStatus'],
  [P.MSG.DIAG_RESULT]: [5, P.decodeDiagResult, 'diagResult'],
  [P.MSG.LOG]: [10, P.decodeLog, 'log'],
  [P.MSG.LINE_LAP]: [6, P.decodeLineLap, 'lineLap'],
  [P.MSG.BASE_INFO]: [6, P.decodeBaseInfo, 'baseInfo', (v) => { S.baseStatus = v.status; S.baseKit = v.kit; }],
  [P.MSG.CLASS_DOWN]: [4, (b) => b, 'classDown'],
  [P.MSG.EXP_INFO]: [3, P.decodeExpInfo, 'expInfo', (v) => { S.exp = v; }],
  [P.MSG.LED_INFO]: [5, P.decodeLedInfo, 'ledInfo', (v) => { S.ledKinds = v; }],
  [P.MSG.CAPS]: [4, P.decodeCaps, 'caps', (v) => { S.caps = v; }],
  [P.MSG.PORTS_INFO]: [2, P.decodePortsInfo, 'pecas', (v) => { S.pecas = v; }],
  [P.MSG.PORT_CURRENT]: [13, P.decodePortCurrent, 'portCurrent', (v) => { S.portCurrent = v; }],
  [P.MSG.PORT_PROFILE_INFO]: [5, P.decodePortProfileInfo, 'ledProfile', (v) => { S.ledProfile = v; }],
  [P.MSG.ENC_INFO]: [P.ENC_INFO_BYTES, P.decodeEncInfo, 'encoder', (v) => { S.encoder = v; }],
  [P.MSG.SYS_INFO]: [P.SYS_INFO_BYTES, P.decodeSysInfo, 'sysInfo'],
  [P.MSG.SCENE_INFO]: [P.SCENE_INFO_BYTES, P.decodeSceneInfo, 'sceneInfo', (v) => { S.scene = v; }],
  [P.MSG.SENSORS]: [P.SENSORS_BYTES, P.decodeSensors, 'sensores', (v) => { S.sensores = v; }],
  [P.MSG.REMOTE_INFO]: [P.REMOTE_INFO_BYTES, P.decodeRemoteInfo, 'remoteInfo', (v) => { S.remoteInfo = { ...v, at: Date.now() }; }],
  [P.MSG.REMOTE_REPLY]: [2, (b) => b.subarray(1), 'remoteReply'],
};

export function onCarMessage(b) {
  const d = DECODERS[b[0]];
  if (!d || b.length < d[0]) return;
  const value = d[1](b);
  d[3]?.(value);
  emit(d[2], value, b);
}

// Lista de Ecos do emulador (imita o seletor de dispositivos do Chrome). Precisa do diálogo #picker na página.
export function chooseEmulatorCar(t) {
  const $ = (sel) => document.querySelector(sel);
  const dlg = $('#picker');
  const list = $('#picker-list');
  // ?plateia (apresentação, documentos/apresentacao.md): cada celular da plateia pega um Eco livre sozinho
  const sozinho = new URLSearchParams(location.search).has('plateia');
  return new Promise((resolve) => {
    let feito = false;
    const done = (id) => {
      if (feito) return;
      feito = true;
      t.onlist = null;
      dlg.close();
      resolve(id);
    };
    const render = (cars) => {
      if (sozinho && cars.length) return done(cars[Math.floor(Math.random() * cars.length)].id);
      list.replaceChildren(...cars.map((c) => {
        const b = document.createElement('button');
        const sw = document.createElement('span');
        sw.className = 'swatch';
        sw.style.background = P.CAR_COLORS[c.color % P.CAR_COLORS.length];
        b.append(sw, c.name);
        b.addEventListener('click', () => done(c.id));
        return b;
      }));
      $('#picker-empty').hidden = cars.length > 0;
    };
    t.onlist = render;
    $('#picker-cancel').onclick = () => done(null);
    dlg.oncancel = (e) => {
      e.preventDefault();
      done(null);
    };
    dlg.showModal();
    render(t.cars);
  });
}
