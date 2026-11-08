// Editor de blocos do modo programação: paleta (por categoria) + trilho de cartões.
// Um "cursor" (a barrinha verde) diz onde o próximo bloco entra; tocar num cartão põe o cursor depois dele.
// "Repetir" e "Se..." entram já com o seu "Fim", e o cursor vai para dentro deles.
// Usado no app (modo programação) e no painel do professor (para montar o programa que vai para a turma).

import { BLOCKS, CATEGORIES, MAX_STEPS, matchBlocks, depths, normalizeProgram, blocosVisiveis } from './program.js';

const DEPTH_COLORS = ['#7c5cff', '#ff8a3d', '#2fb8a6', '#e04f8f'];

export class ProgramEditor {
  // opts: { program, onchange(program), onrun(), onstop(), describe(program) -> texto, compact }
  constructor(root, opts) {
    this.opts = opts;
    this.root = root;
    this.program = normalizeProgram(opts.program);
    this.cursor = this.program.steps.length;
    this.category = CATEGORIES[0].id;
    this.running = false;
    this.palette = root.querySelector('.palette');
    this.tabs = root.querySelector('.pal-tabs');
    this.track = root.querySelector('.track');
    this.info = root.querySelector('.prog-info');
    this.runBtn = root.querySelector('[data-act="run"]');

    for (const c of CATEGORIES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.label;
      b.dataset.cat = c.id;
      b.addEventListener('click', () => {
        this.category = c.id;
        this.renderPalette();
      });
      this.tabs?.append(b);
    }
    this.runBtn?.addEventListener('click', () => (this.running ? opts.onstop?.() : opts.onrun?.()));
    root.querySelector('[data-act="clear"]')?.addEventListener('click', () => {
      if (!this.program.steps.length || !confirm('Apagar todos os blocos?')) return;
      this.program.steps = [];
      this.cursor = 0;
      this.changed();
    });
    // tocar no espaço vazio do trilho: cursor no fim
    this.track.addEventListener('click', (e) => {
      if (e.target !== this.track) return;
      this.cursor = this.program.steps.length;
      this.render();
    });
    this.renderPalette();
    this.render();
  }

  setProgram(program) {
    this.program = normalizeProgram(program); // (blocos de outro cenário saem aqui: normalizeProgram filtra pelos que existem)
    this.cursor = this.program.steps.length;
    this.render();
  }

  renderPalette() {
    // categoria sem nenhum bloco visível (ex.: "Cenário" no Eco, "Mover" na maquete) some
    const visivel = (b) => !(blocosVisiveis.maquete && b.anda);
    const temCat = (cat) => Object.values(BLOCKS).some((b) => b.cat === cat && visivel(b));
    if (!temCat(this.category)) this.category = CATEGORIES.find((c) => temCat(c.id))?.id ?? this.category;
    for (const b of this.tabs?.children ?? []) {
      b.classList.toggle('on', b.dataset.cat === this.category);
      b.classList.toggle('hidden', !temCat(b.dataset.cat));
    }
    this.palette.replaceChildren();
    for (const [type, b] of Object.entries(BLOCKS)) {
      if (b.cat !== this.category || !visivel(b)) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `block b-${type}`;
      btn.innerHTML = `<span>${b.icon}</span><small>${b.label}</small>`;
      btn.addEventListener('click', () => this.add(type));
      this.palette.append(btn);
    }
  }

  add(type) {
    const steps = this.program.steps;
    const b = BLOCKS[type];
    const n = b.opens ? 2 : 1;
    if (steps.length + n > MAX_STEPS) return;
    const block = { type, value: b.def ?? 0 };
    if (b.opens) steps.splice(this.cursor, 0, block, { type: 'end', value: 0 });
    else steps.splice(this.cursor, 0, block);
    this.cursor += 1; // dentro do "repetir/se", ou depois do bloco
    this.changed();
    requestAnimationFrame(() => this.track.querySelector('.caret')?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }));
  }

  remove(i) {
    const steps = this.program.steps;
    const match = matchBlocks(steps);
    if (BLOCKS[steps[i].type].opens && match) {
      // tira o "repetir/se" e o seu fim; o que estava dentro fica
      const j = match[i];
      steps.splice(j, 1);
      steps.splice(i, 1);
      if (this.cursor > j) this.cursor--;
      if (this.cursor > i) this.cursor--;
    } else {
      steps.splice(i, 1);
      if (this.cursor > i) this.cursor--;
    }
    this.changed();
  }

  changed() {
    this.opts.onchange?.(this.program);
    this.render();
  }

  setRunning(running) {
    this.running = running;
    if (this.runBtn) {
      this.runBtn.textContent = running ? '⏹ Parar' : '▶ Executar';
      this.runBtn.classList.toggle('stop', running);
    }
    this.root.classList.toggle('running', running);
    if (!running) this.highlight(-1);
  }

  highlight(index) {
    this.track.querySelectorAll('.pcard').forEach((c) => c.classList.toggle('now', Number(c.dataset.i) === index));
    this.track.querySelector('.pcard.now')?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  render() {
    const steps = this.program.steps;
    if (this.info) this.info.textContent = this.opts.describe?.(this.program) ?? '';
    this.track.replaceChildren();
    const caret = () => {
      const c = document.createElement('div');
      c.className = 'caret';
      return c;
    };
    if (!steps.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = '👈 Toque nos blocos para montar o caminho do Eco';
      this.track.append(empty);
      return;
    }
    const depth = depths(steps);
    const match = matchBlocks(steps);
    steps.forEach((s, i) => {
      if (i === this.cursor) this.track.append(caret());
      this.track.append(this._card(s, i, depth[i], match));
    });
    if (this.cursor >= steps.length) this.track.append(caret());
  }

  _card(s, i, depth, match) {
    const b = BLOCKS[s.type];
    const card = document.createElement('div');
    card.className = `pcard b-${s.type}${b.opens ? ' opens' : ''}${s.type === 'end' ? ' end' : ''}`;
    card.dataset.i = i;
    // faixa colorida em cima: de qual "repetir/se" o bloco faz parte
    const own = b.opens ? depth : s.type === 'end' ? depth : depth - 1;
    card.style.setProperty('--depth', depth);
    if (own >= 0 && (depth > 0 || b.opens || s.type === 'end')) card.style.setProperty('--band', DEPTH_COLORS[own % DEPTH_COLORS.length]);
    const label = s.type === 'end' && match ? `Fim do ${BLOCKS[this.program.steps[match[i]].type].label.toLowerCase()}` : b.label;
    card.innerHTML = `${s.type === 'end' ? '' : '<button type="button" class="del" aria-label="Tirar">✕</button>'}
      <span class="ic">${b.icon}</span><small>${label}</small>`;
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      this.cursor = i + 1;
      this.render();
    });
    card.querySelector('.del')?.addEventListener('click', () => this.remove(i));
    if (b.unit) {
      const row = document.createElement('div');
      row.className = 'val';
      const text = s.value === 0 && b.zero ? b.zero : `${String(s.value).replace('.', ',')}${b.unit === '×' ? '×' : ` ${b.unit}`}`;
      row.innerHTML = `<button type="button">−</button><b>${text}</b><button type="button">+</button>`;
      const [minus, plus] = row.querySelectorAll('button');
      const bump = (d) => {
        s.value = Math.min(b.max, Math.max(b.min, Math.round((s.value + d * b.step) * 10) / 10));
        this.changed();
      };
      minus.addEventListener('click', () => bump(-1));
      plus.addEventListener('click', () => bump(1));
      card.append(row);
    } else if (b.choices) {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'choice';
      choice.textContent = b.choices[s.value];
      choice.addEventListener('click', () => {
        s.value = (s.value + 1) % b.choices.length;
        this.changed();
      });
      card.append(choice);
    }
    return card;
  }
}
