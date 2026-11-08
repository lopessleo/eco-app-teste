// Transportes: a forma como o app fala com o Eco.
// Todos têm a mesma interface: connect(), send(bytes), close(), onmessage(bytes), onstatus(status).
// status: 'connected' | 'reconnecting' | 'disconnected'

import { BLE_SERVICE, BLE_RX, BLE_TX, MSG } from './protocol.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Transport {
  constructor() {
    this.onmessage = null;
    this.onstatus = null;
    this.status = 'disconnected';
    this.closed = false;
  }

  get connected() {
    return this.status === 'connected';
  }

  _setStatus(s) {
    if (s === this.status) return;
    this.status = s;
    this.onstatus?.(s);
  }
}

// Bluetooth Low Energy pelo Web Bluetooth (Chrome no Android / PC)
export class BleTransport extends Transport {
  static get supported() {
    return 'bluetooth' in navigator;
  }

  constructor() {
    super();
    this.queue = [];
    this.writing = false;
    this._onNotify = (e) => {
      const v = e.target.value;
      this.onmessage?.(new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)));
    };
  }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({ filters: [{ services: [BLE_SERVICE] }] });
    this.device.addEventListener('gattserverdisconnected', () => this._onDisconnected());
    await this._open();
  }

  async _open() {
    const server = await this.device.gatt.connect();
    const service = await server.getPrimaryService(BLE_SERVICE);
    this.rx = await service.getCharacteristic(BLE_RX);
    const tx = await service.getCharacteristic(BLE_TX);
    tx.removeEventListener('characteristicvaluechanged', this._onNotify);
    tx.addEventListener('characteristicvaluechanged', this._onNotify);
    await tx.startNotifications();
    this.queue = [];
    this._setStatus('connected');
  }

  async _onDisconnected() {
    if (this.closed) return;
    this._setStatus('reconnecting');
    while (!this.closed) {
      await sleep(1000);
      if (this.closed) return;
      try {
        await this._open();
        return;
      } catch {
        // Eco ainda fora de alcance: tenta de novo
      }
    }
  }

  send(bytes) {
    if (!this.connected) return;
    // O GATT faz uma operação por vez. DRIVE é periódico, então na fila fica só o mais recente.
    const i = bytes[0] === MSG.DRIVE ? this.queue.findIndex((b) => b[0] === MSG.DRIVE) : -1;
    if (i >= 0) this.queue[i] = bytes;
    else this.queue.push(bytes);
    this._pump();
  }

  async _pump() {
    if (this.writing) return;
    this.writing = true;
    while (this.queue.length && this.connected) {
      try {
        await this.rx.writeValueWithoutResponse(this.queue.shift());
      } catch {
        // se a conexão caiu, o evento gattserverdisconnected cuida da reconexão
      }
    }
    this.writing = false;
  }

  close() {
    this.closed = true;
    this._setStatus('disconnected');
    if (this.device?.gatt.connected) this.device.gatt.disconnect();
  }
}

// WebSocket para o emulador no PC (tools/server.mjs), imitando o BLE:
// lista os Ecos livres, o usuário escolhe um (como no seletor do Chrome) e o par fica exclusivo.
export class WsTransport extends Transport {
  // chooser(transport) -> Promise<id | null>: mostra a lista (transport.cars, atualizada via transport.onlist)
  constructor(url, chooser) {
    super();
    this.url = url;
    this.chooser = chooser;
    this.cars = [];
    this.onlist = null;
    this.carId = null;
    this.pending = null;
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const ws = this._open();
      ws.addEventListener('open', () => resolve(), { once: true });
      ws.addEventListener('error', () => {
        if (ws.readyState === WebSocket.OPEN) return;
        this.closed = true;
        reject(new Error(`Emulador não encontrado em ${this.url}`));
      }, { once: true });
    });

    const id = await this.chooser(this);
    if (!id) {
      this.close();
      throw Object.assign(new Error('Nenhum Eco escolhido'), { name: 'NotFoundError' });
    }
    this.carId = id;
    await new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      this.ws.send(`connect:${id}`);
      setTimeout(() => this._settle(new Error('O Eco não respondeu')), 3000);
    });
  }

  // Termina a tentativa de conexão (sucesso sem erro, falha com erro)
  _settle(err) {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    if (!err) return p.resolve();
    this.close();
    p.reject(err);
  }

  _open() {
    const ws = new WebSocket(this.url);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => {
      if (this.carId && !this.pending) ws.send(`connect:${this.carId}`); // voltou depois de cair
    };
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') {
        this.onmessage?.(new Uint8Array(e.data));
        return;
      }
      if (e.data.startsWith('list:')) {
        this.cars = JSON.parse(e.data.slice(5));
        this.onlist?.(this.cars);
      } else if (e.data === 'car:1') {
        this._settle();
        this._setStatus('connected');
      } else if (e.data === 'car:0') {
        if (this.pending) this._settle(new Error('Esse Eco acabou de ser conectado por outro celular'));
        else if (!this.closed) this._setStatus('reconnecting');
      }
    };
    ws.onclose = () => {
      if (this.closed) return;
      this._setStatus('reconnecting');
      setTimeout(() => !this.closed && this._open(), 1000);
    };
    this.ws = ws;
    return ws;
  }

  send(bytes) {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) this.ws.send(bytes);
  }

  close() {
    this.closed = true;
    this._setStatus('disconnected');
    this.ws?.close();
  }
}
