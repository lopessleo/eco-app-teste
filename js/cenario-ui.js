// Cenários no app da criança (documentos/cenarios.md): "O que você montou?" com ilustrações grandes, a tela dos cenários
// maquete (cada porta: motores, luzes, som; os sensores ao vivo; as automações prontas, que ficam no Eco) e um
// painel por cima da pilotagem nos cenários que andam (laboratório: gráfico; explorador: mapa; bichinho: carinha).
// Na aula, quem escolhe é o professor (o tipo de aula traz o cenário); fora dela, a criança, entre os liberados no kit.

import * as P from './protocol.js';
import { CENARIOS, CENARIO, CENARIO_POR_N, MODULOS, MODULO_IDS, recursoDo } from './cenarios.js';
import { blocosDoCenario } from './blocos-cenario.js';
import { setBlocosCenario } from './program.js';
import { arte } from './cenarios-arte.js';
import { holdButton } from './controls.js';
import { leaveDrive } from './connection.js';
import { recursoLigado } from './recursos.js';
import { S, emit, on } from './state.js';
import { $, toast } from './util.js';

const IO_MS = 100;
const NOTAS = [262, 294, 330, 349, 392, 440, 494, 523];
// o módulo está encaixado agora? (endereços que o Eco achou na expansão, EXP_INFO)
const encaixado = (m) => !!S.exp?.addrs?.includes(MODULOS[m].i2c);
const MOTOR_PCT = 70;
const AUTO_ID = 200; // ids de programa das automações prontas (os do editor de blocos são outros)
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const send = (b) => S.transport?.connected && S.transport.send(b);
// segurar: o botão continua recebendo o soltar mesmo se o dedo escorregar (alguns navegadores recusam: segue sem)
const segura = (el, e) => {
  try {
    el.setPointerCapture(e.pointerId);
  } catch {
    // sem captura
  }
};

// o que vale agora: liberado no kit e nesta placa (o Eco diz) e ligado no contrato (recursos)
function disponiveis() {
  const disp = S.scene?.disponiveis ?? 1;
  return CENARIOS.filter((c) => (disp >>> c.n) & 1 && (!recursoDo(c) || recursoLigado(recursoDo(c))));
}
const atual = () => CENARIO_POR_N[S.scene?.atual ?? 0] ?? CENARIO.carrinho;
const naAula = () => !!S.lesson?.cenario;

// ---------- escolher ----------

function escolhe(c) {
  send(P.encodeScene(P.SCENE_OP.ESCOLHER, c.n));
  $('#cena-pick').close();
}

// chegada: logo depois de conectar, o Eco pergunta o que a criança montou (fora da aula com cenário marcado e só se o
// kit tem mais de um liberado); "Continuar" fica com o que já estava no Eco
function abreEscolha(chegada = false) {
  const lista = disponiveis();
  $('#cena-pick-titulo').textContent = chegada ? 'Oi! O que você montou hoje? 🧩' : 'O que você montou?';
  $('#cena-pick-fechar').textContent = chegada ? `Continuar: ${atual().emoji} ${atual().nome}` : 'Fechar';
  $('#cena-pick-msg').textContent = naAula() ? 'Na aula, quem escolhe é o professor.' : 'Escolha o que você montou com as peças do kit.';
  const box = $('#cena-lista');
  box.replaceChildren(...lista.map((c) => {
    const b = document.createElement('button');
    b.className = `cena-cartao${c.n === atual().n ? ' atual' : ''}`;
    b.disabled = naAula() && c.id !== S.lesson.cenario;
    b.innerHTML = `${arte(c.id)}<b>${c.emoji} ${esc(c.nome)}</b><small>${esc(c.desc)}</small>`;
    b.addEventListener('click', () => escolhe(c));
    return b;
  }));
  $('#cena-pick').showModal();
}
$('#btn-cena').addEventListener('click', () => abreEscolha());
$('#cena-trocar').addEventListener('click', () => abreEscolha());
let perguntou = false; // já perguntou nesta conexão
$('#cena-pick-fechar').addEventListener('click', () => $('#cena-pick').close());

// professor escolheu o cenário da aula: o app manda ao Eco (se ele roda esse cenário)
function aplicaAula() {
  const id = S.lesson?.cenario;
  if (!id || !CENARIO[id]) return;
  // ainda não sabe o cenário do Eco (reconectou, a resposta se perdeu): pergunta; a resposta chama de novo
  if (!S.scene) return void send(P.encodeScene(P.SCENE_OP.LER));
  if (S.scene.atual !== CENARIO[id].n && (S.scene.disponiveis >>> CENARIO[id].n) & 1) send(P.encodeScene(P.SCENE_OP.ESCOLHER, CENARIO[id].n));
}

// ---------- tela do cenário maquete ----------

const io = { motores: [0, 0], ligada: [false, false, false, false], somHz: 0 };

function desenhaCena() {
  const c = atual();
  $('#cena-titulo').textContent = `${c.emoji} ${c.nome}`;
  $('#cena-arte').innerHTML = arte(c.id);
  io.motores = [0, 0];
  io.ligada = [false, false, false, false];
  io.somHz = 0;
  const ctr = $('#cena-controles');
  ctr.innerHTML = '';
  c.portas.motor.forEach((nome, i) => {
    if (nome === '—') return;
    const row = document.createElement('div');
    row.className = 'cena-motor';
    row.innerHTML = `<span>${esc(nome)}</span><button class="cena-btn" data-v="-1">◀</button><button class="cena-btn" data-v="1">▶</button>`;
    for (const b of row.querySelectorAll('button')) {
      // segurar = o motor gira (soltou, para): mais seguro para portão, cancela e elevador
      b.addEventListener('pointerdown', (e) => { segura(b, e); io.motores[i] = Number(b.dataset.v) * MOTOR_PCT; b.classList.add('on'); });
      for (const ev of ['pointerup', 'pointercancel']) b.addEventListener(ev, () => { io.motores[i] = 0; b.classList.remove('on'); });
    }
    ctr.append(row);
  });
  const luzes = document.createElement('div');
  luzes.className = 'cena-luzes';
  c.portas.luz.forEach((nome, k) => {
    if (nome === '—') return;
    const b = document.createElement('button');
    const cor = P.PROG_CORES[c.cores[k]] ?? P.PROG_CORES[0];
    b.className = 'cena-luz';
    b.style.setProperty('--cor', `rgb(${cor.join(',')})`);
    b.innerHTML = `<i></i>${esc(nome)}`;
    b.addEventListener('click', () => {
      io.ligada[k] = !io.ligada[k];
      b.classList.toggle('on', io.ligada[k]);
    });
    luzes.append(b);
  });
  const som = document.createElement('button');
  som.className = 'cena-luz cena-som';
  som.innerHTML = '🔔 Som';
  som.addEventListener('pointerdown', (e) => { segura(som, e); io.somHz = 880; som.classList.add('on'); });
  for (const ev of ['pointerup', 'pointercancel']) som.addEventListener(ev, () => { io.somHz = 0; som.classList.remove('on'); });
  luzes.append(som);
  ctr.append(luzes);
  // automações prontas (rodam no Eco, sem o celular, e ficam gravadas)
  const auto = $('#cena-auto');
  auto.innerHTML = c.automacoes.length ? '<h3>⚙️ Automações (ficam no Eco)</h3>' : '';
  c.automacoes.forEach((a, i) => {
    const b = document.createElement('button');
    b.className = 'cena-auto-btn';
    b.textContent = a.nome;
    b.addEventListener('click', () => {
      rodaPronto(a, AUTO_ID + i);
      for (const x of auto.querySelectorAll('.cena-auto-btn')) x.classList.toggle('on', x === b);
    });
    auto.append(b);
  });
  if (c.automacoes.length) {
    const parar = document.createElement('button');
    parar.className = 'cena-auto-btn parar';
    parar.textContent = '⏹ Parar automação';
    parar.addEventListener('click', () => {
      send(P.encodeProgRun(0, P.PROG_CMD.STOP, 50));
      for (const x of auto.querySelectorAll('.cena-auto-btn')) x.classList.remove('on');
    });
    auto.append(parar);
  }
  desenhaModulos(c);
  desenhaSensores();
}

// automação (maquete: fica no Eco) ou programa pronto (veículo: roda com o app)
function rodaPronto(a, id) {
  send(P.encodeProgLoad(id, 0, 1, a.prog));
  send(P.encodeProgRun(id, a.run ? P.PROG_CMD.RUN : P.PROG_CMD.AUTO, 50));
  toast(a.run ? `${a.nome}: rodando` : `${a.nome}: ligada. Funciona até sem o celular.`);
}

// telinha, servos e os extras de cada cenário (piano, memória, avião)
let servoTimer = 0;
function desenhaModulos(c) {
  const box = document.createElement('div');
  box.className = 'cena-modulos';
  if (c.servos.length) {
    box.insertAdjacentHTML('beforeend', `<h3>🦾 Servos${encaixado('servos') ? '' : ' <small>(encaixe o módulo de servos)</small>'}</h3>`);
    c.servos.forEach((nome, i) => {
      const row = document.createElement('label');
      row.className = 'cena-servo';
      row.innerHTML = `<span>${esc(nome)}</span><input type="range" min="0" max="180" value="90" data-servo="${i}"><b>90°</b>`;
      const inp = row.querySelector('input');
      inp.addEventListener('input', () => {
        row.querySelector('b').textContent = `${inp.value}°`;
        clearTimeout(servoTimer);
        servoTimer = setTimeout(() => send(P.encodeServo(i, Number(inp.value))), 40);
      });
      box.append(row);
    });
  }
  if (c.id === 'piano') {
    const teclas = document.createElement('div');
    teclas.className = 'cena-piano';
    NOTAS.forEach((hz, k) => {
      const t = document.createElement('button');
      t.textContent = ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si', 'Dó'][k];
      t.addEventListener('pointerdown', (e) => { segura(t, e); io.somHz = hz; t.classList.add('on'); });
      for (const ev of ['pointerup', 'pointercancel']) t.addEventListener(ev, () => { io.somHz = 0; t.classList.remove('on'); });
      teclas.append(t);
    });
    box.append(teclas);
  }
  if (c.id === 'memoria') {
    const b = document.createElement('button');
    b.className = 'cena-auto-btn';
    b.textContent = '▶ Jogar (repita as cores nas teclas 1 a 4)';
    b.addEventListener('click', memoriaComeca);
    box.append(b, Object.assign(document.createElement('p'), { id: 'memoria-msg', className: 'muted' }));
  }
  if (c.id === 'aviao') {
    box.insertAdjacentHTML('beforeend', '<label class="check"><input type="checkbox" id="aviao-incl"> 📱 Pilotar inclinando o celular (ailerons)</label>');
  }
  if (MODULOS.telinha) {
    box.insertAdjacentHTML('beforeend', `<div class="cena-tela${encaixado('telinha') ? '' : ' hidden'}"><input id="tela-txt" maxlength="16" placeholder="📟 Escrever na telinha">
      <button id="tela-ok" class="small">Mostrar</button><button id="tela-limpa" class="small">Limpar</button></div>`);
  }
  $('#cena-controles').append(box);
  $('#tela-ok')?.addEventListener('click', () => send(P.encodeTela(1, $('#tela-txt').value)));
  $('#tela-limpa')?.addEventListener('click', () => send(P.encodeTela(255)));
}

// ---------- jogo da memória (no app: sorteia a sequência, mostra nas luzes e confere as teclas) ----------
const mem = { seq: [], pos: 0, fase: 'parado', mostra: 0, ultimaTecla: 0 };
function memoriaComeca() {
  mem.seq = [Math.floor(Math.random() * 4)];
  memoriaMostra();
}
function memoriaMostra() {
  mem.fase = 'mostrando';
  mem.pos = 0;
  $('#memoria-msg') && ($('#memoria-msg').textContent = `Rodada ${mem.seq.length}: olhe as luzes…`);
  let i = 0;
  const passo = () => {
    io.ligada = [false, false, false, false];
    if (i >= mem.seq.length * 2) {
      mem.fase = 'esperando';
      $('#memoria-msg') && ($('#memoria-msg').textContent = `Sua vez: ${mem.seq.length} tecla(s)`);
      return;
    }
    if (i % 2 === 0) io.ligada[mem.seq[i / 2]] = true;
    i++;
    setTimeout(passo, i % 2 ? 600 : 250);
  };
  passo();
}
function memoriaTecla(t) {
  if (mem.fase !== 'esperando' || t < 1 || t > 4) return;
  io.ligada = [0, 1, 2, 3].map((k) => k === t - 1);
  setTimeout(() => { io.ligada = [false, false, false, false]; }, 250);
  if (t - 1 !== mem.seq[mem.pos]) {
    mem.fase = 'parado';
    io.somHz = 196;
    setTimeout(() => { io.somHz = 0; }, 600);
    $('#memoria-msg') && ($('#memoria-msg').textContent = `Errou! Chegou a ${mem.seq.length - 1} rodada(s). Toque em Jogar de novo.`);
    return;
  }
  mem.pos++;
  if (mem.pos === mem.seq.length) {
    mem.fase = 'parado';
    mem.seq.push(Math.floor(Math.random() * 4));
    setTimeout(memoriaMostra, 900);
  }
}

// ---------- avião: inclinar o celular move os ailerons ----------
let ultimoIncl = 0;
addEventListener('deviceorientation', (e) => {
  if (!$('#aviao-incl')?.checked || atual().id !== 'aviao' || e.gamma === null) return;
  const now = performance.now();
  if (now - ultimoIncl < 80) return;
  ultimoIncl = now;
  const a = Math.max(0, Math.min(180, 90 + e.gamma * 1.5));
  send(P.encodeServo(0, a));
  send(P.encodeServo(1, 180 - a));
});

function desenhaSensores() {
  const s = S.sensores;
  const c = atual();
  const box = $('#cena-sensores');
  if (!box || !s) return;
  const itens = [];
  c.portas.sensor.forEach((nome, k) => {
    if (nome !== '—') itens.push(`<div class="cena-sensor"><span>${esc(nome)}</span><b class="barra"><i style="width:${Math.round((s.luz[k] / 255) * 100)}%"></i></b></div>`);
  });
  if (c.portas.sonar) itens.push(`<div class="cena-sensor"><span>${esc(c.portas.sonar)}</span><b>${s.distCm === P.NO_DISTANCE ? 'nada perto' : `${s.distCm} cm`}</b></div>`);
  if (s.niveis.some(Boolean)) itens.push(`<div class="cena-sensor"><span>Fim de curso</span><b>${s.niveis.map((n) => (n ? '🔴' : '⚪')).join(' ')}</b></div>`);
  // módulos da expansão
  if (encaixado('teclas')) itens.push(`<div class="cena-sensor"><span>🔢 Teclas</span><b>${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => ((s.teclas >> k) & 1 ? `[${k + 1}]` : `${k + 1}`)).join(' ')}</b></div>`);
  if (s.tempC !== null) {
    temps.push([s.tempC, s.umid ?? 0]);
    if (temps.length > 150) temps.shift();
    const pts = (k, lo, hi) => temps.map((t, i) => `${(i / 149) * 200},${60 - ((t[k] - lo) / (hi - lo)) * 55}`).join(' ');
    itens.push(`<div class="cena-sensor"><span>🌡️ ${s.tempC.toFixed(1)} °C · 💧 ${s.umid ?? '—'} %</span>
      <svg class="cena-graf" viewBox="0 0 200 64"><polyline points="${pts(0, 0, 45)}" fill="none" stroke="#ff4d4d" stroke-width="2"/><polyline points="${pts(1, 0, 100)}" fill="none" stroke="#4da3ff" stroke-width="2"/></svg></div>`);
  }
  if (s.corClasse !== null) itens.push(`<div class="cena-sensor"><span>🎨 Cor</span><b><i class="cena-cor" style="background:rgb(${s.cor.join(',')})"></i> ${P.COR_CLASSE_NOMES[s.corClasse] ?? '?'}</b></div>`);
  box.innerHTML = itens.join('');
}

function cor(k) {
  const c = atual();
  const rgb = P.PROG_CORES[c.cores[k]] ?? P.PROG_CORES[0];
  return io.ligada[k] ? rgb : [0, 0, 0];
}
setInterval(() => {
  if (!$('#cena').classList.contains('active') || !S.transport?.connected || atual().veiculo) return;
  send(P.encodeIo({ motores: io.motores, cores: [0, 1, 2, 3].map(cor), somHz: io.somHz }));
}, IO_MS);

holdButton($('#cena-sair'), 1000, () => {
  leaveDrive();
  toast('Desconectado do Eco');
}, () => toast('Segure para sair'));

// ---------- painel dos cenários que andam ----------

const hist = []; // laboratório: [t, velocidade]
const temps = []; // estação: [temperatura, umidade]
const mapa = []; // explorador: pontos das paredes
let pos = { x: 0, y: 0, odo: null };

function desenhaExtra() {
  const c = atual();
  const box = $('#cena-extra');
  const tem = ['laboratorio', 'explorador', 'bichinho', 'desenhista'].includes(c.id) && document.body.classList.contains('driving');
  box.classList.toggle('hidden', !tem);
  if (!tem) return;
  // pilotando, o painel fica na coluna do meio, no lugar do conta-giros: por cima do acelerador, o Eco não andava.
  // Programar e Seguidor não têm essa coluna: ele fica solto no canto
  const meio = document.querySelector('.center');
  const lugar = getComputedStyle(meio).display === 'none' ? $('#drive') : meio;
  if (box.parentElement !== lugar) lugar.append(box);
  const s = S.sensores;
  if (!s) {
    box.textContent = `${c.emoji} esperando o Eco…`;
    return;
  }
  if (c.id === 'laboratorio') {
    hist.push(s.velMm / 10);
    if (hist.length > 120) hist.shift();
    const max = Math.max(20, ...hist.map(Math.abs));
    const pts = hist.map((v, i) => `${(i / 119) * 200},${50 - (v / max) * 45}`).join(' ');
    box.innerHTML = `<b>🔬 Velocidade ${(s.velMm / 10).toFixed(0)} cm/s · andou ${(s.odoMm / 1000).toFixed(2)} m · ${s.accelG.toFixed(1)} g</b>
      <svg viewBox="0 0 200 100"><path d="M0 50h200" stroke="#555"/><polyline points="${pts}" fill="none" stroke="#3fbf86" stroke-width="2"/></svg>`;
  } else if (c.id === 'explorador') {
    if (pos.odo === null) pos.odo = s.odoMm;
    const d = (s.odoMm - pos.odo) / 10;
    pos.odo = s.odoMm;
    const a = (s.direcao * Math.PI) / 180;
    pos.x += Math.cos(a) * d;
    pos.y += Math.sin(a) * d;
    if (s.distCm !== P.NO_DISTANCE && s.distCm < 300) mapa.push([pos.x + Math.cos(a) * s.distCm, pos.y + Math.sin(a) * s.distCm]);
    if (mapa.length > 600) mapa.shift();
    const k = 0.25;
    box.innerHTML = `<b>🗺️ Mapa: ${mapa.length} pontos</b><svg viewBox="-100 -100 200 200">${mapa.map(([x, y]) => `<circle cx="${(x * k).toFixed(1)}" cy="${(y * k).toFixed(1)}" r="1.5" fill="#ffb020"/>`).join('')}
      <circle cx="${(pos.x * k).toFixed(1)}" cy="${(pos.y * k).toFixed(1)}" r="4" fill="#3fbf86"/></svg>`;
  } else if (c.id === 'desenhista') {
    if (!box.querySelector('[data-caneta]')) {
      box.innerHTML = `<b>✏️ Caneta</b><div class="row"><button data-caneta="30">⬇ Desce</button><button data-caneta="90">⬆ Sobe</button></div>
        ${c.automacoes.map((a, i) => `<button class="cena-auto-btn" data-pronto="${i}">${esc(a.nome)}</button>`).join('')}`;
      for (const b of box.querySelectorAll('[data-caneta]')) b.addEventListener('click', () => send(P.encodeServo(0, Number(b.dataset.caneta))));
      for (const b of box.querySelectorAll('[data-pronto]')) b.addEventListener('click', () => rodaPronto(c.automacoes[b.dataset.pronto], AUTO_ID + Number(b.dataset.pronto)));
    }
  } else {
    // bichinho: perto = assustado; escuro (tamparam os sensores) = carinho; senão, feliz
    const perto = s.distCm !== P.NO_DISTANCE && s.distCm < 20;
    const carinho = s.luz.every((l) => l < 60);
    if (!box.querySelector('.cara')) {
      box.innerHTML = `<div class="cara"></div><small></small>${c.automacoes.map((a, i) => `<button class="cena-auto-btn" data-pronto="${i}">${esc(a.nome)}</button>`).join('')}`;
      for (const b of box.querySelectorAll('[data-pronto]')) b.addEventListener('click', () => rodaPronto(c.automacoes[b.dataset.pronto], AUTO_ID + Number(b.dataset.pronto)));
    }
    box.querySelector('.cara').textContent = perto ? '😱' : carinho ? '🥰' : '😊';
    box.querySelector('small').textContent = perto ? 'Alguém chegou perto!' : carinho ? 'Carinho!' : 'Brincando';
  }
}

// ---------- programar o cenário (blocos do cenário no editor) ----------

let programando = false; // maquete: a criança abriu o editor de blocos
let blocosDe = '';
function blocos() {
  const c = atual();
  // o que o kit tem agora: os módulos encaixados (e as peças simples, que o Eco não vê)
  const kit = MODULO_IDS.filter((m) => !MODULOS[m].i2c || encaixado(m) || (m === 'sonar' && P.hasSonar(S.carState?.line?.port ?? 0)));
  const chave = `${c.id}|${kit.join()}`;
  if (chave === blocosDe) return;
  blocosDe = chave;
  setBlocosCenario(blocosDoCenario(c, kit), !c.veiculo);
  emit('blocosCenario', { maquete: !c.veiculo });
}
$('#cena-prog').addEventListener('click', () => {
  programando = true;
  atualiza();
  emit('setMode', 'program');
});
$('#btn-volta-cena').addEventListener('click', () => {
  programando = false;
  atualiza();
});

// ---------- quem aparece ----------

function atualiza() {
  const conectado = !!S.transport?.connected && !!S.scene;
  const c = atual();
  if (conectado) blocos();
  if (c.veiculo) programando = false;
  $('#btn-volta-cena').classList.toggle('hidden', !programando);
  $('#cena-prog').classList.toggle('hidden', !S.lesson?.modes?.includes('program') || !recursoLigado('programacao'));
  const varios = disponiveis().length > 1;
  $('#btn-cena').classList.toggle('hidden', !conectado || !varios);
  $('#cena-trocar').classList.toggle('hidden', !varios);
  const naCena = conectado && !c.veiculo && !programando && document.body.classList.contains('driving');
  const estava = $('#cena').classList.contains('active');
  $('#cena').classList.toggle('active', naCena);
  $('#drive').classList.toggle('active', document.body.classList.contains('driving') && !naCena);
  if (naCena && (!estava || $('#cena').dataset.n !== String(c.n))) {
    $('#cena').dataset.n = String(c.n);
    desenhaCena();
  }
  desenhaExtra();
}

on('expInfo', () => {
  if ($('#cena').classList.contains('active')) desenhaCena(); // encaixou/tirou um módulo
  if (S.scene) blocos();
});
on('sceneInfo', () => {
  aplicaAula();
  if (!perguntou) {
    perguntou = true;
    if (!naAula() && disponiveis().length > 1 && !$('#cena-pick').open && !S.atualizando && !S.ajustando) abreEscolha(true); // atualizando: não interrompe
  }
  $('#cena-extra').innerHTML = '';
  temps.length = 0;
  hist.length = 0;
  mapa.length = 0;
  pos = { x: 0, y: 0, odo: null };
  atualiza();
});
on('lesson', () => {
  if (naAula() && $('#cena-pick').open) $('#cena-pick').close(); // o professor escolheu: vale o dele
  aplicaAula();
  atualiza();
});
// os sensores chegam 10 vezes por segundo: a tela redesenha no máximo 4 (celular simples não engasga); o jogo da
// memória confere as teclas a cada leitura
let ultimoDesenho = 0;
on('sensores', (s) => {
  const t = s.teclas ? Math.log2(s.teclas & -s.teclas) + 1 : 0;
  if (t && t !== mem.ultimaTecla) memoriaTecla(t);
  mem.ultimaTecla = t;
  const agora = performance.now();
  if (agora - ultimoDesenho < 250) return;
  ultimoDesenho = agora;
  if ($('#cena').classList.contains('active')) desenhaSensores();
  else desenhaExtra();
});
on('connection', (st) => {
  if (st === 'disconnected') {
    S.scene = null;
    S.sensores = null;
    programando = false;
    $('#cena').classList.remove('active');
  }
  if (st === 'connected') {
    perguntou = false;
    aplicaAula();
  }
  atualiza();
});

// para depurar (console e testes): o que o app sabe do cenário agora
window.cenarioDebug = () => ({ scene: S.scene, aula: S.lesson?.cenario ?? null, politica: S.policy?.lesson ? (S.policy.lesson.cenario ?? 'sem') : 'sem aula', viaBase: !!S.classLink?.viaBase, conectado: !!S.transport?.connected, tela: $('#cena').classList.contains('active') });
