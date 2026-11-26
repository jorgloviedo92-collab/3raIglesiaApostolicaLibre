/*
 * Manejadores de eventos declarados en el HTML con data-on-click / data-on-change / data-on-input.
 *
 * Antes se usaban atributos onclick="..." en el HTML, que obligaban a permitir 'unsafe-inline' en la
 * política de seguridad (CSP) de scripts. Con esta tabla la CSP ya no necesita ese permiso, así que
 * un texto malicioso que llegara a la página no podría ejecutar código.
 *
 * Para añadir un botón: poner data-on-click="nombre" en el HTML y registrar "nombre" aquí.
 * Usa delegación de eventos, por lo que también funciona con elementos creados dinámicamente.
 */
(function () {
  var ACTIONS = {
    click: {
      'cert-open': function () {
        toggleCertificatesModal(true);
      },
      'cert-close': function () {
        toggleCertificatesModal(false);
      },
      'cert-logo-clear': function () {
        clearCertLogo();
      },
      'cert-print': function () {
        printCurrentCertificate();
      },
      logout: function () {
        logoutSystem(true);
      }
    },
    change: {
      'cert-type-change': function () {
        updateCertificateSelectors();
      },
      'cert-member-change': function () {
        fillCertificateFromMember();
      },
      'cert-logo-upload': function (e) {
        handleCertLogoUpload(e);
      },
      'cert-preview': function () {
        renderCertificatePreview();
      },
      'rpt-render': function () {
        renderOnScreenReport();
      }
    },
    input: {
      'cert-preview': function () {
        renderCertificatePreview();
      },
      'rpt-render-debounced': function () {
        debouncedRenderOnScreenReport();
      }
    }
  };

  ['click', 'change', 'input'].forEach(function (eventName) {
    var attr = 'data-on-' + eventName;
    document.addEventListener(eventName, function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[' + attr + ']') : null;
      if (!el) return;
      var handler = ACTIONS[eventName][el.getAttribute(attr)];
      if (handler) handler(e);
    });
  });
})();
