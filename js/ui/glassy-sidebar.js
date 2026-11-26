  (function () {
    const header = document.getElementById('mainHeader');
    const nav = document.querySelector('#navSection nav');
    if (!header || !nav) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktopMQ = window.matchMedia('(min-width: 1024px)');

    // 1. Inyectar botón circular de expandir/contraer en la cabecera del sidebar
    const brandRow = header.querySelector('.brand-row');
    if (brandRow && !document.getElementById('btnGlassSidebarToggle')) {
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.id = 'btnGlassSidebarToggle';
      toggleBtn.className = 'glass-toggle-btn hidden lg:inline-flex';
      toggleBtn.title = 'Contraer / expandir menú (Ctrl+B)';
      toggleBtn.setAttribute('aria-label', 'Contraer o expandir menú lateral');
      toggleBtn.innerHTML = '<i class="fa-solid fa-angles-left" aria-hidden="true"></i>';
      toggleBtn.addEventListener('click', () => {
        const existingToggle = document.getElementById('btnSidebarToggle');
        if (existingToggle) {
          existingToggle.click();
        } else {
          document.body.classList.toggle('sidebar-collapsed');
        }
      });
      brandRow.appendChild(toggleBtn);
    }

    // 2. Crear la píldora blanca deslizante dentro de <nav>
    const pill = document.createElement('span');
    pill.className = 'glass-active-pill';
    pill.setAttribute('aria-hidden', 'true');
    nav.prepend(pill);

    let lastTop = null;
    let stretchTimer = null;

    function setPillReady(ready) {
      if (pill.classList.contains('is-ready') !== ready) {
        pill.classList.toggle('is-ready', ready);
      }
    }

    function updatePill(animateStretch) {
      if (!desktopMQ.matches) {
        setPillReady(false);
        return;
      }

      const activeBtn = nav.querySelector('button.tab-active:not(.hidden)');
      if (!activeBtn) {
        setPillReady(false);
        return;
      }

      const targetTop = activeBtn.offsetTop;
      const targetHeight = activeBtn.offsetHeight;

      if (stretchTimer) {
        clearTimeout(stretchTimer);
        stretchTimer = null;
      }

      // Efecto elástico/líquido al cambiar de pestaña
      if (animateStretch && lastTop !== null && !reduceMotion.matches && Math.abs(targetTop - lastTop) > 4) {
        const delta = targetTop - lastTop;
        const extra = Math.min(Math.abs(delta) * 0.38, 42);
        const midTop = delta > 0 ? lastTop + delta * 0.22 : targetTop;

        pill.style.top = midTop + 'px';
        pill.style.height = (targetHeight + extra) + 'px';
        setPillReady(true);

        stretchTimer = setTimeout(() => {
          pill.style.top = targetTop + 'px';
          pill.style.height = targetHeight + 'px';
        }, 90);
      } else {
        pill.style.top = targetTop + 'px';
        pill.style.height = targetHeight + 'px';
        setPillReady(true);
      }

      lastTop = targetTop;
    }

    // 3. Observar SOLO los botones de navegación (nunca la píldora, evitando bucles infinitos)
    const btnObserver = new MutationObserver(() => updatePill(true));
    nav.querySelectorAll('button').forEach((btn) => {
      btnObserver.observe(btn, { attributes: true, attributeFilter: ['class'] });
    });

    // 4. Recalcular posición solo cuando cambia el estado colapsado del sidebar
    let wasCollapsed = document.body.classList.contains('sidebar-collapsed');
    const syncToggleAria = (collapsed) => {
      const glassBtn = document.getElementById('btnGlassSidebarToggle');
      if (glassBtn) glassBtn.setAttribute('aria-expanded', String(!collapsed));
    };
    syncToggleAria(wasCollapsed);
    new MutationObserver(() => {
      const isCollapsed = document.body.classList.contains('sidebar-collapsed');
      if (isCollapsed === wasCollapsed) return;
      wasCollapsed = isCollapsed;
      syncToggleAria(isCollapsed);
      updatePill(false);
      setTimeout(() => updatePill(false), 420);
    }).observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    header.addEventListener('transitionend', (e) => {
      if (e.target === header && e.propertyName === 'width') {
        updatePill(false);
      }
    });

    window.addEventListener('resize', () => updatePill(false));
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => updatePill(false)).observe(nav);
    }

    // Inicialización
    requestAnimationFrame(() => updatePill(false));
  })();
