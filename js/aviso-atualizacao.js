// Aviso de atualização: logo depois de conectar, se o Eco é de protótipo e a versão dele é mais velha que a publicada
// junto com o app (firmware/prototipo.json, tools/build-firmware-prototipo.mjs), oferece abrir a atualização
// (atualizador.js, na mesma conexão). Sem internet ou sem o arquivo, não avisa. Na aula não interrompe. "Depois" vale um dia, por Eco.
// ?pasta=: os testes usam outra pasta (tests/e2e/aviso-atualizacao.test.mjs).
import { BOARD } from './protocol.js';
import { S, api, on } from './state.js';
import { $ } from './util.js';
import { maisVelha, versaoPublicada } from './atualizar-rodas.js';

const params = new URLSearchParams(location.search);
const PASTA = /^[\w-]+$/.test(params.get('pasta') ?? '') ? params.get('pasta') : 'firmware';
const DEPOIS = 'atualizacao.depois';
const UM_DIA = 864e5;


const lePausas = () => {
  try {
    return JSON.parse(localStorage.getItem(DEPOIS) || '{}');
  } catch {
    return {};
  }
};
const adiado = (id) => Date.now() - (lePausas()[id] ?? 0) < UM_DIA;
// "Não quero atualizar": guarda a versão recusada; só volta a avisar quando sair uma mais nova que ela
const RECUSADA = 'atualizacao.recusada';
const leRecusadas = () => {
  try {
    return JSON.parse(localStorage.getItem(RECUSADA) || '{}');
  } catch {
    return {};
  }
};
const recusou = (id, nova) => {
  const r = String(leRecusadas()[id] ?? '').split('.').map(Number);
  return r.length === 2 && !maisVelha(r, nova);
};
let ofertada = null;
function adia(id) {
  try {
    localStorage.setItem(DEPOIS, JSON.stringify({ ...lePausas(), [id]: Date.now() }));
  } catch {
    // sem armazenamento: pergunta de novo na próxima conexão
  }
}

let conferido = null; // id do Eco já conferido nesta conexão
on('connection', (st) => {
  if (st !== 'connected') conferido = null;
});
on('info', async (car) => {
  if (conferido === car.id || S.classLink || S.atualizando || S.ajustando) return;
  conferido = car.id;
  await new Promise((r) => setTimeout(r, 800)); // o CAPS chega logo depois do INFO (Eco antigo nem manda: é protótipo)
  if ((S.caps?.board ?? BOARD.PROTOTIPO) !== BOARD.PROTOTIPO || adiado(car.id)) return;
  const nova = await versaoPublicada(PASTA);
  if (!nova || !maisVelha(car.fw, nova) || !S.transport?.connected || recusou(car.id, nova)) return;
  ofertada = nova;
  $('#aa-versoes').textContent = `Versão ${car.fw.join('.')} → ${nova.join('.')}`;
  $('#aviso-atualizacao').showModal();
});

$('#aa-depois').addEventListener('click', () => {
  if (S.car) adia(S.car.id);
  $('#aviso-atualizacao').close();
});
$('#aa-nunca').addEventListener('click', () => {
  if (S.car && ofertada) {
    try {
      localStorage.setItem(RECUSADA, JSON.stringify({ ...leRecusadas(), [S.car.id]: ofertada.join('.') }));
    } catch {
      // sem armazenamento: o "Depois" de um dia vale
    }
    adia(S.car.id);
  }
  $('#aviso-atualizacao').close();
});
$('#aa-agora').addEventListener('click', () => {
  $('#aviso-atualizacao').close();
  api.atualizador?.abre();
});
