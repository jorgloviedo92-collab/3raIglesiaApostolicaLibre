// ────────────────────────────────────────────────────────────────────
// DASHBOARD Y NAVEGACIÓN
// ────────────────────────────────────────────────────────────────────

function switchTab(tab) {
  if (window.innerWidth < 1024) setMobileMenu(false);
  if (getCurrentRole() === 'consulta' && ['registro', 'contribuciones', 'caja', 'papelera'].includes(tab)) {
    showToast('Acceso restringido: requiere rol Administrador.', 'error');
    return;
  }
  ['dashboard', 'registro', 'directorio', 'contribuciones', 'caja', 'eventos', 'reportes', 'papelera'].forEach((t) => {
    const sec = document.getElementById('view-' + t);
    if (sec) sec.classList.add('hidden');
    const b = document.getElementById('tabBtn-' + t);
    if (b) b.classList.remove('tab-active');
  });
  const activeSec = document.getElementById('view-' + tab);
  if (activeSec) {
    activeSec.classList.remove('hidden');
    activeSec.classList.remove('view-transition');
    void activeSec.offsetWidth;
    activeSec.classList.add('view-transition');
  }
  const ab = document.getElementById('tabBtn-' + tab);
  if (ab) ab.classList.add('tab-active');

  const tabTitles = {
    dashboard: { sub: 'Panel de Control Pastoral', title: 'Resumen y Analítica en Tiempo Real' },
    directorio: { sub: 'Gestión de Membresía', title: 'Directorio General Relacional' },
    registro: { sub: 'Expediente Eclesiástico', title: 'Ficha de Registro y Actualización' },
    contribuciones: { sub: 'Finanzas Congregacionales', title: 'Libro de Contribuciones y Aportes (C$)' },
    caja: { sub: 'Tesorería y Contabilidad', title: 'Flujo de Caja y Gastos Operativos' },
    eventos: { sub: 'Planificación Pastoral', title: 'Agenda y Calendario de Eventos' },
    reportes: { sub: 'Auditoría e Informes', title: 'Reportes Trimestrales y Comparativas' },
    papelera: { sub: 'Seguridad y Respaldo', title: 'Papelera de Reciclaje y Restauración' }
  };
  const tInfo = tabTitles[tab] || tabTitles.dashboard;
  const subEl = document.getElementById('topBarSubtitle');
  const greetEl = document.getElementById('topBarGreeting');
  if (subEl) subEl.textContent = tInfo.sub;
  if (greetEl) greetEl.textContent = tInfo.title;

  vistaActual = tab;
  if (tab === 'dashboard') renderDashboardSummary();
  if (tab === 'eventos' && typeof window.renderEventsModule === 'function') window.renderEventsModule();
  if (tab === 'registro') {
    populateSelectors();
    toggleDisciplineAvailability();
  }
  if (tab === 'directorio') {
    syncStickyHeaderHeight();
    renderDirectory();
  }
  if (tab === 'papelera') renderTrashTable();
  if (tab === 'contribuciones') {
    const adultOpts = adults
      .filter((a) => a.isDeceased !== 'Sí' && a.fallecido !== 'Sí')
      .map(
        (a) =>
          `<option value="${escapeHtml(a.id)}">${escapeHtml(a.fullName || a.nombreCompleto)} (${escapeHtml(a.idNumber || a.cedula || 'S/N')})</option>`
      )
      .join('');
    document.getElementById('contributionMemberSelect').innerHTML =
      '<option value="">Selecciona Miembro...</option>' + adultOpts;
    document.getElementById('contributionDateInput').value = getTodayLocalIsoDate();
    renderContributionsTable();
  }
  if (tab === 'caja') {
    document.getElementById('cashDateInput').value = getTodayLocalIsoDate();
    updateCashCategorySelect();
    renderCashTable();
  }
  if (tab === 'reportes') {
    populateReportYears();
    renderOnScreenReport();
  }
}

function updateCashCategorySelect() {
  const type = document.getElementById('cashMovementTypeSelect').value;
  const cats = CASH_CATEGORIES[type] || [];
  document.getElementById('cashCategorySelect').innerHTML = cats
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join('');
}

// Estado de la alerta: filtro activo, "ver todos" y plegado (recordado en el navegador)
const discAlertState = { filter: 'all', showAll: false, collapsed: false, list: [] };
try {
  discAlertState.collapsed = localStorage.getItem('ecclesia_disc_collapsed') === '1';
} catch (e) {}
const DISC_PREVIEW = 4;
const DISC_FILTER_HELP = {
  due: 'La fecha de fin ya llegó: se puede levantar la disciplina',
  soon: 'Les quedan 15 días o menos para terminar la sanción',
  active: 'Les quedan más de 15 días',
  indef: 'Sanción sin fecha de cierre'
};
const DISC_STATUS = {
  due: {
    label: 'Plazo cumplido',
    accent: '#10b981',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: 'fa-circle-check'
  },
  soon: {
    label: 'Por vencer',
    accent: '#f59e0b',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: 'fa-hourglass-half'
  },
  active: { label: 'En curso', accent: '#3b74e0', chip: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'fa-clock' },
  indef: {
    label: 'Indefinida',
    accent: '#f43f5e',
    chip: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: 'fa-infinity'
  }
};

function classifyDiscipline(m, today) {
  const isIndef = !!(m.disciplineIndefinite || m.disciplinaIndefinida);
  const start = parseDateSafe(m.disciplineDate || m.inicioDisciplina);
  const end = parseDateSafe(m.disciplineEndDate || m.finDisciplina);
  if (isIndef || !end) return { status: 'indef', daysLeft: null, pct: null };
  const daysLeft = Math.ceil((end - today) / 86400000);
  let pct = 100;
  if (start && end > start) pct = Math.max(0, Math.min(100, ((today - start) / (end - start)) * 100));
  const status = daysLeft <= 0 ? 'due' : daysLeft <= 15 ? 'soon' : 'active';
  return { status, daysLeft, pct };
}

function renderDisciplineAlerts(disciplinedList) {
  const alertBox = document.getElementById('disciplineAlerts');
  const alertList = document.getElementById('disciplineAlertList');
  if (!alertBox || !alertList) return;
  if (disciplinedList) {
    const today = parseDateSafe(getTodayLocalIsoDate());
    const order = { due: 0, soon: 1, active: 2, indef: 3 };
    discAlertState.list = disciplinedList
      .map((item) => ({ ...item, info: classifyDiscipline(item.member, today) }))
      .sort(
        (a, b) => order[a.info.status] - order[b.info.status] || (a.info.daysLeft ?? 1e9) - (b.info.daysLeft ?? 1e9)
      );
  }
  const all = discAlertState.list;
  if (!all.length) {
    alertBox.classList.add('hidden');
    return;
  }

  const counts = { all: all.length, due: 0, soon: 0, active: 0, indef: 0 };
  all.forEach((it) => counts[it.info.status]++);
  if (discAlertState.filter !== 'all' && !counts[discAlertState.filter]) discAlertState.filter = 'all';

  // Cabecera y resumen
  document.getElementById('disciplineAlertCount').textContent = all.length;
  const parts = [`${all.length} miembro(s) en seguimiento`];
  if (counts.due) parts.push(`${counts.due} con plazo cumplido, listo(s) para levantar`);
  if (counts.soon) {
    // "Por vencer" = sanciones a las que les quedan 15 días o menos; se muestra el plazo real más próximo
    const nextDays = Math.min(...all.filter((it) => it.info.status === 'soon').map((it) => it.info.daysLeft));
    parts.push(
      counts.soon === 1
        ? `1 vence en ${nextDays} día(s)`
        : `${counts.soon} vencen en los próximos 15 días (la más próxima en ${nextDays} día(s))`
    );
  }
  document.getElementById('disciplineAlertSummary').textContent = parts.join(' · ');
  alertBox.classList.toggle('has-due', counts.due > 0);
  alertBox.classList.toggle('collapsed', discAlertState.collapsed);
  document.getElementById('disciplineAlertToggleLabel').textContent = discAlertState.collapsed ? 'Mostrar' : 'Ocultar';
  document.getElementById('disciplineAlertToggleBtn').setAttribute('aria-expanded', String(!discAlertState.collapsed));

  // Filtros por estado
  const filters = [
    ['all', 'Todos'],
    ['due', 'Plazo cumplido'],
    ['soon', 'Por vencer'],
    ['active', 'En curso'],
    ['indef', 'Indefinida']
  ];
  document.getElementById('disciplineAlertFilters').innerHTML = filters
    .filter(([k]) => k === 'all' || counts[k] > 0)
    .map(
      ([k, label]) =>
        `<button type="button" data-filter="${k}" title="${DISC_FILTER_HELP[k] || ''}" class="discipline-filter ${discAlertState.filter === k ? 'active' : ''}">${label}<span class="n">${counts[k]}</span></button>`
    )
    .join('');

  const isAdmin = getCurrentRole() === 'admin';
  const visible = all.filter((it) => discAlertState.filter === 'all' || it.info.status === discAlertState.filter);
  const shown = discAlertState.showAll ? visible : visible.slice(0, DISC_PREVIEW);

  alertList.innerHTML = shown
    .map((item, i) => {
      const m = item.member;
      const st = DISC_STATUS[item.info.status];
      const nameVal = m.fullName || m.nombreCompleto || 'Miembro';
      const tableKey = item.type === 'Adultos' ? 'adult' : 'child';
      const reasonStr = m.disciplineReason || m.motivoDisciplina || '';
      const endStr = m.disciplineEndDate || m.finDisciplina || '';
      const d = item.info.daysLeft;
      const timeText =
        item.info.status === 'indef'
          ? 'Sin fecha de cierre · sujeta a revisión pastoral'
          : d > 0
            ? `Faltan <strong>${d}</strong> día(s) · fin ${escapeHtml(formatDisplayDate(endStr))}`
            : d === 0
              ? `Vence <strong>hoy</strong> (${escapeHtml(formatDisplayDate(endStr))})`
              : `Cumplido hace <strong>${Math.abs(d)}</strong> día(s)`;
      const liftBtn = isAdmin
        ? `<button type="button" data-id="${escapeHtml(m.id)}" data-table="${tableKey}" data-name="${escapeHtml(nameVal)}" class="btn-alert-lift text-xs font-bold px-3 py-1.5 rounded-lg transition ${item.info.status === 'due' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'}"><i class="fa-solid fa-user-check mr-1 pointer-events-none"></i><span class="pointer-events-none">Levantar</span></button>`
        : '';
      return `
          <li class="discipline-item ${item.info.status === 'due' ? 'is-due' : ''}" style="--accent:${st.accent}; animation-delay:${i * 60}ms">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-bold text-slate-900 truncate">${escapeHtml(nameVal)}</p>
                <p class="text-xs text-slate-500 mt-0.5">${item.type === 'Adultos' ? 'Adulto' : 'Menor'} · Inicio ${escapeHtml(formatDisplayDate(m.disciplineDate || m.inicioDisciplina))}</p>
              </div>
              <span class="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full border ${st.chip}"><i class="fa-solid ${st.icon} mr-1"></i>${st.label}</span>
            </div>
            <div class="discipline-bar mt-3 ${item.info.status === 'indef' ? 'indef' : ''}"><span data-pct="${item.info.pct ?? 100}"></span></div>
            <p class="text-xs text-slate-600 mt-2">${timeText}</p>
            ${reasonStr ? `<p class="text-xs text-slate-500 italic mt-1 truncate" title="${escapeHtml(reasonStr)}">“${escapeHtml(reasonStr)}”</p>` : ''}
            <div class="flex items-center justify-end gap-1.5 mt-3">
              <button type="button" data-id="${escapeHtml(m.id)}" data-type="${escapeHtml(item.type)}" class="btn-alert-view text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"><i class="fa-solid fa-eye mr-1 pointer-events-none"></i><span class="pointer-events-none">Ver ficha</span></button>
              ${liftBtn}
            </div>
          </li>`;
    })
    .join('');

  // Las barras se animan desde 0 hasta el avance real de la sanción
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      alertList.querySelectorAll('.discipline-bar > span[data-pct]').forEach((b) => {
        b.style.width = b.dataset.pct + '%';
      });
    })
  );

  const moreBtn = document.getElementById('disciplineAlertShowMoreBtn');
  moreBtn.classList.toggle('hidden', visible.length <= DISC_PREVIEW);
  moreBtn.textContent = discAlertState.showAll ? 'Mostrar menos' : `Ver todos (${visible.length})`;

  alertBox.classList.remove('hidden');
}

async function executeLiftDiscipline(table, id, name) {
  if (getCurrentRole() !== 'admin') {
    showToast('Se requiere rol Administrador para levantar una disciplina.', 'error');
    return;
  }
  if (
    !(await showConfirmDialog({
      title: 'Levantar disciplina',
      message: `¿Confirmas levantar la disciplina pastoral y reactivar a "${name}"?\n\nEsta acción quedará registrada en la auditoría.`,
      confirmText: 'Levantar disciplina'
    }))
  ) {
    return;
  }

  showSaving('Levantando disciplina y reactivando miembro...');
  try {
    const res = await fetchAPI('liftDiscipline', { table: table, id: id });
    if (res.status !== 'ok') throw new Error(res.message || 'No se pudo levantar la disciplina.');

    if (res.record) {
      const lista = table === 'adult' ? adults : children;
      const idx = lista.findIndex((x) => String(x.id).trim() === String(id).trim());
      if (idx >= 0) lista[idx] = res.record;
    }

    showToast(res.message || `Disciplina levantada. ${name} está activo nuevamente.`);
    updateAllViews();
  } catch (err) {
    showToast('Error al levantar disciplina: ' + err.message, 'error');
  } finally {
    hideSaving();
  }
}

function startPromoteMinorToAdult(childId) {
  if (getCurrentRole() !== 'admin') {
    showToast('Se requiere rol Administrador para realizar el traspaso a Adulto.', 'error');
    return;
  }
  const m = children.find((c) => String(c.id).trim() === String(childId).trim());
  if (!m) return;
  if (calculateAgeYears(m.birthDate || m.fechaNacimiento, 'No', '') < MIN_ADULT_MEMBER_AGE) {
    showToast(`Solo las personas de ${MIN_ADULT_MEMBER_AGE} años o más pueden pasar a Adultos.`, 'error');
    return;
  }

  cancelEditMember('Adulto');
  document.getElementById('promotingFromChildId').value = m.id;
  const nameVal = m.fullName || m.nombreCompleto || '';
  const stageInfo = getMinorStage(m.birthDate || m.fechaNacimiento, 'No', '');
  document.getElementById('promoteBannerTitle').textContent =
    `Traspaso Manual a Miembro Adulto (${stageInfo.label}): ${nameVal}`;
  document.getElementById('promoteBanner').classList.remove('hidden');
  document.getElementById('formHeaderTitle').textContent = `Pasar a Adulto: ${nameVal}`;
  setFormIdBadge('', 'ID de adulto: se asigna al guardar (registro actual ' + childId + ')');

  document.getElementById('fullName').value = nameVal;
  document.getElementById('idNumber').value = m.idNumber || m.cedula || '';
  document.getElementById('gender').value = m.gender || m.genero || 'Masculino';
  document.getElementById('birthDate').value = (m.birthDate || m.fechaNacimiento || '').split('T')[0];
  document.getElementById('birthPlace').value = m.birthPlace || m.lugarNacimiento || '';
  document.getElementById('phone').value = m.phone || m.telefono || '';
  document.getElementById('address').value = m.address || m.direccion || '';
  document.getElementById('educationLevel').value = m.educationLevel || m.escolaridad || 'Secundaria';
  document.getElementById('category').value = m.category || m.categoria || 'Activo';
  document.getElementById('conversionType').value = m.conversionType || m.tipoConversion || '';
  document.getElementById('joinDate').value = (m.joinDate || m.fechaIngreso || '').split('T')[0];
  document.getElementById('isBaptized').value = m.isBaptized || m.bautizado || 'No';
  document.getElementById('baptismDate').value = (m.baptismDate || m.fechaBautismo || '').split('T')[0];
  document.getElementById('baptismPlace').value = m.baptismPlace || m.lugarBautismo || '';
  document.getElementById('isDeceased').value = 'No';
  document.getElementById('inDiscipline').value = m.inDiscipline || m.enDisciplina || 'No';
  document.getElementById('disciplineDate').value = (m.disciplineDate || m.inicioDisciplina || '').split('T')[0];
  document.getElementById('disciplineMonths').value = m.disciplineMonths || m.mesesCastigo || '';
  document.getElementById('disciplineEndDate').value = (m.disciplineEndDate || m.finDisciplina || '').split('T')[0];
  document.getElementById('disciplineIndefinite').checked = !!(m.disciplineIndefinite || m.disciplinaIndefinida);
  document.getElementById('disciplineReason').value = m.disciplineReason || m.motivoDisciplina || '';

  document
    .getElementById('baptismBox')
    .classList.toggle('hidden', document.getElementById('isBaptized').value !== 'Sí');
  document.getElementById('deceasedBox').classList.add('hidden');

  // Mapear Tutores del menor a Padre / Madre en la ficha de Adulto
  populateSelectors();
  const tutors = [
    {
      isMem: !!(m.tutor1IsMember || m.tutor1EsMiembro),
      id: m.tutor1Id || m.idTutor1 || '',
      text: m.tutor1Text || m.nombreTutor1Texto || ''
    },
    {
      isMem: !!(m.tutor2IsMember || m.tutor2EsMiembro),
      id: m.tutor2Id || m.idTutor2 || '',
      text: m.tutor2Text || m.nombreTutor2Texto || ''
    }
  ];
  let fatherAssigned = false;
  let motherAssigned = false;
  tutors.forEach((t) => {
    if (t.isMem && t.id) {
      const obj = adults.find((a) => String(a.id).trim() === String(t.id).trim());
      const g = obj ? String(obj.gender || obj.genero || '').toLowerCase() : '';
      if (g === 'femenino' && !motherAssigned) {
        document.getElementById('motherIsMember').checked = true;
        document.getElementById('motherSelect').value = t.id;
        motherAssigned = true;
      } else if (!fatherAssigned) {
        document.getElementById('fatherIsMember').checked = true;
        document.getElementById('fatherSelect').value = t.id;
        fatherAssigned = true;
      } else if (!motherAssigned) {
        document.getElementById('motherIsMember').checked = true;
        document.getElementById('motherSelect').value = t.id;
        motherAssigned = true;
      }
    } else if (t.text) {
      if (!fatherAssigned) {
        document.getElementById('fatherText').value = t.text;
        fatherAssigned = true;
      } else if (!motherAssigned) {
        document.getElementById('motherText').value = t.text;
        motherAssigned = true;
      }
    }
  });

  loadPhotoIntoForm(m.photoBase64 || m.fotoUrl);

  updateAgePreview();
  toggleAdultFamily();
  toggleDisciplineAvailability();
  calcDisciplineEnd();
  switchTab('registro');
  setTimeout(() => {
    const cedContainer = document.getElementById('cedulaContainer');
    const cedInput = document.getElementById('idNumber');
    if (cedContainer && !cedContainer.classList.contains('hidden') && cedInput && !cedInput.value.trim()) {
      cedInput.focus();
    } else {
      const ms = document.getElementById('maritalStatus');
      if (ms) ms.focus();
    }
  }, 120);
}

function setActiveDirectoryTab(tabKey) {
  currentDirTab = tabKey;
  currentDirPage = 1;
  const btns = [
    { id: 'dirTabAdults', key: 'Adultos' },
    { id: 'dirTabChildren', key: 'Ninos' },
    { id: 'dirTabTeens', key: 'Adolescentes' },
    { id: 'dirTabYouth', key: 'Jovenes' }
  ];
  btns.forEach((b) => {
    const el = document.getElementById(b.id);
    if (!el) return;
    const active = b.key === tabKey;
    el.classList.toggle('btn-dir-active', active);
    el.classList.toggle('bg-slate-200', !active);
    el.classList.toggle('text-slate-600', !active);
    el.classList.toggle('hover:bg-slate-300', !active);
  });
  document.getElementById('tableHeaderRelational').textContent =
    tabKey === 'Adultos' ? 'Cónyuge / Padres' : 'Tutores Asignados';
  renderDirectory();
  const scroller = document.getElementById('directoryTableWrapper');
  if (scroller) scroller.scrollTop = 0;
}

// Pantalla abierta en este momento (la actualiza switchTab)
let vistaActual = 'dashboard';

// Tras un cambio de datos se redibuja SOLO la pantalla visible: las demás se dibujan
// al abrirlas (switchTab). No toca formularios, para no borrar lo que se esté escribiendo.
function updateAllViews() {
  document.getElementById('navTotalCount').textContent =
    adults.filter(isAliveRecord).length + children.filter(isAliveRecord).length;
  document.getElementById('headerChurchName').textContent = churchConfig.name || 'Iglesia Local';
  if (typeof window.updateEventsNavBadge === 'function') window.updateEventsNavBadge();
  renderActiveViewData(vistaActual);
}

function renderActiveViewData(vista) {
  if (vista === 'dashboard') renderDashboardSummary();
  else if (vista === 'directorio') renderDirectory();
  else if (vista === 'contribuciones') renderContributionsTable();
  else if (vista === 'caja') renderCashTable();
  else if (vista === 'eventos' && typeof window.renderEventsModule === 'function') window.renderEventsModule();
  else if (vista === 'papelera') renderTrashTable();
  else if (vista === 'reportes') populateReportYears();
}

// Resumen: indicadores, alertas de disciplina, totales financieros, gráficos y diagnóstico
function renderDashboardSummary() {
  const aliveAdults = adults.filter((a) => a.isDeceased !== 'Sí' && a.fallecido !== 'Sí');
  const aliveChildren = children.filter((c) => c.isDeceased !== 'Sí' && c.fallecido !== 'Sí');
  const totalLive = aliveAdults.length + aliveChildren.length;
  const totalDeceased =
    adults.filter((a) => a.isDeceased === 'Sí' || a.fallecido === 'Sí').length +
    children.filter((c) => c.isDeceased === 'Sí' || c.fallecido === 'Sí').length;

  const aliveNinos = aliveChildren.filter((c) => calculateAgeYears(c.birthDate || c.fechaNacimiento, 'No', '') <= 10);
  const aliveTeens = aliveChildren.filter((c) => {
    const y = calculateAgeYears(c.birthDate || c.fechaNacimiento, 'No', '');
    return y >= 11 && y <= 15;
  });
  const aliveYouth = aliveChildren.filter((c) => calculateAgeYears(c.birthDate || c.fechaNacimiento, 'No', '') >= 16);

  document.getElementById('navTotalCount').textContent = totalLive;
  animateNumber(document.getElementById('statLiveCensus'), totalLive);
  animateNumber(document.getElementById('statAdults'), aliveAdults.length);
  animateNumber(document.getElementById('statChildren'), aliveChildren.length);
  const breakdownEl = document.getElementById('statChildrenBreakdown');
  if (breakdownEl) {
    breakdownEl.textContent = `${aliveNinos.length} Niñ · ${aliveTeens.length} Adol · ${aliveYouth.length} Jóv`;
  }
  animateNumber(
    document.getElementById('statActive'),
    aliveAdults.filter((a) => (a.category || a.categoria) === 'Activo').length
  );
  animateNumber(document.getElementById('statDeceased'), totalDeceased);

  const disciplinedAdults = aliveAdults
    .filter(
      (a) =>
        (a.isBaptized === 'Sí' || a.bautizado === 'Sí') &&
        (a.category || a.categoria) !== 'Inactivo' &&
        (a.inDiscipline === 'Sí' || a.enDisciplina === 'Sí')
    )
    .map((a) => ({ member: a, type: 'Adultos' }));

  const disciplinedChildren = aliveChildren
    .filter(
      (c) =>
        (c.isBaptized === 'Sí' || c.bautizado === 'Sí') &&
        (c.category || c.categoria) !== 'Inactivo' &&
        (c.inDiscipline === 'Sí' || c.enDisciplina === 'Sí')
    )
    .map((c) => ({ member: c, type: 'Menores' }));

  const allDisciplined = [...disciplinedAdults, ...disciplinedChildren];
  animateNumber(document.getElementById('statDiscipline'), allDisciplined.length);

  renderDisciplineAlerts(allDisciplined);

  const headerTitle = document.getElementById('headerChurchName');
  headerTitle.textContent = churchConfig.name || 'Iglesia Local';

  const heroChurchEl = document.getElementById('heroChurchTitle');
  if (heroChurchEl) heroChurchEl.textContent = churchConfig.name || '3ra Iglesia Apostólica Libre Emanuel';
  const heroDateEl = document.getElementById('heroDateBadge');
  if (heroDateEl) heroDateEl.textContent = formatDisplayDate(getTodayLocalIsoDate());
  const heroTotalMirror = document.getElementById('heroTotalLiveMirror');
  animateNumber(heroTotalMirror, totalLive);

  const baptizedLiveCount =
    aliveAdults.filter((a) => (a.isBaptized || a.bautizado) === 'Sí').length +
    aliveChildren.filter((c) => (c.isBaptized || c.bautizado) === 'Sí').length;
  const baptizedRate = totalLive > 0 ? Math.round((baptizedLiveCount / totalLive) * 100) : 0;
  const heroBapCountEl = document.getElementById('heroBaptizedCount');
  animateNumber(heroBapCountEl, baptizedLiveCount);
  const heroBapRateEl = document.getElementById('heroBaptizedRate');
  animateNumber(heroBapRateEl, baptizedRate, (v) => Math.round(v) + '%');
  const heroBapBarEl = document.getElementById('heroBaptizedBar');
  if (heroBapBarEl) heroBapBarEl.style.width = baptizedRate + '%';

  // Totales financieros del Resumen (antes los escribían las tablas de Contribuciones y Caja)
  const sumaMontos = (lista, filtro) =>
    lista.reduce((t, r) => t + (filtro && !filtro(r) ? 0 : parseFloat(r.amount || r.monto) || 0), 0);
  const totalAportes = sumaMontos(contributions);
  const entradasCaja = sumaMontos(cashFlow, (r) => (r.movementType || r.tipoMovimiento) === 'Entrada');
  const salidasCaja = sumaMontos(cashFlow, (r) => (r.movementType || r.tipoMovimiento) !== 'Entrada');
  document.getElementById('statContribTotal').textContent = formatCurrency(totalAportes);
  animateNumber(document.getElementById('statCashNet'), totalAportes + entradasCaja - salidasCaja, (v) =>
    formatCurrency(v)
  );

  renderCharts();
  renderDashboardDiagnostics();
}

// ────────────────────────────────────────────────────────────────────
// GRÁFICOS Y DIAGNÓSTICO DEL RESUMEN
// ────────────────────────────────────────────────────────────────────

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const CHART_FONT = "'IBM Plex Sans', system-ui, sans-serif";

// Montos en córdobas con separador de miles: C$12,500.00 / -C$900.00
// Formateador de montos creado una sola vez (toLocaleString con opciones crea uno nuevo en cada llamada).
const FORMATO_MONTO = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function formatCurrency(n) {
  const v = Number(n) || 0;
  return (v < 0 ? '-' : '') + 'C$' + FORMATO_MONTO.format(Math.abs(v));
}

function isAliveRecord(m) {
  return m.isDeceased !== 'Sí' && m.fallecido !== 'Sí';
}

function isBaptizedRecord(m) {
  return (m.isBaptized || m.bautizado) === 'Sí';
}

function minorStageKey(c) {
  return getMinorStage(c.birthDate || c.fechaNacimiento, 'No', '').key;
}

// Escribe el valor al final de cada barra horizontal
const barValueLabelsPlugin = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = `700 12px ${CHART_FONT}`;
    ctx.fillStyle = '#0f172a';
    ctx.textBaseline = 'middle';
    chart.getDatasetMeta(0).data.forEach((bar, i) => {
      ctx.fillText(String(chart.data.datasets[0].data[i]), bar.x + 8, bar.y);
    });
    ctx.restore();
  }
};

function toIsoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function setCashFlowRangeLastMonths(n) {
  const today = parseDateSafe(getTodayLocalIsoDate()) || new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - (n - 1), 1);
  document.getElementById('cashFlowStartDate').value = toIsoLocal(from);
  document.getElementById('cashFlowEndDate').value = toIsoLocal(today);
}

// Si el gráfico ya existe sobre el mismo lienzo, solo se reemplazan sus datos y opciones
// (Chart.js anima la transición); si no, se crea. Evita destruir y recrear en cada refresco.
function upsertChartInstance(clave, canvas, config) {
  const g = chartInstances[clave];
  if (
    g &&
    g.canvas === canvas &&
    g.config.type === (config.type || g.config.type) &&
    g.data.datasets.length === config.data.datasets.length
  ) {
    g.data.labels = config.data.labels;
    config.data.datasets.forEach((ds, i) => Object.assign(g.data.datasets[i], ds));
    g.options = config.options;
    g.update();
    return g;
  }
  if (g) g.destroy();
  chartInstances[clave] = new Chart(canvas, config);
  return chartInstances[clave];
}

function renderCashFlowChart() {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById('chartCashFlow');
  if (!canvas) return;

  const fromInput = document.getElementById('cashFlowStartDate');
  const toInput = document.getElementById('cashFlowEndDate');
  if (!fromInput.value || !toInput.value) setCashFlowRangeLastMonths(6);
  let from = parseDateSafe(fromInput.value);
  let to = parseDateSafe(toInput.value);
  if (from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }

  // Meses del rango (máximo 36 para que el gráfico siga legible)
  const months = [];
  let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const last = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= last && months.length < 36) {
    months.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      label: `${MESES_CORTOS[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(-2)}`
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  const idx = new Map(months.map((m, i) => [m.key, i]));
  const income = months.map(() => 0);
  const expense = months.map(() => 0);
  const fromIso = toIsoLocal(from);
  const toIso = toIsoLocal(to);
  const addTo = (arr, dateStr, amount) => {
    const iso = String(dateStr || '').split('T')[0];
    if (!iso || iso < fromIso || iso > toIso) return;
    const i = idx.get(iso.substring(0, 7));
    if (i !== undefined) arr[i] += parseFloat(amount) || 0;
  };

  contributions.forEach((c) => addTo(income, c.date || c.fecha, c.amount || c.monto));
  cashFlow.forEach((cf) => {
    const isIn = (cf.movementType || cf.tipoMovimiento) === 'Entrada';
    addTo(isIn ? income : expense, cf.date || cf.fecha, cf.amount || cf.monto);
  });
  const net = income.map((v, i) => Math.round((v - expense[i]) * 100) / 100);

  const sub = document.getElementById('cashFlowSubtitle');
  if (sub) {
    sub.textContent =
      months.length === 6 && toIso === getTodayLocalIsoDate()
        ? 'Ingresos, egresos y resultado neto de los últimos 6 meses (C$)'
        : `Ingresos, egresos y resultado neto del ${formatDisplayDate(fromIso)} al ${formatDisplayDate(toIso)} (C$)`;
  }

  upsertChartInstance('flow', canvas, {
    data: {
      labels: months.map((m) => m.label),
      datasets: [
        {
          type: 'line',
          label: 'Resultado neto',
          data: net,
          order: 0,
          borderColor: '#0f5fa8',
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#0f5fa8',
          pointBorderWidth: 2.5
        },
        {
          type: 'bar',
          label: 'Ingresos',
          data: income,
          order: 1,
          backgroundColor: '#10a36f',
          borderRadius: 6,
          maxBarThickness: 36
        },
        {
          type: 'bar',
          label: 'Egresos',
          data: expense,
          order: 1,
          backgroundColor: '#ef4444',
          borderRadius: 6,
          maxBarThickness: 36
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 10,
            padding: 14,
            color: '#475569',
            font: { family: CHART_FONT, size: 13 }
          }
        },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatCurrency(c.parsed.y)}` } }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#e2e8f0' },
          border: { display: false },
          ticks: {
            color: '#475569',
            font: { family: CHART_FONT, size: 12 },
            callback: (v) => 'C$' + Number(v).toLocaleString('en-US')
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#475569', font: { family: CHART_FONT, size: 13 } }
        }
      }
    }
  });
}

function renderCharts() {
  if (typeof Chart === 'undefined') return;

  const aliveAdults = adults.filter(isAliveRecord);
  const aliveKids = children.filter(isAliveRecord);
  const maritalOf = (a) => a.maritalStatus || a.estadoCivil || '';

  // Demografía por grupo
  const demo = [
    ['Hombres', aliveAdults.filter((a) => (a.gender || a.genero) === 'Masculino').length, '#0f5fa8'],
    ['Mujeres', aliveAdults.filter((a) => (a.gender || a.genero) === 'Femenino').length, '#38a5f0'],
    ['Niños (0-10)', aliveKids.filter((c) => minorStageKey(c) === 'Nino').length, '#0e7490'],
    ['Adolescentes (11-15)', aliveKids.filter((c) => minorStageKey(c) === 'Adolescente').length, '#6d28d9'],
    ['Jóvenes (16+)', aliveKids.filter((c) => minorStageKey(c) === 'Joven').length, '#0284c7']
  ];
  upsertChartInstance('dem', document.getElementById('chartDemography'), {
    type: 'bar',
    data: {
      labels: demo.map((d) => d[0]),
      datasets: [
        { data: demo.map((d) => d[1]), backgroundColor: demo.map((d) => d[2]), borderRadius: 6, barThickness: 26 }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 28 } },
      plugins: { legend: { display: false } },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#e2e8f0' },
          border: { display: false },
          ticks: { precision: 0, color: '#64748b', font: { family: CHART_FONT, size: 12 } }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#334155', font: { family: CHART_FONT, size: 13, weight: '600' } }
        }
      }
    },
    plugins: [barValueLabelsPlugin]
  });

  // Estado civil (adultos vivos)
  const civil = [
    ['Casados', aliveAdults.filter((a) => ['Casado(a)', 'Unión de Hecho'].includes(maritalOf(a))).length, '#0f5fa8'],
    ['Solteros', aliveAdults.filter((a) => maritalOf(a) === 'Soltero(a)').length, '#5cc2f5'],
    [
      'Otros',
      aliveAdults.filter((a) => !['Casado(a)', 'Unión de Hecho', 'Soltero(a)'].includes(maritalOf(a))).length,
      '#94a3b8'
    ]
  ];
  const civilTotal = aliveAdults.length;
  upsertChartInstance('civ', document.getElementById('chartCivil'), {
    type: 'doughnut',
    data: {
      labels: civil.map((c) => c[0]),
      datasets: [
        {
          data: civilTotal ? civil.map((c) => c[1]) : [1],
          backgroundColor: civilTotal ? civil.map((c) => c[2]) : ['#e2e8f0'],
          borderColor: '#ffffff',
          borderWidth: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '74%',
      plugins: { legend: { display: false }, tooltip: { enabled: civilTotal > 0 } }
    }
  });
  document.getElementById('civilCenterValue').textContent = civilTotal;
  document.getElementById('civilLegend').innerHTML = civil
    .map((c) => {
      const pct = civilTotal ? Math.round((c[1] / civilTotal) * 100) : 0;
      return `<span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full" style="background:${c[2]}"></span>${c[0]} · ${c[1]} (${pct}%)</span>`;
    })
    .join('');

  renderCashFlowChart();
}

function renderDashboardDiagnostics() {
  const isAdmin = getCurrentRole() === 'admin';
  const aliveAdults = adults.filter(isAliveRecord);
  const aliveKids = children.filter(isAliveRecord);
  const total = aliveAdults.length + aliveKids.length;
  const pctAdults = total ? (aliveAdults.length / total) * 100 : 0;
  const pctKids = total ? (aliveKids.length / total) * 100 : 0;

  document.getElementById('diagWeight').textContent = total ? `${pctAdults.toFixed(1)}% / ${pctKids.toFixed(1)}%` : '—';
  const ratio = aliveKids.length ? aliveAdults.length / aliveKids.length : null;
  document.getElementById('diagRatio').textContent = ratio === null ? '—' : String(Math.round(ratio * 10) / 10);

  // Indicadores financieros (solo Administrador)
  const amounts = isAdmin ? contributions.map((c) => parseFloat(c.amount || c.monto) || 0).sort((a, b) => a - b) : [];
  const avg = amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : null;
  const mid = Math.floor(amounts.length / 2);
  const median = !amounts.length ? null : amounts.length % 2 ? amounts[mid] : (amounts[mid - 1] + amounts[mid]) / 2;
  document.getElementById('diagAvg').textContent = avg === null ? '—' : formatCurrency(avg);
  document.getElementById('diagMedian').textContent = median === null ? '—' : formatCurrency(median);

  let totalIn = 0;
  let totalOut = 0;
  if (isAdmin) {
    totalIn = contributions.reduce((acc, c) => acc + (parseFloat(c.amount || c.monto) || 0), 0);
    cashFlow.forEach((cf) => {
      const amt = parseFloat(cf.amount || cf.monto) || 0;
      if ((cf.movementType || cf.tipoMovimiento) === 'Entrada') totalIn += amt;
      else totalOut += amt;
    });
    document.getElementById('diagBalanceBadge').textContent =
      'Balance consolidado: ' + formatCurrency(totalIn - totalOut);
  }

  // Hallazgos en lenguaje natural
  const insights = [];
  if (!total) {
    insights.push('Aún no hay personas vivas registradas en el censo.');
  } else {
    const unbaptized = [...aliveAdults, ...aliveKids].filter((m) => !isBaptizedRecord(m)).length;
    insights.push(
      unbaptized > 0
        ? `Hay ${unbaptized} persona(s) viva(s) pendiente(s) de bautismo en agua.`
        : 'Todas las personas vivas registradas están bautizadas en agua.'
    );

    const inactives = aliveAdults.filter((a) => (a.category || a.categoria) === 'Inactivo').length;
    if (inactives > 0)
      insights.push(`Se registran ${inactives} adulto(s) en categoría Inactivo para seguimiento pastoral.`);

    const newBelievers = [...aliveAdults, ...aliveKids].filter(
      (m) => (m.category || m.categoria) === 'Nuevo Creyente'
    ).length;
    if (newBelievers > 0) insights.push(`Hay ${newBelievers} nuevo(s) creyente(s) en proceso de consolidación.`);

    if (isAdmin) {
      const disc = [...aliveAdults, ...aliveKids].filter(
        (m) =>
          isBaptizedRecord(m) &&
          (m.category || m.categoria) !== 'Inactivo' &&
          (m.inDiscipline === 'Sí' || m.enDisciplina === 'Sí')
      ).length;
      if (disc > 0) insights.push(`${disc} miembro(s) en disciplina pastoral requieren acompañamiento.`);
    }

    insights.push(
      `Composición activa: ${pctAdults.toFixed(1)}% adultos (${aliveAdults.length}) y ${pctKids.toFixed(1)}% niños/jóvenes (${aliveKids.length}).`
    );
    if (pctKids < 25)
      insights.push('Baja proporción de niñez/juventud en el censo; conviene impulsar registro infantil y juvenil.');
  }
  if (isAdmin && totalOut > totalIn)
    insights.push('Los egresos superan a los ingresos registrados; conviene revisar el flujo de caja.');

  document.getElementById('diagInsights').innerHTML = insights
    .map((t) => `<li class="py-3">${escapeHtml(t)}</li>`)
    .join('');
}
