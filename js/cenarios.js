// Cenários: o que o kit vira com a mesma placa e os mesmos conectores (carrinho, casinha, elevador, braço…).
// Catálogo sem nada de tela (app, painel, técnico, servidor e testes usam). Especificação: documentos/cenarios.md.
//
// Camadas (cada uma só esconde mais): recurso do produto (contrato do cliente) → módulos que vieram no kit →
// o que a placa tem (CAP) → a escolha na hora (professor na aula, criança em casa).

import { SCENE_PRECISA, ehVeiculo, PROG_OP as OP, PROG_SENSOR as SEN, progSensor, progLuz, progMotor, progServo, progShow, SHOW } from './protocol.js';

// Módulos do kit além da placa. i2c: endereço na porta de expansão (o carrinho reconhece sozinho);
// tomada: peça simples que encaixa numa tomada que já existe
export const MODULOS = {
  teclas: { nome: 'Teclas (8 botões)', emoji: '🔢', i2c: 0x24 },
  temperatura: { nome: 'Temperatura e umidade', emoji: '🌡️', i2c: 0x38 },
  telinha: { nome: 'Telinha', emoji: '📟', i2c: 0x3c },
  cor: { nome: 'Sensor de cor', emoji: '🎨', i2c: 0x29 },
  servos: { nome: 'Módulo de servos', emoji: '🦾', i2c: 0x40 },
  sonar: { nome: 'Sonar', emoji: '📏', i2c: 0x57 },
  sonda: { nome: 'Sonda de umidade do solo', emoji: '💧', tomada: 'sensor de linha' },
  bomba: { nome: 'Bombinha de água', emoji: '🚿', tomada: 'motor' },
};
export const MODULO_IDS = Object.keys(MODULOS);

// fim de curso: só a ECOpro)
// modulos: sem eles o cenário não aparece · opcionais: aparecem se o kit tem (ex.: a telinha)
// portas: o que cada tomada vira neste cenário (o app e o técnico mostram)
export const CENARIOS = [
  {
    id: 'carrinho', n: 0, fase: 0, emoji: '🚗', nome: 'Carrinho', modulos: [], opcionais: ['sonar', 'telinha'],
    desc: 'Dirigir, programar, seguir a linha e competir.', aprende: 'programação e física do movimento',
    portas: { motor: ['Roda esquerda', 'Roda direita'], luz: ['Farol esquerdo', 'Farol direito', 'Lanterna esquerda', 'Lanterna direita'], sensor: ['Sensor de linha', 'Sensor de linha'] },
  },
  {
    id: 'casinha', n: 1, fase: 1, emoji: '🏠', nome: 'Casinha inteligente', modulos: [], opcionais: ['sonar', 'telinha', 'temperatura'],
    desc: 'Luzes dos cômodos, portão, ventilador e alarme. Acende sozinha quando escurece.', aprende: 'automação, sensores e lógica',
    portas: { motor: ['Portão', 'Ventilador'], luz: ['Sala', 'Quarto', 'Cozinha', 'Varanda'], sensor: ['Sensor de luz (dia e noite)', 'Sensor de luz (janela)'], sonar: 'Alarme de presença' },
  },
  {
    id: 'cidade', n: 2, fase: 1, emoji: '🚦', nome: 'Cidade', modulos: [], opcionais: ['sonar', 'telinha'],
    desc: 'Semáforo e cancela de estacionamento que abre quando um carro chega.', aprende: 'sequências, tempo e regras de trânsito',
    portas: { motor: ['Cancela', 'Placa giratória'], luz: ['Vermelho', 'Amarelo', 'Verde', 'Poste'], sensor: ['Sensor de carro', 'Sensor de luz (poste)'], sonar: 'Carro chegando' },
  },
  {
    id: 'laboratorio', n: 3, fase: 1, emoji: '🔬', nome: 'Laboratório de ciências', modulos: [], opcionais: ['sonar', 'telinha'],
    desc: 'O carrinho vira instrumento: mede velocidade, distância e aceleração e desenha gráficos.', aprende: 'velocidade, aceleração e gráficos',
    portas: { motor: ['Roda esquerda (com encoder)', 'Roda direita (com encoder)'], luz: ['Luz', 'Luz', 'Luz', 'Luz'], sensor: ['Sensor de luz', 'Sensor de luz'], sonar: 'Distância' },
  },
  {
    id: 'girassol', n: 4, fase: 1, emoji: '🌻', nome: 'Girassol solar', modulos: [], opcionais: ['telinha'],
    desc: 'Dois olhos de luz e um motor: a flor gira sozinha para o lado mais claro.', aprende: 'energia solar, luz e controle',
    portas: { motor: ['Giro da flor', '—'], luz: ['Pétala', 'Pétala', 'Pétala', 'Pétala'], sensor: ['Olho esquerdo', 'Olho direito'] },
  },
  {
    id: 'explorador', n: 5, fase: 1, emoji: '🗺️', nome: 'Robô explorador', modulos: ['sonar'], opcionais: ['telinha'],
    desc: 'Anda pela sala medindo as paredes com o sonar e desenha o mapa no celular.', aprende: 'geometria, mapas e medidas',
    portas: { motor: ['Roda esquerda (com encoder)', 'Roda direita (com encoder)'], luz: ['Farol', 'Farol', 'Lanterna', 'Lanterna'], sensor: ['—', '—'], sonar: 'Mede as paredes' },
  },
  {
    id: 'bichinho', n: 6, fase: 1, emoji: '🐾', nome: 'Bichinho robô', modulos: [], opcionais: ['sonar', 'telinha'],
    desc: 'Um bichinho que reage: fica feliz com carinho, foge quando chegam perto e dorme no escuro.', aprende: 'causa e efeito, emoções',
    portas: { motor: ['Pata esquerda', 'Pata direita'], luz: ['Olho esquerdo', 'Olho direito', 'Rabo', 'Rabo'], sensor: ['Carinho (luz)', 'Carinho (luz)'], sonar: 'Alguém chegando' },
  },
  {
    id: 'elevador', n: 7, fase: 2, emoji: '🛗', nome: 'Elevador', modulos: ['teclas'], opcionais: ['telinha'],
    desc: 'Botões dos andares, motor com encoder e fim de curso: o elevador para no andar certo.', aprende: 'sequências, posição e botões',
    portas: { motor: ['Motor do elevador (encoder)', 'Porta'], luz: ['Andar 1', 'Andar 2', 'Andar 3', 'Cabine'], sensor: ['—', '—'] },
  },
  {
    id: 'piano', n: 8, fase: 2, emoji: '🎹', nome: 'Piano', modulos: ['teclas'], opcionais: ['telinha'],
    desc: 'Oito teclas, cada uma uma nota. Grava e toca músicas.', aprende: 'sons, música e notas',
    portas: { motor: ['—', '—'], luz: ['Luz', 'Luz', 'Luz', 'Luz'], sensor: ['—', '—'] },
  },
  {
    id: 'estacao', n: 9, fase: 2, emoji: '🌦️', nome: 'Estação do tempo', modulos: ['temperatura'], opcionais: ['telinha'],
    desc: 'Mede temperatura, umidade e luz ao longo do dia e mostra os gráficos.', aprende: 'clima, medidas e gráficos',
    portas: { motor: ['Cata-vento', '—'], luz: ['Frio', 'Ameno', 'Quente', 'Alerta'], sensor: ['Luz do sol', '—'] },
  },
  {
    id: 'cofre', n: 10, fase: 2, emoji: '🔐', nome: 'Cofre com senha', modulos: ['teclas', 'servos'], opcionais: ['telinha'],
    desc: 'Digite a senha certa e a trava abre. Errou três vezes: alarme!', aprende: 'algoritmos e condições',
    portas: { motor: ['—', '—'], luz: ['Errado', 'Certo', 'Luz', 'Luz'], sensor: ['Porta fechada', '—'] },
  },
  {
    id: 'memoria', n: 11, fase: 2, emoji: '🧠', nome: 'Jogo da memória de cores', modulos: ['teclas'], opcionais: ['telinha'],
    desc: 'As luzes acendem numa sequência e é preciso repetir. Cada rodada, uma cor a mais.', aprende: 'sequências e memória',
    portas: { motor: ['—', '—'], luz: ['Vermelho', 'Verde', 'Azul', 'Amarelo'], sensor: ['—', '—'] },
  },
  {
    id: 'horta', n: 12, fase: 2, emoji: '🌱', nome: 'Horta automática', modulos: ['sonda', 'bomba'], opcionais: ['telinha', 'temperatura'],
    desc: 'Quando a terra seca, a bombinha rega sozinha.', aprende: 'ciclo da água e biologia',
    portas: { motor: ['Bombinha', '—'], luz: ['Seco', 'Úmido', 'Luz da planta', 'Luz'], sensor: ['Sonda de umidade', 'Luz do sol'] },
  },
  {
    id: 'desenhista', n: 13, fase: 3, emoji: '✏️', nome: 'Robô desenhista', modulos: ['servos'], opcionais: ['telinha'],
    desc: 'Um carrinho com caneta: desenha quadrados, estrelas e o que for programado.', aprende: 'geometria e ângulos',
    portas: { motor: ['Roda esquerda', 'Roda direita'], luz: ['Farol', 'Farol', 'Lanterna', 'Lanterna'], sensor: ['—', '—'] },
  },
  {
    id: 'braco', n: 14, fase: 3, emoji: '🦾', nome: 'Braço robótico', modulos: ['servos'], opcionais: ['telinha'],
    desc: 'Base que gira, ombro, cotovelo e garra: pega e solta objetos.', aprende: 'coordenadas e sequências',
    portas: { motor: ['Base (encoder)', '—'], luz: ['Luz', 'Luz', 'Luz', 'Garra'], sensor: ['—', '—'] },
  },
  {
    id: 'esteira', n: 15, fase: 3, emoji: '♻️', nome: 'Esteira separadora', modulos: ['cor', 'servos'], opcionais: ['telinha'],
    desc: 'A esteira leva o lixo, o sensor vê a cor e o desviador separa o reciclável.', aprende: 'sustentabilidade e classificação',
    portas: { motor: ['Esteira', '—'], luz: ['Papel', 'Plástico', 'Metal', 'Vidro'], sensor: ['Peça chegando', '—'] },
  },
  {
    id: 'aviao', n: 16, fase: 3, emoji: '✈️', nome: 'Avião (maquete)', modulos: [], opcionais: ['servos', 'telinha'],
    desc: 'Hélice, luzes de navegação e pisca. Incline o celular para pilotar.', aprende: 'voo, inclinação e luzes de navegação',
    portas: { motor: ['Hélice', '—'], luz: ['Asa esquerda (vermelha)', 'Asa direita (verde)', 'Cauda (branca)', 'Pisca'], sensor: ['—', '—'] },
  },
];
// cor de cada luz na tela do cenário (o LED endereçável acende nela; o comum só liga). Índices de PROG_CORES
const CORES = {
  casinha: [4, 4, 4, 4], cidade: [1, 4, 2, 0], girassol: [4, 4, 4, 4], elevador: [0, 0, 0, 8], memoria: [1, 2, 3, 4],
  estacao: [3, 2, 5, 1], horta: [5, 3, 7, 0], cofre: [1, 2, 0, 0], esteira: [3, 1, 4, 2], aviao: [1, 2, 0, 0], bichinho: [8, 8, 7, 7],
};
// nome de cada servo (módulo de servos) nos cenários que usam
const SERVOS = {
  cofre: ['Trava'], desenhista: ['Caneta'], braco: ['Ombro', 'Cotovelo', 'Pulso', 'Garra'], esteira: ['Desviador'], aviao: ['Aileron esquerdo', 'Aileron direito', 'Leme'],
};
// automações prontas (cenários maquete): rodam no carrinho sem o app e ficam gravadas. [op, arg]; WAIT em centésimos.
// Nos cenários que andam (veículo), "programas prontos" (rodam com o app, como o modo programação)
const luzTodas = (cor, b) => [OP.SET_LIGHT, progLuz(15, cor, b)];
const luz = (porta, cor, b = 100) => [OP.SET_LIGHT, progLuz(porta, cor, b)];
const espera = (cs) => [OP.WAIT, cs];
const motor = (p, v) => [OP.SET_MOTOR, progMotor(p, v)];
const servo = (s, a) => [OP.SET_SERVO, progServo(s, a)];
const se = (sensor, acima, valor, ...corpo) => [[OP.IF_SENSOR, progSensor(sensor, acima, valor)], ...corpo, [OP.END, 0]];
// "se a tecla k está apertada" (TECLA = a menor apertada): k−1 < tecla < k+1
const seTecla = (k, ...corpo) => se(SEN.TECLA, true, k - 1, ...se(SEN.TECLA, false, k + 1, ...corpo));
const soltaTecla = () => [OP.WAIT_SENSOR, progSensor(SEN.TECLA, false, 1)];
const sempre = (...corpo) => [[OP.REPEAT, 0], ...corpo, [OP.END, 0]];
const NOTAS = [262, 294, 330, 349, 392, 440, 494, 523]; // dó a dó
const AUTOMACOES = {
  casinha: [
    { id: 'noite', nome: '🌙 Acende quando escurece', prog: [[OP.REPEAT, 0], [OP.IF_SENSOR, progSensor(SEN.LUZ_E, false, 70)], luzTodas(4, 100), [OP.END, 0],
      [OP.IF_SENSOR, progSensor(SEN.LUZ_E, true, 110)], luzTodas(0, 0), [OP.END, 0], [OP.WAIT, 20], [OP.END, 0]] },
    { id: 'alarme', nome: '🚨 Alarme de presença', prog: [[OP.REPEAT, 0], [OP.IF_SENSOR, progSensor(SEN.DIST, false, 30)], [OP.TONE, 880], luzTodas(1, 100),
      [OP.WAIT, 30], [OP.TONE, 0], luzTodas(0, 0), [OP.WAIT, 20], [OP.END, 0], [OP.WAIT, 10], [OP.END, 0]] },
  ],
  cidade: [
    { id: 'semaforo', nome: '🚦 Semáforo', prog: [[OP.REPEAT, 0], luzTodas(0, 0), [OP.SET_LIGHT, progLuz(0, 1, 100)], [OP.WAIT, 500],
      [OP.SET_LIGHT, progLuz(0, 0, 0)], [OP.SET_LIGHT, progLuz(2, 2, 100)], [OP.WAIT, 500], [OP.SET_LIGHT, progLuz(2, 0, 0)],
      [OP.SET_LIGHT, progLuz(1, 4, 100)], [OP.WAIT, 200], [OP.END, 0]] },
    { id: 'cancela', nome: '🚧 Cancela automática', prog: [[OP.REPEAT, 0], [OP.WAIT_SENSOR, progSensor(SEN.DIST, false, 15)], [OP.SET_MOTOR, progMotor(0, 60)],
      [OP.WAIT, 60], [OP.SET_MOTOR, progMotor(0, 0)], [OP.WAIT, 300], [OP.SET_MOTOR, progMotor(0, -60)], [OP.WAIT, 60], [OP.SET_MOTOR, progMotor(0, 0)], [OP.END, 0]] },
  ],
  elevador: [
    // fim de curso embaixo (porta do motor esquerdo); cada andar ≈ 1,5 s de subida
    { id: 'andar', nome: '🛗 Vai ao andar da tecla', prog: sempre(
      ...[1, 2, 3].flatMap((k) => seTecla(k, motor(0, -60), [OP.WAIT_SENSOR, progSensor(SEN.FIM_E, true, 0)], motor(0, 0), ...(k > 1 ? [motor(0, 60), espera((k - 1) * 150), motor(0, 0)] : []),
        luzTodas(0, 0), luz(k - 1, 0), luz(3, 8), [OP.TONE, 880], espera(15), [OP.TONE, 0])),
      espera(5)) },
  ],
  piano: [
    { id: 'teclas', nome: '🎹 Tocar pelas teclas', prog: sempre([OP.TONE, 0], ...NOTAS.flatMap((hz, i) => seTecla(i + 1, [OP.TONE, hz])), espera(3)) },
  ],
  estacao: [
    // luz da faixa: frio (< 18 °C), ameno, quente (> 28 °C); alerta acima de 32 °C
    { id: 'termometro', nome: '🌡️ Termômetro de luzes', prog: sempre(luzTodas(0, 0),
      ...se(SEN.TEMP, false, 580, luz(0, 3)), ...se(SEN.TEMP, true, 579, ...se(SEN.TEMP, false, 681, luz(1, 2))), ...se(SEN.TEMP, true, 680, luz(2, 5)),
      ...se(SEN.TEMP, true, 720, luz(3, 1), [OP.TONE, 660], espera(20), [OP.TONE, 0]), [OP.SHOW, progShow(SHOW.SENSOR, 0, SEN.TEMP)], espera(100)) },
  ],
  cofre: [
    { id: 'senha', nome: '🔐 Senha 1-2-3', prog: sempre(servo(0, 0), luzTodas(0, 0), [OP.WAIT_SENSOR, progSensor(SEN.TECLA, true, 0)],
      ...seTecla(1, soltaTecla(), [OP.WAIT_SENSOR, progSensor(SEN.TECLA, true, 0)], ...seTecla(2, soltaTecla(), [OP.WAIT_SENSOR, progSensor(SEN.TECLA, true, 0)],
        ...seTecla(3, servo(0, 90), luz(1, 2), [OP.TONE, 880], espera(20), [OP.TONE, 0], espera(500)))),
      luz(0, 1), espera(30), soltaTecla()) },
  ],
  memoria: [],
  horta: [
    // sonda na tomada do sensor de linha esquerdo: terra seca = pouca condução = "luz" baixa
    { id: 'rega', nome: '💧 Rega quando secar', prog: sempre(luzTodas(0, 0),
      ...se(SEN.LUZ_E, false, 80, luz(0, 5), motor(0, 80), espera(300), motor(0, 0), espera(3000)),
      ...se(SEN.LUZ_E, true, 79, luz(1, 3)), espera(100)) },
  ],
  braco: [
    { id: 'pega', nome: '🦾 Pega e solta', prog: sempre(servo(3, 90), servo(0, 120), servo(1, 60), espera(80), servo(3, 20), espera(60),
      servo(0, 60), espera(80), motor(0, 50), espera(120), motor(0, 0), servo(1, 100), espera(60), servo(3, 90), espera(80), motor(0, -50), espera(120), motor(0, 0), espera(200)) },
  ],
  esteira: [
    // a esteira anda; viu uma cor (não o preto da esteira): para, acende a luz da cor e o desviador manda para um lado
    { id: 'separa', nome: '♻️ Separa por cor', prog: sempre(motor(0, 45),
      ...se(SEN.COR, true, 0, ...se(SEN.COR, false, 6, motor(0, 0), luzTodas(0, 0),
        ...se(SEN.COR, false, 2, luz(1, 1), servo(0, 150)), ...se(SEN.COR, true, 1, ...se(SEN.COR, false, 3, luz(0, 2), servo(0, 30))),
        ...se(SEN.COR, true, 2, luz(2, 3), servo(0, 90)), espera(80), motor(0, 45), espera(120), luzTodas(0, 0))), espera(5)) },
  ],
  aviao: [
    { id: 'voo', nome: '✈️ Luzes de voo', prog: sempre(luz(0, 1), luz(1, 2), luz(2, 0), luz(3, 0, 100), espera(8), luz(3, 0, 0), espera(92)) },
  ],
  desenhista: [
    { id: 'quadrado', nome: '⬛ Desenhar um quadrado', run: true, prog: [servo(0, 30), [OP.REPEAT, 4], [OP.FORWARD, 20], [OP.TURN, 90], [OP.END, 0], servo(0, 90)] },
    { id: 'estrela', nome: '⭐ Desenhar uma estrela', run: true, prog: [servo(0, 30), [OP.REPEAT, 5], [OP.FORWARD, 25], [OP.TURN, 144], [OP.END, 0], servo(0, 90)] },
  ],
  bichinho: [
    { id: 'brinca', nome: '🐾 Brincar', run: true, prog: sempre([OP.SHOW, progShow(SHOW.CARA, 0)],
      ...se(SEN.DIST, false, 20, [OP.SHOW, progShow(SHOW.CARA, 2)], [OP.TONE, 990], espera(10), [OP.TONE, 0], [OP.BACK, 10]),
      ...se(SEN.LUZ_E, false, 50, [OP.SHOW, progShow(SHOW.CARA, 5)], [OP.MUSIC, 1], espera(100)), espera(10)) },
  ],
  girassol: [
    { id: 'sol', nome: '🌞 Segue o sol', prog: [[OP.REPEAT, 0], [OP.SET_MOTOR, progMotor(0, 0)],
      [OP.IF_SENSOR, progSensor(SEN.LUZ_DIF, true, 1024 + 20)], [OP.SET_MOTOR, progMotor(0, -45)], [OP.END, 0],
      [OP.IF_SENSOR, progSensor(SEN.LUZ_DIF, false, 1024 - 20)], [OP.SET_MOTOR, progMotor(0, 45)], [OP.END, 0], [OP.WAIT, 15], [OP.END, 0]] },
  ],
};

// o que a placa precisa ter (CAP) e se anda como o carrinho: do protocolo (o firmware confere com a mesma tabela)
for (const c of CENARIOS) {
  c.precisa = SCENE_PRECISA[c.n];
  c.veiculo = ehVeiculo(c.n);
  c.cores = CORES[c.id] ?? [0, 0, 0, 0];
  c.servos = SERVOS[c.id] ?? [];
  // maquete: automações (AUTO, gravadas); veículo: só os programas prontos (run)
  c.automacoes = (AUTOMACOES[c.id] ?? []).filter((a) => (c.veiculo ? a.run : !a.run));
}
export const CENARIO = Object.fromEntries(CENARIOS.map((c) => [c.id, c]));
export const CENARIO_POR_N = Object.fromEntries(CENARIOS.map((c) => [c.n, c]));
export const recursoDo = (c) => (c.n === 0 ? null : `cenario${c.id[0].toUpperCase()}${c.id.slice(1)}`); // carrinho sempre existe

// máscara de 32 bits (bit n = cenário n) — vai para o carrinho (SCENE)
export const mascara = (ids) => ids.reduce((m, id) => (CENARIO[id] ? m | (1 << CENARIO[id].n) : m), 0) >>> 0;
export const daMascara = (m) => CENARIOS.filter((c) => (m >>> c.n) & 1).map((c) => c.id);

// a placa tem o que o cenário precisa? caps: CAP da placa (null = carrinho antigo, com tudo)
export const placaServe = (c, caps) => caps === null || caps === undefined || (c.precisa & caps) === c.precisa;

// camadas 1 e 2: o que o contrato e o kit liberam (vai gravado no carrinho). recursos: ligados (recursos.json);
// kit: ids dos módulos que vieram (null = não informado: não esconde por módulo)
export function liberadosPeloKit({ recursos = null, kit = null } = {}) {
  return CENARIOS.filter((c) => {
    const r = recursoDo(c);
    if (r && recursos && recursos[r] === false) return false;
    return !kit || c.modulos.every((m) => kit.includes(m));
  }).map((c) => c.id);
}

// camada 3: dos liberados, os que esta placa roda (o carrinho também confere)
export const disponiveis = (liberados, caps) => liberados.filter((id) => CENARIO[id] && placaServe(CENARIO[id], caps));

// o que falta encaixar agora: módulos I2C que o carrinho não está vendo. enderecos: o que respondeu na expansão
// (EXP_INFO); temSonar: o sonar respondeu (no protótipo ele fica na porta de sensor, não na expansão)
export function faltaEncaixar(c, { enderecos = null, temSonar = false } = {}) {
  if (!Array.isArray(enderecos)) return [];
  return c.modulos.filter((m) => (m === 'sonar' ? !temSonar : MODULOS[m].i2c && !enderecos.includes(MODULOS[m].i2c)));
}
