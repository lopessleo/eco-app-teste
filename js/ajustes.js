// Aplica os ajustes de interface feitos no Estúdio (ajustes-css.js explica o formato). O visual vem de ajustes.css
// (carregado no <head>, sem piscar); aqui ficam os textos trocados e os elementos acrescentados, que precisam do DOM.
// Usado pelo app, pelo painel e pela página do técnico: cada um tem o seu ajustes.json ao lado do index.html.
// Dentro do Estúdio (?estudio=1, numa moldura), carrega também o agente de edição (estudio-agente.js).

let atuais = null;

// troca o texto "próprio" do elemento (o primeiro texto solto), sem apagar ícones/filhos
function trocaTexto(el, texto) {
  const no = [...el.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());
  if (no) {
    if (no.nodeValue !== texto) no.nodeValue = texto;
  } else if (!el.children.length) {
    if (el.textContent !== texto) el.textContent = texto;
  } else el.prepend(document.createTextNode(texto));
}

// Ícones (emojis) "discretos" ou escondidos: cada emoji vira <est-i> (etiqueta própria: não pega nas regras de span do
// programa). "junto" = há texto ao lado; só esses somem com "sem ícones" (botão só de ícone continua com ele).
const EMOJI = /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*\uFE0F?)/u;
const PULA = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'TITLE', 'EST-I', 'svg', 'SVG']);

function embrulhaIcones() {
  const nos = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      for (let p = n.parentNode; p && p !== document.body; p = p.parentNode) if (PULA.has(p.nodeName) || p.id === 'est-ui') return NodeFilter.FILTER_REJECT;
      return EMOJI.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  while (w.nextNode()) nos.push(w.currentNode);
  for (const n of nos) {
    const pai = n.parentElement;
    const junto = pai && pai.textContent.replace(new RegExp(EMOJI.source, 'gu'), '').trim().length > 0;
    const frag = document.createDocumentFragment();
    for (const parte of n.nodeValue.split(new RegExp(EMOJI.source, 'u'))) {
      if (!parte) continue;
      if (EMOJI.test(parte)) {
        const i = document.createElement('est-i');
        if (junto) i.className = 'junto';
        i.textContent = parte;
        frag.append(i);
      } else frag.append(document.createTextNode(parte));
    }
    n.replaceWith(frag);
  }
}

function desembrulhaIcones() {
  for (const i of document.querySelectorAll('est-i')) {
    const pai = i.parentNode;
    i.replaceWith(document.createTextNode(i.textContent));
    pai?.normalize();
  }
}

export function aplicaConteudo(ajustes) {
  atuais = ajustes;
  if (ajustes?.estilo?.icones) embrulhaIcones();
  else if (document.querySelector('est-i')) desembrulhaIcones();
  for (const [sel, p] of Object.entries(ajustes?.elementos ?? {})) {
    if (p.texto === undefined) continue;
    try {
      for (const el of document.querySelectorAll(sel)) trocaTexto(el, p.texto);
    } catch {
      // seletor que não vale mais (a tela mudou): ignora
    }
  }
  const ids = new Set((ajustes?.adicionados ?? []).map((a) => `est-${a.id}`));
  for (const el of document.querySelectorAll('.est-add')) if (!ids.has(el.id)) el.remove();
  for (const a of ajustes?.adicionados ?? []) {
    let alvo = null;
    try {
      alvo = document.querySelector(a.depoisDe);
    } catch {
      alvo = null;
    }
    if (!alvo) continue;
    let el = document.getElementById(`est-${a.id}`);
    if (!el) {
      el = document.createElement(a.tipo === 'imagem' ? 'img' : 'span');
      el.id = `est-${a.id}`;
      el.className = 'est-add';
    }
    if (a.tipo === 'imagem') {
      if (el.getAttribute('src') !== a.src) el.src = a.src;
      el.alt = '';
    } else if (el.textContent !== a.texto) el.textContent = a.texto;
    if (alvo.nextSibling !== el) alvo.after(el);
  }
}

// telas que se redesenham (listas, cartões): aplica de novo quando o DOM muda (sem brigar: só troca o que está diferente)
let agendado = false;
new MutationObserver(() => {
  if (!atuais || agendado) return;
  agendado = true;
  setTimeout(() => {
    agendado = false;
    aplicaConteudo(atuais);
  }, 120);
}).observe(document.documentElement, { childList: true, subtree: true });

const q = new URLSearchParams(location.search);
const noEstudio = q.get('estudio') === '1' && window.parent !== window;
if (noEstudio) {
  import('./estudio-agente.js').then((m) => m.inicia({ de: q.get('de') ?? '', aplicaConteudo }));
} else {
  fetch(new URL('ajustes.json', document.baseURI), { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((a) => a && aplicaConteudo(a))
    .catch(() => {});
}
