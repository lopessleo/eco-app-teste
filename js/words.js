// Textos para a criança (sem efeitos colaterais: o painel do professor também usa).

// velocidade em palavras: o "%" fica só para os pais e o professor
export function speedWord(pct) {
  if (pct <= 30) return '🐢 devagar';
  if (pct <= 50) return '🚗 médio';
  if (pct <= 70) return '🐇 rápido';
  return '🚀 muito rápido';
}
