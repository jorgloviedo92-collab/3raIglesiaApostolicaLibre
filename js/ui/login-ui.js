  /* Comportamiento visual del login. No toca la autenticación: eso sigue en handleDirectLogin(). */
  (function () {
    var gate = document.getElementById('authOverlay');
    if (!gate) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    var cardWrap = document.getElementById('authCardWrapper');
    var pin = document.getElementById('accessPinInput');
    var eye = document.getElementById('btnTogglePinVisibility');
    var caps = document.getElementById('capsLockWarning');
    var form = document.getElementById('loginForm');

    /* Sacudida de la tarjeta cuando hay un error */
    window.AuthUI = window.AuthUI || {};
    window.AuthUI.shakeCard = function () {
      if (!cardWrap || reduce.matches) return;
      cardWrap.classList.remove('auth-shake');
      void cardWrap.offsetWidth;
      cardWrap.classList.add('auth-shake');
    };
    if (cardWrap) cardWrap.addEventListener('animationend', function (e) {
      if (e.target === cardWrap) cardWrap.classList.remove('auth-shake');
    });
    if (form) form.addEventListener('invalid', function () { window.AuthUI.shakeCard(); }, true);

    /* Marca de agua para impresión: reutiliza el logo ya incrustado en la página */
    window.AuthUI.getPrintWatermarkHtml = function () {
      var img = document.querySelector('.auth-logo') || document.getElementById('headerLogo');
      return img ? '<img class="print-watermark" src="' + img.src + '" alt="" />' : '';
    };

    /* El logo del encabezado aparece con un pequeño pulso al entrar */
    function popHeaderLogo() {
      var ring = document.querySelector('.brand-logo-ring');
      if (!ring || reduce.matches) return;
      ring.classList.remove('brand-logo-pop'); void ring.offsetWidth; ring.classList.add('brand-logo-pop');
    }

    /* Salida animada al entrar al sistema (devuelve una promesa y es cancelable al cerrar sesión) */
    var closeGateTimer = null;
    window.AuthUI.cancelClose = function () {
      if (closeGateTimer) { clearTimeout(closeGateTimer); closeGateTimer = null; }
      gate.classList.remove('auth-leaving');
    };
    window.AuthUI.closeOverlay = function () {
      return new Promise(function (resolve) {
        if (gate.classList.contains('hidden')) { resolve(); return; }
        if (reduce.matches) { gate.classList.add('hidden'); resolve(); return; }
        window.AuthUI.cancelClose();
        gate.classList.add('auth-leaving');
        var delay = (gate.querySelector('.auth-card') && window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches) ? 550 : 350;
        closeGateTimer = setTimeout(function () {
          closeGateTimer = null;
          if (gate.classList.contains('auth-leaving')) gate.classList.add('hidden');
          gate.classList.remove('auth-leaving');
          popHeaderLogo();
          resolve();
        }, delay);
      });
    };

    /* Mostrar / ocultar PIN */
    function resetPin() {
      if (!pin || !eye) return;
      pin.type = 'password';
      eye.setAttribute('aria-pressed', 'false');
      eye.setAttribute('aria-label', 'Mostrar PIN');
      eye.firstElementChild.className = 'fa-solid fa-eye';
      if (caps) caps.hidden = true;
    }
    if (pin && eye) {
      eye.addEventListener('click', function () {
        var show = pin.type === 'password';
        pin.type = show ? 'text' : 'password';
        eye.setAttribute('aria-pressed', String(show));
        eye.setAttribute('aria-label', show ? 'Ocultar PIN' : 'Mostrar PIN');
        eye.firstElementChild.className = 'fa-solid ' + (show ? 'fa-eye-slash' : 'fa-eye');
        pin.focus();
      });
      var checkCaps = function (e) { if (caps && e.getModifierState) caps.hidden = !e.getModifierState('CapsLock'); };
      pin.addEventListener('keydown', checkCaps);
      pin.addEventListener('keyup', checkCaps);
      pin.addEventListener('blur', function () { if (caps) caps.hidden = true; });
    }

    /* Inclinación 3D suave del logo siguiendo el cursor (solo con mouse) */
    var stage = document.getElementById('authLogoStage');
    var tilt = document.getElementById('authLogoTilt');
    var tx = 0, ty = 0, tilting = 0;
    function applyTilt() {
      tilting = 0;
      tilt.style.setProperty('--auth-ry', (tx * 9).toFixed(2) + 'deg');
      tilt.style.setProperty('--auth-rx', (-ty * 9).toFixed(2) + 'deg');
    }
    gate.addEventListener('pointermove', function (e) {
      if (!tilt || !stage || reduce.matches || !fine.matches) return;
      var r = stage.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
      ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
      if (!tilting) tilting = requestAnimationFrame(applyTilt);
    });
    gate.addEventListener('pointerleave', function () {
      if (!tilt) return;
      tilt.style.setProperty('--auth-rx', '0deg');
      tilt.style.setProperty('--auth-ry', '0deg');
    });

    /* Polvo de luz dorada. El bucle se detiene cuando el login está oculto. */
    var cv = document.getElementById('authParticlesCanvas');
    var ctx = cv && cv.getContext ? cv.getContext('2d') : null;
    var motes = [], W = 0, H = 0, running = false, last = 0;
    function make(initial) {
      return { x: Math.random() * W, y: initial ? Math.random() * H : H + 12, r: .6 + Math.random() * 1.9,
               v: 6 + Math.random() * 16, ph: Math.random() * 6.28, sw: 6 + Math.random() * 14,
               tw: .6 + Math.random() * 1.4, gold: Math.random() < .78 };
    }
    function resize() {
      if (!ctx) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.max(18, Math.min(64, Math.round(W * H / 24000)));
      while (motes.length < n) motes.push(make(true));
      motes.length = Math.min(motes.length, n);
    }
    function frame(t) {
      if (gate.classList.contains('hidden') || document.hidden) { running = false; return; }
      var dt = Math.min(.05, (t - last) / 1000 || .016); last = t;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        m.y -= m.v * dt; m.ph += m.tw * dt;
        if (m.y < -12) { motes[i] = make(false); continue; }
        var x = m.x + Math.sin(m.ph) * m.sw;
        var a = (.25 + .45 * (.5 + .5 * Math.sin(m.ph * 1.7))) * Math.min(1, m.y / (H * .22));
        ctx.fillStyle = m.gold ? 'rgba(255,255,255,1)' : 'rgba(255,246,214,1)';
        ctx.globalAlpha = a * .22; ctx.beginPath(); ctx.arc(x, m.y, m.r * 3.2, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = a;       ctx.beginPath(); ctx.arc(x, m.y, m.r, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }
    function start() {
      if (running || !ctx || reduce.matches || !fine.matches || window.innerWidth < 1024) return;
      running = true; last = performance.now(); requestAnimationFrame(frame);
    }
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });
    const syncGateScroll = () => document.documentElement.classList.toggle('gate-open', !gate.classList.contains('hidden'));
    new MutationObserver(function () {
      syncGateScroll();
      if (!gate.classList.contains('hidden')) { resetPin(); start(); }
    }).observe(gate, { attributes: true, attributeFilter: ['class'] });
    /* Refresco seguro tras cerrar teclado virtual en tablets/móviles Android Chrome */
    var repaintTimer = null;
    function forceCardRepaint() {
      if (gate.classList.contains('hidden')) return;
      if (repaintTimer) clearTimeout(repaintTimer);
      repaintTimer = setTimeout(function () {
        repaintTimer = null;
        if (gate.classList.contains('hidden')) return;
        var cardEl = gate.querySelector('.auth-card');
        if (cardEl) {
          cardEl.style.visibility = 'hidden';
          void cardEl.offsetHeight;
          cardEl.style.visibility = '';
        }
        if (gate.scrollTop > 0 && gate.scrollHeight <= gate.clientHeight + 2) {
          gate.scrollTop = 0;
        }
      }, 120);
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', forceCardRepaint);
    }
    if (form) {
      form.addEventListener('focusout', forceCardRepaint);
    }

    syncGateScroll();
    resize(); start();
  })();
