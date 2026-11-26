/*
 * Service worker de EcclesiaSoft Pro (app instalable / PWA).
 *
 * Estrategia "red primero": con internet SIEMPRE se carga la versión publicada en GitHub, así que
 * cualquier cambio al sistema llega solo a la app instalada. La copia guardada solo se usa sin
 * conexión (o si la red tarda demasiado), para que la app al menos abra y avise.
 *
 * Seguridad: NO se interceptan las llamadas al servidor (Apps Script: POST a otro dominio), ni
 * ninguna petición que no sea GET. Los datos de la iglesia nunca se guardan en esta caché.
 */
const CACHE = 'ecclesiasoft-app-v1';
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const ESPERA_RED_MS = 6000;

// Si el navegador no permite usar la caché (modo privado, almacenamiento lleno...), la app sigue
// funcionando igual con internet: ningún error de caché debe impedir instalar o cargar.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(['./', 'index.html', 'manifest.webmanifest']))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function guardar(request, response) {
  if (response && response.ok && (response.type === 'basic' || response.type === 'cors')) {
    const copia = response.clone();
    caches
      .open(CACHE)
      .then((c) => c.put(request, copia))
      .catch(() => {});
  }
  return response;
}

// Red primero (revalidando la caché HTTP); si no hay red o tarda, la copia guardada.
function redPrimero(request, esPagina) {
  // (una petición de navegación no admite opciones: se pide de nuevo por su URL)
  const red = fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' }).then((r) => guardar(request, r));
  const tiempo = new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('lenta')), ESPERA_RED_MS));
  return Promise.race([red, tiempo]).catch(() =>
    caches
      .match(request, { ignoreSearch: esPagina })
      .then((r) => r || (esPagina ? caches.match('index.html') : null))
      .catch(() => null)
      .then((r) => r || red)
  );
}

// Librerías externas con versión fija (Chart.js, íconos, fuentes): la copia guardada sirve, y se
// actualiza en segundo plano.
function cachePrimero(request) {
  return caches
    .match(request)
    .catch(() => null)
    .then((guardada) => {
      const red = fetch(request)
        .then((r) => guardar(request, r))
        .catch(() => guardada);
      return guardada || red;
    });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.includes('/__')) return; // rutas internas de pruebas locales
    event.respondWith(redPrimero(req, req.mode === 'navigate'));
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cachePrimero(req));
  }
  // Cualquier otro dominio (Apps Script, Google Drive...) pasa directo, sin caché.
});
