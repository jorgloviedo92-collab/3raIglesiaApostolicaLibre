(function () {
  const STORAGE_EVENTS_KEY = 'ecclesiasoft_events_v1';
  const MONTHS_ES = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre'
  ];
  const MONTHS_SHORT = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  const CATEGORY_META = {
    'Culto Especial': { dot: '#0f5fa8', badge: 'bg-blue-50 text-blue-800 border-blue-200' },
    Bautismo: { dot: '#0891b2', badge: 'bg-cyan-50 text-cyan-700 border-sky-200' },
    'Reunión Directiva': { dot: '#4f46e5', badge: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
    Jóvenes: { dot: '#059669', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    'Niños / Escuela': { dot: '#0d9488', badge: 'bg-teal-50 text-teal-800 border-teal-200' },
    'Evangelismo / Misiones': { dot: '#d97706', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
    'Retiro / Congreso': { dot: '#7c3aed', badge: 'bg-purple-100 text-purple-800 border-purple-200' },
    Otro: { dot: '#64748b', badge: 'bg-slate-100 text-slate-700 border-slate-200' }
  };

  const STATUS_BADGE = {
    Programado: 'bg-blue-50 text-blue-700 border-blue-200',
    Confirmado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Realizado: 'bg-slate-100 text-slate-600 border-slate-200',
    Cancelado: 'bg-rose-50 text-rose-700 border-rose-200'
  };

  let eventsList = [];
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth(); // 0..11
  let selectedDateIso = ''; // '' significa sin filtro de día específico

  function getStorageKey() {
    const ep = (typeof getScriptUrl === 'function' ? getScriptUrl() : '') || 'local';
    let hash = 0;
    for (let i = 0; i < ep.length; i++) hash = ((hash << 5) - hash + ep.charCodeAt(i)) | 0;
    return STORAGE_EVENTS_KEY + '_' + Math.abs(hash).toString(36);
  }

  function loadEventsLocal() {
    try {
      const raw = localStorage.getItem(getStorageKey()) || localStorage.getItem(STORAGE_EVENTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          eventsList = parsed.filter((e) => e && e.id && e.title && e.date);
          return;
        }
      }
    } catch (e) {}
    eventsList = [];
  }

  function saveEventsLocal() {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(eventsList));
    } catch (e) {}
  }

  function normalizeClientEvent(raw) {
    if (!raw) return null;
    return {
      id: String(raw.id || ''),
      title: String(raw.title !== undefined ? raw.title : raw.titulo || ''),
      date: String(raw.date !== undefined ? raw.date : raw.fecha || '').split('T')[0],
      startTime: String(raw.startTime !== undefined ? raw.startTime : raw.horaInicio || ''),
      endTime: String(raw.endTime !== undefined ? raw.endTime : raw.horaFin || ''),
      category: String(raw.category !== undefined ? raw.category : raw.categoria || 'Otro'),
      location: String(raw.location !== undefined ? raw.location : raw.lugar || ''),
      responsible: String(raw.responsible !== undefined ? raw.responsible : raw.responsable || ''),
      status: String(raw.status !== undefined ? raw.status : raw.estado || 'Programado'),
      notes: String(raw.notes !== undefined ? raw.notes : raw.notas || ''),
      updatedAt: String(raw.updatedAt !== undefined ? raw.updatedAt : raw.actualizadoEl || '')
    };
  }

  window.mergeCloudEvents = function (cloudEvents) {
    if (!Array.isArray(cloudEvents)) return;
    eventsList = cloudEvents
      .filter((e) => e && !e.isDeleted && !e.eliminado)
      .map(normalizeClientEvent)
      .filter((e) => e && e.id && e.title && e.date);
    saveEventsLocal();
    updateEventsNavBadge();
    if (typeof vistaActual !== 'undefined' && vistaActual === 'eventos') {
      renderEventsModule();
    }
  };

  window.clearEventsState = function () {
    eventsList = [];
    selectedDateIso = '';
    updateEventsNavBadge();
  };

  function formatTime12h(hhmm) {
    if (!hhmm || !hhmm.includes(':')) return '';
    const [hStr, mStr] = hhmm.split(':');
    let h = parseInt(hStr, 10);
    if (isNaN(h)) return hhmm;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${mStr} ${ampm}`;
  }

  function readTime12hTo24h(prefix) {
    const hVal = document.getElementById(prefix + 'Hour')?.value || '';
    const mVal = document.getElementById(prefix + 'Min')?.value || '00';
    const ampm = document.getElementById(prefix + 'AmPm')?.value || 'AM';
    if (!hVal) return '';
    let h = parseInt(hVal, 10);
    if (isNaN(h)) return '';
    if (ampm === 'AM') {
      h = h === 12 ? 0 : h;
    } else {
      h = h === 12 ? 12 : h + 12;
    }
    return `${String(h).padStart(2, '0')}:${String(mVal).padStart(2, '0')}`;
  }

  function setTime12hFrom24h(prefix, hhmm) {
    const hEl = document.getElementById(prefix + 'Hour');
    const mEl = document.getElementById(prefix + 'Min');
    const apEl = document.getElementById(prefix + 'AmPm');
    const hidEl = document.getElementById(prefix + 'TimeInput');
    if (!hEl || !mEl || !apEl) return;
    if (!hhmm || !hhmm.includes(':')) {
      hEl.value = '';
      mEl.value = '00';
      apEl.value = 'AM';
      if (hidEl) hidEl.value = '';
      return;
    }
    const [hStr, mStr] = hhmm.split(':');
    let h = parseInt(hStr, 10);
    if (isNaN(h)) {
      hEl.value = '';
      mEl.value = '00';
      apEl.value = 'AM';
      if (hidEl) hidEl.value = '';
      return;
    }
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    hEl.value = String(h);
    mEl.value = String(mStr || '00').padStart(2, '0');
    apEl.value = ampm;
    if (hidEl) hidEl.value = readTime12hTo24h(prefix);
  }

  function syncTime12hHidden(prefix) {
    const hidEl = document.getElementById(prefix + 'TimeInput');
    if (hidEl) hidEl.value = readTime12hTo24h(prefix);
  }

  function diffDaysFromToday(dateIso) {
    const todayIso = getTodayLocalIsoDate();
    const d1 = parseDateSafe(todayIso);
    const d2 = parseDateSafe(dateIso);
    if (!d1 || !d2) return 0;
    return Math.round((d2.getTime() - d1.getTime()) / 86400000);
  }

  function getRelativeBadge(ev) {
    if (ev.status === 'Cancelado') return { text: 'Cancelado', cls: 'bg-rose-100 text-rose-800' };
    if (ev.status === 'Realizado') return { text: 'Realizado', cls: 'bg-slate-200 text-slate-700' };
    const diff = diffDaysFromToday(ev.date);
    if (diff === 0) return { text: 'HOY', cls: 'bg-emerald-600 text-white' };
    if (diff === 1) return { text: 'MAÑANA', cls: 'bg-blue-600 text-white' };
    if (diff > 1 && diff <= 7) return { text: `En ${diff} días`, cls: 'bg-amber-100 text-amber-800' };
    if (diff > 7) return { text: `En ${diff} días`, cls: 'bg-blue-50 text-blue-700' };
    return { text: `Hace ${Math.abs(diff)} d`, cls: 'bg-slate-100 text-slate-500' };
  }

  function sortEventsChronologically(arr) {
    return arr.slice().sort((a, b) => {
      const cmpDate = String(a.date || '').localeCompare(String(b.date || ''));
      if (cmpDate !== 0) return cmpDate;
      return String(a.startTime || '99:99').localeCompare(String(b.startTime || '99:99'));
    });
  }

  function updateEventsNavBadge() {
    const badge = document.getElementById('navEventsCount');
    if (!badge) return;
    const today = getTodayLocalIsoDate();
    const upcomingCount = eventsList.filter(
      (e) => e.date >= today && e.status !== 'Cancelado' && e.status !== 'Realizado'
    ).length;
    badge.textContent = String(upcomingCount);
    badge.classList.toggle('hidden', upcomingCount === 0);
  }
  window.updateEventsNavBadge = updateEventsNavBadge;

  function getFilteredEvents() {
    const search = (document.getElementById('evSearchInput')?.value || '').trim().toLowerCase();
    const period = document.getElementById('evPeriodFilter')?.value || 'UPCOMING';
    const category = document.getElementById('evCategoryFilter')?.value || 'ALL';
    const today = getTodayLocalIsoDate();
    const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;

    let list = eventsList.filter((ev) => {
      if (category !== 'ALL' && ev.category !== category) return false;
      if (selectedDateIso) {
        if (ev.date !== selectedDateIso) return false;
      } else {
        if (period === 'UPCOMING' && !(ev.date >= today && ev.status !== 'Realizado' && ev.status !== 'Cancelado'))
          return false;
        if (period === 'MONTH' && !String(ev.date || '').startsWith(monthPrefix)) return false;
        if (period === 'COMPLETED' && ev.status !== 'Realizado') return false;
        if (period === 'PAST' && !(ev.date < today)) return false;
      }
      if (search) {
        const hay = [ev.title, ev.location, ev.responsible, ev.category, ev.notes, ev.date].join(' ').toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    list = sortEventsChronologically(list);
    if (period === 'PAST' || period === 'COMPLETED') {
      list.reverse();
    }
    return list;
  }

  function renderEventsKPIs() {
    const today = getTodayLocalIsoDate();
    const nowD = parseDateSafe(today) || new Date();
    const currentMonthPrefix = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}`;

    const upcoming = sortEventsChronologically(
      eventsList.filter((e) => e.date >= today && e.status !== 'Cancelado' && e.status !== 'Realizado')
    );
    const thisMonth = eventsList.filter(
      (e) => String(e.date || '').startsWith(currentMonthPrefix) && e.status !== 'Cancelado'
    );
    const completed = eventsList.filter((e) => e.status === 'Realizado');

    const elUp = document.getElementById('evStatUpcoming');
    const elMo = document.getElementById('evStatMonth');
    const elMoName = document.getElementById('evStatMonthName');
    const elNextTitle = document.getElementById('evStatNextTitle');
    const elNextDate = document.getElementById('evStatNextDate');
    const elComp = document.getElementById('evStatCompleted');

    if (elUp) elUp.textContent = String(upcoming.length);
    if (elMo) elMo.textContent = String(thisMonth.length);
    if (elMoName)
      elMoName.textContent =
        MONTHS_ES[nowD.getMonth()].charAt(0).toUpperCase() +
        MONTHS_ES[nowD.getMonth()].slice(1) +
        ' ' +
        nowD.getFullYear();
    if (elComp) elComp.textContent = String(completed.length);

    if (upcoming.length > 0) {
      const nextEv = upcoming[0];
      const diff = diffDaysFromToday(nextEv.date);
      const whenTxt = diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana' : `En ${diff} días`;
      const timeTxt = nextEv.startTime ? ` · ${formatTime12h(nextEv.startTime)}` : '';
      if (elNextTitle) {
        elNextTitle.textContent = nextEv.title;
        elNextTitle.title = nextEv.title;
      }
      if (elNextDate) elNextDate.textContent = `${formatDisplayDate(nextEv.date)}${timeTxt} (${whenTxt})`;
    } else {
      if (elNextTitle) elNextTitle.textContent = 'Sin eventos próximos';
      if (elNextDate) elNextDate.textContent = 'Agenda despejada';
    }
    updateEventsNavBadge();
  }

  function renderEventsCalendar() {
    const grid = document.getElementById('evCalendarGrid');
    const label = document.getElementById('evCalMonthLabel');
    if (!grid || !label) return;

    label.textContent = `${MONTHS_ES[calMonth]} ${calYear}`;
    const todayIso = getTodayLocalIsoDate();

    // Indexar eventos por fecha ISO para el mes visible
    const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-`;
    const byDate = {};
    eventsList.forEach((ev) => {
      if (ev.date && ev.date.startsWith(monthPrefix) && ev.status !== 'Cancelado') {
        if (!byDate[ev.date]) byDate[ev.date] = [];
        byDate[ev.date].push(ev);
      }
    });

    const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Dom..6=Sáb
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    let htmlCells = '';
    for (let i = 0; i < firstDay; i++) {
      htmlCells += '<div class="ev-cal-day ev-cal-muted" aria-hidden="true"></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvs = byDate[iso] || [];
      const classes = ['ev-cal-day'];
      if (iso === todayIso) classes.push('ev-cal-today');
      if (iso === selectedDateIso) classes.push('ev-cal-selected');

      let dotsHtml = '<span class="ev-cal-dots">';
      dayEvs.slice(0, 3).forEach((ev) => {
        const meta = CATEGORY_META[ev.category] || CATEGORY_META['Otro'];
        dotsHtml += `<span class="ev-cal-dot" style="background:${meta.dot}"></span>`;
      });
      dotsHtml += '</span>';

      const tip = dayEvs.length
        ? `${dayEvs.length} evento(s): ${dayEvs.map((e) => e.title).join(', ')}`
        : formatDisplayDate(iso);
      htmlCells += `<button type="button" class="${classes.join(' ')}" data-ev-date="${iso}" title="${escapeHtml(tip)}"><span>${d}</span>${dotsHtml}</button>`;
    }
    grid.innerHTML = htmlCells;

    const selBar = document.getElementById('evSelectedDateBar');
    const selTxt = document.getElementById('evSelectedDateText');
    if (selBar && selTxt) {
      if (selectedDateIso) {
        selTxt.textContent = formatDisplayDate(selectedDateIso);
        selBar.classList.remove('hidden');
      } else {
        selBar.classList.add('hidden');
      }
    }
  }

  function renderEventsList() {
    const container = document.getElementById('eventsListContainer');
    const subtitle = document.getElementById('evListSubtitle');
    if (!container) return;

    const filtered = getFilteredEvents();
    const isAdmin = getCurrentRole() !== 'consulta';

    if (subtitle) {
      if (selectedDateIso) {
        subtitle.textContent = `Mostrando ${filtered.length} evento(s) del ${formatDisplayDate(selectedDateIso)}`;
      } else {
        subtitle.textContent = `${filtered.length} evento(s) encontrado(s) · ordenados por fecha`;
      }
    }

    if (!filtered.length) {
      container.innerHTML = `
          <div class="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50">
            <i class="fa-solid fa-calendar-xmark text-3xl text-slate-400 mb-2"></i>
            <p class="text-sm font-bold text-slate-700">No hay eventos para mostrar con este filtro</p>
            <p class="text-xs text-slate-500 mt-1">${isAdmin ? 'Usa el formulario de la izquierda o haz clic en un día del calendario para agendar uno nuevo.' : 'Cambia el período o la categoría para consultar otros eventos.'}</p>
          </div>`;
      return;
    }

    const today = getTodayLocalIsoDate();
    container.innerHTML = filtered
      .map((ev) => {
        const dObj = parseDateSafe(ev.date);
        const mon = dObj ? MONTHS_SHORT[dObj.getMonth()] : '---';
        const day = dObj ? String(dObj.getDate()).padStart(2, '0') : '--';
        const yr = dObj ? dObj.getFullYear() : '';
        const catMeta = CATEGORY_META[ev.category] || CATEGORY_META['Otro'];
        const stCls = STATUS_BADGE[ev.status] || STATUS_BADGE['Programado'];
        const rel = getRelativeBadge(ev);

        let boxCls = 'ev-date-box';
        if (ev.status === 'Cancelado') boxCls += ' ev-cancelled';
        else if (ev.date === today) boxCls += ' ev-today';
        else if (ev.date < today || ev.status === 'Realizado') boxCls += ' ev-past';

        const timeRange = ev.startTime
          ? ev.endTime
            ? `${formatTime12h(ev.startTime)} – ${formatTime12h(ev.endTime)}`
            : formatTime12h(ev.startTime)
          : 'Horario por definir';

        const adminButtons = isAdmin
          ? `
          <div class="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
            ${ev.status !== 'Realizado' && ev.status !== 'Cancelado' && !getEventDoneBlockReason(ev.date, ev.startTime) ? `<button type="button" class="ev-act-done px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition" data-id="${escapeHtml(ev.id)}" title="Marcar como realizado"><i class="fa-solid fa-check mr-1 pointer-events-none"></i>Realizado</button>` : ''}
            <button type="button" class="ev-act-edit px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition" data-id="${escapeHtml(ev.id)}" title="Editar evento"><i class="fa-solid fa-pen mr-1 pointer-events-none"></i>Editar</button>
            <button type="button" class="ev-act-del px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition ml-auto" data-id="${escapeHtml(ev.id)}" title="Eliminar evento"><i class="fa-solid fa-trash mr-1 pointer-events-none"></i>Eliminar</button>
          </div>`
          : '';

        return `
          <article class="ev-card">
            <div class="${boxCls}">
              <span class="ev-date-month">${mon}</span>
              <span class="ev-date-day">${day}</span>
              <span class="ev-date-year">${yr}</span>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <h4 class="text-sm sm:text-base font-bold text-slate-900 leading-tight">${escapeHtml(ev.title)}</h4>
                <span class="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${rel.cls}">${escapeHtml(rel.text)}</span>
              </div>
              <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span class="text-[11px] font-bold px-2 py-0.5 rounded-md border ${catMeta.badge}">${escapeHtml(ev.category || 'Otro')}</span>
                <span class="text-[11px] font-semibold px-2 py-0.5 rounded-md border ${stCls}">${escapeHtml(ev.status || 'Programado')}</span>
              </div>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-600">
                <span><i class="fa-regular fa-clock text-slate-400 mr-1"></i>${escapeHtml(timeRange)}</span>
                ${ev.location ? `<span><i class="fa-solid fa-location-dot text-slate-400 mr-1"></i>${escapeHtml(ev.location)}</span>` : ''}
                ${ev.responsible ? `<span><i class="fa-solid fa-user-tie text-slate-400 mr-1"></i>${escapeHtml(ev.responsible)}</span>` : ''}
              </div>
              ${ev.notes ? `<p class="text-xs text-slate-600 mt-2 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">${escapeHtml(ev.notes)}</p>` : ''}
              ${adminButtons}
            </div>
          </article>`;
      })
      .join('');
  }

  function resetEventForm(prefillDate) {
    const form = document.getElementById('eventForm');
    if (!form) return;
    form.reset();
    document.getElementById('evIdInput').value = '';
    document.getElementById('evDateInput').value = prefillDate || selectedDateIso || getTodayLocalIsoDate();
    setTime12hFrom24h('evStart', '');
    setTime12hFrom24h('evEnd', '');
    document.getElementById('evStatusInput').value = 'Programado';
    refreshEventStatusOptions();
    document.getElementById('evFormHeading').innerHTML =
      '<i class="fa-solid fa-calendar-plus text-blue-600"></i><span>Programar Evento</span>';
    document.getElementById('btnEvSubmit').innerHTML =
      '<i class="fa-solid fa-floppy-disk"></i><span>Guardar en Agenda</span>';
    document.getElementById('btnEvCancelEdit').classList.add('hidden');
  }

  function loadEventIntoForm(id) {
    const ev = eventsList.find((e) => e.id === id);
    if (!ev) return;
    document.getElementById('evIdInput').value = ev.id;
    document.getElementById('evTitleInput').value = ev.title || '';
    document.getElementById('evDateInput').value = ev.date || getTodayLocalIsoDate();
    setTime12hFrom24h('evStart', ev.startTime || '');
    setTime12hFrom24h('evEnd', ev.endTime || '');
    document.getElementById('evCategoryInput').value = ev.category || 'Culto Especial';
    document.getElementById('evLocationInput').value = ev.location || '';
    document.getElementById('evResponsibleInput').value = ev.responsible || '';
    document.getElementById('evStatusInput').value = ev.status || 'Programado';
    document.getElementById('evNotesInput').value = ev.notes || '';
    refreshEventStatusOptions();

    document.getElementById('evFormHeading').innerHTML =
      '<i class="fa-solid fa-pen-to-square text-amber-600"></i><span>Editar Evento</span>';
    document.getElementById('btnEvSubmit').innerHTML =
      '<i class="fa-solid fa-floppy-disk"></i><span>Actualizar Evento</span>';
    document.getElementById('btnEvCancelEdit').classList.remove('hidden');
    document.getElementById('eventFormCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('evTitleInput').focus();
  }

  async function handleEventSubmit(e) {
    e.preventDefault();
    if (getCurrentRole() === 'consulta') {
      showToast('Solo el rol Administrador puede programar eventos.', 'error');
      return;
    }
    const idExisting = document.getElementById('evIdInput').value.trim();
    const title = document.getElementById('evTitleInput').value.trim();
    const date = document.getElementById('evDateInput').value;
    syncTime12hHidden('evStart');
    syncTime12hHidden('evEnd');
    const startTime = document.getElementById('evStartTimeInput').value;
    const endTime = document.getElementById('evEndTimeInput').value;
    const category = document.getElementById('evCategoryInput').value;
    const location = document.getElementById('evLocationInput').value.trim();
    const responsible = document.getElementById('evResponsibleInput').value.trim();
    const status = document.getElementById('evStatusInput').value;
    const notes = document.getElementById('evNotesInput').value.trim();

    const eventError = validateEvent(
      { title, date, startTime, endTime, location, responsible, notes, status },
      getTodayLocalIsoDate(),
      NICARAGUA_HHMM_FORMATTER.format(new Date())
    );
    if (eventError) {
      showToast(eventError, 'error');
      return;
    }

    const payloadData = {
      id: idExisting || '',
      title,
      date,
      startTime,
      endTime,
      category,
      location,
      responsible,
      status,
      notes
    };

    try {
      let savedRecord;
      if (typeof fetchAPI === 'function' && getSessionToken() && getScriptUrl()) {
        showSaving(idExisting ? 'Actualizando evento en Firestore...' : 'Guardando evento en Firestore...');
        const res = await fetchAPI('saveEvent', payloadData);
        if (!res || res.status !== 'ok') {
          throw new Error((res && res.message) || 'No se pudo guardar el evento en Firestore.');
        }
        savedRecord = normalizeClientEvent(res.record || { ...payloadData, id: res.id });
      } else {
        savedRecord = normalizeClientEvent({
          ...payloadData,
          id:
            idExisting ||
            'EV-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(),
          updatedAt: new Date().toISOString()
        });
      }

      const idx = eventsList.findIndex((x) => x.id === savedRecord.id);
      if (idx !== -1) eventsList[idx] = savedRecord;
      else eventsList.push(savedRecord);

      saveEventsLocal();
      showToast(idExisting ? 'Evento actualizado en la agenda.' : 'Evento programado en la agenda.');

      const dObj = parseDateSafe(savedRecord.date);
      if (dObj) {
        calYear = dObj.getFullYear();
        calMonth = dObj.getMonth();
      }
      resetEventForm();
      renderEventsModule();
    } catch (err) {
      showToast(err.message || 'Error al guardar el evento.', 'error');
    } finally {
      hideSaving();
    }
  }

  async function deleteEventById(id) {
    const ev = eventsList.find((e) => e.id === id);
    if (!ev) return;
    const ok = await showConfirmDialog({
      title: 'Eliminar evento',
      message: `¿Deseas eliminar "${ev.title}" (${formatDisplayDate(ev.date)}) de la agenda?`,
      confirmText: 'Eliminar',
      tone: 'danger'
    });
    if (!ok) return;

    try {
      if (typeof fetchAPI === 'function' && getSessionToken() && getScriptUrl()) {
        showSaving('Eliminando evento en Firestore...');
        const res = await fetchAPI('deleteEvent', { id });
        if (!res || res.status !== 'ok') {
          throw new Error((res && res.message) || 'No se pudo eliminar el evento en Firestore.');
        }
      }
      eventsList = eventsList.filter((e) => e.id !== id);
      saveEventsLocal();
      if (document.getElementById('evIdInput').value === id) resetEventForm();
      renderEventsModule();
      showToast('Evento eliminado de la agenda.');
    } catch (err) {
      showToast(err.message || 'Error al eliminar el evento.', 'error');
    } finally {
      hideSaving();
    }
  }

  // Hora actual HH:MM en la zona horaria de Nicaragua (misma referencia que getTodayLocalIsoDate)
  const NICARAGUA_HHMM_FORMATTER = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Managua',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });

  // Devuelve el motivo por el que un evento NO puede marcarse como Realizado, o '' si sí puede.
  function getEventDoneBlockReason(date, startTime) {
    return eventDoneBlockReason(date, startTime, getTodayLocalIsoDate(), NICARAGUA_HHMM_FORMATTER.format(new Date()));
  }

  // En el formulario, la opción "Realizado" solo está disponible si la fecha/hora ya llegó
  function refreshEventStatusOptions() {
    const statusSel = document.getElementById('evStatusInput');
    const doneOpt = statusSel?.querySelector('option[value="Realizado"]');
    if (!doneOpt) return;
    syncTime12hHidden('evStart');
    const reason = getEventDoneBlockReason(
      document.getElementById('evDateInput').value,
      document.getElementById('evStartTimeInput').value
    );
    doneOpt.disabled = !!reason;
    doneOpt.textContent = reason ? 'Realizado (disponible cuando llegue la fecha)' : 'Realizado';
    if (reason && statusSel.value === 'Realizado') {
      statusSel.value = 'Programado';
      showToast('El estado volvió a "Programado": ' + reason, 'error');
    }
  }

  async function markEventDone(id) {
    const ev = eventsList.find((e) => e.id === id);
    if (!ev) return;
    const blockReason = getEventDoneBlockReason(ev.date, ev.startTime);
    if (blockReason) {
      showToast(blockReason, 'error');
      return;
    }
    const updatedPayload = { ...ev, status: 'Realizado' };
    try {
      if (typeof fetchAPI === 'function' && getSessionToken() && getScriptUrl()) {
        showSaving('Actualizando estado en Firestore...');
        const res = await fetchAPI('saveEvent', updatedPayload);
        if (!res || res.status !== 'ok') {
          throw new Error((res && res.message) || 'No se pudo actualizar el evento.');
        }
        const saved = normalizeClientEvent(res.record || updatedPayload);
        const idx = eventsList.findIndex((x) => x.id === id);
        if (idx !== -1) eventsList[idx] = saved;
      } else {
        ev.status = 'Realizado';
        ev.updatedAt = new Date().toISOString();
      }
      saveEventsLocal();
      renderEventsModule();
      showToast('Evento marcado como realizado.');
    } catch (err) {
      showToast(err.message || 'Error al actualizar el evento.', 'error');
    } finally {
      hideSaving();
    }
  }

  function renderEventsModule() {
    renderEventsKPIs();
    renderEventsCalendar();
    renderEventsList();
  }
  window.renderEventsModule = renderEventsModule;

  function initEventsModule() {
    loadEventsLocal();
    const todayD = parseDateSafe(getTodayLocalIsoDate()) || new Date();
    calYear = todayD.getFullYear();
    calMonth = todayD.getMonth();

    const dateInput = document.getElementById('evDateInput');
    if (dateInput && !dateInput.value) dateInput.value = getTodayLocalIsoDate();

    document.getElementById('eventForm')?.addEventListener('submit', handleEventSubmit);
    ['evStart', 'evEnd'].forEach((prefix) => {
      ['Hour', 'Min', 'AmPm'].forEach((part) => {
        document.getElementById(prefix + part)?.addEventListener('change', () => {
          syncTime12hHidden(prefix);
          refreshEventStatusOptions();
        });
      });
    });
    document.getElementById('evDateInput')?.addEventListener('change', refreshEventStatusOptions);
    document.getElementById('evStatusInput')?.addEventListener('focus', refreshEventStatusOptions);
    document.getElementById('btnEvCancelEdit')?.addEventListener('click', () => resetEventForm());

    document.getElementById('btnEvCalPrev')?.addEventListener('click', () => {
      calMonth--;
      if (calMonth < 0) {
        calMonth = 11;
        calYear--;
      }
      renderEventsCalendar();
      if (document.getElementById('evPeriodFilter')?.value === 'MONTH') renderEventsList();
    });
    document.getElementById('btnEvCalNext')?.addEventListener('click', () => {
      calMonth++;
      if (calMonth > 11) {
        calMonth = 0;
        calYear++;
      }
      renderEventsCalendar();
      if (document.getElementById('evPeriodFilter')?.value === 'MONTH') renderEventsList();
    });
    document.getElementById('btnEvCalToday')?.addEventListener('click', () => {
      const d = parseDateSafe(getTodayLocalIsoDate()) || new Date();
      calYear = d.getFullYear();
      calMonth = d.getMonth();
      selectedDateIso = '';
      renderEventsModule();
    });

    document.getElementById('evCalendarGrid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-ev-date]');
      if (!btn) return;
      const iso = btn.getAttribute('data-ev-date');
      selectedDateIso = selectedDateIso === iso ? '' : iso;
      renderEventsCalendar();
      renderEventsList();
    });

    document.getElementById('btnEvClearDateFilter')?.addEventListener('click', () => {
      selectedDateIso = '';
      renderEventsCalendar();
      renderEventsList();
    });

    document.getElementById('btnEvQuickAddDate')?.addEventListener('click', () => {
      if (getCurrentRole() === 'consulta') return;
      resetEventForm(selectedDateIso || getTodayLocalIsoDate());
      document.getElementById('evTitleInput')?.focus();
    });

    document.getElementById('evSearchInput')?.addEventListener('input', renderEventsList);
    document.getElementById('evPeriodFilter')?.addEventListener('change', () => {
      selectedDateIso = '';
      renderEventsCalendar();
      renderEventsList();
    });
    document.getElementById('evCategoryFilter')?.addEventListener('change', renderEventsList);

    document.getElementById('eventsListContainer')?.addEventListener('click', (e) => {
      const btnDone = e.target.closest('.ev-act-done');
      if (btnDone) {
        markEventDone(btnDone.getAttribute('data-id'));
        return;
      }
      const btnEdit = e.target.closest('.ev-act-edit');
      if (btnEdit) {
        loadEventIntoForm(btnEdit.getAttribute('data-id'));
        return;
      }
      const btnDel = e.target.closest('.ev-act-del');
      if (btnDel) {
        deleteEventById(btnDel.getAttribute('data-id'));
        return;
      }
    });

    document.getElementById('btnExportEventsCsv')?.addEventListener('click', () => {
      const rows = getFilteredEvents().map((ev) => [
        formatDisplayDate(ev.date),
        ev.startTime
          ? ev.endTime
            ? `${formatTime12h(ev.startTime)} - ${formatTime12h(ev.endTime)}`
            : formatTime12h(ev.startTime)
          : '',
        ev.title || '',
        ev.category || '',
        ev.status || '',
        ev.location || '',
        ev.responsible || '',
        ev.notes || ''
      ]);
      if (typeof downloadCsvFile === 'function') {
        downloadCsvFile(
          'agenda_eventos',
          ['Fecha', 'Horario', 'Evento', 'Categoría', 'Estado', 'Lugar', 'Responsable', 'Observaciones'],
          rows
        );
      }
    });

    document.getElementById('btnPrintEvents')?.addEventListener('click', () => {
      const list = getFilteredEvents();
      const periodSel = document.getElementById('evPeriodFilter');
      const periodTxt = selectedDateIso
        ? `Fecha: ${formatDisplayDate(selectedDateIso)}`
        : periodSel
          ? periodSel.options[periodSel.selectedIndex].text
          : 'Agenda';
      const catVal = document.getElementById('evCategoryFilter')?.value || 'ALL';
      const filtroTxt = `${periodTxt} · Categoría: ${catVal === 'ALL' ? 'Todas' : catVal} · Total: ${list.length} evento(s)`;
      const cols = [
        { t: 'Fecha' },
        { t: 'Horario' },
        { t: 'Evento' },
        { t: 'Categoría' },
        { t: 'Lugar / Responsable' },
        { t: 'Estado' }
      ];
      const rows = list.map((ev) => [
        formatDisplayDate(ev.date),
        ev.startTime
          ? ev.endTime
            ? `${formatTime12h(ev.startTime)} - ${formatTime12h(ev.endTime)}`
            : formatTime12h(ev.startTime)
          : 'Por definir',
        ev.notes ? `${ev.title} (${ev.notes})` : ev.title,
        ev.category || 'Otro',
        [ev.location, ev.responsible].filter(Boolean).join(' · ') || '—',
        ev.status || 'Programado'
      ]);
      if (typeof printInstitutionalTable === 'function') {
        printInstitutionalTable('Agenda de Eventos Eclesiásticos', filtroTxt, cols, rows, null, false);
      }
    });

    updateEventsNavBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEventsModule);
  } else {
    initEventsModule();
  }
})();
