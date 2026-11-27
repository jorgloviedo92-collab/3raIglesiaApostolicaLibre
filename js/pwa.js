// ────────────────────────────────────────────────────────────────────
// APP INSTALABLE (PWA): registra el service worker (sw.js) y avisa cuando hay una versión nueva
// ────────────────────────────────────────────────────────────────────
// Solo funciona en https (GitHub Pages) o en localhost. Abierto como archivo (file://) se omite
// sin errores: la página sigue funcionando igual, solo que no se puede instalar.
(function () {
  var local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (location.protocol !== 'https:' && !local) return;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function (err) {
        console.warn('No se pudo activar la app instalable:', err);
      });
    });
  }

  // ── Aviso de versión nueva ──
  // En celulares y tabletas la app instalada no se recarga al volver a ella: se reanuda la misma
  // página que ya estaba abierta, aunque se hayan publicado cambios. GitHub Pages marca todos los
  // archivos con la fecha de la última publicación (Last-Modified); si cambia, se ofrece actualizar.
  // No se recarga sola para no perder un formulario a medio llenar. La sesión se mantiene al recargar.
  var CADA_MS = 15 * 60 * 1000;
  var versionCargada = '';
  var ultimaRevision = 0;
  var avisoMostrado = false;

  function fechaPublicacion() {
    return fetch('index.html', { method: 'HEAD', cache: 'no-store' })
      .then(function (r) {
        return (r.ok && r.headers.get('Last-Modified')) || '';
      })
      .catch(function () {
        return '';
      });
  }

  function mostrarAviso() {
    if (avisoMostrado) return;
    avisoMostrado = true;
    var aviso = document.createElement('div');
    aviso.className = 'app-update-banner no-print';
    aviso.setAttribute('role', 'status');
    aviso.innerHTML =
      '<i class="fa-solid fa-circle-arrow-up" aria-hidden="true"></i>' +
      '<span>Hay una versión nueva del sistema.</span>' +
      '<button type="button" class="app-update-ok">Actualizar</button>' +
      '<button type="button" class="app-update-later" aria-label="Más tarde">Más tarde</button>';
    aviso.querySelector('.app-update-ok').addEventListener('click', function () {
      location.reload();
    });
    aviso.querySelector('.app-update-later').addEventListener('click', function () {
      aviso.remove();
      avisoMostrado = false;
      ultimaRevision = Date.now(); // vuelve a avisar en la próxima revisión
    });
    document.body.appendChild(aviso);
  }

  function buscarActualizacion(forzar) {
    if (!versionCargada || avisoMostrado) return Promise.resolve(false);
    if (!forzar && Date.now() - ultimaRevision < 60 * 1000) return Promise.resolve(false);
    ultimaRevision = Date.now();
    return fechaPublicacion().then(function (actual) {
      if (actual && actual !== versionCargada) {
        mostrarAviso();
        return true;
      }
      return false;
    });
  }
  window.buscarActualizacionApp = buscarActualizacion;

  window.addEventListener('load', function () {
    fechaPublicacion().then(function (v) {
      versionCargada = v;
      ultimaRevision = Date.now();
    });
  });
  // Al volver a la app (desde otra app, la pantalla de inicio o al desbloquear)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') buscarActualizacion(false);
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) buscarActualizacion(true);
  });
  setInterval(function () {
    if (document.visibilityState === 'visible') buscarActualizacion(false);
  }, CADA_MS);
})();
