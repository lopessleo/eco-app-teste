// Sala de aula (lado da criança): conecta no servidor da sala, manda telemetria e
// recebe os comandos do professor. Funciona junto com o Bluetooth (o celular usa os dois ao mesmo tempo).
// Mensagens: documentos/sala-de-aula.md
//
// Entrar: "hello" (código + este celular) -> o servidor manda a lista da turma ("roster") -> a criança escolhe
// o nome -> "join". Reconectar (Wi-Fi caiu, app reaberto) entra direto: o servidor lembra do celular.

// race: competição de seguidor de linha aberta ({ speed, strip, dark, laps, myTurn }) ou null
// pauseReason: 'teacher' | 'time' (acabou o tempo de uso); timeLeftMin: minutos que faltam (null = sem limite)
// lesson: tipo de aula do professor (app/js/lesson.js) ou null (fora da aula: vale o padrão do Eco)
export const NO_POLICY = {
  paused: false, pauseReason: '', timeLeftMin: null, muted: false, lightsOff: false, maxSpeed: 100, race: null, lesson: null,
};
const RETRY_MS = 2000;
// Pela base o rádio pode perder uma mensagem (o Wi-Fi não perde): sem resposta, manda de novo.
const ANSWER_MS = 3000; // hello/join sem resposta
const WAIT_HELLO_MS = 5000; // esperando a aula começar: pergunta de novo (a lista que o servidor manda pode se perder)

export class ClassLink {
  // opts: { url, code, device, app, car: () => { id, name, color } | null, connect?: () => WebSocket-like }
  // connect: outro caminho no lugar do WebSocket (o túnel pelo Eco, quando a sala vem pela ECObase)
  constructor(opts) {
    this.opts = opts;
    this.policy = { ...NO_POLICY };
    this.status = 'connecting'; // connecting | waiting | choosing | joined | denied | kicked | ended
    this.roster = null; // última lista recebida
    this.student = null; // { id, name } depois de entrar
    this.choice = null; // o que a criança escolheu ({ student } ou { kid }), para reentrar sozinho
    this.closed = false;
    this.onstatus = null; // (status, detalhe)
    this.onroster = null; // (roster) — mostrar "Quem é você?"
    this.onpolicy = null; // (policy)
    this.onmessage = null; // (texto)
    this.onidentify = null;
    this.onrace = null; // ({ cmd: 'start' | 'stop' }) largada/parada da competição
    this.onprogram = null; // ({ name, program }) programa mandado pelo professor
  }

  start() {
    this.closed = false;
    this._open();
  }

  stop() {
    this.closed = true;
    clearTimeout(this.retryTimer);
    this.ws?.close();
  }

  _retry(fn, ms) {
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      if (!this.closed && this.ws?.readyState === 1) fn();
    }, ms);
  }

  _setStatus(status, detail = '') {
    this.status = status;
    this.onstatus?.(status, detail);
  }

  _raw(obj) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(obj)); // 1 = aberto (WebSocket ou túnel)
  }

  get viaBase() {
    return !!this.opts.connect;
  }

  // manda (de novo) o olá: ex. depois de conectar o Eco, para o servidor sugerir o dono dele
  hello() {
    this._raw({ t: 'hello', code: this.opts.code, device: this.opts.device, app: this.opts.app, car: this.opts.car?.() ?? null });
    this._retry(() => ['connecting', 'waiting'].includes(this.status) && this.hello(), this.status === 'waiting' ? WAIT_HELLO_MS : ANSWER_MS);
  }

  // choice: { student: id } (lista da turma) ou { kid: 'nome' } (aula sem lista)
  join(choice) {
    this.choice = choice;
    this._raw({ t: 'join', code: this.opts.code, device: this.opts.device, app: this.opts.app, ...choice });
    this._retry(() => this.status !== 'joined' && this.choice === choice && this.join(choice), ANSWER_MS);
  }

  _open() {
    let ws;
    try {
      ws = this.opts.connect ? this.opts.connect() : new WebSocket(this.opts.url);
    } catch (err) {
      this._setStatus('denied', `Endereço inválido: ${err.message}`);
      return;
    }
    this.ws = ws;
    ws.onopen = () => this.hello();
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m === null || typeof m !== 'object') return;
      switch (m.t) {
        case 'roster':
          this.roster = m;
          // já tinha escolhido (reconectou): entra de novo sozinho
          if (this.choice && this._stillValid(m)) return this.join(this.choice);
          this._setStatus('choosing');
          this.onroster?.(m);
          break;
        case 'wait': // o professor ainda não começou a aula: a lista chega sozinha depois
          this._setStatus('waiting');
          this._retry(() => this.status === 'waiting' && this.hello(), WAIT_HELLO_MS);
          break;
        case 'welcome':
          this.student = m.student ?? null;
          this._setStatus('joined', m.name ?? '');
          this._setPolicy(m.policy);
          break;
        case 'policy':
          this._setPolicy(m.policy);
          break;
        case 'message':
          this.onmessage?.(String(m.text));
          break;
        case 'identify':
          this.onidentify?.();
          break;
        case 'race':
          this.onrace?.(m);
          break;
        case 'program':
          this.onprogram?.({ name: String(m.name || 'Programa do professor').slice(0, 30), program: m.program });
          break;
        case 'denied':
          this._end('denied', m.reason);
          break;
        case 'kicked':
          this._end('kicked', 'O professor tirou você da sala');
          break;
        case 'classEnded':
          this._end('ended', 'A aula terminou');
          break;
        case 'replaced':
          this._end('ended', 'Outro celular entrou com o seu nome');
          break;
        default:
          break;
      }
    };
    ws.onclose = () => {
      if (this.closed) return;
      this._setStatus('connecting');
      setTimeout(() => !this.closed && this._open(), RETRY_MS);
    };
  }

  // a escolha anterior ainda existe nesta lista? (a aula pode ter mudado de turma)
  _stillValid(roster) {
    if (this.choice.kid !== undefined) return roster.free;
    return !roster.free && roster.students.some((s) => s.id === this.choice.student);
  }

  _end(status, detail) {
    this.closed = true;
    clearTimeout(this.retryTimer);
    this.ws?.close();
    this._setPolicy(NO_POLICY);
    this._setStatus(status, detail);
  }

  _setPolicy(p) {
    this.policy = { ...NO_POLICY, ...p };
    this.onpolicy?.(this.policy);
  }

  _send(obj) {
    if (this.status === 'joined') this._raw(obj);
  }

  telemetry(t) {
    this._send({ t: 'tel', ...t });
  }

  event(kind, data = null) {
    this._send({ t: 'ev', kind, data });
  }
}
