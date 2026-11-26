// ────────────────────────────────────────────────────────────────────
// GESTIÓN DE CAJA Y CONTRIBUCIONES
// ────────────────────────────────────────────────────────────────────

async function handleContribSubmit(e) {
  e.preventDefault();
  if (getCurrentRole() !== 'admin') {
    showToast('Se requiere rol Administrador.', 'error');
    return;
  }
  const memberId = document.getElementById('contributionMemberSelect').value;
  const member = adults.find((a) => String(a.id).trim() === String(memberId).trim());
  if (!member) {
    showToast('Selecciona un miembro válido.', 'error');
    return;
  }
  const contribDateVal = document.getElementById('contributionDateInput').value;
  const { error: contribError, amount: amt } = validateContribution(
    {
      memberFound: true,
      memberDeceased: member.isDeceased === 'Sí' || member.fallecido === 'Sí',
      date: contribDateVal,
      amount: document.getElementById('contributionAmountInput').value,
      type: document.getElementById('contributionTypeSelect').value,
      notes: document.getElementById('contributionNotesInput').value,
      memberBirth: member.birthDate || member.fechaNacimiento
    },
    getTodayLocalIsoDate()
  );
  if (contribError) {
    showToast(contribError, 'error');
    return;
  }

  showSaving('Asentando aporte...');
  try {
    const dataAporte = {
      idMiembro: member.id,
      nombreMiembro: member.fullName || member.nombreCompleto,
      fecha: contribDateVal,
      tipoContribucion: document.getElementById('contributionTypeSelect').value,
      monto: amt,
      metodoPago: document.getElementById('contributionMethodSelect').value,
      notasReferencia: document.getElementById('contributionNotesInput').value.trim()
    };

    const res = await fetchAPI('saveContribution', dataAporte);
    if (res.status !== 'ok') throw new Error(res.message);

    showToast('Contribución registrada con éxito.');
    document.getElementById('contributionAmountInput').value = '';
    document.getElementById('contributionNotesInput').value = '';
    if (res.record) contributions.push(res.record);
    updateAllViews();
  } catch (err) {
    showToast('Error al guardar: ' + err.message, 'error');
  } finally {
    hideSaving();
  }
}

async function handleCashMovementSubmit(e) {
  e.preventDefault();
  if (getCurrentRole() !== 'admin') {
    showToast('Se requiere rol Administrador.', 'error');
    return;
  }
  const cfDateVal = document.getElementById('cashDateInput').value;
  const { error: cashError, amount: amt } = validateCashMovement(
    {
      date: cfDateVal,
      amount: document.getElementById('cashAmountInput').value,
      category: document.getElementById('cashCategorySelect').value,
      notes: document.getElementById('cashNotesInput').value
    },
    getTodayLocalIsoDate()
  );
  if (cashError) {
    showToast(cashError, 'error');
    return;
  }

  // Un egreso mayor que el saldo disponible deja la caja en negativo: se pide confirmación
  if (document.getElementById('cashMovementTypeSelect').value === 'Salida') {
    const saldo =
      contributions.reduce((s, c) => s + (parseFloat(c.amount || c.monto) || 0), 0) +
      cashFlow.reduce(
        (s, cf) =>
          s +
          ((cf.movementType || cf.tipoMovimiento) === 'Entrada' ? 1 : -1) * (parseFloat(cf.amount || cf.monto) || 0),
        0
      );
    if (
      amt > saldo &&
      !(await showConfirmDialog({
        title: 'Saldo insuficiente',
        message: `Este egreso de ${formatCurrency(amt)} supera el saldo disponible (${formatCurrency(saldo)}).\nEl saldo quedará en ${formatCurrency(saldo - amt)}.\n\n¿Deseas registrarlo de todas formas?`,
        confirmText: 'Registrar egreso',
        tone: 'warning'
      }))
    )
      return;
  }

  showSaving('Registrando movimiento...');
  try {
    const dataMovimiento = {
      tipoMovimiento: document.getElementById('cashMovementTypeSelect').value,
      categoriaConcepto: document.getElementById('cashCategorySelect').value,
      fecha: cfDateVal,
      monto: amt,
      formaPago: document.getElementById('cashMethodSelect').value,
      descripcionObservacion: document.getElementById('cashNotesInput').value.trim()
    };

    const res = await fetchAPI('saveCashMovement', dataMovimiento);
    if (res.status !== 'ok') throw new Error(res.message);

    showToast(`Movimiento registrado exitosamente. Recibo: ${res.receipt}`);
    document.getElementById('cashAmountInput').value = '';
    document.getElementById('cashNotesInput').value = '';
    if (res.record) cashFlow.push(res.record);
    updateAllViews();
  } catch (err) {
    showToast('Error al registrar caja: ' + err.message, 'error');
  } finally {
    hideSaving();
  }
}
