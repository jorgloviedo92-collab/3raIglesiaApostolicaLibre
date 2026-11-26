// ────────────────────────────────────────────────────────────────────
// APP INSTALABLE (PWA): registra el service worker (sw.js)
// ────────────────────────────────────────────────────────────────────
// Solo funciona en https (GitHub Pages) o en localhost. Abierto como archivo (file://) se omite
// sin errores: la página sigue funcionando igual, solo que no se puede instalar.
(function () {
  if (!('serviceWorker' in navigator)) return;
  var local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (location.protocol !== 'https:' && !local) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function (err) {
      console.warn('No se pudo activar la app instalable:', err);
    });
  });
})();
