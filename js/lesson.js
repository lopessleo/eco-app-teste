// Tipo de aula: o que aparece no app da criança (modos de controle, botões, missões e velocidades).
// O professor escolhe para a turma; fora de uma aula vale o padrão que o técnico gravou no Eco.
// Usado pelo app, pelo painel, pelo servidor da sala e (em binário) pelo Eco: documentos/protocolo.md (LESSON).

export const MODES = ['tank', 'wheel', 'tilt', 'program', 'line'];
export const MODE_INFO = {
  tank: { icon: '🎚️', name: 'Tanque' },
  wheel: { icon: '🛞', name: 'Volante' },
  tilt: { icon: '📱', name: 'Inclinar' },
  program: { icon: '🧩', name: 'Programar' },
  line: { icon: '🛤️', name: 'Seguidor' },
};
// botões e recursos que o professor pode tirar da tela
export const FEATURES = ['horn', 'lights', 'music', 'engine', 'missions'];
export const FEATURE_INFO = {
  horn: { icon: '📯', name: 'Buzina' },
  lights: { icon: '💡', name: 'Luzes' },
  music: { icon: '🎵', name: 'Músicas' },
  engine: { icon: '🔊', name: 'Ronco do motor' },
  missions: { icon: '🎯', name: 'Missões' },
};

const ALL_ON = { horn: true, lights: true, music: true, engine: true, missions: true };

// Padrão de fábrica (o técnico pode trocar o de cada Eco)
export const DEFAULT_LESSON = {
  type: 'free', modes: ['tank', 'wheel', 'tilt', 'program'], ...ALL_ON,
  progSpeed: 50, lineSpeed: 40, lineStrip: false, lineDark: false,
};

// Prontos para o professor (o "Personalizado" parte do que estiver valendo)
export const LESSONS = {
  drive: { icon: '🚗', title: 'Pilotar', hint: 'só pilotar', modes: ['tank', 'wheel', 'tilt'], missions: false },
  program: { icon: '🧩', title: 'Programação', hint: 'blocos e missões', modes: ['program'] },
  line: { icon: '🛤️', title: 'Seguidor de linha', hint: 'só o seguidor', modes: ['line'], missions: false },
  free: { icon: '🎈', title: 'Livre', hint: 'tudo liberado', modes: [...MODES] },
};

export function lessonPreset(type) {
  const p = LESSONS[type] ?? LESSONS.free;
  return normalizeLesson({ ...DEFAULT_LESSON, ...ALL_ON, ...p, type: LESSONS[type] ? type : 'free' });
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

// Confere tudo (vem do professor, do Eco ou de um arquivo): sempre devolve um tipo de aula válido
export function normalizeLesson(l) {
  const src = l !== null && typeof l === 'object' ? l : {};
  const d = DEFAULT_LESSON;
  const modes = Array.isArray(src.modes) ? MODES.filter((m) => src.modes.includes(m)) : [];
  const out = {
    type: typeof src.type === 'string' && (LESSONS[src.type] || src.type === 'custom') ? src.type : 'custom',
    modes: modes.length ? modes : [...d.modes],
  };
  for (const f of FEATURES) out[f] = typeof src[f] === 'boolean' ? src[f] : d[f];
  out.progSpeed = Math.round(clamp(num(src.progSpeed, d.progSpeed), 20, 100));
  out.lineSpeed = Math.round(clamp(num(src.lineSpeed, d.lineSpeed), 15, 80));
  out.lineStrip = typeof src.lineStrip === 'boolean' ? src.lineStrip : d.lineStrip;
  out.lineDark = typeof src.lineDark === 'boolean' ? src.lineDark : d.lineDark;
  // cenário que o professor escolheu para a aula (id do app/js/cenarios.js; null = a criança escolhe). Só o formato aqui
  // (o protocol.js importa este arquivo: o catálogo confere na hora de usar)
  out.cenario = typeof src.cenario === 'string' && /^[a-z]{3,16}$/.test(src.cenario) ? src.cenario : null;
  return out;
}

export const sameLesson = (a, b) => JSON.stringify(normalizeLesson(a)) === JSON.stringify(normalizeLesson(b));

// Texto curto para o painel ("🚗 Pilotar", "⚙️ Personalizado: Tanque, Programar")
export function lessonLabel(l) {
  const n = normalizeLesson(l);
  if (LESSONS[n.type]) return `${LESSONS[n.type].icon} ${LESSONS[n.type].title}`;
  return `⚙️ Personalizado: ${n.modes.map((m) => MODE_INFO[m].name).join(', ')}`;
}

// ---------- Binário (guardado no Eco como padrão do técnico: mensagem LESSON) ----------
// [modos (bits na ordem de MODES), recursos (bits na ordem de FEATURES), progSpeed, lineSpeed, linha (1 escura, 2 faixa), tipo]
export const LESSON_BYTES = 6;
const TYPES = ['custom', ...Object.keys(LESSONS)];

export function lessonToBytes(lesson) {
  const l = normalizeLesson(lesson);
  const modes = MODES.reduce((a, m, i) => a | (l.modes.includes(m) ? 1 << i : 0), 0);
  const feats = FEATURES.reduce((a, f, i) => a | (l[f] ? 1 << i : 0), 0);
  return [modes, feats, l.progSpeed, l.lineSpeed, (l.lineDark ? 1 : 0) | (l.lineStrip ? 2 : 0), Math.max(0, TYPES.indexOf(l.type))];
}

export function lessonFromBytes(b, o = 0) {
  const modes = MODES.filter((_, i) => b[o] & (1 << i));
  const l = { type: TYPES[b[o + 5]] ?? 'custom', modes, progSpeed: b[o + 2], lineSpeed: b[o + 3], lineDark: !!(b[o + 4] & 1), lineStrip: !!(b[o + 4] & 2) };
  FEATURES.forEach((f, i) => { l[f] = !!(b[o + 1] & (1 << i)); });
  return normalizeLesson(l);
}
