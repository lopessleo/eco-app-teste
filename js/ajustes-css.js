// Ajustes de interface feitos no Estúdio (tools/lancador/estudio.*), sem código: o que fica escondido, onde fica, tamanho,
// cores, textos e elementos acrescentados. Guardados em <programa>/ajustes.json; o CSS gerado daqui vai para
// <programa>/ajustes.css (carregado por cada página) e os textos/acrescentados são aplicados por ajustes.js.
// Módulo puro (sem DOM): usado no navegador (Estúdio, preview) e no Node (lançador grava o .css).
//
// Formato (versao 1):
//   { versao: 1,
//     pacote: 'alegre',   (o pacote de estilo escolhido no Estúdio, só para lembrar)
//     tema: { escuro: { '--accent': '#1a8e5d', … }, claro: { … } },
//     estilo: { fonte, cantos: 'retos' | 'suaves' | 'redondos', icones: 'discretos' | 'nenhum', escala: 85..120, base: 'claro' | 'escuro' },
//     elementos: { '<seletor CSS>': { oculto, x, y, largura, altura, fonte, peso, cor, fundo, raio, espaco, opacidade, ordem, texto } },
//     adicionados: [{ id, tipo: 'texto' | 'emoji' | 'imagem', texto, src (data:image/…), depoisDe: '<seletor>' }] }

export const PROPS = ['oculto', 'x', 'y', 'largura', 'altura', 'fonte', 'peso', 'cor', 'fundo', 'raio', 'espaco', 'opacidade', 'ordem', 'texto'];
const LIMITE_TEXTO = 300;

// fontes que o programa leva junto (app/fonts, funcionam sem internet) ou que todo aparelho tem
export const FONTES = {
  raleway: { nome: 'Raleway (ecocreator)', arquivo: 'raleway-latin.woff2', pesos: '400 800', reserva: 'sans-serif' },
  sistema: { nome: 'Do sistema (Segoe/Roboto)', pilha: "system-ui, 'Segoe UI', Roboto, Arial, sans-serif" },
  inter: { nome: 'Inter (moderna)', arquivo: 'inter-latin.woff2', pesos: '300 800', reserva: 'sans-serif' },
  nunito: { nome: 'Nunito (amigável)', arquivo: 'nunito-latin.woff2', pesos: '300 900', reserva: 'sans-serif' },
  fredoka: { nome: 'Fredoka (alegre)', arquivo: 'fredoka-latin.woff2', pesos: '300 700', reserva: 'sans-serif' },
  lora: { nome: 'Lora (clássica, com serifa)', arquivo: 'lora-latin.woff2', pesos: '400 700', reserva: 'Georgia, serif' },
  mono: { nome: 'Máquina de escrever', pilha: "Consolas, 'Roboto Mono', 'Courier New', monospace" },
};
export const CANTOS = { retos: 3, suaves: 9, redondos: 20 };
const LIMITE_IMAGEM = 400 * 1024; // data URL de cada imagem acrescentada

const num = (v, min, max) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Math.min(max, Math.max(min, Math.round(Number(v) * 10) / 10)) : undefined);
const cor = (v) => (typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|transparent)$/i.test(v.trim()) ? v.trim() : undefined);
// seletor gerado pelo Estúdio; nada que feche a regra ou abra outra
export const seletorValido = (s) => typeof s === 'string' && s.length > 0 && s.length <= 400 && !/[{};<@\\]|\/\*/.test(s);
const varValida = (v) => typeof v === 'string' && /^--[a-z0-9-]{1,40}$/i.test(v);

// confere e limpa o que veio (do arquivo ou da tela): só campos conhecidos, números em faixas, cores e seletores seguros
export function limpaAjustes(a) {
  const out = { versao: 1, tema: {}, elementos: {}, adicionados: [] };
  if (!a || typeof a !== 'object') return out;
  if (typeof a.pacote === 'string' && /^[a-z0-9-]{1,30}$/.test(a.pacote)) out.pacote = a.pacote;
  const st = a.estilo && typeof a.estilo === 'object' ? a.estilo : {};
  const estilo = {
    fonte: Object.hasOwn(FONTES, st.fonte) ? st.fonte : undefined,
    cantos: Object.hasOwn(CANTOS, st.cantos) ? st.cantos : undefined,
    icones: ['discretos', 'nenhum'].includes(st.icones) ? st.icones : undefined,
    escala: num(st.escala, 85, 120),
    base: ['claro', 'escuro'].includes(st.base) ? st.base : undefined,
  };
  if (estilo.escala === 100) delete estilo.escala;
  for (const k of Object.keys(estilo)) if (estilo[k] === undefined) delete estilo[k];
  if (Object.keys(estilo).length) out.estilo = estilo;
  for (const [grupo, vars] of Object.entries(a.tema ?? {})) {
    if (!/^[a-z]{1,20}$/.test(grupo) || !vars || typeof vars !== 'object') continue;
    const g = {};
    for (const [k, v] of Object.entries(vars)) if (varValida(k) && cor(v)) g[k] = cor(v);
    if (Object.keys(g).length) out.tema[grupo] = g;
  }
  for (const [sel, p] of Object.entries(a.elementos ?? {}).slice(0, 2000)) {
    if (!seletorValido(sel) || !p || typeof p !== 'object') continue;
    const e = {
      oculto: p.oculto === true ? true : undefined,
      x: num(p.x, -3000, 3000), y: num(p.y, -3000, 3000), largura: num(p.largura, 0, 5000), altura: num(p.altura, 0, 5000),
      fonte: num(p.fonte, 4, 300), peso: [300, 400, 500, 600, 700, 800].includes(Number(p.peso)) ? Number(p.peso) : undefined,
      cor: cor(p.cor), fundo: cor(p.fundo), raio: num(p.raio, 0, 999), espaco: num(p.espaco, 0, 500), opacidade: num(p.opacidade, 0, 1),
      ordem: num(p.ordem, -99, 99), texto: typeof p.texto === 'string' ? p.texto.slice(0, LIMITE_TEXTO) : undefined,
    };
    for (const k of Object.keys(e)) if (e[k] === undefined) delete e[k];
    if (Object.keys(e).length) out.elementos[sel] = e;
  }
  for (const x of (Array.isArray(a.adicionados) ? a.adicionados : []).slice(0, 200)) {
    if (!x || !/^[a-z0-9]{1,16}$/.test(x.id ?? '') || !['texto', 'emoji', 'imagem'].includes(x.tipo) || !seletorValido(x.depoisDe)) continue;
    const n = { id: x.id, tipo: x.tipo, depoisDe: x.depoisDe };
    if (x.tipo === 'imagem') {
      if (typeof x.src !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(x.src) || x.src.length > LIMITE_IMAGEM * 1.4) continue;
      n.src = x.src;
    } else n.texto = String(x.texto ?? '').slice(0, LIMITE_TEXTO);
    out.adicionados.push(n);
  }
  return out;
}

// a regra CSS de um elemento (!important: vence o estilo do programa; o arrastar no Estúdio usa estilo inline)
function regra(p) {
  const d = [];
  if (p.oculto) d.push('display: none');
  if (p.x !== undefined || p.y !== undefined) d.push(`translate: ${p.x ?? 0}px ${p.y ?? 0}px`);
  if (p.largura !== undefined) d.push(`width: ${p.largura}px`, `min-width: 0`, `max-width: none`, `flex-shrink: 0`);
  if (p.altura !== undefined) d.push(`height: ${p.altura}px`, `min-height: 0`, `max-height: none`);
  if (p.fonte !== undefined) d.push(`font-size: ${p.fonte}px`);
  if (p.peso !== undefined) d.push(`font-weight: ${p.peso}`);
  if (p.cor) d.push(`color: ${p.cor}`);
  if (p.fundo) d.push(`background: ${p.fundo}`);
  if (p.raio !== undefined) d.push(`border-radius: ${p.raio}px`);
  if (p.espaco !== undefined) d.push(`padding: ${p.espaco}px`);
  if (p.opacidade !== undefined) d.push(`opacity: ${p.opacidade}`);
  if (p.ordem !== undefined) d.push(`order: ${p.ordem}`);
  return d.map((x) => `${x} !important`).join('; ');
}

// o pacote de estilo: fonte, cantos, ícones, tamanho geral, base clara/escura.
// alvos: { fontes: caminho de app/fonts a partir da página, superficies: o que tem cantos (botões, cartões…) }
function cssDoEstilo(e, alvos) {
  const l = [];
  const f = FONTES[e.fonte];
  if (f) {
    let familia = f.pilha;
    if (f.arquivo) {
      l.push(`@font-face { font-family: 'Est Fonte'; src: url('${alvos.fontes ?? 'fonts/'}${f.arquivo}') format('woff2'); font-weight: ${f.pesos}; font-display: swap; }`);
      familia = `'Est Fonte', ${f.reserva}`;
    }
    l.push(`body, body *:not(code):not(pre):not(est-i) { font-family: ${familia} !important; }`);
  }
  if (e.cantos && alvos.superficies) l.push(`${alvos.superficies} { border-radius: ${CANTOS[e.cantos]}px !important; }`);
  if (e.icones === 'discretos') l.push('est-i { filter: grayscale(1); opacity: .8; }');
  if (e.icones === 'nenhum') l.push('est-i.junto { display: none !important; }');
  if (e.escala) l.push(`body { zoom: ${e.escala / 100}; }`);
  if (e.base) l.push(`:root { color-scheme: ${e.base === 'claro' ? 'light' : 'dark'} !important; }`);
  return l;
}

// temas: { escuro: [{ sel, media? }], claro: [...] } — onde cada grupo de cores vale (cada programa tem o seu, estudio-programas.json)
export function cssDosAjustes(ajustesBrutos, temas = { escuro: [{ sel: ':root' }] }, alvos = {}) {
  const a = limpaAjustes(ajustesBrutos);
  const linhas = ['/* gerado pelo Estúdio de interface (lançador). Não edite à mão: use o Estúdio. */'];
  if (a.estilo) linhas.push(...cssDoEstilo(a.estilo, alvos));
  for (const [grupo, vars] of Object.entries(a.tema)) {
    const corpo = Object.entries(vars).map(([k, v]) => `${k}: ${v} !important;`).join(' ');
    for (const alvo of temas[grupo] ?? []) {
      const r = `${alvo.sel} { ${corpo} }`;
      linhas.push(alvo.media ? `@media ${alvo.media} { ${r} }` : r);
    }
  }
  for (const [sel, p] of Object.entries(a.elementos)) {
    const r = regra(p);
    if (r) linhas.push(`${sel} { ${r}; }`);
  }
  // acrescentados: aparência padrão (o resto vem de elementos['#est-<id>'])
  if (a.adicionados.length) linhas.push('.est-add { display: inline-block; } img.est-add { max-width: 100%; height: auto; }');
  return `${linhas.join('\n')}\n`;
}
