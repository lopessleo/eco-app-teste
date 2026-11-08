// Modo seguidor de linha e competição (lado da criança).

import * as P from './protocol.js';
import { S, api, on } from './state.js';
import { setMode } from './drive.js';
import { prefs } from './prefs.js';
import { $, fmtSec, speedWord, toast, vibrate } from './util.js';

// ---------- Seguidor de linha ----------
// Quem segue a linha é o Eco (o Bluetooth é lento demais para isso); o app só liga, desliga,
// mostra os sensores e o cronômetro. Na competição, a largada e a chegada vêm do professor.

let linePhase = P.LINE_PHASE.OFF;
let lineFollowAt = 0; // performance.now() quando começou a seguir (cronômetro da tela)
let lineSentAt = 0; // START enviado, esperando o Eco começar a calibrar
let lineBest = null; // melhor volta (faixa de chegada) nesta sessão, em ms
let lineHasResult = false; // mostrando o resultado da última corrida
let raceModeBefore = null; // modo da criança antes da competição abrir

export const lineRunning = () => linePhase !== P.LINE_PHASE.OFF || lineSentAt > 0;

function setLineStatus(text) {
  $('#ln-status').textContent = text;
}

function lineOptions() {
  const race = S.policy.race;
  if (race) return { speed: race.speed, strip: race.strip, dark: race.dark, laps: race.laps ?? 1 };
  const l = S.lesson; // fora da competição: o que a aula define
  return { speed: Math.min(l.lineSpeed, S.policy.maxSpeed), strip: l.lineStrip, dark: l.lineDark, laps: 1 };
}

// Devolve null se largou, ou o motivo (código LINE_END, 0 = sem Eco) para avisar o professor
function startLine() {
  if (!S.transport?.connected) {
    toast('Conecte o Eco primeiro');
    return 0;
  }
  if (S.policy.paused) {
    toast('⏸ O professor pausou os Ecos');
    return 0;
  }
  if (S.carState && !P.hasLight(S.carState.line.port)) {
    setLineStatus('🔌 Ligue os sensores de luz na porta de sensor do Eco.');
    return P.LINE_END.NO_SENSOR;
  }
  const o = lineOptions();
  const F = P.LINE_FLAG;
  S.transport.send(P.encodeLine({ cmd: P.LINE_CMD.START, speed: o.speed, flags: (o.dark ? F.DARK : 0) | (o.strip ? F.FINISH_STRIP : 0), laps: o.laps }));
  lapTimes = [];
  $('#ln-laps').textContent = '';
  lineSentAt = performance.now();
  lineHasResult = false;
  $('#ln-time').textContent = fmtSec(0);
  $('#ln-time').classList.remove('done');
  setLineStatus('Calibrando: o Eco rebola para aprender o claro e o escuro…');
  vibrate(30);
  renderLineButton();
  return null;
}

export function stopLine() {
  lineSentAt = 0;
  if (S.transport?.connected) S.transport.send(P.encodeLine({ cmd: P.LINE_CMD.STOP }));
  renderLineButton();
}

function renderLineButton() {
  const running = lineRunning();
  const go = $('#ln-go');
  go.textContent = running ? '⏹ Parar' : '▶ Andar';
  go.classList.toggle('stop', running);
  go.disabled = !S.transport?.connected;
}

$('#ln-go').addEventListener('click', () => {
  if (lineRunning()) stopLine();
  else startLine();
});

on('state', (s) => renderLine(s));
on('lineResult', (r) => onLineResult(r));
// várias voltas (competição): parciais na tela e para o professor
let lapTimes = [];
on('lineLap', ({ lap, ms }) => {
  lapTimes.push(ms);
  $('#ln-laps').textContent = lapTimes.map((t, i) => `Volta ${i + 1}: ${fmtSec(t - (lapTimes[i - 1] ?? 0))}`).join(' · ');
  vibrate(60);
  S.classLink?.event('lineLap', { lap, ms });
});

function renderLine(s) {
  const l = s.line;
  for (const [i, side] of [[0, 'l'], [1, 'r']]) {
    $(`#ln-${side}`).style.height = `${((l.light[i] / 255) * 100).toFixed(1)}%`;
    $(`#ln-see-${side}`).classList.toggle('on', l.see[i]);
  }
  const prev = linePhase;
  linePhase = l.phase;
  if (l.phase !== P.LINE_PHASE.OFF) lineSentAt = 0;
  if (l.phase === P.LINE_PHASE.FOLLOW && prev !== P.LINE_PHASE.FOLLOW) {
    lineFollowAt = performance.now();
    setLineStatus('🛤️ Seguindo a linha!');
    S.classLink?.event('lineStart');
  }
  if (lineSentAt && performance.now() - lineSentAt > 1500) {
    lineSentAt = 0; // o START se perdeu
    setLineStatus('O Eco não respondeu. Toque em Andar de novo.');
  }
  if (!lineRunning() && !lineHasResult) {
    setLineStatus(P.hasLight(l.port)
      ? 'Coloque o Eco com a fita entre os dois sensores e toque em Andar.'
      : '🔌 Ligue os sensores de luz na porta de sensor do Eco.');
  }
  renderLineButton();
}

function onLineResult({ code, ms }) {
  const E = P.LINE_END;
  linePhase = P.LINE_PHASE.OFF;
  lineSentAt = 0;
  lineHasResult = true;
  const time = $('#ln-time');
  if (ms) time.textContent = fmtSec(ms);
  time.classList.toggle('done', code === E.FINISH);
  if (code === E.FINISH) {
    const record = lineBest === null || ms < lineBest;
    if (record) lineBest = ms;
    setLineStatus(record ? '🏁 Chegou! Novo recorde!' : '🏁 Chegou!');
    vibrate([80, 60, 80, 60, 160]);
  } else {
    setLineStatus({
      [E.STOPPED]: ms ? `⏹ Parou em ${fmtSec(ms)}.` : '⏹ Parou.',
      [E.NO_LINE]: '❓ Não achei a linha. Coloque a fita entre os sensores e ajuste a altura e o LED.',
      [E.NO_SENSOR]: '🔌 Ligue os sensores de luz na porta de sensor do Eco.',
      [E.FAILSAFE]: '📡 Parou: o celular perdeu a conexão com o Eco.',
    }[code] ?? 'Parou.');
  }
  $('#ln-best').textContent = lineBest === null ? '' : `Melhor volta: ${fmtSec(lineBest)}`;
  S.classLink?.event('lineResult', { code, ms });
  renderLineButton();
}

// Competição aberta pelo professor: o app vai para o modo seguidor e mostra a vez de cada um
on('policy', (p, prev) => {
  renderRace(p, prev);
  if (p.paused && lineRunning()) stopLine();
});
on('race', (m) => onRaceCommand(m));

function renderRace(p, prev) {
  const race = p.race;
  if (race && !prev?.race && prefs.mode !== 'line') {
    raceModeBefore = prefs.mode;
    setMode('line');
  } else if (!race && prev?.race && raceModeBefore) {
    setMode(raceModeBefore);
    raceModeBefore = null;
  }
  const el = $('#ln-race');
  el.classList.toggle('hidden', !race);
  el.classList.toggle('turn', !!race?.myTurn);
  if (race) el.textContent = race.myTurn ? '🏁 Sua vez! Coloque o Eco na largada' : `🏁 Competição · ${speedWord(race.speed)}${race.laps > 1 ? ` · ${race.laps} voltas` : ''}`;
}

function onRaceCommand(m) {
  if (m.cmd === 'start') {
    if (prefs.mode !== 'line') setMode('line');
    const fail = startLine();
    if (fail !== null) S.classLink?.event('lineResult', { code: fail, ms: 0 });
  } else if (m.cmd === 'stop') stopLine();
}


// cronômetro na tela enquanto segue a linha
function lineFrame(now) {
  if (linePhase === P.LINE_PHASE.FOLLOW) $('#ln-time').textContent = fmtSec(now - lineFollowAt);
  requestAnimationFrame(lineFrame);
}
requestAnimationFrame(lineFrame);

api.seguidor = { rodando: lineRunning, para: stopLine }; // trocar de modo (drive.js) para o seguidor
