// Blocos de programação de cada cenário (documentos/cenarios.md), montados pelo catálogo (app/js/cenarios.js): cada bloco
// escolhe "o quê" numa lista com os nomes do cenário ("Portão ▶", "Sala acende", "se está escuro", "se a tecla 2 está
// apertada", "Garra 90°"...). Sem tela: o editor (program.js / program-editor.js) recebe as definições.

import { PROG_OP as OP, PROG_SENSOR as SEN, COR_CLASSE, CARAS, progSensor, progIgual, progLuz, progMotor, progServo, progShow, SHOW } from './protocol.js';

const NOTAS = [['Dó', 262], ['Ré', 294], ['Mi', 330], ['Fá', 349], ['Sol', 392], ['Lá', 440], ['Si', 494], ['Dó agudo', 523]];
const ANGULOS = [0, 45, 90, 135, 180];
const CARA_NOMES = ['😊 feliz', '😢 triste', '😮 surpreso', '😴 dormindo', '😠 bravo', '😍 apaixonado'];

// condições que o cenário pode usar ("se", "espere até", "repita até"): { label, op: 'sensor' | 'igual', arg }
export function condicoes(c, kit = null) {
  const tem = (m) => c.modulos.includes(m) || (c.opcionais.includes(m) && (!kit || kit.includes(m)));
  const out = [];
  const [s0, s1] = c.portas.sensor;
  if (c.id === 'horta') {
    out.push({ label: '💧 a terra está seca', op: 'sensor', arg: progSensor(SEN.LUZ_E, false, 80) });
    out.push({ label: '💧 a terra está molhada', op: 'sensor', arg: progSensor(SEN.LUZ_E, true, 120) });
  } else if (s0 && s0 !== '—') {
    out.push({ label: `🌙 está escuro (${s0})`, op: 'sensor', arg: progSensor(SEN.LUZ_E, false, 70) });
    out.push({ label: `☀️ está claro (${s0})`, op: 'sensor', arg: progSensor(SEN.LUZ_E, true, 110) });
  }
  if (s1 && s1 !== '—' && c.id !== 'horta') {
    out.push({ label: '⬅️ a esquerda está mais clara', op: 'sensor', arg: progSensor(SEN.LUZ_DIF, true, 1024 + 20) });
    out.push({ label: '➡️ a direita está mais clara', op: 'sensor', arg: progSensor(SEN.LUZ_DIF, false, 1024 - 20) });
  }
  if (c.portas.sonar || tem('sonar')) {
    out.push({ label: '📏 tem algo perto (20 cm)', op: 'sensor', arg: progSensor(SEN.DIST, false, 20) });
    out.push({ label: '📏 não tem nada perto', op: 'sensor', arg: progSensor(SEN.DIST, true, 40) });
  }
  if (c.id === 'elevador' || c.id === 'cofre' || c.id === 'braco') out.push({ label: '🔘 o fim de curso está apertado', op: 'igual', arg: progIgual(SEN.FIM_E, 1) });
  if (tem('teclas')) for (let k = 1; k <= 8; k++) out.push({ label: `🔢 a tecla ${k} está apertada`, op: 'igual', arg: progIgual(SEN.TECLA, k) });
  if (tem('teclas')) out.push({ label: '🔢 nenhuma tecla apertada', op: 'igual', arg: progIgual(SEN.TECLA, 0) });
  if (tem('temperatura')) {
    out.push({ label: '🔥 está quente (mais de 28 °C)', op: 'sensor', arg: progSensor(SEN.TEMP, true, 680) });
    out.push({ label: '🧊 está frio (menos de 18 °C)', op: 'sensor', arg: progSensor(SEN.TEMP, false, 580) });
    out.push({ label: '💦 o ar está úmido (mais de 70%)', op: 'sensor', arg: progSensor(SEN.UMID, true, 70) });
  }
  if (tem('cor')) {
    for (const [nome, k] of [['vermelho', COR_CLASSE.VERMELHO], ['verde', COR_CLASSE.VERDE], ['azul', COR_CLASSE.AZUL], ['amarelo', COR_CLASSE.AMARELO]]) {
      out.push({ label: `🎨 vê a cor ${nome}`, op: 'igual', arg: progIgual(SEN.COR, k) });
    }
  }
  return out;
}

// os blocos do cenário: { blocos: { tipo: definição do bloco }, ops: { tipo: (valor) => [op, arg] } }
// kit: módulos do kit (null = não sabe: mostra os opcionais também)
export function blocosDoCenario(c, kit = null) {
  const blocos = {};
  const ops = {};
  if (!c || c.id === 'carrinho') return { blocos, ops };
  const tem = (m) => c.modulos.includes(m) || (c.opcionais.includes(m) && (!kit || kit.includes(m)));
  const add = (tipo, def, op) => {
    blocos[tipo] = { cat: 'cena', ...def };
    ops[tipo] = op;
  };
  if (!c.veiculo) {
    const motores = c.portas.motor.flatMap((nome, p) => (nome === '—' ? [] : [[`${nome} ▶`, p, 70], [`${nome} ◀`, p, -70], [`${nome} ⏹`, p, 0]]));
    if (motores.length) add('cMotor', { icon: '⚙️', label: 'Motor', choices: motores.map((m) => m[0]), def: 0 }, (v) => [OP.SET_MOTOR, progMotor(motores[v][1], motores[v][2])]);
    const luzes = c.portas.luz.flatMap((nome, k) => (nome === '—' ? [] : [[`${nome} acende`, k, 100], [`${nome} apaga`, k, 0]]));
    luzes.push(['Todas acendem', 15, 100], ['Todas apagam', 15, 0]);
    add('cLuz', { icon: '💡', label: 'Luz', choices: luzes.map((l) => l[0]), def: 0 },
      (v) => [OP.SET_LIGHT, progLuz(luzes[v][1], luzes[v][1] === 15 ? 0 : c.cores[luzes[v][1]], luzes[v][2])]);
  }
  add('cSom', { icon: '🎵', label: 'Nota', choices: [...NOTAS.map((n) => n[0]), 'Para o som'], def: 0 },
    (v) => [OP.TONE, NOTAS[v]?.[1] ?? 0]);
  const conds = condicoes(c, kit);
  if (conds.length) {
    const op = (cond, sensor, igual) => [cond.op === 'igual' ? igual : sensor, cond.arg];
    add('cSe', { icon: '❓', label: 'Se', choices: conds.map((x) => x.label), def: 0, opens: true }, (v) => op(conds[v], OP.IF_SENSOR, OP.IF_IGUAL));
    add('cEspera', { icon: '⏳', label: 'Espere até', choices: conds.map((x) => x.label), def: 0 }, (v) => op(conds[v], OP.WAIT_SENSOR, OP.WAIT_IGUAL));
    add('cRepeteAte', { icon: '🔁', label: 'Repita até', choices: conds.map((x) => x.label), def: 0, opens: true },
      (v) => op(conds[v], OP.REPEAT_UNTIL_SENSOR, OP.REPEAT_UNTIL_IGUAL));
  }
  if (c.servos.length && tem('servos')) {
    const sv = c.servos.flatMap((nome, i) => ANGULOS.map((a) => [`${nome} ${a}°`, i, a]));
    add('cServo', { icon: '🦾', label: 'Servo', choices: sv.map((s) => s[0]), def: 2 }, (v) => [OP.SET_SERVO, progServo(sv[v][1], sv[v][2])]);
  }
  if (tem('telinha')) {
    add('cCara', { icon: '📟', label: 'Carinha na telinha', choices: CARA_NOMES.slice(0, CARAS.length), def: 0 }, (v) => [OP.SHOW, progShow(SHOW.CARA, v)]);
    const mostra = [['Limpar a telinha', null], ...(tem('temperatura') ? [['Mostrar a temperatura', SEN.TEMP]] : []),
      ...(c.portas.sonar || tem('sonar') ? [['Mostrar a distância', SEN.DIST]] : []), ['Mostrar a luz', SEN.LUZ_E]];
    add('cMostra', { icon: '📟', label: 'Telinha', choices: mostra.map((m) => m[0]), def: 1 },
      (v) => [OP.SHOW, mostra[v][1] === null ? progShow(SHOW.LIMPA) : progShow(SHOW.SENSOR, 0, mostra[v][1])]);
  }
  return { blocos, ops };
}
