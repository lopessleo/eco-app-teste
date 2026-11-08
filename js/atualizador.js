// Atualizador do Eco dentro do app (o Eco do protótipo hoje; o modelo para os kits): na mesma conexão do app, o mascote
// conduz a instalação (rega uma plantinha que cresce com a porcentagem), comemora quando o Eco volta na versão nova, ensina
// a conferir as rodinhas como uma brincadeira e, se os fios estiverem trocados, conserta (o Eco visto de cima) mandando a versão certa
// (atualizar-rodas.js). No fim, a conferência no chão. Abre pelo aviso (aviso-atualizacao.js), por "Precisa de ajuda?"
// ou pelo link ./?atualizar. Registro na caixa-preta. ?pasta=: os testes usam outra pasta de firmware.
import * as P from './protocol.js';
import { S, api, on } from './state.js';
import { $ } from './util.js';
import { FirmwareUpload } from './ota.js';
import { ARQUIVO_NORMAL, anotaVersao, arquivoGuardado, maisVelha, publicado, varianteDasRodas, versaoAnterior } from './atualizar-rodas.js';
import { anotaEco, registra } from './caixa-preta-base.js';

const params = new URLSearchParams(location.search);
const PASTA = /^[\w-]+$/.test(params.get('pasta') ?? '') ? params.get('pasta') : 'firmware';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dlg = $('#atualizador');
const hex = (id) => id.toString(16).toUpperCase().padStart(4, '0');

// ---------- o mascote (um só, passa de cena em cena) ----------
const boneco = document.createElement('div');
boneco.className = 'at-mascote';
let svg = null;
fetch(new URL('../brand/eco.svg', import.meta.url)).then((r) => r.text()).then((t) => {
  boneco.innerHTML = t;
  svg = boneco.querySelector('svg');
}).catch(() => {});
function mascote(onde, { pose = '', cara = 'normal', jeito = '' } = {}) {
  onde.prepend(boneco);
  boneco.className = `at-mascote ${jeito}`;
  if (!svg) return;
  if (pose) svg.dataset.pose = pose;
  else delete svg.dataset.pose;
  svg.dataset.cara = cara;
}

function tela(nome) {
  for (const t of dlg.querySelectorAll('.at-tela')) t.classList.toggle('on', t.dataset.tela === nome);
  rotulaVoltar(); // a versão para onde voltar muda depois de cada instalação
}
function confete() {
  const box = dlg.querySelector('.at-confete');
  const cores = ['#35d07f', '#ffd23f', '#ff6b6b', '#4dabf7', '#b197fc', '#ffa94d'];
  box.replaceChildren(...Array.from({ length: 70 }, (_, i) => {
    const c = document.createElement('i');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = cores[i % cores.length];
    c.style.animationDuration = `${1.6 + Math.random() * 1.8}s`;
    c.style.animationDelay = `${Math.random() * 0.6}s`;
    return c;
  }));
}

// ---------- conexão ----------
const conectado = () => !!S.transport?.connected && !!S.car;
async function esperaVolta(ms) {
  // o Eco reinicia: a conexão cai e o app reconecta sozinho (connection.js manda o HELLO e chega o INFO novo)
  for (let i = 0; i < 80 && S.transport?.connected; i++) await sleep(100);
  S.car = null;
  for (let i = 0; i < ms / 100; i++) {
    if (S.transport?.connected && S.car) return true;
    if (!S.transport) return false;
    await sleep(100);
  }
  return false;
}

// ---------- instalar (corrida ou conserto) ----------
let upload = null;
on('otaStatus', (st) => upload?.onStatus(st));
async function instala(arquivo, { conserto = false, titulo, versao } = {}) {
  tela(conserto ? 'conserto' : 'instalar');
  const t = dlg.querySelector(`[data-tela=${conserto ? 'conserto' : 'instalar'}]`);
  t.querySelector('h2').textContent = titulo;
  const barra = t.querySelector('.at-trilho i');
  const pct = t.querySelector('.at-pct');
  const status = t.querySelector('.at-status');
  const desenho = t.querySelector('.at-ilustra svg');
  desenho.classList.remove('pronta', 'esperando');
  const andou = (p) => {
    barra.style.width = `${(p * 100).toFixed(1)}%`;
    pct.textContent = `${Math.round(p * 100)}%`;
    // o caule aparece de baixo para cima (do vaso, y 236, até a flor, y 84)
    const cresce = desenho.querySelector('.at-cresce');
    if (cresce) {
      cresce.setAttribute('y', (236 - p * 156).toFixed(1));
      cresce.setAttribute('height', (p * 156 + 4).toFixed(1));
    }
    for (const f of desenho.querySelectorAll('[data-a]')) f.classList.toggle('on', p >= Number(f.dataset.a));
  };
  andou(0);
  mascote(t.querySelector('.at-palco'), conserto ? { cara: 'pensando', pose: 'apontando' } : { cara: 'feliz', jeito: 'esperando' });
  status.textContent = 'Baixando a atualização…';
  registra('atualizacao', { arquivo, eco: S.car?.name ?? '', de: S.car?.fw?.join('.') ?? '' });
  if (S.car) anotaVersao(S.car.id, S.car.fw); // a de antes (a primeira vez, sem saber o jeito das rodas)
  try {
    const res = await fetch(`${PASTA}/${arquivo}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Não consegui baixar a atualização. O celular está com internet?');
    const dados = new Uint8Array(await res.arrayBuffer());
    status.textContent = 'Mandando para o Eco. Deixe ele ligado e pertinho do celular.';
    upload = new FirmwareUpload((b) => S.transport?.send(b), andou);
    S.upload = upload; // o laço da pilotagem fica quieto enquanto isso
    await upload.run(dados, S.caps ? S.caps.board : null);
    andou(1);
    status.textContent = 'O Eco está reiniciando com a versão nova…';
    desenho.classList.add('esperando');
    mascote(t.querySelector('.at-palco'), { cara: 'pensando', pose: conserto ? 'apontando' : '', jeito: 'esperando' });
    if (!(await esperaVolta(45000))) throw new Error('O Eco não voltou. Desligue e ligue a powerbank e conecte de novo.');
    if (versao && maisVelha(S.car.fw, versao)) throw new Error(`O Eco voltou na versão ${S.car.fw.join('.')}: a nova não ficou. Ele se protegeu e voltou para a anterior.`);
    anotaVersao(S.car.id, S.car.fw, arquivo.split('/').pop());
    desenho.classList.replace('esperando', 'pronta');
    mascote(t.querySelector('.at-palco'), { cara: 'animado', pose: 'comemorando' });
    await sleep(1400); // a flor abre / as rodas ficam verdes antes da próxima tela
    registra('atualizacao ok', { arquivo, agora: S.car.fw.join('.') });
    anotaEco(hex(S.car.id), { nome: S.car.name, fw: S.car.fw.join('.') });
    return true;
  } catch (err) {
    registra('atualizacao falhou', { arquivo, erro: err.message });
    erro(err.message);
    return false;
  } finally {
    upload = null;
    S.upload = null;
  }
}

function erro(texto) {
  tela('erro');
  dlg.querySelector('[data-tela=erro] .at-msg').textContent = texto;
  mascote(dlg.querySelector('[data-tela=erro] .at-palco'), { cara: 'triste', pose: 'pensando' });
}

// ---------- as rodinhas ----------
async function gira(esq, dir, ms) {
  let seq = 0;
  for (let i = 0; i < ms / 100; i++) {
    S.transport?.send(P.encodeDrive({ seq: seq++, left: esq, right: dir, flags: 0 }));
    await sleep(100);
  }
  for (let i = 0; i < 3; i++) {
    S.transport?.send(P.encodeDrive({ seq: seq++, left: 0, right: 0, flags: 0 }));
    await sleep(100);
  }
}
const resp = { 1: {}, 2: {} };
let rodada = 1;
function perguntaRoda(n) {
  rodada = n;
  resp[n] = {};
  const t = dlg.querySelector('[data-tela=rodas]');
  t.querySelector('.at-n').textContent = n;
  t.querySelectorAll('.at-passos i').forEach((p, i) => p.classList.toggle('on', i < n));
  for (const r of t.querySelectorAll('.at-roda')) r.classList.remove('escolhida', 'gira');
  for (const b of t.querySelectorAll('.at-opcoes button')) b.classList.remove('on');
  t.querySelector('.at-q-roda').classList.remove('on');
  t.querySelector('.at-q-lado').classList.remove('on');
}
async function giraRoda() {
  const t = dlg.querySelector('[data-tela=rodas]');
  const botao = t.querySelector('.at-girar');
  botao.disabled = true;
  await (rodada === 1 ? gira(70, 0, 1500) : gira(0, 70, 1500));
  botao.disabled = false;
  botao.textContent = '🔁 Girar de novo';
  t.querySelector('.at-q-roda').classList.add('on');
}
function escolheRoda(roda) {
  const t = dlg.querySelector('[data-tela=rodas]');
  resp[rodada].roda = roda;
  for (const r of t.querySelectorAll('.at-roda')) r.classList.toggle('escolhida', r.dataset.roda === roda);
  if (!roda) return proximaRoda();
  t.querySelector('.at-q-lado').classList.add('on');
}
function escolheLado(frente) {
  resp[rodada].frente = frente;
  proximaRoda();
}
let versaoNova = null;
async function proximaRoda() {
  if (rodada === 1) {
    perguntaRoda(2);
    dlg.querySelector('[data-tela=rodas] .at-girar').textContent = '▶ Girar a outra rodinha';
    return;
  }
  const v = varianteDasRodas(resp[1], resp[2]);
  registra('teste das rodas', { roda1: JSON.stringify(resp[1]), roda2: JSON.stringify(resp[2]), resultado: v.arquivo ?? v.erro });
  if (v.erro) return erro(v.erro);
  if (v.arquivo === ARQUIVO_NORMAL) return chao();
  tela('achei');
  mascote(dlg.querySelector('[data-tela=achei] .at-palco'), { cara: 'surpreso', pose: 'apontando' });
  dlg.querySelector('[data-tela=achei] .at-consertar').onclick = async () => {
    if (await instala(v.arquivo, { conserto: true, titulo: 'Consertando as rodinhas…', versao: versaoNova })) chao(true);
  };
}

// ---------- no chão ----------
function chao(consertou = false) {
  tela('chao');
  const t = dlg.querySelector('[data-tela=chao]');
  t.querySelector('h2').textContent = consertou ? 'Consertado! Agora vamos testar no chão' : 'As rodinhas estão certinhas! Agora no chão';
  mascote(t.querySelector('.at-palco'), { cara: 'feliz', pose: 'apontando' });
  t.querySelector('.at-q-frente').classList.remove('on');
  t.querySelector('.at-q-giro').classList.remove('on');
  t.querySelector('.at-girar-chao').classList.add('hidden');
}

// ---------- abrir ----------
async function comeca() {
  if (!conectado()) {
    tela('conectar');
    mascote(dlg.querySelector('[data-tela=conectar] .at-palco'), { cara: 'normal', pose: 'acenando' });
    return;
  }
  if ((S.caps?.board ?? P.BOARD.PROTOTIPO) !== P.BOARD.PROTOTIPO) return erro('Este Eco não é do protótipo: a atualização dele é feita pelo técnico da escola.');
  site = await publicado(PASTA);
  versaoNova = site?.versao ?? null;
  if (!versaoNova) return erro('Não achei a atualização. O celular está com internet?');
  rotulaVoltar();
  if (!maisVelha(S.car.fw, versaoNova)) {
    tela('ja');
    dlg.querySelector('[data-tela=ja] .at-msg').textContent = `O ${S.car.name} já está na versão ${S.car.fw.join('.')}.`;
    mascote(dlg.querySelector('[data-tela=ja] .at-palco'), { cara: 'feliz', pose: 'maos-na-cintura' });
    return;
  }
  instalarAgora();
}
async function instalarAgora() {
  if (!(await instala(ARQUIVO_NORMAL, { titulo: 'Instalando a atualização', versao: versaoNova }))) return;
  tela('festa');
  dlg.querySelector('[data-tela=festa] .at-selo').textContent = `✅ Versão ${S.car.fw.join('.')} instalada e conferida`;
  mascote(dlg.querySelector('[data-tela=festa] .at-palco'), { cara: 'animado', pose: 'comemorando' });
  confete();
}

export function abre() {
  S.atualizando = true;
  registra('atualizador aberto', { conectado: conectado() ? 'sim' : 'não' });
  if (!dlg.open) dlg.showModal();
  comeca();
}
function fecha() {
  if (upload) return; // no meio da instalação não fecha
  S.atualizando = false;
  dlg.close();
}
api.atualizador = { abre };

// ---------- botões ----------
dlg.querySelector('.at-fechar').addEventListener('click', fecha);
$('#btn-atualizar').addEventListener('click', abre);
dlg.addEventListener('cancel', (e) => {
  e.preventDefault();
  fecha();
});
dlg.querySelector('[data-tela=conectar] .at-conectar').addEventListener('click', () => $('#btn-ble').click());
on('info', () => {
  if (dlg.open && dlg.querySelector('[data-tela=conectar]').classList.contains('on')) comeca();
});
dlg.querySelector('[data-tela=ja] .at-refazer').addEventListener('click', instalarAgora);
dlg.querySelector('[data-tela=festa] .at-calibrar').addEventListener('click', () => {
  tela('rodas');
  perguntaRoda(1);
  dlg.querySelector('[data-tela=rodas] .at-girar').textContent = '▶ Girar uma rodinha';
});
const rodas = dlg.querySelector('[data-tela=rodas]');
rodas.querySelector('.at-girar').addEventListener('click', giraRoda);
for (const r of rodas.querySelectorAll('.at-roda')) r.addEventListener('click', () => escolheRoda(r.dataset.roda));
rodas.querySelector('.at-nenhuma').addEventListener('click', () => escolheRoda(null));
rodas.querySelector('.at-frente').addEventListener('click', () => escolheLado(true));
rodas.querySelector('.at-tras').addEventListener('click', () => escolheLado(false));

const chaoT = dlg.querySelector('[data-tela=chao]');
chaoT.querySelector('.at-andar').addEventListener('click', async (e) => {
  e.target.disabled = true;
  await gira(50, 50, 1000);
  e.target.disabled = false;
  chaoT.querySelector('.at-q-frente').classList.add('on');
});
chaoT.querySelector('.at-frente-sim').addEventListener('click', () => chaoT.querySelector('.at-girar-chao').classList.remove('hidden'));
chaoT.querySelector('.at-girar-chao').addEventListener('click', async (e) => {
  e.target.disabled = true;
  await gira(60, -60, 800);
  e.target.disabled = false;
  chaoT.querySelector('.at-q-giro').classList.add('on');
});
chaoT.querySelector('.at-giro-sim').addEventListener('click', () => {
  registra('conferencia no chao', { resultado: 'ok' });
  tela('fim');
  dlg.querySelector('.at-calibrar-depois').classList.toggle('hidden', !!S.baseKit || !api.ajustes);
  mascote(dlg.querySelector('[data-tela=fim] .at-palco'), { cara: 'apaixonado', pose: 'comemorando' });
  confete();
});
for (const b of chaoT.querySelectorAll('.at-nao')) {
  b.addEventListener('click', () => {
    registra('conferencia no chao', { resultado: `não: ${b.dataset.q}` });
    erro('Hmm, ainda não ficou certo. Faça o teste das rodinhas de novo, com calma. Se continuar, envie o relatório para a equipe.');
  });
}
dlg.querySelector('[data-tela=fim] .at-brincar').addEventListener('click', fecha);
dlg.querySelector('[data-tela=fim] .at-calibrar-depois').addEventListener('click', () => {
  fecha();
  api.ajustes?.abre({ calibrar: true });
});
const erroT = dlg.querySelector('[data-tela=erro]');
erroT.querySelector('.at-de-novo').addEventListener('click', comeca);
erroT.querySelector('.at-relatorio').addEventListener('click', () => {
  fecha();
  $('#btn-relatorio')?.click();
});
// "voltar": para a versão que este Eco tinha antes (histórico), mesmo que tenha pulado várias
let site = null;
const destinoVoltar = () => (S.car ? versaoAnterior(S.car.id, S.car.fw, site?.versoes ?? []) : null);
function rotulaVoltar() {
  const d = destinoVoltar();
  for (const b of dlg.querySelectorAll('.at-voltar')) {
    b.classList.toggle('hidden', !d);
    if (d) b.textContent = `${b.dataset.antes ?? ''}Voltar para a versão ${d.versao.join('.')}`;
  }
}
for (const b of dlg.querySelectorAll('.at-voltar')) {
  if (b.textContent.startsWith('Algo ficou estranho?')) b.dataset.antes = 'Algo ficou estranho? ';
  b.addEventListener('click', async () => {
    if (!conectado()) return erro('Conecte o Eco primeiro.');
    const d = destinoVoltar();
    if (!d) return erro('Não sei para qual versão voltar: este Eco não tem outra guardada.');
    if (!confirm(`Voltar o Eco para a versão ${d.versao.join('.')}? Ele perde o que veio nas versões depois dela.`)) return;
    if (await instala(arquivoGuardado(d), { titulo: `Voltando para a versão ${d.versao.join('.')}` })) {
      tela('ja');
      dlg.querySelector('[data-tela=ja] .at-msg').textContent = `Pronto: o ${S.car.name} voltou para a versão ${S.car.fw.join('.')}.`;
      mascote(dlg.querySelector('[data-tela=ja] .at-palco'), { cara: 'normal', pose: 'maos-na-cintura' });
    }
  });
}

if (params.has('atualizar')) setTimeout(abre, 300);
