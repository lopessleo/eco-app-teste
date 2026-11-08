// Página escondida do app (atualizar.html): atualiza o Eco do PROTÓTIPO pelo Bluetooth do celular, sem a página do
// técnico. Manda o firmware de rodas certas, testa cada roda com quem segura o Eco e, se os fios estiverem trocados,
// manda a versão que compensa (atualizar-rodas.js). Força total e giro forte já vêm em todos (PROTO_SIMPLES).
// Os arquivos (assinados, placa protótipo) ficam em firmware/, gerados por tools/build-firmware-prototipo.mjs.
// ?emu: usa o Eco do emulador (testes); ?eco=Nome escolhe qual. tests/e2e/atualizar-prototipo.test.mjs
import * as P from './protocol.js';
import { BleTransport, WsTransport } from './transport.js';
import { FirmwareUpload } from './ota.js';
import { token } from './prefs.js';
import { ARQUIVO_NORMAL, varianteDasRodas } from './atualizar-rodas.js';

const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const params = new URLSearchParams(location.search);
// ?pasta=: os testes usam firmwares assinados com a chave de teste, em outra pasta
const PASTA = /^[\w-]+$/.test(params.get('pasta') ?? '') ? params.get('pasta') : 'firmware';
let t = null;
let info = null;
let caps = null;
let upload = null;
let seq = 0;

const msg = (id, texto, tipo = '') => {
  $(`#${id}`).textContent = texto;
  $(`#${id}`).className = `msg ${tipo}`;
};
const libera = (id) => $(`#${id}`).classList.remove('bloq');
const feito = (id) => $(`#${id}`).classList.add('feito');
const mostraEco = () => {
  $('#eco').textContent = t?.connected && info ? `Conectado: ${info.name} · firmware ${info.fw.join('.')}` : t ? 'Eco desconectado' : '';
};

function onMessage(b) {
  if (b[0] === P.MSG.INFO && b.length >= P.INFO_MIN_BYTES) info = P.decodeInfo(b);
  else if (b[0] === P.MSG.CAPS && b.length >= 4) caps = P.decodeCaps(b);
  else if (b[0] === P.MSG.OTA_STATUS && b.length >= 6) upload?.onStatus(P.decodeOtaStatus(b));
  else if (b[0] === P.MSG.DENIED) msg('m1', '🔒 Este Eco está preso a outro celular. Desligue o modo dono pelo técnico ou use aquele celular.', 'erro');
  mostraEco();
}
function onStatus(st) {
  if (st === 'connected') {
    info = null;
    t.send(P.encodeHello(token));
  }
  mostraEco();
}
async function esperaInfo(ms) {
  for (let i = 0; i < ms / 100; i++) {
    if (t?.connected && info) return true;
    await sleep(100);
  }
  return false;
}

// emulador: pega o Eco pedido (ou o primeiro livre), sem mostrar lista
const urlEmu = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?role=app`;
const escolheNoEmulador = (tr) => new Promise((resolve) => {
  const pega = (cars) => {
    const c = cars.find((x) => !params.get('eco') || x.name === params.get('eco'));
    if (c) {
      tr.onlist = null;
      resolve(c.id);
    }
  };
  tr.onlist = pega;
  pega(tr.cars);
});

$('#conectar').addEventListener('click', async () => {
  if (!params.has('emu') && !BleTransport.supported) return msg('m1', 'Este navegador não tem Bluetooth para sites. Abra este link no Chrome do Android.', 'erro');
  msg('m1', 'Procurando o Eco…');
  t?.close();
  t = params.has('emu') ? new WsTransport(urlEmu(), escolheNoEmulador) : new BleTransport();
  t.onmessage = onMessage;
  t.onstatus = onStatus;
  try {
    await t.connect();
  } catch (err) {
    t = null;
    return msg('m1', err?.name === 'NotFoundError' ? 'Nenhum Eco escolhido. Ele está ligado e perto?' : `Não deu para conectar: ${err.message}`, 'erro');
  }
  if (!(await esperaInfo(6000))) return msg('m1', 'O Eco conectou mas não respondeu. Desligue e ligue a powerbank e tente de novo.', 'erro');
  if (caps && caps.board !== P.BOARD.PROTOTIPO) return msg('m1', 'Este Eco não é do protótipo: esta página é só para os protótipos.', 'erro');
  msg('m1', `✅ ${info.name} conectado.`, 'ok');
  feito('p1');
  libera('p2');
});

// manda um firmware e espera o Eco voltar com ele
async function manda(arquivo, barra, saida, botao) {
  botao.disabled = true;
  try {
    msg(saida, 'Baixando a atualização…');
    const res = await fetch(`${PASTA}/${arquivo}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('não achei o arquivo da atualização (sem internet?)');
    const dados = new Uint8Array(await res.arrayBuffer());
    upload = new FirmwareUpload((b) => t?.send(b), (p) => {
      $(`#${barra}`).style.width = `${(p * 100).toFixed(1)}%`;
      msg(saida, `Enviando… ${Math.round(p * 100)}%`);
    });
    await upload.run(dados, caps ? caps.board : null);
    $(`#${barra}`).style.width = '100%';
    msg(saida, 'Enviado! O Eco está reiniciando…');
    // o Eco reinicia: a conexão cai e volta sozinha
    for (let i = 0; i < 80 && t.connected; i++) await sleep(100);
    info = null;
    if (!(await esperaInfo(45000))) throw new Error('o Eco não voltou. Desligue e ligue a powerbank, toque em Conectar e confira se ele já está na versão nova');
    return true;
  } catch (err) {
    msg(saida, `❌ ${err.message}`, 'erro');
    return false;
  } finally {
    upload = null;
    botao.disabled = false;
  }
}

$('#atualizar').addEventListener('click', async () => {
  if (!(await manda(ARQUIVO_NORMAL, 'b2', 'm2', $('#atualizar')))) return;
  msg('m2', '✅ Atualizado: força total nos motores e no giro.', 'ok');
  feito('p2');
  libera('p3');
});

// ---------- teste das rodas ----------
async function gira(esq, dir, ms = 1500) {
  for (let i = 0; i < ms / 100; i++) {
    t?.send(P.encodeDrive({ seq: seq++, left: esq, right: dir, flags: 0 }));
    await sleep(100);
  }
  for (let i = 0; i < 3; i++) {
    t?.send(P.encodeDrive({ seq: seq++, left: 0, right: 0, flags: 0 }));
    await sleep(100);
  }
}
const resp = { 1: {}, 2: {} };
const completo = (r) => r.roda === null || (r.roda !== undefined && r.frente !== undefined);
$('#girar1').addEventListener('click', () => gira(70, 0));
$('#girar2').addEventListener('click', () => gira(0, 70));
for (const grupo of document.querySelectorAll('.opcoes[data-teste]')) {
  grupo.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    for (const x of grupo.querySelectorAll('button')) x.classList.toggle('on', x === b);
    const r = resp[grupo.dataset.teste];
    if (grupo.dataset.q === 'roda') r.roda = b.dataset.v || null;
    else r.frente = b.dataset.v === '1';
    if (completo(resp[1])) $('#t2').classList.remove('hidden');
    if (completo(resp[1]) && completo(resp[2])) decide();
  });
}
let variante = null;
function decide() {
  variante = varianteDasRodas(resp[1], resp[2]);
  if (variante.erro) return msg('m3', variante.erro, 'erro');
  feito('p3');
  if (variante.arquivo === ARQUIVO_NORMAL) {
    msg('m3', '✅ As rodas já estão certas.', 'ok');
    $('#t4').textContent = 'Nada a acertar. Pronto! Pode voltar ao app pelo botão lá em cima.';
    $('#acertar').classList.add('hidden');
    feito('p4');
    return libera('p4');
  }
  msg('m3', '✅ Teste feito: os fios estão trocados, o próximo passo acerta.', 'ok');
  libera('p4');
}

$('#acertar').addEventListener('click', async () => {
  if (!variante?.arquivo) return;
  if (!(await manda(variante.arquivo, 'b4', 'm4', $('#acertar')))) return;
  msg('m4', '✅ Acertado. Agora confira:', 'ok');
  $('#conferir').classList.remove('hidden');
});
$('#frente').addEventListener('click', () => gira(70, 70));
$('.opcoes[data-q=conferir]').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.v === '1') {
    feito('p4');
    msg('m4', '✅ Pronto! Pode voltar ao app pelo botão lá em cima.', 'ok');
  } else {
    msg('m4', 'Mande um print desta tela para quem te passou este link.', 'erro');
  }
});
