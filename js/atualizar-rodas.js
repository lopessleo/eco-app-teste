// Atualizador do protótipo (app/js/atualizador.js): o que o teste das rodas mostrou -> qual firmware mandar.
// O teste roda no firmware de rodas certas (prototipo.bin): "roda 1" é o que esse firmware chama de esquerda e "roda 2",
// de direita. Cada uma diz qual roda girou de verdade ('e' / 'd', ou null se nenhuma) e se foi para a frente.
// Os arquivos saem de tools/build-firmware-prototipo.mjs (MOTOR_TROCA, MOTOR_INV_E, MOTOR_INV_D em firmware/eco/src/config.h).

export const ARQUIVO_NORMAL = 'prototipo.bin';

// [maior, menor]: a é mais velha que b? (0.9 < 0.10: compara número a número, não como texto)
export const maisVelha = (a, b) => (a[0] !== b[0] ? a[0] < b[0] : a[1] < b[1]);

// versão publicada junto com os firmwares (firmware/prototipo.json); null sem internet ou sem o arquivo
export async function versaoPublicada(pasta = 'firmware') {
  try {
    const r = await fetch(`${pasta}/prototipo.json`, { cache: 'no-store' });
    if (!r.ok) return null;
    const v = String((await r.json()).versao).split('.').map(Number);
    return v.length === 2 && v.every(Number.isFinite) ? v : null;
  } catch {
    return null;
  }
}

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
