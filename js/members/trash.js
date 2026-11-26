// ────────────────────────────────────────────────────────────────────
// BAJA Y RESTAURACIÓN (PAPELERA)
// ────────────────────────────────────────────────────────────────────

// Listas locales (activas y papelera) por tipo de tabla del servidor
function getLocalLists(table) {
  if (table === 'adult') return { active: adults, trash: deletedAdults };
  if (table === 'child') return { active: children, trash: deletedChildren };
  if (table === 'contribution') return { active: contributions, trash: deletedContributions };
  if (table === 'cash') return { active: cashFlow, trash: deletedCashFlow };
  if (table === 'event' && typeof window.getEventLists === 'function') return window.getEventLists();
  return null;
}

function moveLocalRecord(table, id, toTrash) {
  const lists = getLocalLists(table);
  if (!lists) return;
  const from = toTrash ? lists.active : lists.trash;
  const to = toTrash ? lists.trash : lists.active;
  const idx = from.findIndex((x) => String(x.id).trim() === String(id).trim());
  if (idx < 0) return;
  const [rec] = from.splice(idx, 1);
  rec.eliminado = toTrash;
  rec.isDeleted = toTrash;
  to.push(rec);
}

async function executeLogicalDelete(table, id, name) {
  if (getCurrentRole() !== 'admin') {
    showToast('Se requiere rol Administrador para eliminar registros.', 'error');
    return;
  }
  if (
    !(await showConfirmDialog({
      title: 'Dar de baja',
      message: `¿Confirmas la baja de "${name}"?\n\nEl registro quedará archivado en la Papelera y podrás restaurarlo.`,
      confirmText: 'Dar de baja',
      tone: 'danger'
    }))
  )
    return;

  showSaving('Registrando baja...');
  try {
    const res = await fetchAPI('deleteItemLogical', { table: table, id: id });
    if (res.status !== 'ok') throw new Error(res.message);
    moveLocalRecord(table, id, true);
    updateAllViews();
    showToast(`"${name}" se movió a la Papelera.`);
    if (table === 'adult') syncFromCloud(false); // el servidor limpió sus vínculos en otras fichas
  } catch (err) {
    showToast('Error al dar de baja: ' + err.message, 'error');
  } finally {
    hideSaving();
  }
}

async function executeLogicalRestore(table, id) {
  if (getCurrentRole() !== 'admin') return;
  if (
    !(await showConfirmDialog({
      title: 'Restaurar registro',
      message: '¿Deseas restaurar este registro y devolverlo al sistema activo?',
      confirmText: 'Restaurar'
    }))
  )
    return;

  showSaving('Restaurando registro...');
  try {
    const res = await fetchAPI('restoreItemLogical', { table: table, id: id });
    if (res.status !== 'ok') throw new Error(res.message);
    moveLocalRecord(table, id, false);
    if (table === 'event' && typeof window.afterEventsTrashChange === 'function') window.afterEventsTrashChange();
    updateAllViews();
    showToast(table === 'event' ? 'Evento restaurado en la agenda.' : 'Registro restaurado con éxito.');
    if (table === 'adult' || table === 'child') syncFromCloud(false); // puede traer vínculos corregidos por el servidor
  } catch (err) {
    showToast('Error al restaurar: ' + err.message, 'error');
  } finally {
    hideSaving();
  }
}

async function executeEmptyTrash() {
  if (getCurrentRole() !== 'admin') {
    showToast('Se requiere rol Administrador para vaciar la papelera.', 'error');
    return;
  }
  const filter = document.getElementById('trashModuleFilter').value;
  const filterInfo = {
    adultos: { label: 'Adultos eliminados', table: 'adult' },
    menores: { label: 'Menores/Jóvenes eliminados', table: 'child' },
    contribuciones: { label: 'Contribuciones anuladas', table: 'contribution' },
    caja: { label: 'Movimientos de caja anulados', table: 'cash' },
    eventos: { label: 'Eventos eliminados', table: 'event' }
  }[filter] || { label: 'este módulo', table: '' };

  if (
    !(await showConfirmDialog({
      title: 'Vaciar papelera',
      message: `Se eliminarán PERMANENTEMENTE todos los registros de ${filterInfo.label}.\n\nEsta acción no se puede deshacer: los datos se borran definitivamente de la base de datos.`,
      confirmText: 'Eliminar definitivamente',
      tone: 'danger'
    }))
  ) {
    return;
  }

  showSaving('Eliminando registros permanentemente...');
  try {
    const res = await fetchAPI('emptyTrash', { filter: filter });
    if (res.status !== 'ok') throw new Error(res.message);
    const lists = getLocalLists(filterInfo.table);
    if (lists) lists.trash.length = 0;
    if (filterInfo.table === 'event' && typeof window.afterEventsTrashChange === 'function')
      window.afterEventsTrashChange();
    renderTrashTable();
    showToast(res.message || 'Papelera vaciada con éxito.');
  } catch (err) {
    showToast('Error al vaciar papelera: ' + err.message, 'error');
  } finally {
    hideSaving();
  }
}

function renderTrashTable() {
  const tbody = document.getElementById('trashTableBody');
  const filter = document.getElementById('trashModuleFilter').value;
  tbody.innerHTML = '';

  let dataset = [];
  let tipoStr = '';
  let tableKey = '';

  if (filter === 'adultos') {
    dataset = deletedAdults;
    tipoStr = 'Adulto';
    tableKey = 'adult';
  }
  if (filter === 'menores') {
    dataset = deletedChildren;
    tipoStr = 'Menor';
    tableKey = 'child';
  }
  if (filter === 'contribuciones') {
    dataset = deletedContributions;
    tipoStr = 'Contribución';
    tableKey = 'contribution';
  }
  if (filter === 'caja') {
    dataset = deletedCashFlow;
    tipoStr = 'Caja/Gasto';
    tableKey = 'cash';
  }
  if (filter === 'eventos') {
    const lists = getLocalLists('event');
    dataset = lists ? lists.trash : [];
    tipoStr = 'Evento';
    tableKey = 'event';
  }

  if (dataset.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="py-8 text-center text-slate-400 font-bold">La papelera está vacía para este módulo.</td></tr>';
    return;
  }

  dataset.forEach((item) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-rose-50/50 transition';

    const tdId = document.createElement('td');
    tdId.className = 'py-3 px-4 font-mono text-xs text-slate-500 font-bold';
    tdId.textContent = item.id;

    const tdDetalle = document.createElement('td');
    tdDetalle.className = 'py-3 px-4 font-bold text-slate-700 text-sm';
    if (filter === 'adultos' || filter === 'menores') {
      tdDetalle.textContent = item.fullName || item.nombreCompleto;
    } else if (filter === 'contribuciones') {
      tdDetalle.textContent = `Aporte ${formatCurrency(item.amount || item.monto)} - ${item.memberName || item.nombreMiembro}`;
    } else if (filter === 'eventos') {
      tdDetalle.textContent = `${item.title} - ${formatDisplayDate(item.date)}${item.category ? ' (' + item.category + ')' : ''}`;
    } else {
      tdDetalle.textContent = `Movimiento ${formatCurrency(item.amount || item.monto)} - ${item.category || item.categoriaConcepto}`;
    }

    const tdModulo = document.createElement('td');
    tdModulo.className = 'py-3 px-4';
    tdModulo.innerHTML = `<span class="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold text-[11px]">${tipoStr}</span>`;

    const tdAccion = document.createElement('td');
    tdAccion.className = 'py-3 px-4 text-right';
    const btnRestore = document.createElement('button');
    btnRestore.className =
      'text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ml-auto act-restore';
    btnRestore.setAttribute('data-id', item.id);
    btnRestore.setAttribute('data-table', tableKey);
    btnRestore.innerHTML =
      '<i class="fa-solid fa-clock-rotate-left pointer-events-none"></i> <span class="pointer-events-none">Restaurar</span>';
    tdAccion.appendChild(btnRestore);

    tr.appendChild(tdId);
    tr.appendChild(tdDetalle);
    tr.appendChild(tdModulo);
    tr.appendChild(tdAccion);
    tbody.appendChild(tr);
  });
}
