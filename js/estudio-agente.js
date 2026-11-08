// Agente do Estúdio de interface: roda DENTRO do programa quando ele está no preview do Estúdio (?estudio=1 numa moldura).
// Só conversa com a página que o abriu (origem passada em ?de=, sempre localhost) por postMessage:
//   Estúdio -> agente: { tipo: 'modo', modo: 'editar' | 'usar' } · { tipo: 'css', css, ajustes } · { tipo: 'selecionar', seletor } · { tipo: 'pai' }
//                      { tipo: 'ir', passos: [...] }  navegar até uma tela (passos: estudio-programas.json; ver `navega`)
//   agente -> Estúdio: { tipo: 'pronto' } · { tipo: 'selecionado', … } · { tipo: 'mudou', seletor, props } · { tipo: 'tecla', … }
// No modo editar, os cliques não chegam ao programa: escolhem um elemento. Arrastar move; o canto redimensiona.

const IGNORA_CLASSES = /^(active|on|off|hidden|selected|atual|open|show|ok|err|sel|disabled|running|pressed|dragging|est-.*|is-.*|has-.*)$/;
let de = '';
let aplicaConteudo = () => {};
let modo = 'editar';
let navegando = false; // cliques feitos pelo próprio agente para chegar a uma tela: passam
let sel = null; // elemento escolhido
let selInfo = null;
let hover = null;
let ui;

const envia = (m) => window.parent.postMessage(m, de);
const esc = (s) => (window.CSS?.escape ? CSS.escape(s) : String(s).replace(/[^\w-]/g, '\\$&'));
const unico = (s) => {
  try {
    return document.querySelectorAll(s).length === 1;
  } catch {
    return false;
  }
};
const conta = (s) => {
  try {
    return document.querySelectorAll(s).length;
  } catch {
    return 0;
  }
};

// ---------- seletores estáveis ----------

function ancoraDe(el) {
  for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (a.id && unico(`#${esc(a.id)}`)) return `#${esc(a.id)}`;
  return 'body';
}
const classes = (el) => [...el.classList].filter((c) => !IGNORA_CLASSES.test(c));
const dados = (el) => [...el.attributes].filter((a) => a.name.startsWith('data-') && a.value && a.value.length < 40 && !/^data-(v|estado|state)$/.test(a.name));

function seletorDe(el) {
  if (el.id && unico(`#${esc(el.id)}`)) return `#${esc(el.id)}`;
  const tag = el.tagName.toLowerCase();
  const anc = ancoraDe(el);
  for (const d of dados(el)) {
    const s = `${anc} ${tag}[${d.name}="${d.value.replace(/"/g, '\\"')}"]`;
    if (unico(s)) return s;
  }
  // caminho até a âncora
  const partes = [];
  for (let e = el; e && e !== document.body && !(e.id && `#${esc(e.id)}` === anc); e = e.parentElement) {
    const c = classes(e).map((x) => `.${esc(x)}`).join('');
    const irmaos = e.parentElement ? [...e.parentElement.children].filter((x) => x.tagName === e.tagName) : [];
    const n = irmaos.length > 1 ? `:nth-of-type(${irmaos.indexOf(e) + 1})` : '';
    partes.unshift(`${e.tagName.toLowerCase()}${c}${n}`);
  }
  return `${anc} > ${partes.join(' > ')}`;
}

// "todos iguais": mesma etiqueta e classes, dentro da mesma âncora (ex.: todos os cartões de aluno)
function seletorTodos(el) {
  const c = classes(el);
  if (!c.length) return null;
  const s = `${ancoraDe(el)} ${el.tagName.toLowerCase()}${c.map((x) => `.${esc(x)}`).join('')}`;
  return conta(s) > 1 ? s : null;
}

function nomeDe(el) {
  const t = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const tipo = { button: 'Botão', a: 'Link', img: 'Imagem', input: 'Campo', select: 'Lista', h1: 'Título', h2: 'Título', h3: 'Título', p: 'Texto', label: 'Rótulo', li: 'Item', span: 'Texto', section: 'Área', div: 'Caixa', header: 'Barra', main: 'Área', nav: 'Menu', svg: 'Desenho' }[el.tagName.toLowerCase()] ?? 'Elemento';
  return t ? `${tipo}: ${t}` : tipo;
}

const hex = (c) => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c);
  if (!m) return null;
  if (m[4] !== undefined && Number(m[4]) === 0) return 'transparent';
  return `#${[m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('')}`;
};
const textoProprio = (el) => [...el.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim())?.nodeValue.trim() ?? (el.children.length ? null : el.textContent.trim());

function info(el) {
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    tipo: 'selecionado', seletor: seletorDe(el), seletorTodos: seletorTodos(el), quantos: 0, nome: nomeDe(el),
    adicionado: el.classList.contains('est-add') ? el.id.slice(4) : null,
    texto: textoProprio(el), podeTexto: textoProprio(el) !== null || !el.children.length, temFilhos: el.children.length > 0,
    atual: {
      largura: Math.round(r.width), altura: Math.round(r.height), fonte: Math.round(parseFloat(cs.fontSize)), peso: Number(cs.fontWeight) || 400,
      cor: hex(cs.color), fundo: hex(cs.backgroundColor), raio: Math.round(parseFloat(cs.borderTopLeftRadius) || 0),
      espaco: Math.round(parseFloat(cs.paddingTop) || 0), opacidade: Number(cs.opacity), ordem: Number(cs.order) || 0,
    },
  };
}

// ---------- caixas de destaque (hover, seleção, alças) ----------

function montaUi() {
  ui = document.createElement('div');
  ui.id = 'est-ui';
  ui.innerHTML = `<style>
    #est-ui { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; }
    #est-ui .b { position: fixed; box-sizing: border-box; border-radius: 3px; display: none; }
    #est-ui .h { outline: 2px dashed #48dbfb; background: rgba(72,219,251,.08); }
    #est-ui .s { outline: 2px solid #ff9f1a; background: rgba(255,159,26,.08); pointer-events: auto; cursor: move; }
    #est-ui .s i { position: absolute; width: 12px; height: 12px; background: #ff9f1a; border: 2px solid #fff; border-radius: 3px; }
    #est-ui .s i.d { right: -7px; top: calc(50% - 6px); cursor: ew-resize; }
    #est-ui .s i.b2 { bottom: -7px; left: calc(50% - 6px); cursor: ns-resize; }
    #est-ui .s i.db { right: -7px; bottom: -7px; cursor: nwse-resize; }
    #est-ui .s span { position: absolute; left: 0; top: -22px; font: 700 11px/1 system-ui, sans-serif; background: #ff9f1a; color: #000; padding: 4px 6px; border-radius: 4px; white-space: nowrap; }
  </style><div class="b h"></div><div class="b s"><span></span><i class="d" data-r="w"></i><i class="b2" data-r="h"></i><i class="db" data-r="wh"></i></div>`;
  document.documentElement.append(ui);
  ui.querySelector('.s').addEventListener('pointerdown', arrasta);
}

function posiciona(box, el) {
  if (!el || !el.isConnected || modo !== 'editar') return (box.style.display = 'none');
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return (box.style.display = 'none');
  Object.assign(box.style, { display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
}

function quadro() {
  posiciona(ui.querySelector('.h'), hover && hover !== sel ? hover : null);
  posiciona(ui.querySelector('.s'), sel);
  if (sel) ui.querySelector('.s span').textContent = `${selInfo?.nome ?? ''} · ${Math.round(sel.getBoundingClientRect().width)}×${Math.round(sel.getBoundingClientRect().height)}`;
  requestAnimationFrame(quadro);
}

// o elemento de verdade debaixo do ponteiro (ignorando as caixas do Estúdio)
function debaixo(x, y) {
  ui.style.display = 'none';
  const el = document.elementFromPoint(x, y);
  ui.style.display = '';
  return el && el !== document.documentElement && el !== document.body ? el : null;
}

function escolhe(el) {
  sel = el;
  selInfo = el ? info(el) : null;
  if (selInfo) selInfo.quantos = selInfo.seletorTodos ? conta(selInfo.seletorTodos) : 1;
  envia(selInfo ?? { tipo: 'selecionado', seletor: null });
}

// ---------- arrastar (mover) e alças (tamanho) ----------

function arrasta(e) {
  if (!sel || e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const r0 = sel.getBoundingClientRect();
  const alca = e.target.dataset?.r ?? null;
  const t0 = getComputedStyle(sel).translate.split(' ').map((v) => parseFloat(v) || 0);
  const x0 = e.clientX;
  const y0 = e.clientY;
  let mudou = null;
  const move = (ev) => {
    const dx = Math.round(ev.clientX - x0);
    const dy = Math.round(ev.clientY - y0);
    if (!mudou && Math.abs(dx) + Math.abs(dy) < 3) return;
    if (!alca) {
      mudou = { x: t0[0] + dx, y: (t0[1] ?? 0) + dy };
      sel.style.setProperty('translate', `${mudou.x}px ${mudou.y}px`, 'important');
    } else {
      mudou = {};
      if (alca.includes('w')) mudou.largura = Math.max(4, Math.round(r0.width + dx));
      if (alca.includes('h')) mudou.altura = Math.max(4, Math.round(r0.height + dy));
      if (mudou.largura) sel.style.setProperty('width', `${mudou.largura}px`, 'important');
      if (mudou.altura) sel.style.setProperty('height', `${mudou.altura}px`, 'important');
    }
  };
  const solta = () => {
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', solta, true);
    if (mudou) envia({ tipo: 'mudou', props: mudou });
    else if (!alca) escolhe(debaixo(x0, y0)); // clique sem arrastar: escolhe o que está ali dentro
  };
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', solta, true);
}

// ---------- no modo editar, o programa não recebe cliques ----------

function bloqueia(e) {
  if (modo !== 'editar' || navegando || ui.contains(e.target)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (e.type === 'pointerdown' && e.button === 0) escolhe(debaixo(e.clientX, e.clientY));
}
for (const t of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend', 'contextmenu', 'submit']) {
  window.addEventListener(t, bloqueia, { capture: true, passive: false });
}
window.addEventListener('pointermove', (e) => {
  if (modo === 'editar' && !ui.contains(e.target)) hover = debaixo(e.clientX, e.clientY);
}, true);
window.addEventListener('keydown', (e) => {
  if (modo !== 'editar') return;
  e.preventDefault();
  e.stopImmediatePropagation();
  envia({ tipo: 'tecla', key: e.key, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey });
}, true);

// ---------- navegar até uma tela (abas, diálogos, login) ----------
// passo: { clicar: sel } | { preencher: sel, valor } | { enviar: formSel } | { esperar: sel, ms } | { pausa: ms }
//        + condição opcional { se: sel } (só se estiver visível) ou { seNao: sel } (só se NÃO estiver visível)
const pega = (s) => {
  try {
    return document.querySelector(s);
  } catch {
    return null;
  }
};
const visivel = (s) => {
  const el = pega(s);
  return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
};
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const algumVisivel = (lista) => lista.split(',').some((x) => visivel(x.trim()));

// espera a página "assentar" (nada mudando por 400 ms, no máximo 3 s): o programa terminou de carregar e desenhar
function calmo() {
  return new Promise((resolve) => {
    let t = setTimeout(fim, 400);
    const limite = setTimeout(fim, 3000);
    const obs = new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(fim, 400);
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true });
    function fim() {
      obs.disconnect();
      clearTimeout(t);
      clearTimeout(limite);
      resolve();
    }
  });
}

async function navega(passos) {
  navegando = true;
  const falhas = []; // passos que não acharam o que clicar (ex.: aba que só existe com a ECOcentral ligada)
  try {
    if (passos?.length) await calmo();
    for (const p of passos ?? []) {
      if (p.se && !visivel(p.se)) continue;
      if (p.seNao && visivel(p.seNao)) continue;
      if (p.esperar) {
        for (let t = 0; t < (p.ms ?? 5000) && !algumVisivel(p.esperar); t += 100) await pausa(100);
        if (!algumVisivel(p.esperar)) falhas.push(p.esperar);
        continue;
      }
      if (p.pausa) {
        await pausa(p.pausa);
        continue;
      }
      const alvo = p.clicar ?? p.preencher ?? p.enviar;
      // o botão pode estar aparecendo (animação, janela abrindo): espera um pouco
      for (let t = 0; p.clicar && t < 2500 && !visivel(alvo); t += 100) await pausa(100);
      const el = pega(alvo);
      if (!el || (p.clicar && !visivel(alvo))) {
        falhas.push(alvo);
        continue;
      }
      if (p.preencher) {
        el.value = p.valor ?? '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (p.enviar) el.requestSubmit?.();
      else el.click();
      await pausa(450);
    }
  } finally {
    navegando = false;
    envia({ tipo: 'navegou', falhas });
  }
}

// ---------- mensagens do Estúdio ----------

function recebe(ev) {
  if (ev.origin !== de || ev.source !== window.parent) return;
  const m = ev.data ?? {};
  if (m.tipo === 'modo') {
    modo = m.modo === 'usar' ? 'usar' : 'editar';
    hover = null;
  } else if (m.tipo === 'css') {
    let st = document.getElementById('est-css');
    if (!st) {
      st = document.createElement('style');
      st.id = 'est-css';
      document.head.append(st);
    }
    st.textContent = m.css;
    aplicaConteudo(m.ajustes);
    // o que veio do arrastar já está na regra: tira o estilo provisório
    if (sel) for (const p of ['translate', 'width', 'height']) sel.style.removeProperty(p);
    if (sel && sel.isConnected) {
      selInfo = { ...info(sel), quantos: selInfo?.quantos ?? 1, seletor: selInfo?.seletor ?? seletorDe(sel), seletorTodos: selInfo?.seletorTodos ?? null };
      envia({ ...selInfo, tipo: 'atualizado' });
    }
  } else if (m.tipo === 'ir') {
    navega(m.passos);
  } else if (m.tipo === 'pai') {
    if (sel?.parentElement && sel.parentElement !== document.body) escolhe(sel.parentElement);
  } else if (m.tipo === 'selecionar') {
    let el = null;
    try {
      el = m.seletor ? document.querySelector(m.seletor) : null;
    } catch {
      el = null;
    }
    escolhe(el);
    el?.scrollIntoView?.({ block: 'nearest' });
  }
}

export function inicia(opcoes) {
  de = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(opcoes.de) ? opcoes.de : '';
  if (!de) return; // só obedece ao Estúdio do próprio computador
  aplicaConteudo = opcoes.aplicaConteudo;
  // o ajustes.css salvo fica desligado: o Estúdio manda o CSS ao vivo
  for (const l of document.querySelectorAll('link[rel=stylesheet]')) if (/ajustes\.css(\?|$)/.test(l.href)) l.disabled = true;
  montaUi();
  requestAnimationFrame(quadro);
  window.addEventListener('message', recebe);
  envia({ tipo: 'pronto', titulo: document.title });
}
