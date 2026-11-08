// Envio de firmware novo para o Eco (OTA) pelo mesmo canal do controle.
// Manda janelas de OTA_WINDOW pacotes; o último de cada janela pede confirmação e o Eco
// responde até onde recebeu (em ordem). Se algo se perdeu, a próxima janela recomeça dali.
// Respostas atrasadas/repetidas são ignoradas pela posição.
// O arquivo tem que ser o firmware ASSINADO (npm run firmware): imagem + assinatura da ecocreator (app/js/ed25519.js).
// O app só separa as partes; quem confere a assinatura é o Eco (e recusa se não bater).

import {
  OTA_CODE, OTA_REASON, OTA_CHUNK, OTA_WINDOW, OTA_MAX_BYTES, crc32,
  encodeOtaBegin, encodeOtaData, encodeOtaEnd, encodeOtaAbort, NOME_DA_PLACA,
} from './protocol.js';
import { abreFirmware } from './ed25519.js';

const SEM_ASSINATURA = 'Este arquivo não tem a assinatura da ecocreator (use o firmware gerado pelo "npm run firmware")';
const outraPlaca = (nome) => `Este firmware é de outra placa: escolha o firmware da placa deste ${nome}`;
// o arquivo é da placa X, o Eco é da Y (o rabicho diz a placa): avisa antes de mandar
export const placaErrada = (arquivoPlaca, carroPlaca, nome = 'Eco') =>
  `Este firmware é da placa ${NOME_DA_PLACA[arquivoPlaca] ?? arquivoPlaca}; este ${nome} é ${NOME_DA_PLACA[carroPlaca] ?? carroPlaca}`;

const BEGIN_TIMEOUT_MS = 10000; // o ESP32 apaga a partição antes de responder
const ACK_TIMEOUT_MS = 1500;
const END_TIMEOUT_MS = 5000; // conferir o CRC de ~1 MB leva um pouco
// Sem resposta no prazo, reenvia o pacote que pede confirmação. Só desiste depois de MIN_RETRIES reenvios E de
// SILENCE_MS sem ouvir nada do Eco: com rádio ruim (pacotes perdidos) ele ainda responde de vez em quando e a
// atualização continua; desligado ou longe demais, desiste em ~20 s. (Antes: 4 reenvios fixos — com 10% de perda nos
// dois sentidos, 1 pedido em ~4000 falhava 5 vezes seguidas, e um firmware de 1 MB tem centenas de pedidos.)
const MIN_RETRIES = 4;
const SILENCE_MS = 20000;

export class FirmwareUpload {
  // timing: { begin, ack, end, silence } em ms, só para os testes (o padrão é o do Eco de verdade)
  // nome: quem recebe, nas mensagens de erro ('Eco' ou 'controle'; os dois falam a mesma conversa)
  constructor(send, onprogress, timing = {}, nome = 'Eco') {
    this.nome = nome;
    this.send = send;
    this.onprogress = onprogress;
    this.timing = { begin: BEGIN_TIMEOUT_MS, ack: ACK_TIMEOUT_MS, end: END_TIMEOUT_MS, silence: SILENCE_MS, ...timing };
    this.waiter = null;
    this.cancelled = false;
    this.heardAt = 0; // última vez que chegou qualquer resposta do Eco
  }

  // Chamar com cada OTA_STATUS que chegar do Eco
  onStatus(status) {
    if (status) this.heardAt = Date.now();
    this.waiter?.(status);
  }

  cancel() {
    this.cancelled = true;
    this.waiter?.(null);
  }

  // Espera uma resposta que satisfaça `accept` (as outras são ignoradas, mas mostram que o Eco está vivo).
  // Sem resposta no prazo, reenvia `packet` (ver MIN_RETRIES / SILENCE_MS).
  _request(packet, accept, timeoutMs) {
    return new Promise((resolve, reject) => {
      let tries = 0;
      let timer = 0;
      const startedAt = Date.now();
      const arm = () => {
        timer = setTimeout(() => {
          const silent = Date.now() - Math.max(this.heardAt, startedAt);
          if (++tries > MIN_RETRIES && silent >= this.timing.silence) {
            this.waiter = null;
            reject(new Error(`O ${this.nome} parou de responder`));
            return;
          }
          this.send(packet);
          arm();
        }, timeoutMs);
      };
      this.waiter = (status) => {
        if (!status) {
          clearTimeout(timer);
          this.waiter = null;
          reject(new Error('Cancelado'));
        } else if (accept(status)) {
          clearTimeout(timer);
          this.waiter = null;
          resolve(status);
        }
      };
      this.send(packet);
      arm();
    });
  }

  // placa: a do Eco (CAPS), se já se sabe; o arquivo de outra placa nem começa (o Eco também recusaria no fim)
  async run(arquivo, placa = null) {
    const fw = abreFirmware(arquivo);
    if (!fw) throw new Error(SEM_ASSINATURA);
    if (placa !== null && placa !== undefined && fw.placa !== placa) throw new Error(placaErrada(fw.placa, placa, this.nome));
    const data = fw.imagem;
    if (data.length > OTA_MAX_BYTES) throw new Error(`Arquivo grande demais para o ${this.nome}`);
    const isError = (s) => s.code === OTA_CODE.ERROR;
    try {
      let s = await this._request(encodeOtaBegin(data.length, crc32(data), fw.versao, fw.assinatura),
        (st) => st.code === OTA_CODE.READY || isError(st), this.timing.begin);
      if (isError(s)) throw new Error(s.reason === OTA_REASON.SIGNATURE ? `O ${this.nome} não aceita firmware sem assinatura (atualize o app?)` : `O ${this.nome} recusou a atualização`);

      let offset = 0;
      while (offset < data.length) {
        const end = Math.min(data.length, offset + OTA_CHUNK * OTA_WINDOW);
        const packets = [];
        for (let o = offset; o < end; o += OTA_CHUNK) {
          packets.push(encodeOtaData(o, data.subarray(o, Math.min(o + OTA_CHUNK, end)), o + OTA_CHUNK >= end));
        }
        for (const p of packets.slice(0, -1)) this.send(p);
        const from = offset;
        s = await this._request(packets.at(-1), (st) => isError(st) || (st.code === OTA_CODE.PROGRESS && st.offset >= from), this.timing.ack);
        if (isError(s)) throw new Error(s.reason === OTA_REASON.WRONG_CHIP
          ? outraPlaca(this.nome)
          : `Erro no ${this.nome} durante o envio`);
        offset = s.offset; // = end se chegou tudo; menor se algum pacote se perdeu
        this.onprogress(offset / data.length);
      }

      s = await this._request(encodeOtaEnd(), (st) => st.code === OTA_CODE.DONE || isError(st), this.timing.end);
      if (isError(s)) {
        if (s.reason === OTA_REASON.WRONG_BOARD) throw new Error(outraPlaca(this.nome));
        throw new Error(s.reason === OTA_REASON.SIGNATURE
          ? `O ${this.nome} recusou: a assinatura não é da ecocreator (firmware alterado ou de outra origem)`
          : 'O arquivo chegou corrompido (CRC não confere)');
      }
    } catch (err) {
      this.send(encodeOtaAbort());
      throw err;
    }
  }
}
