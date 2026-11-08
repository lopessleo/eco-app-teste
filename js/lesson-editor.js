// Editor do tipo de aula (modos, botões, velocidades). Usado no painel do professor ("Personalizado") e na
// página do técnico (padrão do Eco e da escola). Monta os campos dentro de `root`.

import { FEATURES, FEATURE_INFO, MODES, MODE_INFO, normalizeLesson } from './lesson.js';
import { speedWord } from './words.js';

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

function check(name, label, group) {
  const input = el('input', { type: 'checkbox', name, value: name });
  input.dataset.group = group;
  return el('label', { className: 'check' }, input, ` ${label}`);
}

function range(name, label, min, max, step) {
  const out = el('output');
  const input = el('input', { type: 'range', name, min, max, step });
  input.addEventListener('input', () => { out.textContent = `${input.value}% · ${speedWord(Number(input.value))}`; });
  return el('label', { className: 'field' }, `${label} `, out, input);
}

export class LessonEditor {
  // onchange(lesson): a cada mudança (opcional)
  constructor(root, { onchange = null } = {}) {
    this.root = root;
    this.onchange = onchange;
    root.classList.add('lesson-editor');
    const modes = el('fieldset', { className: 'le-modes' }, el('legend', {}, 'Modos que aparecem'),
      ...MODES.map((m) => check(m, `${MODE_INFO[m].icon} ${MODE_INFO[m].name}`, 'mode')));
    const feats = el('fieldset', { className: 'le-feats' }, el('legend', {}, 'Botões e recursos'),
      ...FEATURES.map((f) => check(f, `${FEATURE_INFO[f].icon} ${FEATURE_INFO[f].name}`, 'feature')));
    const speeds = el('fieldset', { className: 'le-speeds' }, el('legend', {}, 'Velocidades'),
      range('progSpeed', '🧩 Programas', 20, 100, 5),
      range('lineSpeed', '🛤️ Seguidor', 15, 80, 5),
      check('lineStrip', '🏁 Seguidor para na faixa de chegada', 'line'),
      check('lineDark', '⚫ Linha preta em chão claro', 'line'));
    root.replaceChildren(modes, feats, speeds);
    root.addEventListener('change', (e) => {
      // pelo menos um modo
      if (e.target.dataset?.group === 'mode' && !root.querySelector('[data-group=mode]:checked')) e.target.checked = true;
      this.onchange?.(this.value);
    });
  }

  get value() {
    const q = (n) => this.root.querySelector(`[name="${n}"]`);
    const l = { type: 'custom', modes: MODES.filter((m) => q(m).checked) };
    for (const f of FEATURES) l[f] = q(f).checked;
    l.progSpeed = Number(q('progSpeed').value);
    l.lineSpeed = Number(q('lineSpeed').value);
    l.lineStrip = q('lineStrip').checked;
    l.lineDark = q('lineDark').checked;
    return normalizeLesson(l);
  }

  set value(lesson) {
    const l = normalizeLesson(lesson);
    const q = (n) => this.root.querySelector(`[name="${n}"]`);
    for (const m of MODES) q(m).checked = l.modes.includes(m);
    for (const f of FEATURES) q(f).checked = l[f];
    q('progSpeed').value = l.progSpeed;
    q('lineSpeed').value = l.lineSpeed;
    q('lineStrip').checked = l.lineStrip;
    q('lineDark').checked = l.lineDark;
    for (const r of this.root.querySelectorAll('input[type=range]')) r.dispatchEvent(new Event('input'));
  }
}
