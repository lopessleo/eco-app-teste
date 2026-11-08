// Lista dos recursos do produto (sem nada de navegador: o servidor também usa). Explicação em recursos.js.

export const RECURSOS = [
  { id: 'salaWifi', nome: '📶 Sala pelo Wi-Fi', desc: 'reserva: a criança entra na sala pelo código, quando não há ECObase' },
  { id: 'baseUsb', nome: '🔌 ECObase', desc: 'caminho principal da sala (ESP-NOW): pausa no próprio Eco, kit, firmware pela base' },
  { id: 'central', nome: '☁️ ECOcentral', desc: 'ligação da sala com a ECOcentral: suporte, materiais, firmware, arquivo de volta' },
  { id: 'controleRemoto', nome: '🎮 ECOcontroller', desc: 'Ecos no controle de botões aparecem no painel; aba no emulador' },
  { id: 'controleFio', nome: '🔌 Controle com fio', desc: 'controle de botões na porta de expansão (I2C) do Eco; aba Sensores do emulador' },
  { id: 'competicao', nome: '🏁 Competição', desc: 'aba de competição do painel e cronômetro no projetor' },
  { id: 'seguidor', nome: '🛤️ Seguidor de linha', desc: 'modo seguidor no app (sensores de luz)' },
  { id: 'programacao', nome: '🧩 Programação em blocos', desc: 'modo programar, missões e programa enviado pelo professor' },
  { id: 'trilha', nome: '📚 Trilha de aulas (BNCC)', desc: 'aulas prontas no painel, com objetivos da BNCC Computação' },
  { id: 'estudio', nome: '🎨 Estúdio de interface', desc: 'ferramenta interna do lançador (não vai para a escola)' },
  // um por cenário (app/js/cenarios.js; o Eco sempre existe): o contrato do cliente liga ou desliga cada um
  { id: 'cenarioCasinha', nome: '🏠 Cenário: Casinha inteligente', desc: 'cenário casinha inteligente (documentos/cenarios.md)', cenario: 'casinha' },
  { id: 'cenarioCidade', nome: '🚦 Cenário: Cidade', desc: 'cenário cidade (documentos/cenarios.md)', cenario: 'cidade' },
  { id: 'cenarioLaboratorio', nome: '🔬 Cenário: Laboratório de ciências', desc: 'cenário laboratório de ciências (documentos/cenarios.md)', cenario: 'laboratorio' },
  { id: 'cenarioGirassol', nome: '🌻 Cenário: Girassol solar', desc: 'cenário girassol solar (documentos/cenarios.md)', cenario: 'girassol' },
  { id: 'cenarioExplorador', nome: '🗺️ Cenário: Robô explorador', desc: 'cenário robô explorador (documentos/cenarios.md)', cenario: 'explorador' },
  { id: 'cenarioBichinho', nome: '🐾 Cenário: Bichinho robô', desc: 'cenário bichinho robô (documentos/cenarios.md)', cenario: 'bichinho' },
  { id: 'cenarioElevador', nome: '🛗 Cenário: Elevador', desc: 'cenário elevador (documentos/cenarios.md)', cenario: 'elevador' },
  { id: 'cenarioPiano', nome: '🎹 Cenário: Piano', desc: 'cenário piano (documentos/cenarios.md)', cenario: 'piano' },
  { id: 'cenarioEstacao', nome: '🌦️ Cenário: Estação do tempo', desc: 'cenário estação do tempo (documentos/cenarios.md)', cenario: 'estacao' },
  { id: 'cenarioCofre', nome: '🔐 Cenário: Cofre com senha', desc: 'cenário cofre com senha (documentos/cenarios.md)', cenario: 'cofre' },
  { id: 'cenarioMemoria', nome: '🧠 Cenário: Jogo da memória de cores', desc: 'cenário jogo da memória de cores (documentos/cenarios.md)', cenario: 'memoria' },
  { id: 'cenarioHorta', nome: '🌱 Cenário: Horta automática', desc: 'cenário horta automática (documentos/cenarios.md)', cenario: 'horta' },
  { id: 'cenarioDesenhista', nome: '✏️ Cenário: Robô desenhista', desc: 'cenário robô desenhista (documentos/cenarios.md)', cenario: 'desenhista' },
  { id: 'cenarioBraco', nome: '🦾 Cenário: Braço robótico', desc: 'cenário braço robótico (documentos/cenarios.md)', cenario: 'braco' },
  { id: 'cenarioEsteira', nome: '♻️ Cenário: Esteira separadora', desc: 'cenário esteira separadora (documentos/cenarios.md)', cenario: 'esteira' },
  { id: 'cenarioAviao', nome: '✈️ Cenário: Avião (maquete)', desc: 'cenário avião (maquete) (documentos/cenarios.md)', cenario: 'aviao' },
];

// o modo do app que cada recurso controla
export const RECURSO_DO_MODO = { program: 'programacao', line: 'seguidor' };

export function normaliza(lido) {
  return Object.fromEntries(RECURSOS.map((r) => [r.id, lido?.[r.id] !== false]));
}
