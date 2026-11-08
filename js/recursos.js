// Recursos do produto: funções inteiras que a ecocreator liga ou desliga para cada cliente (app/recursos.json, editado
// pelo cartão "🎛️ Recursos" do lançador). Diferente do tipo de aula (que o professor escolhe): aqui é o que existe.
// Desligado = some da tela (todo elemento com data-recurso="id") e o código que depende dele não roda
// (recursoLigado('id')). Para tirar de vez um recurso de um cliente: desligue, rode os testes e depois apague o código
// marcado com o mesmo id (procure por data-recurso="id" e recursoLigado('id')).
// Usado pelo app, painel, técnico e emulador (no navegador); o servidor usa recursos-lista.js e lê o mesmo JSON.

import { RECURSOS, normaliza } from './recursos-lista.js';

export { RECURSOS, RECURSO_DO_MODO, normaliza } from './recursos-lista.js';

let lido = null;
try {
  if (typeof document !== 'undefined') {
    const r = await fetch(new URL('../recursos.json', import.meta.url), { cache: 'no-cache' });
    if (r.ok) lido = await r.json();
  }
} catch {
  // sem o arquivo (ou offline sem cache): tudo ligado
}
export const recursos = normaliza(lido);
export const recursoLigado = (id) => recursos[id] !== false;

// esconde o que pertence a recursos desligados (vence as classes que o próprio programa põe e tira)
if (typeof document !== 'undefined') {
  const off = RECURSOS.filter((r) => !recursos[r.id]).map((r) => `[data-recurso~="${r.id}"]`);
  if (off.length) {
    const st = document.createElement('style');
    st.id = 'recursos-off';
    st.textContent = `${off.join(',')}{display:none!important}`;
    document.head.append(st);
  }
  document.documentElement.dataset.recursosOff = RECURSOS.filter((r) => !recursos[r.id]).map((r) => r.id).join(' ');
}
