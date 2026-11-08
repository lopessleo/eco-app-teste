// Sala pela ECObase: as mensagens da sala (o mesmo JSON do Wi-Fi) vão pelo Eco, em pedaços (CLASS_UP /
// CLASS_DOWN). Imita um WebSocket, então a sala de aula (classroom.js) não precisa saber por onde está indo.

import { MSG, BASE_STATUS } from './protocol.js';
import { Reassembler, chunkText, seqFor } from './air.js';
import { S, on } from './state.js';

let current = null; // um túnel por vez (o do Eco conectado)

on('classDown', (b) => current?._down(b));
on('baseInfo', (info) => {
  if (info.status !== BASE_STATUS.ONLINE) current?._lost();
});
on('connection', (st) => {
  if (st !== 'connected') current?._lost();
});

export class CarTunnel {
  constructor() {
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.tx = { seq: 0, lastText: null };
    this.rx = new Reassembler();
    current?._lost();
    current = this;
    // abre na próxima volta (como um WebSocket): quem criou já pôs os onopen/onclose
    setTimeout(() => {
      if (this.readyState !== 0) return;
      if (S.transport?.connected && S.baseStatus === BASE_STATUS.ONLINE) {
        this.readyState = 1; // OPEN
        this.onopen?.();
      } else this._lost();
    }, 0);
  }

  send(text) {
    if (this.readyState !== 1 || !S.transport?.connected) return;
    for (const part of chunkText(MSG.CLASS_UP, seqFor(this.tx, text), text)) S.transport.send(part);
  }

  close() {
    this._lost();
  }

  _down(b) {
    if (this.readyState !== 1) return;
    const text = this.rx.push(b);
    if (text !== null) this.onmessage?.({ data: text });
  }

  _lost() {
    if (this.readyState === 3) return;
    this.readyState = 3; // CLOSED
    if (current === this) current = null;
    this.onclose?.();
  }
}
