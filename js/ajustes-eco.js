// Ajustes do Eco (tela em "Precisa de ajuda?" e, opcional, depois da atualização): força dos motores (velocidade máxima,
// arrancada, partida forte, modo do PWM), andar reto (o giroscópio mede o quanto puxa), distância (o sonar mede a
// velocidade de verdade indo até a parede) e o giro, calibrado sozinho em rodadas (o Eco diz quantos graus girou no
// TURN_DONE). Tudo fica gravado no Eco (CONFIG, CALIB, AJUSTE). A parte de andar reto e distância é a mesma da
// "Calibração inicial" do técnico (tecnico/js/diag.js).
import * as P from './protocol.js';
import { S, api, on } from './state.js';
import { $, toast } from './util.js';
import { registra } from './caixa-preta-base.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dlg = $('#ajustes');
const q = (sel) => dlg.querySelector(sel);
const conectado = () => !!S.transport?.connected && !!S.car;
const temGiroscopio = () => !!((S.car?.flags ?? 0) & P.INFO_FLAG.IMU) && !!((S.calib?.auto ?? 0) & P.CALIB_AUTO.GYRO);
const ajuste = () => P.normalizeAjuste(S.ajuste ?? P.AJUSTE_PADRAO);
const msg = (aba, texto) => {
  q(`.aj-aba[data-aba=${aba}] .aj-msg`).textContent = texto;
};

// ---------- abrir, abas, assistente ----------
const PASSOS = ['reto', 'distancia', 'giro'];
let assistente = false;
function aba(nome) {
  for (const b of dlg.querySelectorAll('.aj-abas button')) b.classList.toggle('on', b.dataset.aba === nome);
  for (const s of dlg.querySelectorAll('.aj-aba')) s.classList.toggle('hidden', s.dataset.aba !== nome);
  const i = PASSOS.indexOf(nome);
  q('.aj-assistente').classList.toggle('hidden', !assistente);
  if (assistente) q('.aj-passo').textContent = i >= 0 ? `passo ${i + 1} de ${PASSOS.length}` : 'força';
}
function tela(nome) {
  for (const t of dlg.querySelectorAll('.aj-tela')) t.classList.toggle('on', t.dataset.tela === nome);
}
function mostra() {
  if (!conectado()) return tela('conectar');
  if ((S.caps?.board ?? P.BOARD.PROTOTIPO) !== P.BOARD.PROTOTIPO) {
    tela('conectar');
    q('[data-tela=conectar] .aj-msg').textContent = 'Este Eco não é do protótipo: os ajustes dele são feitos pelo técnico da escola.';
    return;
  }
  tela('ajustes');
  preenche();
}
export function abre({ calibrar = false } = {}) {
  assistente = calibrar;
  S.ajustando = true;
  registra('ajustes abertos', { assistente: calibrar ? 'sim' : 'não' });
  if (!dlg.open) dlg.showModal();
  aba(calibrar ? 'reto' : 'forca');
  mostra();
}
function fecha() {
  if (ocupado) return;
  S.ajustando = false;
  dlg.close();
}
api.ajustes = { abre };
q('.at-fechar').addEventListener('click', fecha);
dlg.addEventListener('cancel', (e) => {
  e.preventDefault();
  fecha();
});
for (const b of dlg.querySelectorAll('.aj-abas button')) b.addEventListener('click', () => aba(b.dataset.aba));
for (const b of dlg.querySelectorAll('.aj-proximo')) {
  b.addEventListener('click', () => {
    const i = PASSOS.indexOf(b.closest('.aj-aba').dataset.aba);
    if (i < PASSOS.length - 1) aba(PASSOS[i + 1]);
    else fecha();
  });
}
q('.aj-conectar').addEventListener('click', () => $('#btn-ble').click());
on('info', () => dlg.open && !q('[data-tela=ajustes]').classList.contains('on') && mostra());
on('ajuste', () => dlg.open && preenche());
$('#btn-ajustes').addEventListener('click', () => abre());

// ---------- força ----------
function preenche() {
  const c = S.car?.config;
  const a = ajuste();
  if (c) {
    q('[data-config=maxSpeed]').value = c.maxSpeed;
    q('[data-de=maxSpeed]').textContent = `${c.maxSpeed}%`;
    for (const b of dlg.querySelectorAll('[data-config=accel] button')) b.classList.toggle('on', Number(b.dataset.v) === c.accel);
  }
  if (c) {
    q('[data-config=autoBrake]').checked = c.autoBrake;
    q('[data-config=brakeDist]').value = c.brakeDist;
    q('[data-de=brakeDist]').textContent = `${c.brakeDist} cm`;
  }
  q('[data-de=alvoFreio]').textContent = `${q('.aj-alvo-freio').value} cm`;
  q('[data-ajuste=partida]').value = a.partida;
  q('[data-de=partida]').textContent = a.partida ? `${a.partida * 10} ms` : 'desligada';
  for (const b of dlg.querySelectorAll('[data-ajuste=motorModo] button')) b.classList.toggle('on', Number(b.dataset.v) === a.motorModo);
}
function mandaConfig(patch) {
  if (!conectado()) return;
  const config = { ...S.car.config, ...patch };
  S.transport.send(P.encodeConfig(config));
  S.car = { ...S.car, config }; // o INFO de volta confirma
  registra('ajuste', patch);
  preenche();
}
function mandaAjuste(patch) {
  if (!conectado()) return;
  S.ajuste = P.normalizeAjuste({ ...ajuste(), ...patch });
  S.transport.send(P.encodeAjuste(S.ajuste));
  registra('ajuste', patch);
  preenche();
}
q('[data-config=maxSpeed]').addEventListener('input', (e) => { q('[data-de=maxSpeed]').textContent = `${e.target.value}%`; });
q('[data-config=maxSpeed]').addEventListener('change', (e) => mandaConfig({ maxSpeed: Number(e.target.value) }));
q('[data-config=accel]').addEventListener('click', (e) => e.target.dataset.v && mandaConfig({ accel: Number(e.target.dataset.v) }));
q('[data-ajuste=partida]').addEventListener('input', (e) => { q('[data-de=partida]').textContent = Number(e.target.value) ? `${e.target.value * 10} ms` : 'desligada'; });
q('[data-ajuste=partida]').addEventListener('change', (e) => mandaAjuste({ partida: Number(e.target.value) }));
q('[data-ajuste=motorModo]').addEventListener('click', (e) => e.target.dataset.v && mandaAjuste({ motorModo: Number(e.target.dataset.v) }));

// comandos de teste: a pilotagem fica quieta enquanto a tela está aberta (drive.js olha S.ajustando)
let seq = 0;
async function anda(esq, dir, ms, parar = null) {
  for (let t = 0; t < ms; t += 100) {
    if (parar?.()) break;
    S.transport?.send(P.encodeDrive({ seq: seq++, left: esq, right: dir, flags: 0 }));
    await sleep(100);
  }
  for (let i = 0; i < 3; i++) {
    S.transport?.send(P.encodeDrive({ seq: seq++, left: 0, right: 0, flags: 0 }));
    await sleep(100);
  }
}
let ocupado = false;
async function tarefa(botao, fn) {
  if (ocupado || !conectado()) return;
  ocupado = true;
  botao.disabled = true;
  try {
    await fn();
  } finally {
    ocupado = false;
    botao.disabled = false;
  }
}
q('.aj-testar-andar').addEventListener('click', (e) => tarefa(e.target, () => anda(70, 70, 1000)));
q('.aj-testar-girar').addEventListener('click', (e) => tarefa(e.target, () => anda(70, -70, 1000)));

// ---------- calibração (CALIB) ----------
function esperaCalib(cond, ms = 8000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const olha = () => {
      if (S.calib && cond(S.calib)) return resolve(S.calib);
      if (Date.now() - t0 > ms) return resolve(null);
      setTimeout(olha, 200);
    };
    olha();
  });
}
function mandaCalib(patch, reset = false) {
  S.transport.send(P.encodeCalib(P.sanitizeCalib({ ...S.calib, ...patch }), P.MSG.CALIB, reset));
  return sleep(400);
}

// andar reto: o giroscópio mede o quanto ele puxa (learnTrim) e vira o alinhamento gravado
q('.aj-medir-reto').addEventListener('click', (e) => tarefa(e.target, async () => {
  if (!temGiroscopio()) return msg('reto', 'Sem o giroscópio: use os botões "Ele puxa para…" e teste de novo.');
  msg('reto', '⏳ Andando reto 3 segundos…');
  await mandaCalib({ auto: S.calib.auto | P.CALIB_AUTO.GYRO }, true);
  await anda(60, 60, 3000);
  const c = await esperaCalib((x) => x.learnTrim !== 0, 6000);
  if (!c) return msg('reto', 'Ele já anda reto, ou não deu para medir. Se ele puxa para um lado, use os botões abaixo.');
  const trim = Math.max(-25, Math.min(25, Math.round(c.trim + c.learnTrim)));
  await mandaCalib({ trim }, true);
  registra('calibracao', { reto: trim });
  msg('reto', `✅ Corrigido: alinhamento ${trim === 0 ? 'reto' : `${trim > 0 ? '+' : ''}${trim}`}. Teste de novo se quiser.`);
}));
for (const b of dlg.querySelectorAll('.aj-trim')) {
  b.addEventListener('click', (e) => tarefa(e.target, async () => {
    const trim = Math.max(-40, Math.min(40, (S.calib?.trim ?? 0) + Number(b.dataset.d)));
    await mandaCalib({ trim });
    msg('reto', `Alinhamento: ${trim > 0 ? '+' : ''}${trim}. Testando…`);
    await anda(60, 60, 1500);
    msg('reto', `Alinhamento: ${trim > 0 ? '+' : ''}${trim}. Ainda puxa? Toque de novo.`);
  }));
}

// distância: andando reto até a parede, o sonar mede a velocidade de verdade (learnSpeed) e vira o ajuste de distância
q('.aj-medir-distancia').addEventListener('click', (e) => tarefa(e.target, async () => {
  if (!P.hasSonar(S.carState?.line?.port ?? 0)) return msg('distancia', 'Este Eco está sem o sonar ligado: dá para pular este passo.');
  const auto = S.calib.auto;
  msg('distancia', '⏳ Andando até a parede…');
  await mandaCalib({ auto: auto | P.CALIB_AUTO.SONAR }, true);
  await anda(55, 55, 5000, () => (S.carState?.distance ?? 999) < 35);
  const c = await esperaCalib((x) => x.learnSpeed !== 100, 5000);
  if (!c) {
    await mandaCalib({ auto });
    return msg('distancia', 'Não deu para medir. Comece a uns 1,5 m da parede, bem de frente para ela, e tente de novo.');
  }
  const distAdj = Math.max(50, Math.min(150, Math.round((c.distAdj * c.learnSpeed) / 100)));
  await mandaCalib({ distAdj, auto }, true);
  registra('calibracao', { distancia: distAdj });
  msg('distancia', `✅ Medido: ele anda ${c.learnSpeed}% do que eu calculava. As distâncias dos programas já levam isso em conta.`);
}));

// ---------- freio anti-colisão ----------
// O Eco freia sozinho quando a distância fica menor que brakeDist + uma margem pela velocidade (carcore). Aqui ele vai
// até a parede com o freio ligado e o sonar diz onde parou de verdade. NUNCA aprende batendo: a primeira tentativa
// começa com o freio bem antecipado, e entre as tentativas o Eco dá ré até ~1 m (pelo sonar da frente).
export const FREIO_TOLERANCIA = 3; // cm
export const FREIO_LIMITE_MS = 6000;
export function proximoFreio(brakeDist, parou, alvo) {
  // parou perto demais (quase encostou): adianta de uma vez; senão, corrige pela diferença
  const erro = parou < 4 ? -Math.max(10, alvo - parou + 8) : parou - alvo;
  return Math.max(5, Math.min(60, Math.round(brakeDist - erro)));
}
q('[data-config=autoBrake]').addEventListener('change', (e) => mandaConfig({ autoBrake: e.target.checked }));
q('[data-config=brakeDist]').addEventListener('input', (e) => { q('[data-de=brakeDist]').textContent = `${e.target.value} cm`; });
q('[data-config=brakeDist]').addEventListener('change', (e) => mandaConfig({ brakeDist: Number(e.target.value) }));
q('.aj-alvo-freio').addEventListener('input', (e) => { q('[data-de=alvoFreio]').textContent = `${e.target.value} cm`; });
const distancia = () => S.carState?.distance ?? P.NO_DISTANCE;
const temSonarAgora = () => P.hasSonar(S.carState?.line?.port ?? 0) && distancia() !== P.NO_DISTANCE;
const parado = () => Math.abs(S.carState?.left ?? 0) < 2 && Math.abs(S.carState?.right ?? 0) < 2;
// vai até a parede na velocidade máxima, com o freio ligado; devolve onde parou (cm) ou null
async function ateParede() {
  const t0 = Date.now();
  let paradoDesde = 0;
  let andou = false;
  while (Date.now() - t0 < FREIO_LIMITE_MS) {
    S.transport?.send(P.encodeDrive({ seq: seq++, left: 100, right: 100, flags: 0 }));
    await sleep(100);
    if (!parado()) andou = true;
    if (andou && parado()) {
      paradoDesde ||= Date.now();
      if (Date.now() - paradoDesde > 500) break;
    } else paradoDesde = 0;
  }
  await anda(0, 0, 0);
  await sleep(300);
  return andou && parado() ? distancia() : null;
}
// ré até ficar a ~1 m da parede (o sonar da frente mede a parede se afastando); no máximo 2 s
async function volta(ate = 90) {
  await anda(-60, -60, 2000, () => distancia() !== P.NO_DISTANCE && distancia() >= ate);
}
function prontoParaFreio(aba) {
  if (!temSonarAgora()) {
    msg(aba, 'Precisa do sonar ligado e de uma parede na frente do Eco.');
    return false;
  }
  if (!S.car.config.autoBrake) mandaConfig({ autoBrake: true });
  return true;
}
q('.aj-testar-freio').addEventListener('click', (e) => tarefa(e.target, async () => {
  if (!prontoParaFreio('freio')) return;
  if (distancia() < 50) return msg('freio', 'Afaste o Eco: comece a pelo menos 50 cm da parede.');
  msg('freio', '⏳ Indo até a parede…');
  const parou = await ateParede();
  registra('freio teste', { parou: parou ?? 'não parou', freio: S.car.config.brakeDist });
  msg('freio', parou === null ? 'Ele não parou sozinho. O freio está ligado? Tem parede na frente?' : `Parou a ${parou} cm da parede.`);
}));
q('.aj-calibrar-freio').addEventListener('click', (e) => tarefa(e.target, async () => {
  const lista = q('.aj-rodadas-freio');
  lista.replaceChildren();
  if (!prontoParaFreio('freio')) return;
  const alvo = Number(q('.aj-alvo-freio').value);
  // a primeira tentativa começa com o freio bem antecipado: para longe, nunca bate
  let freio = Math.min(60, Math.max(S.car.config.brakeDist, alvo + 20));
  let certas = 0;
  for (let i = 0; i < 6; i++) {
    if (distancia() < 60) {
      msg('freio', '⏳ Dando ré para começar de novo…');
      await volta();
      if (distancia() < 60) return msg('freio', 'Coloque o Eco a 1 m da parede, com espaço atrás, e toque em "Calibrar o freio" de novo.');
    }
    mandaConfig({ brakeDist: freio, autoBrake: true });
    await sleep(400);
    msg('freio', `⏳ Tentativa ${i + 1}: indo até a parede…`);
    const parou = await ateParede();
    const item = document.createElement('li');
    if (parou === null) {
      item.textContent = 'não parou sozinho';
      lista.append(item);
      return msg('freio', '❌ Ele não parou sozinho. Confira se o sonar está encaixado e de frente para a parede.');
    }
    const novo = proximoFreio(freio, parou, alvo);
    const certo = Math.abs(parou - alvo) <= FREIO_TOLERANCIA;
    item.textContent = `parou a ${parou} cm ${certo ? '✓' : parou < alvo ? `(perto demais: frear antes)` : '(longe: frear mais tarde)'}`;
    lista.append(item);
    registra('calibracao freio', { tentativa: i + 1, parou, freio, alvo });
    certas = certo ? certas + 1 : 0;
    if (certas >= 2) {
      registra('calibracao', { freio });
      return msg('freio', `✅ Pronto: parou a ${alvo} cm duas vezes seguidas. Ele começa a frear a ${freio} cm (mais cedo quando está rápido).`);
    }
    if (!certo) freio = novo;
    await volta();
  }
  mandaConfig({ brakeDist: freio });
  msg('freio', `⚠️ Não acertou em 6 tentativas; ficou o melhor que deu (${freio} cm). Dá para calibrar de novo.`);
}));

// ---------- giro: rodadas automáticas ----------
// O Eco gira 90° com o giroscópio e responde quanto girou (TURN_DONE). Travou no meio (não completou, ou passou do
// tempo): mais força mínima e partida forte. Passou do ponto: menos força. Duas certas seguidas: pronto.
export const GIRO_LIMITE_MS = 7000; // sem resposta nesse tempo: travou (o Eco desiste sozinho em 15 s)
export const GIRO_TOLERANCIA = 6; // graus
const MAX_RODADAS = 8;
export function proximoAjusteGiro(a, { ok, deg }, alvo = 90) {
  const girou = Math.abs(deg);
  if (!ok || girou < alvo * 0.6) return { ...a, giroMin: Math.min(100, a.giroMin + 10), giroForca: Math.max(a.giroForca, Math.min(100, a.giroMin + 10)), partida: Math.min(30, a.partida + 4) };
  if (girou > alvo + GIRO_TOLERANCIA) return a.giroForca - 10 > a.giroMin ? { ...a, giroForca: a.giroForca - 10 } : { ...a, giroMin: Math.max(10, a.giroMin - 5) };
  if (girou < alvo - GIRO_TOLERANCIA) return { ...a, giroMin: Math.min(a.giroForca, a.giroMin + 5) };
  return a;
}
let turnId = 100;
async function umGiro(deg) {
  // sem o "estou aqui" desde a última rodada, o Eco está em segurança e cancelaria o giro na hora: acorda antes
  for (let i = 0; i < 3; i++) {
    S.transport?.send(P.encodeDrive({ seq: seq++, left: 0, right: 0, flags: 0 }));
    await sleep(80);
  }
  return new Promise((resolve) => {
    const id = turnId = (turnId % 250) + 1;
    let pronto = false;
    // o DRIVE parado continua indo: é o "estou aqui" (sem ele o Eco para em 0,5 s)
    const vivo = setInterval(() => S.transport?.send(P.encodeDrive({ seq: seq++, left: 0, right: 0, flags: 0 })), 150);
    const off = on('turnDone', (r) => {
      if (r.id !== id || pronto) return;
      pronto = true;
      off();
      clearInterval(vivo);
      resolve({ ok: !!r.ok, deg: r.deg, travou: false });
    });
    S.transport.send(P.encodeTurn(id, deg, 60));
    setTimeout(() => {
      clearInterval(vivo);
      if (pronto) return;
      pronto = true;
      off();
      S.transport?.send(P.encodeTurn(id, 0, 60)); // cancela o giro que travou
      resolve({ ok: false, deg: 0, travou: true });
    }, GIRO_LIMITE_MS);
  });
}
q('.aj-quarto').addEventListener('click', (e) => tarefa(e.target, async () => {
  if (!temGiroscopio()) return msg('giro', 'Este Eco está sem o giroscópio ligado: o giro dele é por tempo.');
  const r = await umGiro(90);
  msg('giro', r.travou ? '⚠️ Travou: não teve força para girar. Use "Calibrar o giro".' : `Girou ${Math.abs(r.deg)}° (o certo é 90°).`);
}));
q('.aj-calibrar-giro').addEventListener('click', (e) => tarefa(e.target, async () => {
  const lista = q('.aj-rodadas');
  lista.replaceChildren();
  if (!temGiroscopio()) return msg('giro', 'Este Eco está sem o giroscópio ligado: o giro dele é por tempo.');
  msg('giro', '⏳ Calibrando… deixe o Eco no chão, com espaço em volta.');
  let certas = 0;
  let travadas = 0;
  for (let i = 0; i < MAX_RODADAS; i++) {
    const alvo = i % 2 ? -90 : 90;
    const r = await umGiro(alvo);
    const antes = ajuste();
    const depois = proximoAjusteGiro(antes, r);
    const girou = Math.abs(r.deg);
    const item = document.createElement('li');
    const certo = !r.travou && r.ok && Math.abs(girou - 90) <= GIRO_TOLERANCIA;
    item.textContent = r.travou || !r.ok || girou < 54 ? `travou em ${girou}° → mais força` : girou > 90 + GIRO_TOLERANCIA ? `girou ${girou}°, passou → menos força`
      : girou < 90 - GIRO_TOLERANCIA ? `girou ${girou}°, faltou → um pouco mais de força` : `girou ${girou}° ✓`;
    lista.append(item);
    registra('calibracao giro', { rodada: i + 1, girou, ok: r.ok ? 'sim' : 'não', travou: r.travou ? 'sim' : 'não' });
    travadas = r.travou || !r.ok || girou < 54 ? travadas + 1 : 0;
    if (travadas >= 2 && antes.giroMin >= 100) {
      return msg('giro', '❌ Mesmo com força total ele não gira. Confira a powerbank (bem carregada), as rodas (raspando?) e os fios dos motores, e tente de novo.');
    }
    if (travadas >= 3) {
      mandaAjuste(depois);
      return msg('giro', '❌ Ele travou várias vezes seguidas. Aumentei a força: confira a powerbank e as rodas e toque em "Calibrar o giro" de novo.');
    }
    certas = certo ? certas + 1 : 0;
    if (JSON.stringify(depois) !== JSON.stringify(antes)) mandaAjuste(depois);
    if (certas >= 2) return msg('giro', `✅ Pronto: girou certinho duas vezes seguidas. Força do giro ${depois.giroMin}–${depois.giroForca}%.`);
    await sleep(900);
  }
  msg('giro', '⚠️ Não ficou certinho em 8 rodadas. Dá para tentar de novo: ele continua de onde parou.');
}));

// sem conexão no meio: avisa (as tarefas param sozinhas porque o transport não manda nada)
on('connection', (st) => {
  if (dlg.open && st !== 'connected' && ocupado) toast('O Eco desconectou: chegue mais perto.');
});
