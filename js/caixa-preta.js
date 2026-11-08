// Caixa-preta, a parte com tela (a base é caixa-preta-base.js): anota as conexões, o Eco conectado e o registro de erros
// dele (lido ao conectar), os avisos que a tela inicial mostra, e abre o relatório em "Precisa de ajuda?" para a pessoa
// ver e enviar (compartilhar do Android: WhatsApp, e-mail…). Nada é enviado sozinho.
import * as P from './protocol.js';
import { S, on } from './state.js';
import { $, APP_VERSION, toast } from './util.js';
import { anotaEco, limpa, registra, relatorio } from './caixa-preta-base.js';

const hex = (id) => id.toString(16).toUpperCase().padStart(4, '0');
let ecoAtual = null;

on('connection', (st) => {
  registra('conexao', { estado: st, eco: ecoAtual ? hex(ecoAtual) : '' });
  if (st !== 'connected') ecoAtual = null;
});
on('info', (car) => {
  if (ecoAtual === car.id) return;
  ecoAtual = car.id;
  anotaEco(hex(car.id), { nome: car.name, fw: car.fw.join('.') });
  registra('eco', { id: hex(car.id), fw: car.fw.join('.') });
  // o registro de erros do Eco (reinícios, quedas de tensão, travamentos, atualizações): só lê, não mexe em nada
  setTimeout(() => S.transport?.connected && S.transport.send(P.encodeDiag(P.DIAG_TEST.LOG_READ)), 2500);
});
on('caps', (c) => S.car && anotaEco(hex(S.car.id), { placa: c.board }));
on('log', (log) => S.car && anotaEco(hex(S.car.id), { log }));
on('denied', () => registra('recusado', { motivo: 'o Eco está preso a outro celular' }));

// avisos da tela inicial (Bluetooth desligado, sem permissão, Eco não encontrado…): são técnicos, sem nomes
const msg = $('#home-msg');
new MutationObserver(() => {
  const t = msg.textContent.trim();
  if (t) registra('aviso', { texto: t });
}).observe(msg, { childList: true, characterData: true, subtree: true });

// ---------- relatório ----------
const dialogo = $('#relatorio');
let texto = '';
async function abre() {
  const cache = (await caches?.keys?.().catch(() => []))?.find((k) => k.startsWith('carrinho-')) ?? 'sem cache';
  texto = relatorio({ versaoApp: APP_VERSION, cache, conectado: S.transport?.connected && S.car ? `${S.car.name} (firmware ${S.car.fw.join('.')})` : null });
  $('#rel-texto').textContent = texto;
  dialogo.showModal();
}
$('#btn-relatorio').addEventListener('click', abre);
$('#rel-fechar').addEventListener('click', () => dialogo.close());
$('#rel-apagar').addEventListener('click', () => {
  if (!confirm('Apagar o registro deste celular?')) return;
  limpa();
  registra('registro apagado');
  abre();
});
$('#rel-enviar').addEventListener('click', async () => {
  const data = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const arquivo = new File([texto], `relatorio-eco-${data}.txt`, { type: 'text/plain' });
  try {
    if (navigator.canShare?.({ files: [arquivo] })) await navigator.share({ files: [arquivo], title: 'Relatório do app Ecocreator' });
    else if (navigator.share) await navigator.share({ title: 'Relatório do app Ecocreator', text: texto });
    else {
      // sem compartilhar (computador): baixa o arquivo
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(arquivo), download: arquivo.name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    registra('relatorio enviado');
  } catch (err) {
    if (err?.name !== 'AbortError') toast(`Não deu para compartilhar: ${err.message}`);
  }
});
$('#rel-copiar').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(texto);
    toast('📋 Copiado: cole no WhatsApp ou no e-mail');
  } catch {
    toast('Não deu para copiar: use Enviar');
  }
});
