// Service worker: guarda o app para funcionar sem internet.
// Estratégia "rede primeiro": com internet sempre pega a versão nova; sem internet usa o cache.
// A lista tem que ter TODOS os arquivos que o app usa (o teste tests/unit/app-files.test.mjs confere).

const CACHE = 'carrinho-v23';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'ajustes.json',
  'ajustes.css',
  'recursos.json',
  'css/app.css',
  'css/program.css',
  'css/cenarios.css',
  'js/air.js',
  'js/ajustes.js',
  'js/estudio-agente.js',
  'js/app.js',
  'js/brand.js',
  'js/blocos-cenario.js',
  'js/carlink.js',
  'js/cenario-ui.js',
  'js/cenarios.js',
  'js/cenarios-arte.js',
  'js/class-ui.js',
  'js/classroom.js',
  'js/connection.js',
  'js/controls.js',
  'js/drive.js',
  'js/engine-sound.js',
  'js/home.js',
  'js/lesson.js',
  'js/lesson-ui.js',
  'js/line.js',
  'js/messages.js',
  'js/missions.js',
  'js/pecas.js',
  'js/prefs.js',
  'js/program.js',
  'js/program-editor.js',
  'js/programming.js',
  'js/protocol.js',
  'js/recursos.js',
  'js/recursos-lista.js',
  'js/sair-da-pagina.js',
  'js/state.js',
  'js/transport.js',
  'js/tunnel.js',
  'js/util.js',
  'js/words.js',
  'brand/logo-horizontal.png',
  'brand/logo-icon.png',
  'brand/eco.svg',
  'fonts/raleway-latin.woff2',
  // as outras fontes (inter, nunito, fredoka, lora) só valem se o Estúdio escolher uma: entram no cache no primeiro uso
  // (a busca abaixo guarda tudo o que baixa), sem pesar ~150 KB na instalação de cada celular
  'icons/favicon.png',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // firmware do protótipo (atualizar.html): ~1 MB cada, baixa na hora e não ocupa o celular
  if (new URL(e.request.url).pathname.includes('/firmware')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
