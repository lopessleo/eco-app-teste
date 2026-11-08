// Atualizador do protótipo (app/js/atualizador.js): o que o teste das rodas mostrou -> qual firmware mandar.
// O teste roda no firmware de rodas certas (prototipo.bin): "roda 1" é o que esse firmware chama de esquerda e "roda 2",
// de direita. Cada uma diz qual roda girou de verdade ('e' / 'd', ou null se nenhuma) e se foi para a frente.
// Os arquivos saem de tools/build-firmware-prototipo.mjs (MOTOR_TROCA, MOTOR_INV_E, MOTOR_INV_D em firmware/eco/src/config.h).

export const ARQUIVO_NORMAL = 'prototipo.bin';

// [maior, menor]: a é mais velha que b? (0.9 < 0.10: compara número a número, não como texto)
export const maisVelha = (a, b) => (a[0] !== b[0] ? a[0] < b[0] : a[1] < b[1]);

const versaoDe = (t) => {
  const v = String(t).split('.').map(Number);
  return v.length === 2 && v.every(Number.isFinite) ? v : null;
};
// o que está publicado junto com os firmwares (firmware/prototipo.json): a versão nova e as antigas guardadas
// (firmware/versoes/<versão>/<arquivo>, tools/build-firmware-prototipo.mjs); null sem internet ou sem o arquivo
export async function publicado(pasta = 'firmware') {
  try {
    const r = await fetch(`${pasta}/prototipo.json`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    const versao = versaoDe(j.versao);
    return versao ? { versao, versoes: (j.versoes ?? []).map(versaoDe).filter(Boolean) } : null;
  } catch {
    return null;
  }
}
export const versaoPublicada = async (pasta) => (await publicado(pasta))?.versao ?? null;

// Histórico de versões de cada Eco, neste celular: a cada atualização, a versão que ele tinha e a que recebeu (e o
// arquivo, que diz o jeito das rodas). "Voltar" vai para a que ele tinha antes, mesmo pulando várias (0.8 -> 1.4 -> 0.8).
// Fica no celular que atualizou; nos kits, o certo será o Eco guardar (por enquanto é só o protótipo).
const HIST = 'eco.versoes';
const leHist = () => {
  try {
    return JSON.parse(localStorage.getItem(HIST) || '{}');
  } catch {
    return {};
  }
};
export function anotaVersao(id, versao, arquivo = null) {
  const h = leHist();
  const lista = h[id] ?? [];
  const texto = versao.join('.');
  if (lista.at(-1)?.versao === texto && lista.at(-1)?.arquivo === arquivo) return;
  h[id] = [...lista, { versao: texto, arquivo, t: new Date().toISOString() }].slice(-20);
  try {
    localStorage.setItem(HIST, JSON.stringify(h));
  } catch {
    // sem armazenamento: "voltar" usa a versão guardada anterior à atual
  }
}
export const historico = (id) => leHist()[id] ?? [];
// para onde "voltar": a última versão diferente da atual no histórico; sem histórico, a guardada logo abaixo da atual
export function versaoAnterior(id, atual, guardadas = []) {
  const texto = atual.join('.');
  const h = [...historico(id)].reverse().find((e) => e.versao !== texto);
  if (h) return { versao: versaoDe(h.versao), arquivo: h.arquivo };
  const abaixo = guardadas.filter((v) => maisVelha(v, atual)).sort((a, b) => (maisVelha(a, b) ? 1 : -1))[0];
  return abaixo ? { versao: abaixo, arquivo: null } : null;
}
// arquivo de uma versão guardada; sem o jeito das rodas conhecido, o de rodas certas
export const arquivoGuardado = ({ versao, arquivo }) => `versoes/${versao.join('.')}/${arquivo ?? ARQUIVO_NORMAL}`;

export function varianteDasRodas(r1, r2) {
  if (!r1?.roda || !r2?.roda) return { erro: 'Uma roda não girou. Confira se o fio daquele motor está bem encaixado e se a powerbank está ligada.' };
  if (r1.roda === r2.roda) return { erro: 'As duas vezes girou a mesma roda. Confira os fios dos motores e faça o teste de novo.' };
  const troca = r1.roda === 'd';
  const [esq, dir] = troca ? [r2, r1] : [r1, r2];
  const invE = !esq.frente;
  const invD = !dir.frente;
  const sufixo = `${troca ? 't' : ''}${invE ? 'e' : ''}${invD ? 'd' : ''}`;
  return { troca, invE, invD, arquivo: sufixo ? `prototipo-${sufixo}.bin` : ARQUIVO_NORMAL };
}
