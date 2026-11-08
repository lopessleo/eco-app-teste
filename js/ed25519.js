// Assinatura do firmware do Eco: SHA-256, SHA-512 e conferência Ed25519 (RFC 8032), em JS puro e síncrono
// (o carcore.js é a especificação do firmware e roda igual no navegador e no Node). Só CONFERE: assinar é com a chave
// privada da ecocreator, fora do projeto (tools/chave-firmware.mjs, com o crypto do Node).
// No ESP32 o mesmo papel é da Monocypher (crypto_ed25519_check) + SHA-256 do mbedTLS (firmware/eco/src/carcore.cpp).
//
// Firmware assinado = imagem do ESP32 + "rabicho" de 72 bytes no fim:
//   assinatura (64) · versão major (1) · minor (1) · "ECOSIG" (6)
// A assinatura é do texto "ecocreator/firmware\n<major>.<minor>\n<sha256 da imagem em hex>" (o mesmo formato que a
// Central usa para o que ela publica, com outra chave).

// ---------- SHA-256 ----------
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(data) {
  const n = data.length;
  const total = Math.ceil((n + 9) / 64) * 64;
  const m = new Uint8Array(total);
  m.set(data);
  m[n] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(total - 8, Math.floor(n / 0x20000000));
  dv.setUint32(total - 4, (n * 8) >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x, r) => (x >>> r) | (x << (32 - r));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i]);
  return out;
}

export const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

// ---------- SHA-512 (BigInt: só para a conferência, poucas dezenas de bytes) ----------
const K512 = [
  '428a2f98d728ae22', '7137449123ef65cd', 'b5c0fbcfec4d3b2f', 'e9b5dba58189dbbc', '3956c25bf348b538', '59f111f1b605d019',
  '923f82a4af194f9b', 'ab1c5ed5da6d8118', 'd807aa98a3030242', '12835b0145706fbe', '243185be4ee4b28c', '550c7dc3d5ffb4e2',
  '72be5d74f27b896f', '80deb1fe3b1696b1', '9bdc06a725c71235', 'c19bf174cf692694', 'e49b69c19ef14ad2', 'efbe4786384f25e3',
  '0fc19dc68b8cd5b5', '240ca1cc77ac9c65', '2de92c6f592b0275', '4a7484aa6ea6e483', '5cb0a9dcbd41fbd4', '76f988da831153b5',
  '983e5152ee66dfab', 'a831c66d2db43210', 'b00327c898fb213f', 'bf597fc7beef0ee4', 'c6e00bf33da88fc2', 'd5a79147930aa725',
  '06ca6351e003826f', '142929670a0e6e70', '27b70a8546d22ffc', '2e1b21385c26c926', '4d2c6dfc5ac42aed', '53380d139d95b3df',
  '650a73548baf63de', '766a0abb3c77b2a8', '81c2c92e47edaee6', '92722c851482353b', 'a2bfe8a14cf10364', 'a81a664bbc423001',
  'c24b8b70d0f89791', 'c76c51a30654be30', 'd192e819d6ef5218', 'd69906245565a910', 'f40e35855771202a', '106aa07032bbd1b8',
  '19a4c116b8d2d0c8', '1e376c085141ab53', '2748774cdf8eeb99', '34b0bcb5e19b48a8', '391c0cb3c5c95a63', '4ed8aa4ae3418acb',
  '5b9cca4f7763e373', '682e6ff3d6b2b8a3', '748f82ee5defb2fc', '78a5636f43172f60', '84c87814a1f0ab72', '8cc702081a6439ec',
  '90befffa23631e28', 'a4506cebde82bde9', 'bef9a3f7b2c67915', 'c67178f2e372532b', 'ca273eceea26619c', 'd186b8c721c0c207',
  'eada7dd6cde0eb1e', 'f57d4f7fee6ed178', '06f067aa72176fba', '0a637dc5a2c898a6', '113f9804bef90dae', '1b710b35131c471b',
  '28db77f523047d84', '32caab7b40c72493', '3c9ebe0a15c9bebc', '431d67c49c100d4c', '4cc5d4becb3e42b6', '597f299cfc657e2a',
  '5fcb6fab3ad6faec', '6c44198c4a475817',
].map((x) => BigInt(`0x${x}`));

export function sha512(data) {
  const M = (x) => BigInt.asUintN(64, x);
  const rotr = (x, r) => M((x >> BigInt(r)) | (x << BigInt(64 - r)));
  const n = data.length;
  const total = Math.ceil((n + 17) / 128) * 128;
  const m = new Uint8Array(total);
  m.set(data);
  m[n] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setBigUint64(total - 8, BigInt(n) * 8n);
  const h = [
    0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
    0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n,
  ];
  const w = new Array(80);
  for (let o = 0; o < total; o += 128) {
    for (let i = 0; i < 16; i++) w[i] = dv.getBigUint64(o + i * 8);
    for (let i = 16; i < 80; i++) {
      const s0 = rotr(w[i - 15], 1) ^ rotr(w[i - 15], 8) ^ (w[i - 15] >> 7n);
      const s1 = rotr(w[i - 2], 19) ^ rotr(w[i - 2], 61) ^ (w[i - 2] >> 6n);
      w[i] = M(w[i - 16] + s0 + w[i - 7] + s1);
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 80; i++) {
      const t1 = M(hh + (rotr(e, 14) ^ rotr(e, 18) ^ rotr(e, 41)) + ((e & f) ^ (~e & g)) + K512[i] + w[i]);
      const t2 = M((rotr(a, 28) ^ rotr(a, 34) ^ rotr(a, 39)) + ((a & b) ^ (a & c) ^ (b & c)));
      hh = g; g = f; f = e; e = M(d + t1); d = c; c = b; b = a; a = M(t1 + t2);
    }
    h[0] = M(h[0] + a); h[1] = M(h[1] + b); h[2] = M(h[2] + c); h[3] = M(h[3] + d);
    h[4] = M(h[4] + e); h[5] = M(h[5] + f); h[6] = M(h[6] + g); h[7] = M(h[7] + hh);
  }
  const out = new Uint8Array(64);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setBigUint64(i * 8, h[i]);
  return out;
}

// ---------- Ed25519: só a conferência ----------
const P = 2n ** 255n - 19n;
const L = 2n ** 252n + 27742317777372353535851937790883648493n;
const mod = (a, m = P) => ((a % m) + m) % m;
function pow(b, e) {
  let r = 1n;
  b = mod(b);
  for (; e > 0n; e >>= 1n, b = (b * b) % P) if (e & 1n) r = (r * b) % P;
  return r;
}
const inv = (a) => pow(a, P - 2n);
const D = mod(-121665n * inv(121666n));
const SQRT_M1 = pow(2n, (P - 1n) / 4n);
const leNum = (b) => b.reduceRight((acc, x) => (acc << 8n) | BigInt(x), 0n);

// pontos em coordenadas estendidas (X, Y, Z, T), curva a = -1
function add([X1, Y1, Z1, T1], [X2, Y2, Z2, T2]) {
  const A = mod((Y1 - X1) * (Y2 - X2));
  const B = mod((Y1 + X1) * (Y2 + X2));
  const C = mod(2n * D * T1 * T2);
  const Dd = mod(2n * Z1 * Z2);
  const E = B - A;
  const F = Dd - C;
  const G = Dd + C;
  const H = B + A;
  return [mod(E * F), mod(G * H), mod(F * G), mod(E * H)];
}
function mul(pt, k) {
  let r = [0n, 1n, 1n, 0n];
  for (let q = pt; k > 0n; k >>= 1n, q = add(q, q)) if (k & 1n) r = add(r, q);
  return r;
}
const neg = ([X, Y, Z, T]) => [mod(-X), Y, Z, mod(-T)];

function encode([X, Y, Z]) {
  const zi = inv(Z);
  const x = mod(X * zi);
  let y = mod(Y * zi);
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++, y >>= 8n) out[i] = Number(y & 0xffn);
  if (x & 1n) out[31] |= 0x80;
  return out;
}

function decode(bytes) {
  if (bytes.length !== 32) return null;
  const b = Uint8Array.from(bytes);
  const sign = b[31] >> 7;
  b[31] &= 0x7f;
  const y = leNum(b);
  if (y >= P) return null;
  const u = mod(y * y - 1n);
  const v = mod(D * y * y + 1n);
  // x = u·v³·(u·v⁷)^((p−5)/8)
  let x = mod(u * pow(v, 3n) * pow(u * pow(v, 7n), (P - 5n) / 8n));
  const vx2 = mod(v * x * x);
  if (vx2 === mod(-u)) x = mod(x * SQRT_M1);
  else if (vx2 !== u) return null;
  if (x === 0n && sign) return null;
  if (Number(x & 1n) !== sign) x = P - x;
  return [x, y, 1n, mod(x * y)];
}

const BASE = decode(Uint8Array.from([0x58, ...new Array(31).fill(0x66)]));

// true se `assinatura` (64 bytes) é de `mensagem` com a chave privada de `chavePublica` (32 bytes)
export function confereEd25519(chavePublica, mensagem, assinatura) {
  if (chavePublica?.length !== 32 || assinatura?.length !== 64) return false;
  const A = decode(chavePublica);
  if (!A) return false;
  const R = assinatura.subarray(0, 32);
  const s = leNum(assinatura.subarray(32));
  if (s >= L) return false;
  const k = mod(leNum(sha512(Uint8Array.from([...R, ...chavePublica, ...mensagem]))), L);
  const r = add(mul(BASE, s), neg(mul(A, k))); // [s]B − [k]A tem que dar R
  const e = encode(r);
  return e.every((x, i) => x === R[i]);
}

// ---------- firmware assinado ----------
// A placa faz parte do que é assinado: o Eco confere com a placa DELE, então o firmware da ECOplus não entra na
// ECOpro nem no protótipo (e vice-versa), mesmo com o mesmo chip. O protótipo (placa 0) usa o texto de antes.
//   protótipo:  imagem + assinatura(64) + major + minor + "ECOSIG"           (72 bytes no fim)
//   ECOplus/ECOpro: imagem + assinatura(64) + placa + major + minor + "ECOSIP" (73 bytes no fim)
export const RABICHO = 72;
const MAGICO = [0x45, 0x43, 0x4f, 0x53, 0x49, 0x47]; // "ECOSIG"
const MAGICO_PLACA = [0x45, 0x43, 0x4f, 0x53, 0x49, 0x50]; // "ECOSIP"
export const textoAssinado = (major, minor, hashHex, placa = 0) => new TextEncoder().encode(placa
  ? `ecocreator/firmware\nplaca ${placa}\n${major}.${minor}\n${hashHex}`
  : `ecocreator/firmware\n${major}.${minor}\n${hashHex}`);

// separa imagem / versão / assinatura / placa; null se o arquivo não tem o rabicho (firmware sem assinatura)
export function abreFirmware(arquivo) {
  const n = arquivo?.length ?? 0;
  if (n <= RABICHO + 1) return null;
  const fim = arquivo.subarray(n - 6);
  const comPlaca = MAGICO_PLACA.every((x, i) => fim[i] === x);
  if (!comPlaca && !MAGICO.every((x, i) => fim[i] === x)) return null;
  const rab = RABICHO + (comPlaca ? 1 : 0);
  return {
    imagem: arquivo.subarray(0, n - rab),
    assinatura: arquivo.slice(n - rab, n - rab + 64),
    versao: [arquivo[n - 8], arquivo[n - 7]],
    placa: comPlaca ? arquivo[n - 9] : 0,
  };
}

// junta imagem + assinatura + (placa) + versão (tools/chave-firmware.mjs usa ao montar o firmware)
export function fechaFirmware(imagem, [major, minor], assinatura, placa = 0) {
  const fim = placa ? [placa, major, minor, ...MAGICO_PLACA] : [major, minor, ...MAGICO];
  const out = new Uint8Array(imagem.length + 64 + fim.length);
  out.set(imagem);
  out.set(assinatura, imagem.length);
  out.set(fim, imagem.length + 64);
  return out;
}

export function confereFirmware(chavePublica, imagem, [major, minor], assinatura, placa = 0) {
  return confereEd25519(chavePublica, textoAssinado(major, minor, hex(sha256(imagem)), placa), assinatura);
}
