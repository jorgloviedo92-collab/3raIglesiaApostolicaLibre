    // ────────────────────────────────────────────────────────────────────
    // GESTIÓN DE CAJA Y CONTRIBUCIONES
    // ────────────────────────────────────────────────────────────────────

    async function handleContribSubmit(e) {
      e.preventDefault();
      if (getCurrentRole() !== 'admin') { showToast("Se requiere rol Administrador.", "error"); return; }
      const memberId = document.getElementById('contributionMemberSelect').value;
      const member = adults.find(a => String(a.id).trim() === String(memberId).trim());
      if (!member) { showToast("Selecciona un miembro válido.", "error"); return; }
      const contribDateVal = document.getElementById('contributionDateInput').value;
      if (!contribDateVal) { showToast("Indica la fecha de la contribución.", "error"); return; }
      if (parseDateSafe(contribDateVal) > parseDateSafe(getTodayLocalIsoDate())) {
        showToast("La fecha de la contribución no puede ser futura.", "error");
        return;
      }
      const amt = parseMoneyAmount(document.getElementById('contributionAmountInput').value);
      if (amt === null) { showToast("El monto debe estar entre 0.01 y 9,999,999, con máximo 2 decimales.", "error"); return; }
      if (!document.getElementById('contributionTypeSelect').value) { showToast("Selecciona el tipo de contribución.", "error"); return; }
      if (document.getElementById('contributionNotesInput').value.trim().length > 200) { showToast("Las notas no pueden superar 200 caracteres.", "error"); return; }
      const nacMiembro = String(member.birthDate || member.fechaNacimiento || '').split('T')[0];
      if (nacMiembro && contribDateVal < nacMiembro) {
        showToast("La fecha de la contribución no puede ser anterior al nacimiento del miembro.", "error");
        return;
      }
      const defMiembro = (member.isDeceased === 'Sí' || member.fallecido === 'Sí') ? String(member.deceasedDate || member.fechaDefuncion || '').split('T')[0] : '';
      if (defMiembro && contribDateVal > defMiembro) {
        showToast("La fecha de la contribución no puede ser posterior a la defunción del miembro.", "error");
        return;
      }

      showSaving("Asentando aporte...");
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

          showToast("Contribución registrada con éxito.");
          document.getElementById('contributionAmountInput').value = '';
          document.getElementById('contributionNotesInput').value = '';
          if (res.record) contributions.push(res.record);
          updateAllViews();
        } catch (err) { 
          showToast("Error al guardar: " + err.message, "error"); 
        } finally { 
          hideSaving(); 
        }
      }

      async function handleCashMovementSubmit(e) {
        e.preventDefault();
        if (getCurrentRole() !== 'admin') { showToast("Se requiere rol Administrador.", "error"); return; }
        const cfDateVal = document.getElementById('cashDateInput').value;
        if (!cfDateVal) { showToast("Indica la fecha del movimiento de caja.", "error"); return; }
        if (parseDateSafe(cfDateVal) > parseDateSafe(getTodayLocalIsoDate())) {
        showToast("La fecha del movimiento de caja no puede ser futura.", "error");
        return;
        }
        const amt = parseMoneyAmount(document.getElementById('cashAmountInput').value);
        if (amt === null) { showToast("El monto debe estar entre 0.01 y 9,999,999, con máximo 2 decimales.", "error"); return; }
        if (!document.getElementById('cashCategorySelect').value) { showToast("Selecciona el concepto o categoría del movimiento.", "error"); return; }
        if (document.getElementById('cashNotesInput').value.trim().length > 200) { showToast("La descripción no puede superar 200 caracteres.", "error"); return; }

        // Un egreso mayor que el saldo disponible deja la caja en negativo: se pide confirmación
        if (document.getElementById('cashMovementTypeSelect').value === 'Salida') {
          const saldo = contributions.reduce((s, c) => s + (parseFloat(c.amount || c.monto) || 0), 0) +
            cashFlow.reduce((s, cf) => s + ((cf.movementType || cf.tipoMovimiento) === 'Entrada' ? 1 : -1) * (parseFloat(cf.amount || cf.monto) || 0), 0);
          if (amt > saldo && !(await showConfirmDialog({ title: 'Saldo insuficiente', message: `Este egreso de ${formatCurrency(amt)} supera el saldo disponible (${formatCurrency(saldo)}).\nEl saldo quedará en ${formatCurrency(saldo - amt)}.\n\n¿Deseas registrarlo de todas formas?`, confirmText: 'Registrar egreso', tone: 'warning' }))) return;
        }

        showSaving("Registrando movimiento...");
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
          showToast("Error al registrar caja: " + err.message, "error"); 
        } finally { 
          hideSaving(); 
        }
      }

