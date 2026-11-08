// Caixa-preta do app (sem tela): guarda no próprio celular os últimos eventos técnicos (abriu, erros, conexões, avisos,
// atualizações) e o registro de erros de cada Eco, e monta o relatório que a pessoa envia pela tela "Precisa de ajuda?"
// (caixa-preta.js). Nada sai do celular sozinho. Sem nome de criança, turma, código de sala nem localização.
// O começo do index.html grava "abriu" e os erros com um script próprio, no mesmo formato:
// se o resto do app nem carregar, a pista fica. O app instalado e o do navegador dividem esta memória.
import { LOG_EVENT, RESET_REASON, NOME_DA_PLACA } from './protocol.js';

export const CHAVE = 'eco.caixa-preta';
const MAX_EVENTOS = 300;
const corta = (v, n = 300) => (typeof v === 'string' ? v.slice(0, n) : v);

function le() {
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    return { eventos: Array.isArray(c.eventos) ? c.eventos : [], ecos: c.ecos && typeof c.ecos === 'object' ? c.ecos : {} };
  } catch {
    return { eventos: [], ecos: {} };
  }
}
function grava(c) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(c));
  } catch {
    // sem armazenamento (aba anônima, cheio): o app segue sem caixa-preta
  }
}

export function registra(tipo, dados = {}) {
  const c = le();
  const d = Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, corta(v)]));
  c.eventos = [...c.eventos, { t: new Date().toISOString(), k: tipo, d }].slice(-MAX_EVENTOS);
  grava(c);
}

// o Eco conectado e o registro de erros dele (o último lido vale: o Eco guarda os dele)
export function anotaEco(id, info) {
  const c = le();
  c.ecos[id] = { ...c.ecos[id], ...info, visto: new Date().toISOString() };
  grava(c);
}

export const limpa = () => grava({ eventos: [], ecos: {} });

const quando = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const MOTIVO = { [RESET_REASON.POWER_ON]: 'ligado na powerbank', [RESET_REASON.BROWNOUT]: 'queda de tensão', [RESET_REASON.SOFTWARE]: 'reiniciou pelo programa (atualização)', [RESET_REASON.WATCHDOG]: 'TRAVOU e reiniciou', [RESET_REASON.OTHER]: 'outro motivo' };
const EVENTO_ECO = {
  [LOG_EVENT.BOOT]: (a) => `ligou (${MOTIVO[a] ?? a})`,
  [LOG_EVENT.BROWNOUT]: () => 'a tensão caiu e reiniciou',
  [LOG_EVENT.FAILSAFE]: () => 'perdeu o celular andando e parou',
  [LOG_EVENT.LOW_BATTERY]: (a) => `bateria fraca (${(a / 10).toFixed(1)} V)`,
  [LOG_EVENT.BUMP]: (a) => `batida (${(a / 10).toFixed(1)} g)`,
  [LOG_EVENT.OTA_OK]: () => 'firmware atualizado',
  [LOG_EVENT.OTA_FAIL]: (a) => `atualização falhou (motivo ${a})`,
  [LOG_EVENT.PROG_ERROR]: (a) => `programa parou com erro ${a}`,
  [LOG_EVENT.EXP_FAULT]: () => 'ligação errada na porta de expansão',
  [LOG_EVENT.PECA]: (a) => `conferência das peças (${a})`,
  [LOG_EVENT.STALL]: (a) => `roda ${a ? 'direita' : 'esquerda'} travada`,
};
const textoDe = (d) => Object.entries(d ?? {}).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ');

// o texto que vai para a equipe (o mesmo que a pessoa vê antes de enviar)
export function relatorio({ versaoApp = '?', cache = '?', conectado = null } = {}) {
  const c = le();
  const instalado = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  const linhas = [
    'Relatório do app Ecocreator',
    `Gerado em ${quando(new Date().toISOString())} (relógio do celular)`,
    `App ${versaoApp} · ${cache} · aberto ${instalado ? 'como app instalado' : 'no navegador'} · ${navigator.onLine ? 'com' : 'sem'} internet`,
    `Aparelho: ${navigator.userAgent}`,
    `Tela ${screen.width}×${screen.height} (janela ${innerWidth}×${innerHeight}) · idioma ${navigator.language} · Bluetooth no navegador: ${'bluetooth' in navigator ? 'sim' : 'não'}`,
    conectado ? `Conectado agora: ${conectado}` : 'Nenhum Eco conectado agora',
    '',
    'Ecos:',
  ];
  const ecos = Object.entries(c.ecos);
  if (!ecos.length) linhas.push('  (nenhum Eco conectado neste celular desde que o registro começou)');
  for (const [id, e] of ecos) {
    linhas.push(`- ${e.nome ?? 'Eco'} (id ${id}) · firmware ${e.fw ?? '?'} · placa ${NOME_DA_PLACA[e.placa] ?? e.placa ?? '?'} · visto ${quando(e.visto)}`);
    if (e.log) {
      const l = e.log;
      linhas.push(`  Registro do Eco: ligou ${l.boots} vezes · quedas de tensão ${l.brownouts} · perdeu o celular andando ${l.failsafes} · bateria fraca ${l.lowBattery}`);
      for (const ev of l.events.slice(-24)) linhas.push(`    liga nº ${ev.boot}, ${ev.s} s: ${(EVENTO_ECO[ev.type] ?? ((a) => `evento ${ev.type} (${a})`))(ev.arg)}`);
    }
  }
  linhas.push('', `Eventos do app (${c.eventos.length}, do mais antigo ao mais novo):`);
  for (const ev of c.eventos) linhas.push(`${quando(ev.t)}  ${ev.k}  ${textoDe(ev.d)}`);
  return linhas.join('\n');
}
