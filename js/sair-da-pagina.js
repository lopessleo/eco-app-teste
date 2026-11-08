// Ao sair da página, fecha as conexões WebSocket dela (carregado ANTES dos outros módulos em todas as páginas).
// O Chrome guarda a página que saiu congelada no cache de voltar/avançar (bfcache) com as conexões ABERTAS: o
// servidor e o emulador continuavam achando que o app estava no Eco (e uma base recarregada ficava sem kit).
// Se a página voltar desse cache, recarrega (as conexões já foram fechadas; recomeçar é o mais simples e seguro).

const abertos = new Set();
const Nativo = globalThis.WebSocket;
if (Nativo && !Nativo.ecoFechaAoSair) {
  class WebSocketQueFecha extends Nativo {
    constructor(...args) {
      super(...args);
      abertos.add(this);
      this.addEventListener('close', () => abertos.delete(this));
    }
  }
  WebSocketQueFecha.ecoFechaAoSair = true;
  globalThis.WebSocket = WebSocketQueFecha;
  addEventListener('pagehide', () => {
    for (const ws of abertos) {
      try {
        ws.close(1001, 'saiu da página');
      } catch {
        // já fechando
      }
    }
  });
  addEventListener('pageshow', (e) => {
    if (e.persisted) location.reload();
  });
}
