// Página de atualização dos protótipos (app/atualizar.html): o que o teste das rodas mostrou -> qual firmware mandar.
// O teste roda no firmware de rodas certas (prototipo.bin): "roda 1" é o que esse firmware chama de esquerda e "roda 2",
// de direita. Cada uma diz qual roda girou de verdade ('e' / 'd', ou null se nenhuma) e se foi para a frente.
// Os arquivos saem de tools/build-firmware-prototipo.mjs (MOTOR_TROCA, MOTOR_INV_E, MOTOR_INV_D em firmware/eco/src/config.h).

export const ARQUIVO_NORMAL = 'prototipo.bin';

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
