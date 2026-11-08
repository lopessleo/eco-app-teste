// Utilidades da interface: seletor, avisos, vibração, formatação.

import { prefs } from './prefs.js';

export { speedWord } from './words.js';

export const APP_VERSION = '0.6';
export const $ = (sel) => document.querySelector(sel);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const params = new URLSearchParams(location.search);
export const fmtSec = (ms) => `${(Math.max(0, ms) / 1000).toFixed(2).replace('.', ',')} s`;

export function vibrate(pattern) {
  if (prefs.vibrate && navigator.vibrate) navigator.vibrate(pattern);
}

// ---------- Avisos ----------

let toastTimer = 0;
export function toast(text, ms = 2200) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}
