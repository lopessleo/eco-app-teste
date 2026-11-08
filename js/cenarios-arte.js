// Ilustrações dos cenários (SVG, 200 × 140): as telas "O que você montou?" do app, o painel e o técnico usam.
// Desenho simples e chapado, nas cores da marca. arte(id) devolve o SVG como texto.

const C = {
  ceu: '#d9f1f7', chao: '#cfe8c9', verde: '#1a8e5d', azul: '#008c98', laranja: '#ff9f1a', amarelo: '#ffd23f', vermelho: '#e5484d',
  cinza: '#5d6a64', claro: '#ffffff', escuro: '#1d2622', madeira: '#c98b4b', roxo: '#8e5cd9', rosa: '#ff8fb1', placa: '#2f7a5a',
};
const fundo = (ceu = C.ceu, chao = C.chao) => `<rect width="200" height="140" rx="16" fill="${ceu}"/><path d="M0 104h200v20a16 16 0 0 1-16 16H16A16 16 0 0 1 0 124z" fill="${chao}"/>`;
const placa = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><rect width="34" height="22" rx="4" fill="${C.placa}"/><rect x="5" y="5" width="10" height="8" rx="1.5" fill="${C.escuro}"/><circle cx="25" cy="9" r="2.4" fill="${C.amarelo}"/><rect x="18" y="15" width="12" height="3" rx="1.5" fill="#9fd4b8"/></g>`;
const roda = (x, y, r = 11) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.escuro}"/><circle cx="${x}" cy="${y}" r="${r * 0.42}" fill="${C.amarelo}"/>`;
const luz = (x, y, cor, r = 5) => `<circle cx="${x}" cy="${y}" r="${r + 4}" fill="${cor}" opacity=".25"/><circle cx="${x}" cy="${y}" r="${r}" fill="${cor}"/>`;

const ARTE = {
  carrinho: () => `${fundo()}<path d="M30 92c0-14 10-26 28-28l20-14h40l22 14c16 2 30 12 30 28z" fill="${C.verde}"/><path d="M84 54h32l14 10H72z" fill="${C.ceu}"/>
    ${roda(62, 98)}${roda(140, 98)}${luz(168, 84, C.amarelo, 4)}${luz(34, 84, C.vermelho, 4)}${placa(83, 70, 0.8)}`,
  casinha: () => `${fundo()}<path d="M40 64 100 22l60 42z" fill="${C.vermelho}"/><rect x="50" y="62" width="100" height="44" fill="${C.claro}"/>
    <rect x="60" y="72" width="22" height="16" rx="2" fill="${C.amarelo}"/><rect x="118" y="72" width="22" height="16" rx="2" fill="${C.amarelo}"/>
    <rect x="90" y="78" width="20" height="28" rx="2" fill="${C.madeira}"/><circle cx="105" cy="93" r="1.6" fill="${C.escuro}"/>
    <circle cx="170" cy="30" r="10" fill="${C.amarelo}"/><g transform="translate(150 50)"><circle r="11" fill="${C.azul}"/>${[0, 120, 240].map((a) => `<ellipse rx="3.4" ry="7" transform="rotate(${a}) translate(0 -5)" fill="${C.claro}"/>`).join('')}<circle r="2.2" fill="${C.azul}"/></g>`,
  cidade: () => `${fundo('#e7f3f8', '#bfc8c4')}<rect x="0" y="104" width="200" height="8" fill="${C.cinza}"/><path d="M0 108h200" stroke="${C.claro}" stroke-width="2" stroke-dasharray="10 8"/>
    <rect x="34" y="34" width="22" height="56" rx="6" fill="${C.escuro}"/>${luz(45, 46, C.vermelho, 6)}<circle cx="45" cy="62" r="6" fill="#6b5a2a"/><circle cx="45" cy="78" r="6" fill="#2a4a33"/>
    <rect x="43" y="90" width="4" height="16" fill="${C.escuro}"/><rect x="118" y="78" width="10" height="28" fill="${C.cinza}"/>
    <rect x="124" y="80" width="64" height="7" rx="3.5" fill="${C.claro}" stroke="${C.vermelho}" stroke-width="2" stroke-dasharray="8 6"/>${luz(123, 74, C.amarelo, 3)}`,
  laboratorio: () => `${fundo('#eef1fb', '#dfe5f2')}<rect x="20" y="20" width="96" height="70" rx="8" fill="${C.claro}"/>
    <path d="M30 78l18-16 14 8 18-26 22-14" fill="none" stroke="${C.azul}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M30 30v50h80" fill="none" stroke="${C.cinza}" stroke-width="2"/><path d="M140 30h20M146 30v24l-14 30h36l-14-30V30" fill="${C.claro}" stroke="${C.verde}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M136 76h28l4 8h-36z" fill="${C.verde}"/><circle cx="148" cy="70" r="3" fill="${C.verde}" opacity=".6"/><circle cx="155" cy="64" r="2" fill="${C.verde}" opacity=".5"/>`,
  girassol: () => `${fundo()}<path d="M100 104V66" stroke="${C.verde}" stroke-width="6" stroke-linecap="round"/><path d="M100 88c-14-2-20-10-22-16 10 0 20 6 22 16z" fill="${C.verde}"/>
    <g transform="translate(100 52)">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<ellipse rx="9" ry="17" transform="rotate(${a}) translate(0 -20)" fill="${C.amarelo}"/>`).join('')}<circle r="15" fill="${C.madeira}"/>
    <circle cx="-5" cy="-2" r="2.5" fill="${C.escuro}"/><circle cx="5" cy="-2" r="2.5" fill="${C.escuro}"/><path d="M-5 5q5 4 10 0" fill="none" stroke="${C.escuro}" stroke-width="2" stroke-linecap="round"/></g>
    <circle cx="170" cy="26" r="12" fill="${C.laranja}"/>${[0, 60, 120, 180, 240, 300].map((a) => `<path d="M170 26m0-18v-6" stroke="${C.laranja}" stroke-width="3" stroke-linecap="round" transform="rotate(${a} 170 26)"/>`).join('')}`,
  explorador: () => `${fundo('#f1efe4', '#e2dccb')}<path d="M24 22h110v40h40v58H24z" fill="none" stroke="${C.cinza}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M40 104c20-10 30-30 54-30s28-20 52-20" fill="none" stroke="${C.azul}" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round"/>
    <g transform="translate(146 54)"><rect x="-14" y="-9" width="28" height="18" rx="6" fill="${C.verde}"/><path d="M14 0l20-12M14 0l20 12" stroke="${C.laranja}" stroke-width="2" opacity=".8"/>
    <circle cx="10" cy="-4" r="2.5" fill="${C.claro}"/><circle cx="10" cy="4" r="2.5" fill="${C.claro}"/></g><circle cx="40" cy="104" r="4" fill="${C.vermelho}"/>`,
  bichinho: () => `${fundo('#fdeef3', '#f6d9e4')}<ellipse cx="100" cy="80" rx="46" ry="30" fill="${C.laranja}"/><circle cx="66" cy="56" r="14" fill="${C.laranja}"/><circle cx="134" cy="56" r="14" fill="${C.laranja}"/>
    <circle cx="66" cy="56" r="7" fill="${C.rosa}"/><circle cx="134" cy="56" r="7" fill="${C.rosa}"/>
    <circle cx="86" cy="76" r="7" fill="${C.claro}"/><circle cx="114" cy="76" r="7" fill="${C.claro}"/><circle cx="87" cy="77" r="3.5" fill="${C.escuro}"/><circle cx="115" cy="77" r="3.5" fill="${C.escuro}"/>
    <path d="M92 90q8 7 16 0" fill="none" stroke="${C.escuro}" stroke-width="3" stroke-linecap="round"/><path d="M146 82c14-4 20-16 18-24" fill="none" stroke="${C.laranja}" stroke-width="7" stroke-linecap="round"/>
    <path d="M150 30l4 6 6 2-6 2-4 6-4-6-6-2 6-2z" fill="${C.amarelo}"/>${roda(76, 108, 7)}${roda(124, 108, 7)}`,
  elevador: () => `${fundo('#eaf2f6', '#d4dde2')}<rect x="66" y="12" width="68" height="114" rx="6" fill="${C.claro}" stroke="${C.cinza}" stroke-width="3"/>
    <path d="M100 12v34" stroke="${C.escuro}" stroke-width="2"/><rect x="76" y="46" width="48" height="40" rx="4" fill="${C.azul}"/><path d="M100 46v40" stroke="${C.claro}" stroke-width="2"/>
    <rect x="144" y="40" width="20" height="44" rx="5" fill="${C.escuro}"/><circle cx="154" cy="52" r="5" fill="${C.amarelo}"/><circle cx="154" cy="66" r="5" fill="${C.cinza}"/>
    <path d="M151 54l3-4 3 4M151 64l3 4 3-4" fill="none" stroke="${C.escuro}" stroke-width="1.5"/><text x="92" y="36" font-size="16" font-weight="800" fill="${C.verde}" font-family="sans-serif">3</text>`,
  piano: () => `${fundo('#f3eefb', '#e4dcf3')}<rect x="20" y="40" width="160" height="70" rx="8" fill="${C.escuro}"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${28 + i * 18.5}" y="50" width="16" height="54" rx="3" fill="${i === 3 ? C.amarelo : C.claro}"/>`).join('')}
    ${[0, 1, 3, 4, 5].map((i) => `<rect x="${40 + i * 18.5}" y="50" width="10" height="32" rx="2" fill="${C.escuro}"/>`).join('')}
    <path d="M150 18v18a6 6 0 1 1-4-5.6V18l18-4v16a6 6 0 1 1-4-5.6V20z" fill="${C.roxo}"/>`,
  estacao: () => `${fundo('#e3f1fb', '#cfe5c4')}<path d="M44 52a18 18 0 0 1 34-8 14 14 0 0 1 20 14H40a10 10 0 0 1 4-6z" fill="${C.claro}"/>
    <circle cx="150" cy="34" r="13" fill="${C.amarelo}"/><rect x="132" y="56" width="12" height="48" rx="6" fill="${C.claro}" stroke="${C.cinza}" stroke-width="2"/>
    <circle cx="138" cy="102" r="9" fill="${C.vermelho}"/><rect x="135" y="72" width="6" height="30" fill="${C.vermelho}"/>
    <path d="M60 104V70" stroke="${C.cinza}" stroke-width="3"/><path d="M60 70l-14-6 14-4 14 4z" fill="${C.azul}"/>${[0, 1, 2].map((i) => `<path d="M${96 + i * 8} 66v10" stroke="${C.azul}" stroke-width="2" stroke-linecap="round"/>`).join('')}`,
  cofre: () => `${fundo('#eef0ee', '#dde2de')}<rect x="44" y="26" width="112" height="86" rx="10" fill="${C.cinza}"/><rect x="54" y="36" width="92" height="66" rx="6" fill="#71807a"/>
    <circle cx="86" cy="69" r="18" fill="${C.claro}"/><circle cx="86" cy="69" r="6" fill="${C.escuro}"/>${[0, 60, 120, 180, 240, 300].map((a) => `<path d="M86 55v-4" stroke="${C.escuro}" stroke-width="2" transform="rotate(${a} 86 69)"/>`).join('')}
    ${[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => `<rect x="${114 + c * 10}" y="${50 + r * 10}" width="8" height="8" rx="2" fill="${C.claro}"/>`)).join('')}${luz(138, 92, C.verde, 3)}`,
  memoria: () => `${fundo('#f5f0e6', '#e9e0cc')}<circle cx="100" cy="70" r="46" fill="${C.escuro}"/>
    <path d="M100 70V28a42 42 0 0 1 42 42z" fill="${C.vermelho}"/><path d="M100 70h42a42 42 0 0 1-42 42z" fill="${C.azul}"/>
    <path d="M100 70v42a42 42 0 0 1-42-42z" fill="${C.amarelo}"/><path d="M100 70H58a42 42 0 0 1 42-42z" fill="${C.verde}"/>
    <circle cx="100" cy="70" r="14" fill="${C.escuro}"/><circle cx="121" cy="49" r="10" fill="${C.claro}" opacity=".5"/>`,
  horta: () => `${fundo()}<path d="M30 104h140l-10 20H40z" fill="${C.madeira}"/>
    ${[56, 86, 116, 146].map((x) => `<path d="M${x} 104v-20" stroke="${C.verde}" stroke-width="4"/><path d="M${x} 88c-10 0-14-8-14-12 8 0 14 4 14 12zM${x} 84c10 0 14-8 14-12-8 0-14 4-14 12z" fill="${C.verde}"/>`).join('')}
    <path d="M150 30h20v10h-10l-6 8h-8z" fill="${C.azul}"/>${[0, 1, 2, 3].map((i) => `<circle cx="${148 - i * 6}" cy="${54 + i * 9}" r="2.6" fill="${C.azul}"/>`).join('')}
    <path d="M40 30l6 10a7 7 0 1 1-12 0z" fill="${C.azul}"/>`,
  desenhista: () => `${fundo('#fbf7ef', '#efe7d6')}<rect x="26" y="20" width="148" height="96" rx="6" fill="${C.claro}"/>
    <path d="M60 90l20-50 20 50-46-32h52z" fill="none" stroke="${C.roxo}" stroke-width="3" stroke-linejoin="round"/>
    <g transform="translate(130 76) rotate(-20)"><rect x="-16" y="-10" width="32" height="20" rx="7" fill="${C.verde}"/><rect x="-3" y="-22" width="6" height="18" fill="${C.amarelo}"/><path d="M-3-22h6l-3-6z" fill="${C.escuro}"/></g>`,
  braco: () => `${fundo('#eef3f6', '#dce4ea')}<rect x="60" y="100" width="56" height="12" rx="4" fill="${C.escuro}"/><circle cx="88" cy="96" r="12" fill="${C.cinza}"/>
    <path d="M88 96l22-40" stroke="${C.laranja}" stroke-width="12" stroke-linecap="round"/><circle cx="110" cy="56" r="8" fill="${C.escuro}"/>
    <path d="M110 56l36 10" stroke="${C.laranja}" stroke-width="10" stroke-linecap="round"/><circle cx="146" cy="66" r="6" fill="${C.escuro}"/>
    <path d="M150 62l12-6M150 70l12 6" stroke="${C.cinza}" stroke-width="5" stroke-linecap="round"/><rect x="160" y="88" width="16" height="16" rx="3" fill="${C.azul}"/>`,
  esteira: () => `${fundo('#eef6ef', '#d7e8d9')}<rect x="20" y="78" width="130" height="14" rx="7" fill="${C.escuro}"/>${roda(30, 85, 6)}${roda(140, 85, 6)}
    <rect x="40" y="60" width="16" height="18" rx="3" fill="${C.azul}"/><circle cx="84" cy="70" r="8" fill="${C.amarelo}"/><rect x="104" y="64" width="18" height="14" rx="2" fill="${C.cinza}"/>
    <path d="M150 74l16 10" stroke="${C.laranja}" stroke-width="5" stroke-linecap="round"/><path d="M158 96h28l-4 24h-20z" fill="${C.verde}"/>
    <path d="M168 104l4-6 4 6m-6-1 2 6 2-6" fill="none" stroke="${C.claro}" stroke-width="2"/><rect x="96" y="30" width="18" height="16" rx="3" fill="${C.escuro}"/><circle cx="105" cy="38" r="4" fill="${C.rosa}"/><path d="M105 46v12" stroke="${C.escuro}" stroke-width="3"/>`,
  aviao: () => `${fundo('#d6ecfb', '#cfe8c9')}<path d="M30 70c0-6 6-10 14-10h90l30-24h12l-16 30 22 4c6 1 6 8 0 9l-140 9c-8 0-12-4-12-8z" fill="${C.claro}"/>
    <path d="M86 66l-22-36h16l40 34z" fill="${C.azul}"/><path d="M90 80l-16 30h14l34-30z" fill="${C.azul}"/>
    <circle cx="28" cy="74" r="3" fill="${C.escuro}"/><path d="M26 58v32" stroke="${C.cinza}" stroke-width="3" stroke-linecap="round"/>${luz(70, 32, C.vermelho, 3)}${luz(74, 108, C.verde, 3)}${luz(176, 36, C.claro, 3)}
    ${[50, 70, 90, 110].map((x) => `<circle cx="${x}" cy="68" r="3" fill="${C.ceu}"/>`).join('')}`,
};

export function arte(id) {
  const f = ARTE[id];
  return `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">${f ? f() : fundo()}</svg>`;
}
export const temArte = (id) => !!ARTE[id];
