// Estado do Eco na tela da criança: velocímetro, sinal, avisos e os números para o professor.
// As mensagens viram eventos em messages.js.

import * as P from './protocol.js';
import { wheelSpeed } from './program.js';
import { S, classDelta, effCalib, lights, on } from './state.js';
import { engine, renderToggles } from './drive.js';
import { $, clamp, toast, vibrate } from './util.js';

export { onCarMessage as onMessage } from './messages.js';

// Porta de expansão: ligação errada é aviso de segurança (sempre aparece); o controle com fio, só um aviso curto
let prevExp = { wired: false, fault: false };
on('connection', () => { prevExp = { wired: false, fault: false }; });
on('expInfo', (e) => {
  if (e.fault && !prevExp.fault) {
    vibrate([200, 100, 200]);
    toast('⚠️ Tem algo ligado na porta errada do Eco. Tire o cabo e chame o professor.');
  } else if (e.wired && !prevExp.wired) toast('🎮 Controle com fio ligado no Eco');
  prevExp = e;
});

let prevObstacle = false;
let prevBump = false;
let prevLow = false;
const stateTimes = [];

let lastStateAt = 0;
on('connection', () => { lastStateAt = 0; });

function accumulateStats(s) {
  const now = performance.now();
  const dt = lastStateAt ? Math.min(300, now - lastStateAt) : 0;
  lastStateAt = now;
  classDelta.connMs += dt;
  if (Math.abs(s.left) + Math.abs(s.right) > 6) classDelta.driveMs += dt;
  // distância do corpo do Eco (girando no lugar as rodas andam, mas ele não sai do lugar)
  const c = effCalib();
  const vl = Math.sign(s.left) * wheelSpeed(c, Math.abs(s.left) / 100);
  const vr = Math.sign(s.right) * wheelSpeed(c, Math.abs(s.right) / 100);
  classDelta.distM += (Math.abs(vl + vr) / 2) * (dt / 1000);
}

on('state', () => {
  stateTimes.push(performance.now());
  renderState();
});
on('info', () => renderInfo());

function renderState() {
  const s = S.carState;
  const L = P.LIGHT;
  $('#btn-left').classList.toggle('lit', !!(s.lights & L.LEFT));
  $('#btn-right').classList.toggle('lit', !!(s.lights & L.RIGHT));
  $('#btn-hazard').classList.toggle('lit', lights.hazard && !!(s.lights & L.LEFT));
  $('#btn-head').classList.toggle('lit', !!(s.lights & L.HEADLIGHT));
  $('#btn-police').classList.toggle('lit', !!(s.lights & L.POLICE));

  const dist = $('#dist');
  const near = s.distance !== P.NO_DISTANCE && s.distance < (S.car?.config.brakeDist ?? P.DEFAULT_CONFIG.brakeDist) + 15;
  dist.textContent = s.distance === P.NO_DISTANCE ? '📏 — cm' : `📏 ${s.distance} cm`;
  dist.classList.toggle('near', near);
  // sem sonar na porta de sensor (sensores de luz ou vazia): não tem distância para mostrar
  const noSonar = !P.hasSonar(s.line.port) && (P.hasLight(s.line.port) || s.distance === P.NO_DISTANCE);
  dist.classList.toggle('hidden', noSonar);

  // Velocímetro: cheio = velocidade máxima configurada para este Eco
  const avg = (s.left + s.right) / 2;
  const level = clamp((Math.abs(s.left) + Math.abs(s.right)) / 2 / (S.car?.config.maxSpeed ?? 100), 0, 1);
  $('#g-fill').style.strokeDasharray = `${(level * 100).toFixed(1)} 100`;
  $('#g-needle').style.transform = `rotate(${(-90 + level * 180).toFixed(1)}deg)`;
  $('#g-label').textContent = avg < -3 ? 'R' : '';
  $('.gauge').classList.toggle('rev', avg < -3);
  engine.set(level, true);

  autoCancelSignals(s);
  accumulateStats(s);

  const obstacle = !!(s.status & P.STATUS.OBSTACLE);
  if (obstacle && !prevObstacle) {
    vibrate([60, 40, 60]);
    S.classLink?.event('obstacle');
  }
  prevObstacle = obstacle;
  const bump = !!(s.status & P.STATUS.BUMP);
  if (bump && !prevBump) {
    vibrate(120);
    S.classLink?.event('bump');
  }
  prevBump = bump;
  const low = !!(s.status & P.STATUS.LOW_VOLTAGE);
  if (low && !prevLow) S.classLink?.event('lowBattery', { vbus: s.vbus });
  prevLow = low;
  const banner = $('#banner');
  banner.textContent = obstacle ? '🛑 Obstáculo!' : low ? '🪫 Bateria fraca' : '';
  banner.classList.toggle('hidden', !obstacle && !low);
}

// Seta desliga sozinha depois da curva, como num carro de verdade
const turnState = { left: null, right: null };
function autoCancelSignals(s) {
  const now = performance.now();
  const avg = (s.left + s.right) / 2;
  const turn = (s.left - s.right) * (avg < -3 ? -1 : 1); // > 0 = virando para a direita
  for (const side of ['left', 'right']) {
    if (!lights[side]) {
      turnState[side] = null;
      continue;
    }
    const dir = side === 'right' ? turn : -turn;
    const st = turnState[side];
    if (dir > 25) turnState[side] = { turned: true, straightSince: null };
    else if (st?.turned && Math.abs(turn) < 8) {
      st.straightSince ??= now;
      if (now - st.straightSince > 700) {
        lights[side] = false;
        turnState[side] = null;
        renderToggles();
      }
    } else if (st) st.straightSince = null;
  }
}

// Barrinhas de sinal: pacotes que chegam (STATE, 10/s) e que o Eco recebe (DRIVE, 20/s)
setInterval(() => {
  const now = performance.now();
  while (stateTimes.length && now - stateTimes[0] > 1000) stateTimes.shift();
  let bars = 0;
  if (S.transport?.connected && S.carState) {
    const q = Math.min(stateTimes.length / 10, (S.carState.linkRx ?? 20) / 20);
    bars = q > 0.85 ? 4 : q > 0.6 ? 3 : q > 0.3 ? 2 : 1;
  }
  S.signalBars = bars;
  $('#signal').className = `signal s${bars}`;
}, 500);

function renderInfo() {
  $('#car-name').textContent = S.car.name || 'Eco';
  $('#car-color').style.background = P.CAR_COLORS[S.car.color];
}

// Tocar no nome faz o Eco piscar e apitar ("qual é o meu?")
$('#car-id').addEventListener('click', () => {
  if (!S.transport?.connected) return;
  S.transport.send(P.encodeIdentify());
  vibrate(20);
  toast('✨ O Eco está piscando');
});
