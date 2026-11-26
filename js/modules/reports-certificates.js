// ── 1. FILTROS AVANZADOS EN REPORTES ──
window.addEventListener('DOMContentLoaded', () => {
  // B. Inyectar controles de Filtro Avanzado en la pestaña de Reportes
  const rptAuthorInput = document.getElementById('reportAuthorInput');
  if (rptAuthorInput && rptAuthorInput.parentElement && rptAuthorInput.parentElement.parentElement) {
    const filterContainer = rptAuthorInput.parentElement.parentElement;
    const extraFilters = document.createElement('div');
    extraFilters.className = 'flex flex-wrap items-center gap-2 pt-2 w-full border-t border-slate-100 mt-2';
    extraFilters.innerHTML = `
        <div>
          <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Categoría</label>
          <select id="rptFilterCategory" data-on-change="rpt-render" class="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold">
            <option value="ALL">Todas</option>
            <option value="Activo">Activos</option>
            <option value="Directivo">Directivos</option>
            <option value="Inactivo">Inactivos</option>
            <option value="Nuevo Creyente">Nuevos Creyentes</option>
          </select>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Bautismo</label>
          <select id="rptFilterBaptized" data-on-change="rpt-render" class="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold">
            <option value="ALL">Todos</option>
            <option value="Sí">Bautizados</option>
            <option value="No">No Bautizados</option>
          </select>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Género</label>
          <select id="rptFilterGender" data-on-change="rpt-render" class="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold">
            <option value="ALL">Todos</option>
            <option value="Masculino">Masculino</option>
            <option value="Femenino">Femenino</option>
          </select>
        </div>
        <div class="flex-grow min-w-[180px]">
          <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Buscar en el Reporte</label>
          <input type="text" id="rptFilterSearch" data-on-input="rpt-render-debounced" placeholder="Filtrar por nombre o cédula..." class="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs" />
        </div>
      `;
    filterContainer.appendChild(extraFilters);
  }

  // Sobrescribir buildHistoricalReport para que respete los nuevos filtros de reportes
  const originalBuildReport = window.buildHistoricalReport;
  if (typeof originalBuildReport === 'function') {
    window.buildHistoricalReport = function (year, qVal, author) {
      const catEl = document.getElementById('rptFilterCategory');
      const catF = catEl ? catEl.value : 'ALL';
      const bapEl = document.getElementById('rptFilterBaptized');
      const bapF = bapEl ? bapEl.value : 'ALL';
      const genEl = document.getElementById('rptFilterGender');
      const genF = genEl ? genEl.value : 'ALL';
      const txtEl = document.getElementById('rptFilterSearch');
      const txtF = txtEl ? txtEl.value.trim().toLowerCase() : '';

      const backupAdults = [...adults];
      const backupChildren = [...children];
      const matchRptFilter = (m) => {
        const cat = m.category || m.categoria || '';
        const bap = m.isBaptized || m.bautizado || 'No';
        const gen = m.gender || m.genero || '';
        const name = (m.fullName || m.nombreCompleto || '').toLowerCase();
        const ced = (m.idNumber || m.cedula || '').toLowerCase();
        if (catF !== 'ALL' && cat !== catF) return false;
        if (bapF !== 'ALL' && bap !== bapF) return false;
        if (genF !== 'ALL' && gen !== genF) return false;
        if (txtF && !name.includes(txtF) && !ced.includes(txtF)) return false;
        return true;
      };
      try {
        adults = adults.filter(matchRptFilter);
        children = children.filter(matchRptFilter);
        return originalBuildReport(year, qVal, author);
      } finally {
        adults = backupAdults;
        children = backupChildren;
      }
    };
  }
});

// ── 2. VENTANA DE CERTIFICADOS ──
function toggleCertificatesModal(show) {
  const m = document.getElementById('certificatesModal');
  if (show) {
    m.classList.replace('hidden', 'flex');
    updateCertificateSelectors();
  } else {
    m.classList.replace('flex', 'hidden');
  }
}

// ── 3. GENERADOR E IMPRESIÓN DE CERTIFICADOS (BAUTISMO Y MATRIMONIO) ──
function updateCertificateSelectors() {
  const type = document.getElementById('certTypeSelect').value;
  const isMarriage = type === 'MATRIMONIO';
  document.getElementById('certSpouseWrapper').classList.toggle('hidden', !isMarriage);

  const list = isMarriage
    ? adults.filter((a) => a.isDeceased !== 'Sí' && a.fallecido !== 'Sí')
    : [...adults, ...children].filter((m) => m.isBaptized === 'Sí' || m.bautizado === 'Sí');

  const sel = document.getElementById('certMemberSelect');
  sel.innerHTML = list
    .map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.fullName || m.nombreCompleto)}</option>`)
    .join('');

  document.getElementById('certVerseInput').value = isMarriage
    ? '"Asi que no son ya mas dos, sino una sola carne; por tanto, lo que Dios juntó, no lo separe el hombre." — Mateo 19:6'
    : '"El que creyere y fuere bautizado, será salvo; mas el que no creyere, será condenado." — Marcos 16:16';

  fillCertificateFromMember();
}

function fillCertificateFromMember() {
  const id = document.getElementById('certMemberSelect').value;
  const m = [...adults, ...children].find((x) => String(x.id).trim() === String(id).trim());
  if (!m) {
    renderCertificatePreview();
    return;
  }

  const type = document.getElementById('certTypeSelect').value;
  if (type === 'BAUTISMO') {
    document.getElementById('certDateInput').value = (m.baptismDate || m.fechaBautismo || getTodayLocalIsoDate()).split(
      'T'
    )[0];
    document.getElementById('certPlaceInput').value =
      m.baptismPlace || m.lugarBautismo || churchConfig.name || 'Templo Local';
  } else {
    const spId = m.spouseId || m.idConyuge;
    const spMem = m.spouseIsMember || m.conyugeEsMiembro;
    const spObj = adults.find((a) => String(a.id).trim() === String(spId).trim());
    const spName = spMem
      ? spObj
        ? spObj.nombreCompleto || spObj.fullName
        : ''
      : m.spouseText || m.nombreConyugeTexto || '';
    document.getElementById('certSpouseInput').value = spName;
    document.getElementById('certDateInput').value = getTodayLocalIsoDate();
    document.getElementById('certPlaceInput').value = churchConfig.name || 'Templo Central';
  }
  renderCertificatePreview();
}

let rawStoredLogo = '';
try {
  rawStoredLogo = localStorage.getItem('ECCLESIA_CERT_LOGO') || '';
} catch (e) {}
let currentCertLogoBase64 = /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(rawStoredLogo)
  ? rawStoredLogo
  : '';

function handleCertLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    showToast('Formato inválido. Solo se admiten PNG, JPG o WEBP.', 'error');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('El logo no debe superar los 2 MB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = function (ev) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      const MAX = 300;
      let w = img.width,
        h = img.height;
      if (w > h) {
        if (w > MAX) {
          h *= MAX / w;
          w = MAX;
        }
      } else {
        if (h > MAX) {
          w *= MAX / h;
          h = MAX;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      currentCertLogoBase64 = canvas.toDataURL('image/png');
      try {
        localStorage.setItem('ECCLESIA_CERT_LOGO', currentCertLogoBase64);
      } catch (err) {}
      renderCertificatePreview();
      showToast('Logo cargado en el certificado.');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function clearCertLogo() {
  currentCertLogoBase64 = '';
  try {
    localStorage.removeItem('ECCLESIA_CERT_LOGO');
  } catch (e) {}
  const inp = document.getElementById('certLogoInput');
  if (inp) inp.value = '';
  renderCertificatePreview();
}

function buildCertificateHtml() {
  const type = document.getElementById('certTypeSelect').value;
  const id = document.getElementById('certMemberSelect').value;
  const m = [...adults, ...children].find((x) => String(x.id).trim() === String(id).trim());
  const memberName = m ? m.fullName || m.nombreCompleto : '______________________';
  const spouseName = document.getElementById('certSpouseInput').value.trim() || '______________________';
  const dateFormatted = formatDisplayDate(document.getElementById('certDateInput').value || getTodayLocalIsoDate());
  const place = document.getElementById('certPlaceInput').value.trim() || churchConfig.name || 'Templo Local';
  const verse = document.getElementById('certVerseInput').value.trim();
  const useWatermark = document.getElementById('certWatermarkCheck')
    ? document.getElementById('certWatermarkCheck').checked
    : true;

  const isMarriage = type === 'MATRIMONIO';
  const title = isMarriage ? 'CERTIFICADO ECLESIÁSTICO DE MATRIMONIO' : 'CERTIFICADO OFICIAL DE BAUTISMO EN AGUA';
  const bodyText = isMarriage
    ? `Por cuanto <strong>${escapeHtml(memberName)}</strong> y <strong>${escapeHtml(spouseName)}</strong> han comparecido ante Dios y esta congregación para unir sus vidas en Santo Matrimonio conforme a las Sagradas Escrituras, el día <strong>${escapeHtml(dateFormatted)}</strong> en <strong>${escapeHtml(place)}</strong>.`
    : `Hacemos constar que <strong>${escapeHtml(memberName)}</strong> ha dado testimonio público de su fe en Jesucristo, siendo bautizado(a) en agua en el nombre del Padre, del Hijo y del Espíritu Santo, el día <strong>${escapeHtml(dateFormatted)}</strong> en <strong>${escapeHtml(place)}</strong>.`;

  const topLogoHtml = currentCertLogoBase64
    ? `<img src="${currentCertLogoBase64}" alt="Logo" style="height: 75px; width: auto; object-fit: contain; margin: 0 auto 10px auto; display: block;" />`
    : '';

  const watermarkHtml =
    currentCertLogoBase64 && useWatermark
      ? `<img src="${currentCertLogoBase64}" alt="" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 280px; height: 280px; object-fit: contain; opacity: 0.08; pointer-events: none; z-index: 0;" />`
      : '';

  return `
      <div style="border: 8px double #1e3a8a; padding: 32px; background-color: #ffffff; text-align: center; font-family: Georgia, serif; color: #0f172a; position: relative; overflow: hidden;">
        ${watermarkHtml}
        <div style="border: 2px solid #b45309; padding: 26px; position: relative; z-index: 1;">
          ${topLogoHtml}
          <p style="font-size: 11pt; font-weight: 600; color: #1d4ed8; letter-spacing: 2px; text-transform: uppercase; margin: 0;">${escapeHtml(churchConfig.name || 'IGLESIA CRISTIANA')}</p>
          <p style="font-size: 8.5pt; color: #64748b; margin-top: 2px;">${escapeHtml(churchConfig.address || 'Nicaragua')}</p>
          <h1 style="font-size: 20pt; font-weight: 700; color: #0f172a; margin: 16px 0 12px 0; letter-spacing: 1px;">${title}</h1>
          <p style="font-size: 12pt; line-height: 1.8; max-width: 650px; margin: 0 auto 18px auto;">${bodyText}</p>
          <p style="font-size: 10pt; font-style: italic; color: #92400e; margin: 16px auto; max-width: 580px;">${escapeHtml(verse)}</p>
          <div style="margin-top: 50px; display: flex; justify-content: space-around; align-items: flex-end;">
            <div style="width: 210px;">
              <div style="border-top: 1px solid #0f172a; padding-top: 6px; font-weight: 600; font-size: 10pt;">${escapeHtml(churchConfig.pastor || 'Pastor Oficiante')}</div>
              <div style="font-size: 8pt; color: #64748b;">Pastor General</div>
            </div>
            <div style="width: 210px;">
              <div style="border-top: 1px solid #0f172a; padding-top: 6px; font-weight: 600; font-size: 10pt;">${escapeHtml(churchConfig.secretary || 'Secretaría General')}</div>
              <div style="font-size: 8pt; color: #64748b;">Secretario(a) General</div>
            </div>
          </div>
        </div>
      </div>
    `;
}

function renderCertificatePreview() {
  document.getElementById('certPreviewBox').innerHTML = buildCertificateHtml();
}

function printCurrentCertificate() {
  const printArea = document.getElementById('printOfficialReportArea');
  printArea.innerHTML = `<div class="cert-doc">${buildCertificateHtml()}</div>`;
  setTimeout(() => {
    window.print();
    printArea.innerHTML = '';
  }, 250);
}
