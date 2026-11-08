// Conexão com o Eco (Bluetooth ou emulador) e troca entre a tela inicial e a de pilotagem.

import * as P from './protocol.js';
import { S, api, emit, on } from './state.js';
import { BleTransport, WsTransport } from './transport.js';
import { onCarMessage as onMessage } from './messages.js';
import { chooseEmulatorCar } from './messages.js';
import { holdButton } from './controls.js';
import { engine, setMode } from './drive.js';
import { applyLesson } from './lesson-ui.js';
import { prefs, savePrefs, token } from './prefs.js';
import { $, toast, vibrate } from './util.js';

// ---------- Conexão ----------

function renderConnection(st) {
  $('#conn-dot').className = `dot ${st}`;
  $('#overlay').classList.toggle('hidden', st === 'connected');
  $('#overlay-text').textContent = S.transport instanceof WsTransport ? 'Aguardando o Eco do emulador…' : 'Reconectando ao Eco…';
  if (st !== 'connected') engine.set(0, false);
}

function onStatus(st) {
  renderConnection(st);
  emit('connection', st);
  if (st === 'connected') {
    S.transport.send(P.encodeHello(token));
    vibrate(40);
    S.classLink?.event('carConnect');
  } else if (st === 'reconnecting') {
    api.programa?.stop();
    vibrate([100, 50, 100]);
    S.classLink?.event('carDrop');
  }
}

async function startTransport(t) {
  S.transport = t;
  t.onmessage = onMessage;
  t.onstatus = onStatus;
  try {
    await t.connect();
  } catch (err) {
    if (S.transport === t) S.transport = null;
    throw err;
  }
  if (S.transport !== t) return; // recusado (dono) durante a conexão
  enterDrive();
  renderConnection(t.status);
}

// Mensagens claras para cada problema de Bluetooth
function bluetoothError(err) {
  const m = err?.message ?? '';
  if (err?.name === 'NotFoundError') {
    if (/cancel/i.test(m)) return '';
    if (/adapter|bluetooth.*(off|disabled|not available)/i.test(m)) return '📴 O Bluetooth do celular está desligado. Ligue e tente de novo.';
    return 'Nenhum Eco encontrado. Ele está ligado e perto do celular?';
  }
  if (err?.name === 'SecurityError' || err?.name === 'NotAllowedError') {
    return '🔐 O Chrome não tem permissão de Bluetooth/localização. Libere nas configurações do Android → Apps → Chrome → Permissões.';
  }
  if (err?.name === 'NetworkError') return 'Não deu para conectar. Chegue mais perto do Eco e tente de novo.';
  if (err?.name === 'NotSupportedError') return 'Este Eco não é compatível com esta versão do app.';
  return `Não foi possível conectar: ${m}`;
}

// dentro do APK (Capacitor): Bluetooth nativo do Android, mais confiável que o do navegador
export const isNativeApp = () => !!globalThis.Capacitor?.isNativePlatform?.();

$('#btn-ble').addEventListener('click', async () => {
  const msg = $('#home-msg');
  engine.unlock();
  if (isNativeApp()) {
    msg.textContent = '';
    try {
      const { NativeBleTransport } = await import('./native-ble.js');
      await startTransport(new NativeBleTransport());
    } catch (err) {
      msg.textContent = /disabled|not enabled|desligado/i.test(err?.message ?? '')
        ? '📴 O Bluetooth do celular está desligado. Ligue e tente de novo.'
        : /permission|permiss/i.test(err?.message ?? '')
          ? '🔐 O app precisa da permissão de "Dispositivos por perto" para achar o Eco. Toque em Permitir.'
          : bluetoothError(err);
    }
    return;
  }
  if (!BleTransport.supported) {
    msg.textContent = /iPhone|iPad/.test(navigator.userAgent)
      ? 'No iPhone, use o navegador Bluefy (o Safari não tem Bluetooth para sites).'
      : 'Este navegador não tem Bluetooth para sites. Use o Chrome no Android.';
    return;
  }
  msg.textContent = '';
  try {
    if ((await navigator.bluetooth.getAvailability?.()) === false) {
      msg.textContent = '📴 O Bluetooth do celular está desligado. Ligue e tente de novo.';
      return;
    }
    await startTransport(new BleTransport());
  } catch (err) {
    msg.textContent = bluetoothError(err);
  }
});

function defaultEmuUrl() {
  if (!location.protocol.startsWith('http')) return 'ws://localhost:8080/ws?role=app';
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?role=app`;
}

$('#emu-url').value = prefs.emuUrl || defaultEmuUrl();

export async function connectEmulator() {
  const url = $('#emu-url').value.trim() || defaultEmuUrl();
  prefs.emuUrl = url === defaultEmuUrl() ? '' : url;
  savePrefs();
  $('#home-msg').textContent = '';
  try {
    await startTransport(new WsTransport(url, chooseEmulatorCar));
  } catch (err) {
    if (err.name !== 'NotFoundError') $('#home-msg').textContent = err.message;
  }
}
$('#btn-emu').addEventListener('click', connectEmulator);

export function enterDrive() {
  $('#home').classList.remove('active');
  $('#drive').classList.add('active');
  document.body.classList.add('driving');
  applyLesson();
  setMode(S.lesson.modes.includes(prefs.mode) ? prefs.mode : S.lesson.modes[0]);
  goFullscreen();
  keepAwake();
}

on('denied', () => {
  leaveDrive();
  $('#home-msg').textContent = '🔒 Este Eco está travado para outro celular. Peça ao professor: '
    + 'segurar o botão da placa por 3 segundos libera.';
  vibrate([200, 100, 200]);
});

export function leaveDrive() {
  api.programa?.stop();
  S.transport?.close();
  S.transport = null;
  S.car = null;
  S.caps = null;
  S.pecas = null;
  S.carState = null;
  S.carLesson = null;
  S.baseStatus = P.BASE_STATUS.NONE;
  applyLesson();
  engine.set(0, false);
  $('#drive').classList.remove('active');
  $('#home').classList.add('active');
  document.body.classList.remove('driving');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
$('#btn-home').addEventListener('click', leaveDrive);
// Sair do Eco: segurar (um toque sem querer no meio da brincadeira não desconecta)
holdButton($('#btn-exit'), 1000, () => {
  leaveDrive();
  toast('Desconectado do Eco');
}, () => toast('Segure para sair do Eco'));

async function goFullscreen() {
  if (window.top !== window) return; // dentro do emulador (iframe)
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    await screen.orientation?.lock?.('landscape');
  } catch {
    // navegador não permitiu: segue sem tela cheia
  }
}

async function keepAwake() {
  try {
    await navigator.wakeLock?.request('screen');
  } catch {
    // sem wake lock (página sem HTTPS, por exemplo)
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && document.body.classList.contains('driving')) keepAwake();
});
