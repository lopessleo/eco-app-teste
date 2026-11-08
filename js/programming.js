// Modo programação no app: editor, envio do programa ao Eco (quem executa é ele),
// programas salvos, missões com estrelas e programas mandados pelo professor.

import * as P from './protocol.js';
import { ProgramClient, estimate, needs, normalizeProgram } from './program.js';
import { ProgramEditor } from './program-editor.js';
import { MISSIONS, missionById } from './missions.js';
import { S, api, effCalib, hasImu, on, emit } from './state.js';
import { prefs, savePrefs } from './prefs.js';
import { $, toast, vibrate } from './util.js';

const MAX_SAVED = 30;
const FOREVER_MIN_MS = 5000; // "repetir sempre" parado depois disso conta como missão rodada

export const runner = new ProgramClient((bytes) => S.transport?.send(bytes));
api.programa = runner; // os outros módulos: api.programa?.stop(), api.programa?.running

// velocidade dos programas: a da aula (o professor escolhe), limitada pelo máximo do professor
const progSpeed = () => Math.min(S.lesson.progSpeed, S.policy.maxSpeed);
const programCtx = () => ({
  calib: effCalib(), config: S.car?.config ?? P.DEFAULT_CONFIG, speedPct: progSpeed(),
});

export const editor = new ProgramEditor($('#program'), {
  program: prefs.program,
  onchange(program) {
    prefs.program = program;
    savePrefs();
    renderMission();
  },
  onrun: () => runProgram(editor.program),
  onstop: () => runner.stop(),
  describe(program) {
    if (!program.steps.length) return '';
    const { ms, exact } = estimate(program, programCtx());
    const s = Math.round(ms / 1000);
    return exact ? `≈ ${s} s` : s ? `≈ ${s} s ou mais (depende dos sensores)` : 'tempo depende dos sensores';
  },
});

// ---------- Executar ----------

let running = null; // { program, mission, fromTest }

// sensores que faltam para o programa (o Eco também avisa, mas assim a criança sabe antes)
function missing(program) {
  const port = S.carState?.line.port;
  const msgs = { sonar: '📡 sonar', light: '🔦 sensores de luz', imu: '🧭 giroscópio' };
  return needs(program).filter((n) => (n === 'imu' ? !hasImu() : n === 'sonar' ? !P.hasSonar(port) : !P.hasLight(port))).map((n) => msgs[n]);
}

// devolve true se o programa começou a rodar no Eco
async function runProgram(program, { test = false, done = null, auto = false } = {}) {
  if (!S.transport?.connected) return toast('Conecte o Eco primeiro');
  if (!program.steps.length) return toast('Coloque alguns blocos primeiro 🙂');
  if (S.policy.paused) return toast('⏸ O professor pausou os Ecos');
  const lack = missing(program);
  if (lack.length && !confirm(`Este programa usa ${lack.join(' e ')}, que não está no Eco agora. Rodar mesmo assim?`)) return;
  const me = (running = { program, mission: test ? null : prefs.mission, test, done });
  if (!test) editor.setRunning(true);
  vibrate(30);
  // só limpa se ainda for este programa (outro pode ter começado enquanto este era enviado)
  const cancel = () => {
    if (running !== me) return;
    running = null;
    editor.setRunning(false);
  };
  try {
    if (!(await runner.run(program, progSpeed(), { auto }))) {
      cancel(); // parou (ou começou outro) antes do Eco receber o "play"
      return false;
    }
    if (!test) S.classLink?.event('program', { blocks: program.steps.length, name: program.name || '' });
    return true;
  } catch (err) {
    cancel();
    toast(`❌ ${err.message}`);
    return false;
  }
}

// Programinhas de teste (calibração): resolve quando o Eco termina (com o estado final)
export function runTest(steps) {
  return new Promise((resolve) => {
    runProgram({ name: 'teste', steps }, { test: true, done: resolve }).then((started) => started || resolve(null));
  });
}

const ERR_TEXT = {
  [P.PROG_ERR.NO_SONAR]: '📡 Este programa precisa do sonar na porta de sensor.',
  [P.PROG_ERR.NO_LIGHT]: '🔦 Este programa precisa dos sensores de luz na porta de sensor.',
  [P.PROG_ERR.LINK_LOST]: '📡 O Eco parou: ficou muito tempo sem falar com o celular.',
  [P.PROG_ERR.INVALID]: 'O programa tem algum bloco que o Eco não conhece. Atualize o firmware.',
  [P.PROG_ERR.NO_PROGRAM]: 'O programa não chegou no Eco. Tente de novo.',
};

runner.onstep = (i) => {
  if (!running?.test) editor.highlight(i);
};
runner.onend = (state, err, ms) => {
  const r = running;
  running = null;
  editor.setRunning(false);
  if (!r) return;
  if (state === P.PROG_STATE.ERROR) toast(`❌ ${ERR_TEXT[err] ?? 'O programa parou.'}`);
  r.done?.(state);
  if (r.test) return;
  const forever = r.program.steps.some((s) => s.type === 'repeat' && s.value === 0);
  const completed = state === P.PROG_STATE.DONE || (forever && state === P.PROG_STATE.STOPPED && ms >= FOREVER_MIN_MS);
  S.classLink?.event('programRun', { name: r.program.name || '', from: r.program.from || '', ok: completed });
  if (completed && r.mission) awardMission(r.mission, r.program);
};

on('progAck', (a) => runner.onAck(a));
on('progStatus', (st) => runner.onStatus(st));
on('connection', (st) => st !== 'connected' && runner.lost());
on('policy', (p) => p.paused && runner.stop());
on('calib', () => editor.render());
on('lesson', () => {
  editor.render(); // a velocidade (estimativa de tempo) pode ter mudado
  renderMission();
});

// ---------- Programas salvos ----------

const filesDialog = $('#prog-files');

function renderFiles() {
  const list = $('#pf-list');
  list.replaceChildren();
  if (!prefs.programs.length) {
    list.innerHTML = '<li class="muted">Nenhum programa salvo ainda.</li>';
    return;
  }
  prefs.programs.forEach((p, i) => {
    const li = document.createElement('li');
    const blocks = p.steps.filter((s) => s.type !== 'end').length;
    li.innerHTML = `<div><b></b><small class="muted">${blocks} bloco(s)${p.from ? ' · 👩‍🏫 do professor' : ''}</small></div>
      <button type="button" class="small" data-a="open">Abrir</button><button type="button" class="small danger" data-a="del">🗑</button>`;
    li.querySelector('b').textContent = p.name || 'Sem nome';
    li.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'open') {
        editor.setProgram(p);
        prefs.program = normalizeProgram(p);
        savePrefs();
        filesDialog.close();
        toast(`📂 ${p.name || 'Programa'} aberto`);
      } else if (a === 'del' && confirm(`Apagar "${p.name || 'programa'}"?`)) {
        prefs.programs.splice(i, 1);
        savePrefs();
        renderFiles();
      }
    });
    list.append(li);
  });
}

export function saveProgram(program, name, from = '') {
  const entry = { ...normalizeProgram(program), name, from, at: Date.now() };
  const i = prefs.programs.findIndex((p) => p.name === name);
  if (i >= 0) prefs.programs.splice(i, 1);
  prefs.programs.unshift(entry);
  prefs.programs.length = Math.min(prefs.programs.length, MAX_SAVED);
  savePrefs();
}

$('#program [data-act="files"]').addEventListener('click', () => {
  $('#pf-name').value = editor.program.name || '';
  renderFiles();
  filesDialog.showModal();
});
$('#pf-save').addEventListener('click', () => {
  const name = $('#pf-name').value.trim();
  if (!name) return toast('Dê um nome ao programa');
  if (!editor.program.steps.length) return toast('O programa está vazio');
  editor.program.name = name;
  saveProgram(editor.program, name);
  renderFiles();
  toast('💾 Salvo!');
});

// ---------- Missões ----------

const missionsDialog = $('#missions');
const stars = (n) => '⭐'.repeat(n) + '☆'.repeat(3 - n);

function renderMissions() {
  const list = $('#ms-list');
  list.replaceChildren();
  for (const m of MISSIONS) {
    const li = document.createElement('li');
    const got = prefs.missions[m.id] ?? 0;
    li.className = prefs.mission === m.id ? 'on' : '';
    li.innerHTML = `<span class="ms-icon">${m.icon}</span><div><b>${m.title}</b><small class="muted"></small></div><span class="ms-stars">${stars(got)}</span>`;
    li.querySelector('small').textContent = m.goal;
    li.addEventListener('click', () => {
      prefs.mission = m.id;
      savePrefs();
      missionsDialog.close();
      renderMission();
    });
    list.append(li);
  }
}

function renderMission() {
  const bar = $('#mission-bar');
  const m = S.lesson.missions ? missionById(prefs.mission) : null; // aula sem missões: a barra some
  bar.classList.toggle('hidden', !m);
  if (!m) return;
  bar.querySelector('.mb-title').textContent = `${m.icon} ${m.title}`;
  bar.querySelector('.mb-goal').textContent = m.goal;
  bar.querySelector('.mb-stars').textContent = stars(prefs.missions[m.id] ?? 0);
  bar.querySelector('.mb-hint').textContent = '';
}

$('#program [data-act="missions"]').addEventListener('click', () => {
  renderMissions();
  missionsDialog.showModal();
});
$('#mission-bar .mb-check').addEventListener('click', () => {
  const m = missionById(prefs.mission);
  if (!m) return;
  const r = m.check(editor.program.steps);
  $('#mission-bar .mb-hint').textContent = r.ok
    ? `${stars(r.stars)} Parece certo! Agora rode no Eco para ganhar as estrelas.${r.hint ? ` ${r.hint}` : ''}`
    : `🤔 ${r.hint}`;
});
$('#mission-bar .mb-close').addEventListener('click', () => {
  prefs.mission = null;
  savePrefs();
  renderMission();
});

function awardMission(id, program) {
  const m = missionById(id);
  const r = m?.check(program.steps);
  if (!r?.ok) {
    toast(`🤔 Rodou, mas ainda não cumpre a missão: ${r?.hint ?? ''}`);
    return;
  }
  const before = prefs.missions[id] ?? 0;
  prefs.missions[id] = Math.max(before, r.stars);
  savePrefs();
  renderMission();
  vibrate([60, 40, 60, 40, 160]);
  emit('teacherMsg', `${stars(r.stars)} Missão "${m.title}" cumprida!${r.stars < 3 && r.hint ? ` ${r.hint}` : ''}`);
  S.classLink?.event('mission', { id, stars: r.stars, title: m.title });
}

renderMission();

// ---------- Programa mandado pelo professor ----------

on('teacherProgram', ({ name, program }) => {
  const p = { ...normalizeProgram(program), name, from: 'professor' };
  saveProgram(p, name, 'professor');
  editor.setProgram(p);
  prefs.program = normalizeProgram(p);
  savePrefs();
  emit('setMode', 'program'); // só abre se a aula tiver o modo programação (senão fica salvo em 📂)
  emit('teacherMsg', `📩 O professor mandou um programa: ${name}`);
});

// ---------- Cenários (documentos/cenarios.md): os blocos do cenário e "gravar no Eco" (automação, só na maquete) ----------
on('blocosCenario', ({ maquete }) => {
  editor.setProgram(editor.program); // tira os blocos de outro cenário
  editor.renderPalette();
  editor.render();
  $('#btn-prog-auto').classList.toggle('hidden', !maquete);
  $('#program').classList.toggle('maquete', maquete); // as missões são do Eco: somem na maquete
});
$('#btn-prog-auto').addEventListener('click', async () => {
  if (!editor.program.steps.length) return toast('Coloque alguns blocos primeiro 🙂');
  await runProgram(editor.program, { auto: true });
  toast('⚙️ Gravado no Eco: roda sozinho, mesmo sem o celular');
});
