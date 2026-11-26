// Diálogo de confirmación propio (reemplaza confirm() del navegador).
// showConfirmDialog({ title, message, confirmText, cancelText, tone: 'danger' | 'primary' | 'warning' }) → Promise<boolean>
function showConfirmDialog(opts) {
  const o = Object.assign(
    { title: 'Confirmar acción', message: '', confirmText: 'Confirmar', cancelText: 'Cancelar', tone: 'primary' },
    opts || {}
  );
  return new Promise((resolve) => {
    const previo = document.activeElement;
    const capa = document.createElement('div');
    capa.className = 'ui-dialog-backdrop';
    const icono =
      o.tone === 'danger'
        ? 'fa-triangle-exclamation'
        : o.tone === 'warning'
          ? 'fa-circle-exclamation'
          : 'fa-circle-question';
    capa.innerHTML = `
          <div class="ui-dialog ui-tone-${escapeHtml(o.tone)}" role="alertdialog" aria-modal="true" aria-labelledby="uiDialogTitle" aria-describedby="uiDialogMessage">
            <div class="ui-dialog-head">
              <span class="ui-dialog-icon"><i class="fa-solid ${icono}"></i></span>
              <h3 id="uiDialogTitle"></h3>
            </div>
            <p id="uiDialogMessage" class="ui-dialog-msg"></p>
            <div class="ui-dialog-actions">
              <button type="button" class="ui-btn ui-btn-ghost" data-r="0"></button>
              <button type="button" class="ui-btn ui-btn-${o.tone === 'danger' ? 'danger' : 'primary'}" data-r="1"></button>
            </div>
          </div>`;
    capa.querySelector('#uiDialogTitle').textContent = o.title;
    capa.querySelector('#uiDialogMessage').textContent = o.message;
    capa.querySelector('[data-r="0"]').textContent = o.cancelText;
    capa.querySelector('[data-r="1"]').textContent = o.confirmText;
    let cerrado = false;
    const cerrar = (r) => {
      if (cerrado) return;
      cerrado = true;
      document.removeEventListener('keydown', teclas, true);
      capa.classList.add('ui-leaving');
      setTimeout(() => capa.remove(), 140);
      if (previo && previo.focus) {
        try {
          previo.focus();
        } catch (e) {}
      }
      resolve(r);
    };
    const teclas = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cerrar(false);
      } else if (e.key === 'Tab') {
        const bs = capa.querySelectorAll('button');
        if (e.shiftKey && document.activeElement === bs[0]) {
          e.preventDefault();
          bs[1].focus();
        } else if (!e.shiftKey && document.activeElement === bs[1]) {
          e.preventDefault();
          bs[0].focus();
        }
      }
    };
    capa.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-r]');
      if (b) cerrar(b.getAttribute('data-r') === '1');
      else if (e.target === capa) cerrar(false);
    });
    document.addEventListener('keydown', teclas, true);
    document.body.appendChild(capa);
    // En acciones peligrosas el foco inicial queda en "Cancelar"
    capa.querySelector(o.tone === 'danger' ? '[data-r="0"]' : '[data-r="1"]').focus();
  });
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const isError = type === 'error';
  const duration = isError ? 6000 : 3800;
  const toast = document.createElement('div');
  toast.className = `toast-card toast-enter ${isError ? 'toast-error' : 'toast-success'}`;
  toast.setAttribute('role', isError ? 'alert' : 'status');
  toast.innerHTML = `
        <span class="toast-icon"><i class="fa-solid ${isError ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i></span>
        <div class="min-w-0"><p class="toast-title">${isError ? 'No se pudo completar' : 'Listo'}</p><p class="toast-msg"></p></div>
        <button type="button" class="toast-close" aria-label="Cerrar aviso"><i class="fa-solid fa-xmark"></i></button>
        <span class="toast-progress" style="animation-duration:${duration}ms"></span>`;
  toast.querySelector('.toast-msg').textContent = String(message);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    toast.classList.replace('toast-enter', 'toast-leave');
    setTimeout(() => toast.remove(), 300);
  };
  toast.querySelector('.toast-close').addEventListener('click', close);
  toast.querySelector('.toast-progress').addEventListener('animationend', close);
  if (prefersReducedMotion.matches) setTimeout(close, duration);
  container.appendChild(toast);
  while (container.children.length > 4) container.firstElementChild.remove();
}

// Barra superior para operaciones en segundo plano (cuenta operaciones simultáneas)
let busyCount = 0;
function setBackgroundBusy(on) {
  busyCount = Math.max(0, busyCount + (on ? 1 : -1));
  const bar = document.getElementById('topProgress');
  if (bar) bar.classList.toggle('active', busyCount > 0);
}

// Animación de conteo para las cifras del resumen
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
function animateNumber(el, target, format = (v) => String(Math.round(v))) {
  if (!el) return;
  const from = parseFloat(el.dataset.value || '0') || 0;
  el.dataset.value = String(target);
  el.title = format(target); // valor completo al pasar el mouse
  if (prefersReducedMotion.matches || from === target || document.hidden) {
    el.textContent = format(target);
    return;
  }
  const start = performance.now();
  const dur = 650;
  const step = (now) => {
    if (el.dataset.value !== String(target)) return; // llegó un valor más nuevo
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = format(from + (target - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function showSaving(text = 'Procesando...') {
  document.getElementById('savingText').textContent = text;
  document.getElementById('savingOverlay').classList.replace('hidden', 'flex');
}
function hideSaving() {
  document.getElementById('savingOverlay').classList.replace('flex', 'hidden');
}
