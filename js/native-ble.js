// Bluetooth nativo do Android (o app instalado pelo APK): plugin @capacitor-community/bluetooth-le pela ponte do
// Capacitor. No Chrome vale o Web Bluetooth (transport.js); dentro do APK, este. Mesma interface dos outros
// transportes: connect(), send(bytes), close(), onmessage(bytes), onstatus(status).
// Só é carregado dentro do APK (o tools/build-apk.mjs põe o js/vendor/capacitor-core.js junto).

import { registerPlugin } from './vendor/capacitor-core.js';
import { BLE_SERVICE, BLE_RX, BLE_TX, MSG } from './protocol.js';

const Ble = registerPlugin('BluetoothLe');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (s) => Uint8Array.from(String(s ?? '').replace(/[^0-9a-f]/gi, '').match(/../g) ?? [], (h) => parseInt(h, 16));

let initialized = false;

export class NativeBleTransport {
  constructor() {
    this.onmessage = null;
    this.onstatus = null;
    this.status = 'disconnected';
    this.closed = false;
    this.queue = [];
    this.writing = false;
    this.listeners = [];
    this.reconnecting = false;
  }

  get connected() {
    return this.status === 'connected';
  }

  _setStatus(s) {
    if (s === this.status) return;
    this.status = s;
    this.onstatus?.(s);
  }

  async connect() {
    if (!initialized) {
      // Android 12+: procurar Ecos não precisa da localização (só da permissão de "dispositivos por perto")
      await Ble.initialize({ androidNeverForLocation: true });
      initialized = true;
    }
    let dev;
    try {
      dev = await Ble.requestDevice({ services: [BLE_SERVICE] });
    } catch (err) {
      // o usuário cancelou a lista: igual ao Web Bluetooth
      throw Object.assign(new Error(err?.message ?? 'cancelado'), { name: /cancel/i.test(err?.message ?? '') ? 'NotFoundError' : 'NetworkError' });
    }
    this.deviceId = dev.deviceId;
    this.listeners.push(await Ble.addListener(`disconnected|${this.deviceId}`, () => this._onDisconnected()));
    this.listeners.push(await Ble.addListener(`notification|${this.deviceId}|${BLE_SERVICE}|${BLE_TX}`, (r) => {
      this.onmessage?.(fromHex(r?.value));
    }));
    try {
      await this._open();
    } catch (err) {
      // não conectou: solta tudo (senão um aviso de desconexão depois começaria a reconectar um transporte abandonado)
      this.close();
      throw Object.assign(new Error(err?.message ?? 'não conectou'), { name: 'NetworkError' });
    }
  }

  async _open() {
    await Ble.connect({ deviceId: this.deviceId, timeout: 10000 }); // o plugin já pede o MTU grande
    await Ble.startNotifications({ deviceId: this.deviceId, service: BLE_SERVICE, characteristic: BLE_TX });
    this.queue = [];
    this._setStatus('connected');
  }

  async _onDisconnected() {
    if (this.closed || this.reconnecting) return; // o aviso pode chegar repetido: um laço só
    this.reconnecting = true;
    this._setStatus('reconnecting');
    try {
      while (!this.closed) {
        await sleep(1000);
        if (this.closed) return;
        try {
          await this._open();
          return;
        } catch {
          // Eco ainda fora de alcance (ou conectou pela metade): solta e tenta de novo
          await Ble.disconnect({ deviceId: this.deviceId }).catch(() => {});
        }
      }
    } finally {
      this.reconnecting = false;
    }
  }

  send(bytes) {
    if (!this.connected) return;
    // uma escrita por vez; DRIVE é periódico, então na fila fica só o mais recente
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
        await Ble.writeWithoutResponse({ deviceId: this.deviceId, service: BLE_SERVICE, characteristic: BLE_RX, value: toHex(this.queue.shift()) });
      } catch {
        // caiu: o aviso de desconexão cuida da reconexão
      }
    }
    this.writing = false;
  }

  close() {
    this.closed = true;
    this._setStatus('disconnected');
    for (const l of this.listeners) l.remove?.();
    this.listeners = [];
    if (this.deviceId) Ble.disconnect({ deviceId: this.deviceId }).catch(() => {});
  }
}
