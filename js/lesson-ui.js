// Tipo de aula na tela da criança: só aparecem os modos e botões que a aula libera.
// Vale o do professor (sala de aula); fora da aula, o padrão gravado no Eco pelo técnico.

import { DEFAULT_LESSON, normalizeLesson, sameLesson } from './lesson.js';
import { RECURSO_DO_MODO, recursoLigado } from './recursos.js';
import { S, CAP_DA_TELA, emit, on, temCap } from './state.js';
import { prefs } from './prefs.js';
import { $, params } from './util.js';

// botão de modo escondido no Estúdio (ajustes.css): a classe .hidden é nossa, por isso não conta. No ?preview vale tudo
// (é por ali que o Estúdio abre cada tela para editar)
function escondidoNoEstudio(modo) {
  const b = document.querySelector(`#modes [data-mode="${modo}"]`);
  if (!b || params.has('preview')) return false;
  const tinha = b.classList.contains('hidden');
  b.classList.remove('hidden');
  const escondido = getComputedStyle(b).display === 'none';
  b.classList.toggle('hidden', tinha);
  return escondido;
}

// modos de recursos desligados para este cliente (app/recursos.json) nunca aparecem; sobra pelo menos o tanque.
// Os escondidos no Estúdio saem também, menos se a aula só tiver eles (ex.: competição, só com o Seguidor)
export function effectiveLesson() {
  const l = normalizeLesson(S.policy.lesson ?? S.carLesson ?? DEFAULT_LESSON);
  const liberados = l.modes.filter((m) => recursoLigado(RECURSO_DO_MODO[m] ?? m) && (m !== 'line' || temCap(CAP_DA_TELA.line)));
  const visiveis = liberados.filter((m) => !escondidoNoEstudio(m));
  const modes = visiveis.length ? visiveis : liberados;
  return modes.length === l.modes.length ? l : { ...l, modes: modes.length ? modes : ['tank'] };
}

export function applyLesson() {
  const l = effectiveLesson();
  const changed = !sameLesson(l, S.lesson);
  S.lesson = l;
  for (const b of document.querySelectorAll('#modes button')) b.classList.toggle('hidden', !l.modes.includes(b.dataset.mode));
  $('#modes').classList.toggle('hidden', l.modes.length < 2);
  for (const el of document.querySelectorAll('[data-feature]')) el.classList.toggle('hidden', !l[el.dataset.feature]);
  // o que a placa deste Eco não tem some (ex.: a ECOplus não tem setas nem modo polícia: evita confusão)
  for (const el of document.querySelectorAll('[data-cap]')) if (!temCap(CAP_DA_TELA[el.dataset.cap])) el.classList.add('hidden');
  // sobrou pouco botão (placas básicas): o velocímetro cresce e vira conta-giros
  const botoes = [...document.querySelectorAll('.lights .lb')].filter((b) => getComputedStyle(b).display !== 'none').length; // vale também o que o Estúdio escondeu
  $('.center').classList.toggle('gauge-grande', botoes <= 2);
  $('.lights').classList.toggle('hidden', !botoes);
  if (changed) emit('lesson', l);
  // o modo atual saiu da aula: vai para o primeiro liberado
  if (!l.modes.includes(prefs.mode)) emit('setMode', l.modes[0]);
}

on('policy', applyLesson);
on('carLesson', applyLesson);
on('caps', applyLesson);
