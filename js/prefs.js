// Preferências deste celular e a identidade dele (token: o Eco e a sala reconhecem o celular).
// Não há tela de configurações no app da criança: o que muda a tela vem do tipo de aula (lesson.js).

import * as P from './protocol.js';

// ---------- Preferências deste celular ----------

const PREFS_KEY = 'carrinho.prefs';
const DEFAULT_PREFS = {
  mode: 'tank', // último modo usado (se a aula liberar)
  pedal: 'simple',
  steerSens: 100,
  tiltMax: 30,
  tiltInvert: false,
  lefty: false,
  dance: true,
  vibrate: true,
  emuUrl: '',
  program: null, // programa aberto no editor
  programs: [], // programas salvos [{ name, steps, from, at }]
  missions: {}, // estrelas por missão { id: 1..3 }
  mission: null, // missão escolhida agora
  kidName: '', // nome digitado (aula sem lista)
  classCode: '', // sala de aula
  classUrl: '',
  classChoice: null, // { code, choice: { student } | { kid } }: quem a criança escolheu ser nesta sala
};
// campos de versões antigas (configurações que saíram do app da criança)
const OLD = ['modeFree', 'progSpeed', 'lineSpeed', 'lineStrip', 'lineDark', 'engineSound', 'pinHash'];
export const prefs = { ...DEFAULT_PREFS, ...readJson(PREFS_KEY) };
for (const k of OLD) delete prefs[k];

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

export function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // sem armazenamento (aba anônima): as preferências valem só nesta sessão
  }
}

// Identidade deste celular para o "modo dono": 8 bytes aleatórios gerados uma vez
function phoneToken() {
  const KEY = 'carrinho.token';
  let hex = null;
  try {
    hex = localStorage.getItem(KEY);
  } catch {
    // sem armazenamento: token novo a cada sessão
  }
  if (!/^[0-9a-f]{16}$/.test(hex ?? '')) {
    hex = Array.from(crypto.getRandomValues(new Uint8Array(P.TOKEN_BYTES)), (b) => b.toString(16).padStart(2, '0')).join('');
    try {
      localStorage.setItem(KEY, hex);
    } catch {
      // idem
    }
  }
  return Uint8Array.from(hex.match(/../g), (h) => parseInt(h, 16));
}
export const token = phoneToken();
export const tokenHex = Array.from(token, (b) => b.toString(16).padStart(2, '0')).join('');
