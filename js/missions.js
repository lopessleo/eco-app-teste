// Missões do modo programação: um objetivo, uma conferência do programa e de 1 a 3 estrelas.
// A conferência olha o programa (o desenho que ele faz no chão, os blocos usados); as estrelas só valem
// depois que o Eco rodou o programa até o fim. Programas mais curtos (usando "Repetir") ganham mais.

import { BLOCKS } from './program.js';

// Programa -> árvore: blocos que abrem ganham "children"
export function tree(steps) {
  const root = [];
  const stack = [root];
  for (const s of steps) {
    if (s.type === 'end') {
      if (stack.length > 1) stack.pop();
    } else if (BLOCKS[s.type]?.opens) {
      const node = { ...s, children: [] };
      stack.at(-1).push(node);
      stack.push(node.children);
    } else stack.at(-1).push({ ...s });
  }
  return root;
}

const walk = (nodes, fn, path = []) => nodes.forEach((n) => {
  fn(n, path);
  if (n.children) walk(n.children, fn, [...path, n]);
});

// Desenho no chão (só blocos de movimento, com "Repetir N" desenrolado). null se depende de sensores.
export function trace(steps) {
  let x = 0;
  let y = 0;
  let h = 0; // graus, 0 = para frente
  let turnSum = 0;
  let dist = 0;
  let far = 0;
  const sides = [];
  let ok = true;
  const run = (nodes, budget = { n: 0 }) => {
    for (const n of nodes) {
      if (++budget.n > 400) return;
      switch (n.type) {
        case 'forward': case 'back': {
          const d = n.type === 'forward' ? n.value : -n.value;
          x += d * Math.cos((h * Math.PI) / 180);
          y += d * Math.sin((h * Math.PI) / 180);
          dist += d;
          sides.push(Math.abs(d));
          far = Math.max(far, Math.hypot(x, y));
          break;
        }
        case 'left': h -= n.value; turnSum -= n.value; break;
        case 'right': h += n.value; turnSum += n.value; break;
        case 'repeat':
          if (!n.value) ok = false;
          for (let k = 0; k < (n.value || 1); k++) run(n.children, budget);
          break;
        case 'until': case 'followLine': case 'repeatUntil': case 'ifObstacle': case 'ifBump': case 'ifLine':
          ok = false;
          break;
        default: break;
      }
    }
  };
  run(tree(steps));
  if (!ok) return null;
  return { x, y, end: Math.hypot(x, y), turnSum, dist, far, sides };
}

const count = (steps) => steps.filter((s) => s.type !== 'end').length;
const has = (steps, type) => steps.some((s) => s.type === type);
const byBlocks = (steps, three, two) => (count(steps) <= three ? 3 : count(steps) <= two ? 2 : 1);

// polígono regular: fecha, n lados iguais, giro total de 360°
function polygon(steps, n) {
  const t = trace(steps);
  if (!t) return { ok: false, hint: 'Use só blocos de andar e girar (e Repetir) nesta missão.' };
  const equal = t.sides.length === n && t.sides.every((s) => s === t.sides[0]);
  if (t.sides.length !== n) return { ok: false, hint: `Um ${n === 4 ? 'quadrado' : 'triângulo'} tem ${n} lados: o seu tem ${t.sides.length}.` };
  if (!equal) return { ok: false, hint: 'Os lados precisam ter o mesmo tamanho.' };
  if (Math.abs(Math.abs(t.turnSum) - 360) > 1) return { ok: false, hint: `Somando os giros dá ${Math.abs(t.turnSum)}°; para fechar a volta tem que dar 360°.` };
  if (t.end > 1) return { ok: false, hint: 'O Eco não volta para onde começou. Confira os ângulos.' };
  const usesRepeat = has(steps, 'repeat');
  return { ok: true, stars: usesRepeat && count(steps) <= 3 ? 3 : count(steps) <= 8 ? 2 : 1, hint: usesRepeat ? '' : 'Dica: com 🔁 Repetir dá para fazer com só 3 blocos.' };
}

export const MISSIONS = [
  {
    id: 'reta', icon: '📏', title: 'Ande 1 metro',
    goal: 'Faça o Eco andar 1 metro para frente (100 cm) e parar.',
    check(steps) {
      const t = trace(steps);
      if (!t || t.turnSum !== 0) return { ok: false, hint: 'Só para frente, sem girar.' };
      if (Math.round(t.dist) !== 100) return { ok: false, hint: `Ele anda ${Math.round(t.dist)} cm. Faltam ${100 - Math.round(t.dist)} cm.` };
      return { ok: true, stars: byBlocks(steps, 1, 3) };
    },
  },
  {
    id: 'vaivolta', icon: '↔️', title: 'Vai e volta',
    goal: 'Ande pelo menos 50 cm, vire e volte até o lugar onde começou.',
    check(steps) {
      const t = trace(steps);
      if (!t) return { ok: false, hint: 'Use só blocos de andar e girar.' };
      if (t.far < 49) return { ok: false, hint: 'Vá mais longe: pelo menos 50 cm.' };
      if (t.end > 1) return { ok: false, hint: 'Ele não volta para o começo. Gire 180° e ande a mesma distância.' };
      return { ok: true, stars: byBlocks(steps, 3, 5) };
    },
  },
  {
    id: 'quadrado', icon: '⬜', title: 'Quadrado',
    goal: 'Desenhe um quadrado no chão: 4 lados iguais e 4 giros de 90°. Dica: use 🔁 Repetir.',
    check: (steps) => polygon(steps, 4),
  },
  {
    id: 'triangulo', icon: '🔺', title: 'Triângulo',
    goal: 'Desenhe um triângulo de lados iguais. Quanto o Eco precisa girar em cada canto?',
    check: (steps) => polygon(steps, 3),
  },
  {
    id: 'parede', icon: '🧱', title: 'Pare antes da parede', needs: 'sonar',
    goal: 'Ande até perto de uma parede e pare sozinho, sem bater. Depois buzine.',
    check(steps) {
      if (!has(steps, 'until') && !has(steps, 'repeatUntil')) return { ok: false, hint: 'Use o bloco 🧱 Andar até obstáculo.' };
      const i = steps.findIndex((s) => s.type === 'until' || s.type === 'repeatUntil');
      return { ok: true, stars: steps.slice(i).some((s) => s.type === 'horn') ? 3 : 2, hint: 'Faltou buzinar no fim!' };
    },
  },
  {
    id: 'desvia', icon: '🌀', title: 'Desvie dos obstáculos', needs: 'sonar',
    goal: 'Ande pela sala para sempre e, quando tiver algo na frente, vire. (🔁 Repetir sempre + ❓ Se obstáculo)',
    check(steps) {
      let turnInIf = false;
      let fwdInLoop = false;
      walk(tree(steps), (n, path) => {
        const inForever = path.some((p) => p.type === 'repeat' && p.value === 0);
        if (inForever && path.some((p) => p.type === 'ifObstacle') && (n.type === 'left' || n.type === 'right')) turnInIf = true;
        if (inForever && n.type === 'forward' && !path.some((p) => p.type === 'ifObstacle')) fwdInLoop = true;
      });
      if (!turnInIf) return { ok: false, hint: 'Dentro de um 🔁 Repetir (sempre), use ❓ Se obstáculo perto com um giro dentro.' };
      if (!fwdInLoop) return { ok: false, hint: 'Falta andar para frente quando não tem nada na frente.' };
      return { ok: true, stars: byBlocks(steps, 5, 8) };
    },
  },
  {
    id: 'festa', icon: '🎉', title: 'Festa de luzes',
    goal: 'Monte uma dança: música, farol, piscar e pelo menos 2 giros.',
    check(steps) {
      const turns = steps.filter((s) => s.type === 'left' || s.type === 'right').length;
      const parts = [has(steps, 'music'), has(steps, 'lights'), has(steps, 'blink'), turns >= 2 || has(steps, 'repeat')];
      const n = parts.filter(Boolean).length;
      if (n < 3) return { ok: false, hint: 'Use música 🎵, farol 💡, piscar ✨ e giros.' };
      return { ok: true, stars: n === 4 ? 3 : 2 };
    },
  },
  {
    id: 'linha', icon: '🛤️', title: 'Siga a linha', needs: 'light',
    goal: 'Use o bloco Seguir a linha e buzine quando terminar.',
    check(steps) {
      const i = steps.findIndex((s) => s.type === 'followLine');
      if (i < 0) return { ok: false, hint: 'Use o bloco 🛤️ Seguir a linha.' };
      return { ok: true, stars: steps.slice(i).some((s) => s.type === 'horn') ? 3 : 2, hint: 'Faltou buzinar no fim!' };
    },
  },
  {
    id: 'batida', icon: '💥', title: 'Detetive de batidas', needs: 'imu',
    goal: 'Ande para sempre e, se bater, dê ré e pisque.',
    check(steps) {
      let ok = false;
      walk(tree(steps), (n, path) => {
        if (n.type === 'back' && path.some((p) => p.type === 'ifBump') && path.some((p) => p.type === 'repeat')) ok = true;
      });
      if (!ok) return { ok: false, hint: 'Dentro de um 🔁 Repetir, use 💥 Se bateu com uma ré dentro.' };
      return { ok: true, stars: has(steps, 'blink') ? 3 : 2, hint: 'Faltou piscar ✨.' };
    },
  },
];

export const missionById = (id) => MISSIONS.find((m) => m.id === id);
