// Conferência das peças no app da criança: o Eco conta o que percebeu em cada peça (PORTS_INFO) e o app mostra
// "🔌 Confira as peças" só com o que a aula usa (aula só de dirigir não cobra os sensores de linha, por exemplo).
// Roda travada vira um aviso na hora. O resumo vai para o professor (selo no cartão do aluno, pela telemetria da sala).

import * as P from './protocol.js';
import { S, api, on } from './state.js';
import { $, toast, vibrate } from './util.js';

const ST = P.PECA_ST;
const GRUPO = { me: 'motor', md: 'motor', fe: 'luzes', fd: 'luzes', te: 'luzes', td: 'luzes', le: 'seguidor', ld: 'seguidor', son: 'sonar' };

// o que a aula usa: motores sempre; luzes se a aula tem os botões de luz; seguidor e sonar conforme os modos
export function usoDaAula(lesson) {
  const modes = lesson?.modes ?? [];
  return { motor: true, luzes: !!lesson?.lights, seguidor: modes.includes('line'), sonar: modes.includes('program') };
}

function frase(id, st) {
  const nome = P.PECA_NOME[id];
  if (st === ST.FALTA) return `Falta encaixar o ${nome}.`;
  if (st === ST.FROUXA) return `O ${nome} está frouxo: empurre o cabo até o fim.`;
  if (st === ST.ERRADA) return GRUPO[id] === 'motor' ? `Tem uma peça no lugar do ${nome}. Chame o professor.` : `O ${nome} não parece um LED. Chame o professor.`;
  return '';
}

// itens que a criança precisa ver agora (o que a aula usa e está com problema)
export function itensParaConferir(pecas, lesson) {
  if (!pecas) return [];
  const uso = usoDaAula(lesson);
  return P.PECAS.filter((id) => uso[GRUPO[id]] && [ST.FALTA, ST.FROUXA, ST.ERRADA].includes(pecas[id]))
    .map((id) => ({ id, st: pecas[id], txt: frase(id, pecas[id]) }));
}

let escondidoAte = ''; // a criança tocou "OK": some até a lista mudar
function desenha() {
  const box = $('#confira');
  if (!box) return;
  const itens = S.transport?.connected ? itensParaConferir(S.pecas, S.lesson) : [];
  const chave = itens.map((i) => i.id + i.st).join();
  if (!itens.length || chave === escondidoAte) {
    box.classList.add('hidden');
    return;
  }
  box.querySelector('ul').replaceChildren(...itens.slice(0, 4).map((i) => Object.assign(document.createElement('li'), { textContent: i.txt })));
  box.dataset.chave = chave;
  box.classList.remove('hidden');
}

let antes = null;
on('pecas', (p) => {
  // roda travada: aviso na hora (o Eco já parou aquele motor para se proteger)
  for (const [id, lado] of [['me', 'esquerda'], ['md', 'direita']]) {
    if (p[id] === ST.TRAVADA && antes?.[id] !== ST.TRAVADA) {
      toast(`🛑 A roda ${lado} travou! Solte o Eco ou tire o que está prendendo.`);
      vibrate([150, 80, 150]);
    }
  }
  antes = p;
  desenha();
});
on('lesson', desenha);
on('connection', desenha);
$('#confira')?.querySelector('button')?.addEventListener('click', () => {
  escondidoAte = $('#confira').dataset.chave;
  $('#confira').classList.add('hidden');
});

api.pecas = { itensParaConferir }; // a telemetria da sala (class-ui.js) manda o que falta conferir
