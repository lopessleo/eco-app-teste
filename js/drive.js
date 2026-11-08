// Pilotagem: controles de toque e teclado, mistura dos motores, envio do DRIVE, luzes, buzina, música e modos.

import * as P from './protocol.js';
import { Lever, Pedal, SteeringWheel, TiltSensor } from './controls.js';
import { EngineSound } from './engine-sound.js';
import { S, api, classDelta, lights, on, temCap } from './state.js';
import { prefs, savePrefs } from './prefs.js';
import { $, clamp, params, toast, vibrate } from './util.js';

let seq = 0;
let horn = false;
const INVERTE = (params.get('inverte') ?? '').toLowerCase(); // ?inverte=e, d ou ed: motor ligado ao contrário
const FOLGA_FREIO_CM = 10; // o app sabe a distância com atraso: freia um pouco antes do Eco
const TROCA = params.has('troca'); // ?troca=1: motores ligados nos lados trocados (vale antes do inverte)

// ---------- Controles ----------

const WHEEL_SVG = `<svg viewBox="-100 -100 200 200">
  <circle r="86" class="rim"/>
  <path d="M-80 6 H-22 M22 6 H80 M0 28 V84" class="spoke"/>
  <circle r="24" class="hub"/>
  <rect x="-7" y="-98" width="14" height="22" rx="4" class="mark"/>
</svg>`;
$('#wheel').innerHTML = WHEEL_SVG;
$('#tilt-wheel').innerHTML = WHEEL_SVG;

const detent = () => vibrate(8);
const leverL = new Lever($('#lever-l'), { onDetent: detent });
const leverR = new Lever($('#lever-r'), { onDetent: detent });
const wheel = new SteeringWheel($('#wheel'));
export const pedal = new Pedal($('#pedal'), prefs.pedal);
pedal.onDir = () => vibrate(30);
export const tilt = new TiltSensor();
export const engine = new EngineSound();

// Teclado (para testar no PC)
const keys = new Set();
export const key = (code) => (keys.has(code) ? 1 : 0);
addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, select, dialog')) return;
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  const actions = {
    KeyL: () => toggleLight('headlight'),
    KeyQ: () => toggleLight('left'),
    KeyE: () => toggleLight('right'),
    KeyH: () => toggleLight('hazard'),
    KeyG: () => toggleLight('police'),
    Space: () => S.lesson.horn && classDelta.horns++,
    // teclas 1..5: modos (só os que a aula libera)
    Digit1: () => setMode('tank'),
    Digit2: () => setMode('wheel'),
    Digit3: () => setMode('tilt'),
    Digit4: () => setMode('program'),
    Digit5: () => setMode('line'),
    Enter: () => prefs.mode === 'line' && $('#ln-go').click(),
  };
  actions[e.code]?.();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// Modo volante/inclinação: comporta-se como carro (parado, virar o volante não faz nada).
// A roda de dentro da curva desacelera até parar no volante todo virado (sens = 1).
export function mixCar(throttle, steer, sens) {
  const s = clamp(steer, -1, 1) * sens;
  const inner = throttle * (1 - Math.abs(s));
  const left = s > 0 ? throttle : inner; // virando à direita, a roda esquerda é a de fora
  const right = s > 0 ? inner : throttle;
  return [left, right];
}

function computeMotors() {
  if (performance.now() < S.testUntil) return [0.6, 0.6];
  if (prefs.mode === 'program' || prefs.mode === 'line') return [0, 0]; // quem dirige é o programa / o próprio Eco
  if (prefs.mode === 'tank') {
    if (leverL.active || leverR.active) return [leverL.value, leverR.value];
    return [key('KeyW') - key('KeyS'), key('ArrowUp') - key('ArrowDown')];
  }
  let throttle = pedal.value;
  if (!pedal.active) throttle = Math.max(key('ArrowUp'), key('KeyW')) - Math.max(key('ArrowDown'), key('KeyS'));
  const useTilt = prefs.mode === 'tilt' && tilt.available;
  let steer = useTilt ? tilt.value : wheel.value;
  if (!wheel.active && !useTilt) {
    const k = key('ArrowRight') + key('KeyD') - key('ArrowLeft') - key('KeyA');
    if (k) steer = clamp(k, -1, 1);
  }
  return mixCar(throttle, steer, prefs.steerSens / 100);
}

function driveFlags() {
  const F = P.DRIVE_FLAG;
  let f = 0;
  // botões que a aula tirou da tela também não valem pelo teclado
  if (S.lesson.lights) {
    if (lights.headlight) f |= F.HEADLIGHT;
    const setas = temCap(P.CAP.SIGNALS); // a ECOplus não tem setas nem modo polícia (os botões nem aparecem)
    if (lights.left && setas) f |= F.LEFT;
    if (lights.right && setas) f |= F.RIGHT;
    if (lights.hazard) f |= F.HAZARD;
    if (lights.police && setas) f |= F.POLICE;
  }
  if (S.lesson.horn && (horn || keys.has('Space'))) f |= F.HORN;
  return f;
}

// Comandos do professor valem por cima de tudo (pausa, mudo, luzes apagadas, limite de velocidade)
function applyPolicy(left, right, flags) {
  const F = P.DRIVE_FLAG;
  if (S.policy.paused) {
    left = 0;
    right = 0;
    flags &= ~(F.HORN | F.POLICE);
  }
  if (S.policy.muted) flags = (flags & ~F.HORN) | F.MUTE;
  if (S.policy.lightsOff) flags = (flags & (F.HAZARD | F.HORN | F.MUTE)) | F.LIGHTS_OFF;
  const cap = S.policy.maxSpeed / 100;
  return [left * cap, right * cap, flags];
}

setInterval(() => {
  if (!S.transport?.connected || S.upload) return;
  // no modo programação e no seguidor quem dirige é o Eco: o DRIVE vai parado (é o "estou aqui")
  const [l, r] = computeMotors();
  let [left, right, flags] = applyPolicy(l, r, driveFlags());
  if ((INVERTE || TROCA) && S.car?.config.autoBrake !== false && S.carState) {
    [left, right] = P.freioNoApp(left, right, S.carState.distance, (S.car?.config.brakeDist ?? 20) + FOLGA_FREIO_CM);
  }
  const [ml, mr] = P.inverteMotores(TROCA ? right * 100 : left * 100, TROCA ? left * 100 : right * 100, INVERTE);
  S.transport.send(P.encodeDrive({ seq: seq++, left: ml, right: mr, flags }));
}, P.DRIVE_INTERVAL_MS);

// Atualizações visuais contínuas
function frame(now) {
  pedal.update(now);
  if (prefs.mode === 'tilt') $('#tilt-wheel').style.setProperty('--angle', `${(tilt.value * 90).toFixed(1)}deg`);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// O navegador só libera som depois de um toque
document.addEventListener('pointerdown', () => engine.unlock());

// ---------- Botões de luz, buzina e música ----------

const LIGHT_BUTTONS = { left: '#btn-left', headlight: '#btn-head', hazard: '#btn-hazard', right: '#btn-right', police: '#btn-police' };

export function renderToggles() {
  for (const [n, sel] of Object.entries(LIGHT_BUTTONS)) $(sel).classList.toggle('on', lights[n]);
}

function toggleLight(name) {
  lights[name] = !lights[name];
  if (name === 'left' && lights.left) lights.right = false;
  if (name === 'right' && lights.right) lights.left = false;
  vibrate(15);
  renderToggles();
}

for (const [name, sel] of Object.entries(LIGHT_BUTTONS)) $(sel).addEventListener('click', () => toggleLight(name));

const hornBtn = $('#btn-horn');
hornBtn.addEventListener('pointerdown', (e) => {
  hornBtn.setPointerCapture(e.pointerId);
  horn = true;
  hornBtn.classList.add('on');
  vibrate(30);
  classDelta.horns++;
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  hornBtn.addEventListener(ev, () => {
    horn = false;
    hornBtn.classList.remove('on');
  });
}

const musicMenu = $('#music-menu');
$('#dance').checked = prefs.dance;
$('#dance').addEventListener('change', (e) => {
  prefs.dance = e.target.checked;
  savePrefs();
});
for (const m of [...P.MELODIES, { id: 0, name: 'Parar', icon: '⏹️' }]) {
  const b = document.createElement('button');
  b.textContent = `${m.icon} ${m.name}`;
  b.addEventListener('click', () => {
    musicMenu.classList.add('hidden');
    if (!S.lesson.music) return;
    if (S.policy.muted && m.id) return toast('🔇 O professor desligou o som');
    S.transport?.send(P.encodeMelody(m.id, prefs.dance));
    vibrate(15);
  });
  musicMenu.append(b);
}
$('#btn-music').addEventListener('click', (e) => {
  e.stopPropagation();
  musicMenu.classList.toggle('hidden');
});
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('#music-menu, #btn-music')) musicMenu.classList.add('hidden');
});

// ---------- Modos ----------

on('setMode', (m) => setMode(m));
on('lesson', (l) => { engine.enabled = l.engine; });

export function setMode(mode) {
  if (!S.lesson.modes.includes(mode)) return; // a aula não libera esse modo
  if (mode !== 'program') api.programa?.stop();
  if (mode !== 'line' && api.seguidor?.rodando()) api.seguidor.para();
  prefs.mode = mode;
  savePrefs();
  $('#cockpit').dataset.mode = mode;
  for (const b of document.querySelectorAll('.modes button')) b.setAttribute('aria-pressed', b.dataset.mode === mode);
  if (mode === 'tilt') {
    if (!window.isSecureContext) {
      $('#tilt-msg').textContent = 'O sensor de inclinação só funciona em HTTPS. Abra o app pelo endereço https://.';
      return;
    }
    tilt.start()
      .then(() => setTimeout(() => {
        $('#tilt-msg').textContent = tilt.available ? '' : params.has('emu') ? 'No PC: use o controle 📐 Inclinar do emulador (ou ← → no teclado).' : 'Sem sensor de inclinação. No PC use ← → no teclado.';
      }, 600))
      .catch((err) => {
        $('#tilt-msg').textContent = `Sensor indisponível: ${err.message}`;
      });
  }
}
for (const b of document.querySelectorAll('.modes button')) b.addEventListener('click', () => setMode(b.dataset.mode));

export function applyLayoutPrefs() {
  $('#cockpit').classList.toggle('lefty', prefs.lefty);
  pedal.mode = prefs.pedal;
  engine.enabled = S.lesson.engine;
  tilt.maxDeg = prefs.tiltMax;
  tilt.invert = prefs.tiltInvert;
}

$('#btn-calibrate').addEventListener('click', () => {
  tilt.calibrate();
  vibrate(30);
  toast('Centro calibrado');
});
