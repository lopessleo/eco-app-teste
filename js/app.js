// Ponto de entrada do app da criança: liga os módulos e trata os parâmetros da URL (?sala, ?emu...).
// Sem configurações: o tipo de aula (o que aparece) vem do professor ou do padrão gravado no Eco.

import { defaultClassUrl, joinClass, renderClass } from './class-ui.js';
import { connectEmulator, enterDrive } from './connection.js';
import { applyLayoutPrefs, tilt } from './drive.js';
import { applyLesson } from './lesson-ui.js';
import { MODES, lessonPreset } from './lesson.js';
import { S } from './state.js';
import { prefs, savePrefs } from './prefs.js';
import { $, params, toast } from './util.js';
import { recursoLigado } from './recursos.js';
// módulos que só se registram (escutam eventos e botões): a ordem não importa
import './carlink.js';
import './pecas.js';
import './line.js';
import './programming.js';
import './home.js';
import './cenario-ui.js';
import './aviso-atualizacao.js';
import './caixa-preta.js';
import './atualizador.js';
import './ajustes-eco.js';

// ---------- Inicialização ----------

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

applyLesson();
applyLayoutPrefs();
renderClass();

// ?sala=1234: link/QR do professor (o app pergunta "Quem é você?" quando a lista chegar)
const salaParam = params.get('sala');
if (/^\d{4}$/.test(salaParam ?? '') && recursoLigado('salaWifi')) {
  if (prefs.classCode !== salaParam) prefs.classChoice = null;
  prefs.classCode = salaParam;
  savePrefs();
  joinClass(salaParam, prefs.classUrl || defaultClassUrl());
} else if (/^\d{4}$/.test(prefs.classCode) && prefs.classChoice && recursoLigado('salaWifi')) {
  // app reaberto no meio da aula: volta para a sala
  joinClass(prefs.classCode, prefs.classUrl || defaultClassUrl());
}

// ?dev mostra o emulador; ?emu=1 conecta direto nele (moldura do emulador)
if (params.has('dev') || params.has('emu')) $('#emu-box').classList.remove('hidden');
if (params.has('dev') || params.has('emu')) import('../../emulator/dev-reload.js').catch(() => {});
if (params.has('emu')) {
  $('#emu-box').open = true;
  // inclinação simulada pela moldura do emulador (controle "📐 Inclinar")
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.data?.type !== 'emu-tilt') return;
    tilt.simulate(e.data.deg);
    $('#tilt-msg').textContent = '';
  });
  connectEmulator();
} else if (params.has('plateia')) {
  // apresentação (documentos/apresentacao.md): o celular de quem assiste pega sozinho um Eco livre do emulador
  // projetado (se dois pegarem o mesmo ao mesmo tempo, tenta outro) e mostra qual é o seu
  (async () => {
    for (let i = 0; i < 6 && !S.transport?.connected; i++) {
      await connectEmulator();
      if (!S.transport?.connected) await new Promise((r) => setTimeout(r, 700 + Math.random() * 900));
    }
    for (let i = 0; i < 20 && !S.car; i++) await new Promise((r) => setTimeout(r, 150));
    if (S.car) toast(`🚗 Você pilota o "${S.car.name}" (procure o nome na tela grande)`, 6000);
  })();
} else if (params.has('preview')) {
  // ?preview[&mode=...]: abre a tela de pilotagem sem Eco, com todos os modos (para ver/ajustar o visual)
  S.carLesson = lessonPreset('free');
  if (MODES.includes(params.get('mode'))) prefs.mode = params.get('mode');
  enterDrive();
}

// carregou tudo (os módulos de função também): os testes de modularidade conferem isto
document.documentElement.dataset.pronto = "sim";
