// Sala de aula (lado da criança): entrar (código + "Quem é você?"), comandos do professor e telemetria.

import * as P from './protocol.js';
import { ClassLink, NO_POLICY } from './classroom.js';
import { CarTunnel } from './tunnel.js';
import { S, api, classDelta, emit, on } from './state.js';
import { prefs, savePrefs, tokenHex } from './prefs.js';
import { $, APP_VERSION, toast, vibrate } from './util.js';

// ---------- Entrar na sala ----------

const classDialog = $('#class-dialog');
const rosterDialog = $('#roster');

// dentro do APK a página não vem do notebook do professor: o endereço da sala (Wi-Fi) tem que ser digitado
const nativeApp = () => !!globalThis.Capacitor?.isNativePlatform?.();

export function defaultClassUrl() {
  if (nativeApp()) return '';
  if (!location.protocol.startsWith('http')) return 'ws://localhost:8080/ws?role=student';
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?role=student`;
}

// "192.168.0.10:8080" (como o painel mostra), "http://..." ou "ws://..." -> endereço do WebSocket da sala
export function classUrlFrom(text) {
  const t = String(text ?? '').trim();
  if (!t) return '';
  if (/^wss?:\/\//i.test(t)) return t;
  const m = /^(?:(https?):\/\/)?([^/?#\s]+)/i.exec(t);
  if (!m) return '';
  const host = m[2].includes(':') ? m[2] : `${m[2]}:8080`;
  return `${m[1]?.toLowerCase() === 'https' ? 'wss' : 'ws'}://${host}/ws?role=student`;
}

export function openClassDialog(code = '') {
  $('#c-code').value = code || prefs.classCode.replace(/^base:.*/, '');
  $('#c-url').value = prefs.classUrl || defaultClassUrl();
  $('#c-url').placeholder = 'ex.: 192.168.0.10:8080 (aparece no painel)';
  classDialog.querySelector('details').open = nativeApp() && !prefs.classUrl;
  classDialog.returnValue = '';
  classDialog.showModal();
}

classDialog.addEventListener('close', () => {
  if (classDialog.returnValue !== 'join') return;
  const code = $('#c-code').value.trim();
  if (!/^\d{4}$/.test(code)) return toast('O código da sala tem 4 números');
  const url = classUrlFrom($('#c-url').value) || defaultClassUrl();
  if (!url) return toast('Coloque o endereço da sala (aparece no painel do professor)');
  Object.assign(prefs, { classCode: code, classUrl: url === defaultClassUrl() ? '' : url });
  savePrefs();
  joinClass(code, url);
});

const carInfo = () => (S.car ? { id: P.formatCarId(S.car.id), name: S.car.name, color: S.car.color } : null);

// via: 'wifi' (servidor da sala pela rede) ou 'base' (pelo Eco: ECObase no notebook, sem rede)
export function joinClass(code, url, via = 'wifi') {
  S.classLink?.stop();
  const link = new ClassLink({
    url, code, device: tokenHex, app: APP_VERSION, car: carInfo, connect: via === 'base' ? () => new CarTunnel() : undefined,
  });
  // escolha lembrada (mesma sala): reconectar entra direto
  if (prefs.classChoice?.code === code) link.choice = prefs.classChoice.choice;
  link.onstatus = (st, detail) => {
    if (link !== S.classLink) return;
    if (['denied', 'kicked', 'ended'].includes(st)) {
      S.classLink = null;
      rosterDialog.close();
      setPolicy(NO_POLICY);
      showTeacherMessage(`🏫 ${detail || 'Você saiu da sala'}`);
      // pela base: entra de novo sozinho (espera o professor começar a próxima aula)
      if (via === 'base') {
        setTimeout(() => {
          if (!S.classLink && S.transport?.connected && S.baseStatus === P.BASE_STATUS.ONLINE) joinClass(code, '', 'base');
        }, 3000);
      }
    } else if (st === 'joined') {
      rosterDialog.close();
      prefs.classChoice = { code, choice: link.choice };
      savePrefs();
      toast(`🏫 ${link.student?.name ? `Oi, ${link.student.name}! ` : ''}Você entrou na sala${detail ? ` ${detail}` : ''}!`);
    }
    renderClass();
  };
  link.onroster = (r) => link === S.classLink && onRoster(r);
  link.onpolicy = (p) => link === S.classLink && setPolicy(p);
  link.onrace = (m) => link === S.classLink && emit('race', m);
  link.onmessage = (text) => showTeacherMessage(`📢 ${text}`);
  link.onprogram = (m) => link === S.classLink && emit('teacherProgram', m);
  link.onidentify = () => {
    if (!S.transport?.connected) return;
    S.transport.send(P.encodeIdentify());
    toast('✨ O professor pediu para o Eco piscar');
  };
  S.classLink = link;
  link.start();
  renderClass();
}

// Conectou outro Eco enquanto escolhe o nome: o servidor pode sugerir o dono dele
on('info', () => {
  if (S.classLink?.status === 'choosing') S.classLink.hello();
});

// O Eco está no kit de uma base ligada: a sala vem por ele (sem rede, sem código). Tem preferência sobre o Wi-Fi.
on('baseInfo', ({ status, kit }) => {
  if (status !== P.BASE_STATUS.ONLINE) {
    // base fora (notebook desligado, longe): o Eco já deixou de obedecer a pausa/limites; o app também,
    // para nunca prender a criança. A sala volta sozinha quando a base voltar (a ClassLink fica tentando).
    if (S.classLink?.viaBase && S.policy !== NO_POLICY) setPolicy(NO_POLICY);
    return;
  }
  if (S.classLink?.viaBase) return;
  const code = `base:${kit.toString(16)}`;
  if (prefs.classCode !== code) prefs.classChoice = null;
  prefs.classCode = code;
  savePrefs();
  joinClass(code, '', 'base');
});

// ---------- Quem é você? ----------

function onRoster(r) {
  const link = S.classLink;
  // este celular já estava na aula (o app fechou e abriu de novo): entra direto
  if (r.suggest?.why === 'device') {
    if (r.free && prefs.kidName) return link.join({ kid: prefs.kidName });
    if (!r.free) return link.join({ student: r.suggest.id });
  }
  showRoster(r);
}

function showRoster(r) {
  $('#ro-class').textContent = r.name ? `Aula: ${r.name}` : '';
  const sug = r.suggest?.why === 'car' ? r.students.find((s) => s.id === r.suggest.id) : null;
  const sugBtn = $('#ro-suggest');
  sugBtn.classList.toggle('hidden', !sug);
  if (sug) {
    sugBtn.textContent = `✔ Sou ${sug.name}`;
    sugBtn.onclick = () => pickStudent(sug);
  }
  const list = $('#ro-list');
  list.replaceChildren(...r.students.filter((s) => s !== sug).map((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = s.busy ? 'busy' : '';
    b.textContent = s.name;
    if (s.busy) b.title = 'já entrou';
    b.addEventListener('click', () => pickStudent(s));
    return b;
  }));
  list.classList.toggle('hidden', r.free);
  $('#ro-free').classList.toggle('hidden', !r.free);
  $('#ro-name').value = prefs.kidName;
  if (!rosterDialog.open) rosterDialog.showModal();
  vibrate(30);
}

function pickStudent(s) {
  if (s.busy && !confirm(`Já tem alguém na sala como ${s.name}. É você mesmo?`)) return;
  S.classLink?.join({ student: s.id });
}

$('#ro-free').addEventListener('submit', (e) => {
  e.preventDefault();
  const kid = $('#ro-name').value.trim();
  if (!kid) return;
  prefs.kidName = kid;
  savePrefs();
  S.classLink?.join({ kid });
});
$('#ro-cancel').addEventListener('click', () => rosterDialog.close());

function leaveClass() {
  S.classLink?.stop();
  S.classLink = null;
  prefs.classChoice = null;
  savePrefs();
  setPolicy(NO_POLICY);
  renderClass();
}

function setPolicy(p) {
  const wasPaused = S.policy.paused;
  const prev = S.policy;
  S.policy = p;
  emit('policy', p, prev);
  $('#pause-overlay').classList.toggle('hidden', !p.paused);
  const time = p.pauseReason === 'time';
  $('#pause-icon').textContent = time ? '⏰' : '⏸️';
  $('#pause-title').textContent = time ? 'Seu tempo acabou!' : 'Pausa!';
  $('#pause-text').textContent = time ? 'Hora de dar a vez para outro colega. 🙂' : 'O professor pediu para parar os Ecos.';
  if (p.timeLeftMin !== null && p.timeLeftMin <= 2 && p.timeLeftMin > 0 && prev.timeLeftMin !== p.timeLeftMin) {
    toast(`⏱ Falta${p.timeLeftMin > 1 ? 'm' : ''} ${p.timeLeftMin} minuto${p.timeLeftMin > 1 ? 's' : ''}`);
  }
  renderClass();
  if (p.paused && !wasPaused) {
    vibrate([200, 80, 200]);
  }
  $('#class-chip').classList.toggle('limited', p.muted || p.lightsOff || p.maxSpeed < 100);
}

export function renderClass() {
  const link = S.classLink;
  const st = link?.status;
  const who = link?.student?.name ?? '';
  const chip = $('#class-chip');
  chip.classList.toggle('hidden', !link);
  chip.classList.toggle('offline', st !== 'joined');
  const left = S.policy.timeLeftMin;
  const icon = link?.viaBase ? '📡' : '🏫';
  chip.textContent = st === 'choosing' ? `${icon} Quem é você?` : st === 'waiting' ? `${icon} ⏳ aula`
    : `${icon} ${who || (link?.viaBase ? 'Sala' : prefs.classCode)}${left !== null && left > 0 && left <= 5 ? ` · ⏱ ${left} min` : ''}`;
  const where = link?.viaBase ? 'Na sala (pelo Eco)' : `Na sala ${prefs.classCode}`;
  chip.title = st === 'joined' ? `${where}${who ? ` como ${who}` : ''}` : st === 'choosing' ? 'Toque para escolher o seu nome' : 'Reconectando à sala…';
  $('#class-status').textContent = !link
    ? 'A sala chega sozinha pelo Eco (base do professor ligada) ou pelo código que o professor mostra.'
    : st === 'joined' ? `✅ ${where}${who ? ` como ${who}` : ''}`
      : st === 'choosing' ? '👋 Escolha o seu nome na lista.' : st === 'waiting' ? '⏳ Esperando o professor começar a aula…'
        : link.viaBase ? '⏳ Esperando o Eco e a base do professor…' : '⏳ Conectando à sala…';
  $('#btn-class').textContent = link ? '🚪 Sair da sala' : '🏫 Entrar na sala';
}

$('#btn-class').addEventListener('click', () => (S.classLink ? leaveClass() : openClassDialog()));
$('#class-chip').addEventListener('click', () => {
  const link = S.classLink;
  if (link?.status === 'choosing' && link.roster) showRoster(link.roster);
  else toast($('#class-chip').title);
});

let msgTimer = 0;
on('teacherMsg', (text) => showTeacherMessage(text));

function showTeacherMessage(text) {
  const box = $('#teacher-msg');
  box.querySelector('p').textContent = text;
  box.classList.remove('hidden');
  vibrate([80, 60, 80]);
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => box.classList.add('hidden'), 8000);
}
$('#teacher-msg').addEventListener('click', () => $('#teacher-msg').classList.add('hidden'));

// Telemetria para o professor, 1x por segundo
setInterval(() => {
  if (S.classLink?.status !== 'joined') {
    Object.assign(classDelta, { connMs: 0, driveMs: 0, distM: 0, horns: 0 });
    return;
  }
  const s = S.carState;
  S.classLink.telemetry({
    car: S.car ? { id: P.formatCarId(S.car.id), name: S.car.name, color: S.car.color, fw: S.car.fw.join('.') } : null,
    carConn: !!S.transport?.connected,
    mode: prefs.mode,
    prog: !!api.programa?.running,
    speed: s ? Math.round((Math.abs(s.left) + Math.abs(s.right)) / 2) : 0,
    dist: s && s.distance !== P.NO_DISTANCE ? s.distance : null,
    vbus: s?.vbus ?? 0,
    low: !!(s && s.status & P.STATUS.LOW_VOLTAGE),
    signal: S.signalBars,
    line: s ? { port: s.line.port, phase: s.line.phase } : null,
    // conferência das peças (só o que a aula usa): o professor vê um selo no cartão do aluno
    confira: (api.pecas?.itensParaConferir(S.pecas, S.lesson) ?? []).map((i) => ({ id: i.id, st: i.st })),
    d: { ...classDelta },
  });
  Object.assign(classDelta, { connMs: 0, driveMs: 0, distM: 0, horns: 0 });
}, 1000);
