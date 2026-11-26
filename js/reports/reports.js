// ────────────────────────────────────────────────────────────────────
// REPORTES HISTÓRICOS Y PROTECCIÓN DE DATOS (LEY 787)
// ────────────────────────────────────────────────────────────────────

function buildHistoricalReport(year, qVal, author) {
  const isAdmin = getCurrentRole() === 'admin';

  // Función para obtener las fechas exactas de cualquier trimestre o año
  const getQDef = (y, q) => {
    if (q === 'ALL')
      return {
        name: 'Año Consolidado',
        short: 'Anual',
        start: new Date(y, 0, 1),
        end: new Date(y, 11, 31, 23, 59, 59)
      };
    if (q == 1)
      return { name: 'Primer Trimestre', short: 'T1', start: new Date(y, 0, 1), end: new Date(y, 2, 31, 23, 59, 59) };
    if (q == 2)
      return { name: 'Segundo Trimestre', short: 'T2', start: new Date(y, 3, 1), end: new Date(y, 5, 30, 23, 59, 59) };
    if (q == 3)
      return { name: 'Tercer Trimestre', short: 'T3', start: new Date(y, 6, 1), end: new Date(y, 8, 30, 23, 59, 59) };
    if (q == 4)
      return { name: 'Cuarto Trimestre', short: 'T4', start: new Date(y, 9, 1), end: new Date(y, 11, 31, 23, 59, 59) };
  };

  const q = getQDef(year, qVal);

  // Determinar el PERÍODO ANTERIOR
  let prevQ;
  let prevYear = year;

  if (qVal === 'ALL') {
    prevYear = year - 1;
    prevQ = getQDef(prevYear, 'ALL');
  } else {
    let prevQVal = parseInt(qVal) - 1;
    if (prevQVal === 0) {
      prevQVal = 4;
      prevYear = year - 1;
    }
    prevQ = getQDef(prevYear, prevQVal);
  }

  // Función interna para calcular métricas
  const calcMetrics = (start, end) => {
    const newJoins =
      adults.filter((a) => {
        const j = parseDateSafe(a.joinDate || a.fechaIngreso);
        return j && j >= start && j <= end;
      }).length +
      children.filter((c) => {
        const j = parseDateSafe(c.joinDate || c.fechaIngreso);
        return j && j >= start && j <= end;
      }).length;

    const baptisms =
      adults.filter((a) => {
        if (a.isBaptized !== 'Sí' && a.bautizado !== 'Sí') return false;
        const b = parseDateSafe(a.baptismDate || a.fechaBautismo);
        return b && b >= start && b <= end;
      }).length +
      children.filter((c) => {
        if (c.isBaptized !== 'Sí' && c.bautizado !== 'Sí') return false;
        const b = parseDateSafe(c.baptismDate || c.fechaBautismo);
        return b && b >= start && b <= end;
      }).length;

    const presented = children.filter((c) => {
      if (!c.presentedToChurch && !c.presentado) return false;
      const p = parseDateSafe(c.presentedDate || c.fechaPresentacion || c.joinDate || c.fechaIngreso);
      return p && p >= start && p <= end;
    }).length;

    const deaths =
      adults.filter((a) => {
        if (a.isDeceased !== 'Sí' && a.fallecido !== 'Sí') return false;
        const d = parseDateSafe(a.deceasedDate || a.fechaDefuncion);
        return d && d >= start && d <= end;
      }).length +
      children.filter((c) => {
        if (c.isDeceased !== 'Sí' && c.fallecido !== 'Sí') return false;
        const d = parseDateSafe(c.deceasedDate || c.fechaDefuncion);
        return d && d >= start && d <= end;
      }).length;

    const disciplined =
      adults.filter((a) => {
        if (a.inDiscipline !== 'Sí' && a.enDisciplina !== 'Sí') return false;
        const discDate = parseDateSafe(a.disciplineDate || a.inicioDisciplina);
        return discDate && discDate >= start && discDate <= end;
      }).length +
      children.filter((c) => {
        if (c.inDiscipline !== 'Sí' && c.enDisciplina !== 'Sí') return false;
        const discDate = parseDateSafe(c.disciplineDate || c.inicioDisciplina);
        return discDate && discDate >= start && discDate <= end;
      }).length;

    const isAliveAtEnd = (m) => {
      const j = parseDateSafe(m.joinDate || m.fechaIngreso);
      const d =
        m.isDeceased === 'Sí' || m.fallecido === 'Sí' ? parseDateSafe(m.deceasedDate || m.fechaDefuncion) : null;
      return j && j <= end && (!d || d > end);
    };

    // Para que el conteo de edades coincida exactamente con el Directorio en el trimestre en curso,
    // si el fin del trimestre (end) es posterior a la fecha actual de Nicaragua (hoy), se evalúa la edad cumplida HOY.
    const todayLocal = parseDateSafe(getTodayLocalIsoDate()) || new Date();
    const effectiveAgeCutoff = end > todayLocal ? todayLocal : end;

    const ageAtDate = (birthDateStr, cutoffDate) => {
      const b = parseDateSafe(birthDateStr);
      if (!b || !cutoffDate) return 0;
      let yrs = cutoffDate.getFullYear() - b.getFullYear();
      const mDiff = cutoffDate.getMonth() - b.getMonth();
      if (mDiff < 0 || (mDiff === 0 && cutoffDate.getDate() < b.getDate())) yrs--;
      return Math.max(0, yrs);
    };

    // Conteo al corte del trimestre y nuevos ingresos del trimestre para Niños (0-10), Adolescentes (11-15) y Jóvenes (16+)
    const aliveMinorsAtEnd = children.filter((c) => isAliveAtEnd(c));
    const ninosCutoff = aliveMinorsAtEnd.filter(
      (c) => ageAtDate(c.birthDate || c.fechaNacimiento, effectiveAgeCutoff) <= 10
    ).length;
    const adolescentesCutoff = aliveMinorsAtEnd.filter((c) => {
      const y = ageAtDate(c.birthDate || c.fechaNacimiento, effectiveAgeCutoff);
      return y >= 11 && y <= 15;
    }).length;
    const jovenesCutoff = aliveMinorsAtEnd.filter(
      (c) => ageAtDate(c.birthDate || c.fechaNacimiento, effectiveAgeCutoff) >= 16
    ).length;
    const totalMinorsCutoff = ninosCutoff + adolescentesCutoff + jovenesCutoff;

    const minorsJoinedInPeriod = children.filter((c) => {
      const j = parseDateSafe(c.joinDate || c.fechaIngreso);
      return j && j >= start && j <= end;
    });
    const newNinos = minorsJoinedInPeriod.filter(
      (c) => ageAtDate(c.birthDate || c.fechaNacimiento, effectiveAgeCutoff) <= 10
    ).length;
    const newAdolescentes = minorsJoinedInPeriod.filter((c) => {
      const y = ageAtDate(c.birthDate || c.fechaNacimiento, effectiveAgeCutoff);
      return y >= 11 && y <= 15;
    }).length;
    const newJovenes = minorsJoinedInPeriod.filter(
      (c) => ageAtDate(c.birthDate || c.fechaNacimiento, effectiveAgeCutoff) >= 16
    ).length;

    const countCategoryAtEnd = (catName) => {
      const aCount = adults.filter((a) => isAliveAtEnd(a) && (a.category || a.categoria) === catName).length;
      const cCount = children.filter((c) => isAliveAtEnd(c) && (c.category || c.categoria) === catName).length;
      return aCount + cCount;
    };

    const catActivos = countCategoryAtEnd('Activo');
    const catDirectivos = countCategoryAtEnd('Directivo');
    const inactives = countCategoryAtEnd('Inactivo');
    const catNuevosCreyentes = countCategoryAtEnd('Nuevo Creyente');

    const countConversionInPeriod = (convName) => {
      const aCount = adults.filter((a) => {
        const j = parseDateSafe(a.joinDate || a.fechaIngreso);
        return j && j >= start && j <= end && (a.conversionType || a.tipoConversion) === convName;
      }).length;
      const cCount = children.filter((c) => {
        const j = parseDateSafe(c.joinDate || c.fechaIngreso);
        return j && j >= start && j <= end && (c.conversionType || c.tipoConversion) === convName;
      }).length;
      return aCount + cCount;
    };

    const aceptaciones = countConversionInPeriod('Aceptación');
    const reconcilios = countConversionInPeriod('Reconcilio');

    let contribSum = 0;
    let cashNet = 0;
    let expenses = 0;
    if (isAdmin) {
      contribSum = contributions
        .filter((c) => {
          const dt = parseDateSafe(c.date || c.fecha);
          return dt && dt >= start && dt <= end;
        })
        .reduce((acc, curr) => acc + (parseFloat(curr.amount || curr.monto) || 0), 0);

      let cashIn = 0;
      let cashOut = 0;
      cashFlow.forEach((cf) => {
        const dt = parseDateSafe(cf.date || cf.fecha);
        if (dt && dt >= start && dt <= end) {
          const amt = parseFloat(cf.amount || cf.monto) || 0;
          const movType = cf.movementType || cf.tipoMovimiento;
          if (movType === 'Entrada') cashIn += amt;
          else cashOut += amt;
        }
      });
      expenses = cashOut;
      cashNet = contribSum + cashIn - cashOut;
    }
    return {
      newJoins,
      aceptaciones,
      reconcilios,
      baptisms,
      presented,
      deaths,
      disciplined,
      ninosCutoff,
      adolescentesCutoff,
      jovenesCutoff,
      totalMinorsCutoff,
      newNinos,
      newAdolescentes,
      newJovenes,
      catActivos,
      catDirectivos,
      inactives,
      catNuevosCreyentes,
      contribSum,
      expenses,
      cashNet
    };
  };

  const currStats = calcMetrics(q.start, q.end);
  const prevStats = calcMetrics(prevQ.start, prevQ.end);

  const adultsAtCutoff = adults.filter((a) => {
    const j = parseDateSafe(a.joinDate || a.fechaIngreso);
    const d = a.isDeceased === 'Sí' || a.fallecido === 'Sí' ? parseDateSafe(a.deceasedDate || a.fechaDefuncion) : null;
    return j && j <= q.end && (!d || d > q.end);
  });

  const getDisciplinedAtCutoff = (list, typeLabel) => {
    return list
      .filter((m) => {
        if (m.inDiscipline !== 'Sí' && m.enDisciplina !== 'Sí') return false;
        const discStart = parseDateSafe(m.disciplineDate || m.inicioDisciplina);
        if (!discStart || discStart > q.end) return false;

        if (!(m.disciplineIndefinite || m.disciplinaIndefinida)) {
          const discEnd = parseDateSafe(m.disciplineEndDate || m.finDisciplina);
          if (discEnd && discEnd < q.start) return false;
        }

        const j = parseDateSafe(m.joinDate || m.fechaIngreso);
        const d =
          m.isDeceased === 'Sí' || m.fallecido === 'Sí' ? parseDateSafe(m.deceasedDate || m.fechaDefuncion) : null;
        return j && j <= q.end && (!d || d > q.end);
      })
      .map((m) => ({ ...m, _typeLabel: typeLabel }));
  };

  const disciplinedMembers = [
    ...getDisciplinedAtCutoff(adults, 'Adulto'),
    ...getDisciplinedAtCutoff(children, 'Menor')
  ];

  const getDiff = (curr, prev, isCurrency, inverseColors = false) => {
    const diff = curr - prev;
    if (diff === 0) return '<span style="color:#64748b; font-weight:normal;">= Igual</span>';
    const isPositive = diff > 0;
    const color = isPositive ? (inverseColors ? '#e11d48' : '#059669') : inverseColors ? '#059669' : '#e11d48';
    const icon = isPositive ? '▲' : '▼';
    const valText = isCurrency ? formatCurrency(Math.abs(diff)) : Math.abs(diff);
    return `<span style="color:${color}; font-weight: 600;">${icon} ${isPositive ? '+' : '-'}${valText}</span>`;
  };

  const currentHeader = `${q.short} ${year}`;
  const prevHeader = `${prevQ.short} ${prevYear}`;

  let disciplineTableHtml = '';
  if (disciplinedMembers.length > 0) {
    disciplineTableHtml = `
          <div style="margin-top: 25px; page-break-inside: avoid;">
            <h3 style="font-size: 9pt; font-weight: 600; margin-bottom: 6px; color: #9f1239; border-bottom: 1px solid #fda4af; padding-bottom: 3px;">
              Auditoría: Miembros en Disciplina Pastoral al Corte (${disciplinedMembers.length})
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 8pt; text-align: left; margin-bottom: 15px;">
              <thead>
                <tr style="background-color: #fff1f2; border-bottom: 2px solid #fda4af; color: #9f1239;">
                  <th style="padding: 5px; border: 1px solid #fecdd3;">Miembro</th>
                  <th style="padding: 5px; border: 1px solid #fecdd3;">Categoría</th>
                  <th style="padding: 5px; border: 1px solid #fecdd3;">Inicio Disciplina</th>
                  <th style="padding: 5px; border: 1px solid #fecdd3;">Estado / Fin</th>
                  <th style="padding: 5px; border: 1px solid #fecdd3;">Motivo / Notas</th>
                </tr>
              </thead>
              <tbody>
                ${disciplinedMembers
                  .map((m) => {
                    const isIndef = m.disciplineIndefinite || m.disciplinaIndefinida;
                    const endStr = m.disciplineEndDate || m.finDisciplina;
                    const statusText = isIndef ? 'Indefinido' : escapeHtml(formatDisplayDate(endStr));
                    return `
                  <tr style="background-color: #fffafb;">
                    <td style="padding: 5px; border: 1px solid #fecdd3; font-weight: 600; color: #881337;">${escapeHtml(m.fullName || m.nombreCompleto)}</td>
                    <td style="padding: 5px; border: 1px solid #fecdd3; color: #9f1239;">${m._typeLabel}</td>
                    <td style="padding: 5px; border: 1px solid #fecdd3; color: #9f1239;">${escapeHtml(formatDisplayDate(m.disciplineDate || m.inicioDisciplina))}</td>
                    <td style="padding: 5px; border: 1px solid #fecdd3; color: #9f1239; font-weight: 600;">${statusText}</td>
                    <td style="padding: 5px; border: 1px solid #fecdd3; color: #9f1239; font-style: italic;">${escapeHtml(m.disciplineReason || m.motivoDisciplina || 'Sin especificar')}</td>
                  </tr>
                  `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        `;
  }

  return `
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; color: #0f172a;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              ${getInstitutionalLogoHtml() ? `<img src="${escapeHtml(getInstitutionalLogoHtml())}" alt="" style="width: 50px; height: 50px; object-fit: contain;" />` : ''}
              <div>
              <p style="font-size: 8.5pt; font-weight: 600; color: #1d4ed8; text-transform: uppercase;">${escapeHtml(churchConfig.name)}${churchConfig.address ? ` <span style="color:#64748b; text-transform:none; font-weight:500;">· ${escapeHtml(churchConfig.address)}</span>` : ''}</p>
              <h1 style="font-size: 15pt; font-weight: 700; color: #0f172a; margin: 2px 0;">Informe Oficial de Gestión Eclesiástica</h1>
              <p style="font-size: 7.5pt; color: #334155;">Corte oficial histórico protegido bajo la Ley de Protección de Datos Personales (Ley 787)</p>
              </div>
            </div>
            <div style="text-align: right; font-size: 7.5pt; color: #334155;">
              <p><strong>Emisión:</strong> ${getTodayLocalIsoDate()}</p>
              <p><strong>Revisor:</strong> ${escapeHtml(author)}</p>
              <p><strong>Nivel:</strong> ${isAdmin ? 'ADMINISTRATIVO COMPLETO' : 'CONSULTA GENERAL'}</p>
            </div>
          </div>
          <div style="background-color: #e2e8f0; color: #0f172a; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 6px; margin-top: 8px; font-size: 8pt; font-weight: 700; text-align: center;">
            PERÍODO ACTUAL: ${q.name} ${year} &nbsp;|&nbsp; PERÍODO COMPARADO: ${prevQ.name} ${prevYear}
          </div>
        </div>

        <div style="margin-bottom: 15px; color: #0f172a;">
          <h3 style="font-size: 9pt; font-weight: 600; margin-bottom: 6px; color: #0f172a; border-bottom: 1px solid #94a3b8; padding-bottom: 3px;">
            Cuadro Comparativo Periódico (${currentHeader} vs ${prevHeader})
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 8pt; text-align: left; margin-bottom: 15px; color: #0f172a;">
            <thead>
              <tr style="background-color: #e2e8f0; border-bottom: 2px solid #94a3b8; color: #0f172a;">
                <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a; font-weight: 700;">Métrica Evaluada</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a; font-weight: 700;">Actual (${currentHeader})</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a; font-weight: 700;">Anterior (${prevHeader})</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a; font-weight: 700;">Variación</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: 600; color: #0f172a;">Nuevos Ingresos</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; color: #0f172a;">${currStats.newJoins}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #334155; font-weight: 600;">${prevStats.newJoins}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${getDiff(currStats.newJoins, prevStats.newJoins, false)}</td>
              </tr>
              <tr>
                <td style="padding: 5px; border: 1px solid #cbd5e1; padding-left: 16px; color: #1e293b; font-weight: 600;">• Por Aceptación</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; color: #0f172a;">${currStats.aceptaciones}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #334155; font-weight: 600;">${prevStats.aceptaciones}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${getDiff(currStats.aceptaciones, prevStats.aceptaciones, false)}</td>
              </tr>
              <tr>
                <td style="padding: 5px; border: 1px solid #cbd5e1; padding-left: 16px; color: #1e293b; font-weight: 600;">• Por Reconcilio</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; color: #0f172a;">${currStats.reconcilios}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #334155; font-weight: 600;">${prevStats.reconcilios}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${getDiff(currStats.reconcilios, prevStats.reconcilios, false)}</td>
              </tr>
              <tr>
                <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: 600; color: #0f172a;">Bautismos en Agua</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; color: #0f172a;">${currStats.baptisms}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #334155; font-weight: 600;">${prevStats.baptisms}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${getDiff(currStats.baptisms, prevStats.baptisms, false)}</td>
              </tr>
              <tr>
                <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: 600; color: #0f172a;">Presentación de Menores</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; color: #0f172a;">${currStats.presented}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #334155; font-weight: 600;">${prevStats.presented}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${getDiff(currStats.presented, prevStats.presented, false)}</td>
              </tr>
              <tr style="background-color: #f0fdfa;">
                <td colspan="4" style="padding: 5px; border: 1px solid #e2e8f0; font-weight: 600; color: #0f766e; text-transform: uppercase; font-size: 7.5pt;">Censo Trimestral de Niños, Adolescentes y Jóvenes al Corte</td>
              </tr>
              <tr>
                <td style="padding: 5px; border: 1px solid #e2e8f0; font-weight: 600; color: #0f766e;">• Total Niños (0–10 años)</td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #0f766e;">${currStats.ninosCutoff} <span style="font-size: 7pt; font-weight: normal; color: #64748b;">(Nuevos: ${currStats.newNinos})</span></td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">${prevStats.ninosCutoff} <span style="font-size: 7pt;">(Nuevos: ${prevStats.newNinos})</span></td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center;">${getDiff(currStats.ninosCutoff, prevStats.ninosCutoff, false)}</td>
              </tr>
              <tr>
                <td style="padding: 5px; border: 1px solid #e2e8f0; font-weight: 600; color: #6d28d9;">• Total Adolescentes (11–15 años)</td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #6d28d9;">${currStats.adolescentesCutoff} <span style="font-size: 7pt; font-weight: normal; color: #64748b;">(Nuevos: ${currStats.newAdolescentes})</span></td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">${prevStats.adolescentesCutoff} <span style="font-size: 7pt;">(Nuevos: ${prevStats.newAdolescentes})</span></td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center;">${getDiff(currStats.adolescentesCutoff, prevStats.adolescentesCutoff, false)}</td>
              </tr>
              <tr>
                <td style="padding: 5px; border: 1px solid #e2e8f0; font-weight: 600; color: #0369a1;">• Total Jóvenes (16+ años en registro juvenil)</td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #0369a1;">${currStats.jovenesCutoff} <span style="font-size: 7pt; font-weight: normal; color: #64748b;">(Nuevos: ${currStats.newJovenes})</span></td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">${prevStats.jovenesCutoff} <span style="font-size: 7pt;">(Nuevos: ${prevStats.newJovenes})</span></td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center;">${getDiff(currStats.jovenesCutoff, prevStats.jovenesCutoff, false)}</td>
              </tr>
              <tr style="background-color: #f8fafc;">
                <td style="padding: 5px; border: 1px solid #e2e8f0; font-weight: 700; color: #0f172a;">Total General Niños, Adolescentes y Jóvenes</td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; font-weight: 700; color: #0f172a;">${currStats.totalMinorsCutoff}</td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #64748b;">${prevStats.totalMinorsCutoff}</td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center;">${getDiff(currStats.totalMinorsCutoff, prevStats.totalMinorsCutoff, false)}</td>
              </tr>
              <tr style="background-color: #f8fafc;">
                <td colspan="4" style="padding: 5px; border: 1px solid #e2e8f0; font-weight: 600; color: #1e3a8a; text-transform: uppercase; font-size: 7.5pt;">Distribución por Categorías al Corte (Adultos, Jóvenes, Adolescentes y Niños)</td>
              </tr>
              <tr>
                <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: 600; color: #0f172a;">Categoría: Activos</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; color: #0f172a;">${currStats.catActivos}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #334155; font-weight: 600;">${prevStats.catActivos}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${getDiff(currStats.catActivos, prevStats.catActivos, false)}</td>
              </tr>
              <tr>
                <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: 600; color: #0f172a;">Categoría: Directivos</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; color: #0f172a;">${currStats.catDirectivos}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #334155; font-weight: 600;">${prevStats.catDirectivos}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${getDiff(currStats.catDirectivos, prevStats.catDirectivos, false)}</td>
              </tr>
              <tr>
                <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: 600; color: #0f172a;">Categoría: Nuevo Creyente</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; color: #0f172a;">${currStats.catNuevosCreyentes}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #334155; font-weight: 600;">${prevStats.catNuevosCreyentes}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${getDiff(currStats.catNuevosCreyentes, prevStats.catNuevosCreyentes, false)}</td>
              </tr>
              <tr>
                <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: 600; color: #0f172a;">Categoría: Miembros Inactivos</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; color: #0f172a;">${currStats.inactives}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #334155; font-weight: 600;">${prevStats.inactives}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${getDiff(currStats.inactives, prevStats.inactives, false, true)}</td>
              </tr>
              <tr>
                <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: 600; color: #0f172a;">Nuevos Casos Disciplina Pastoral</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; color: #0f172a;">${currStats.disciplined}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #334155; font-weight: 600;">${prevStats.disciplined}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${getDiff(currStats.disciplined, prevStats.disciplined, false, true)}</td>
              </tr>
              <tr>
                <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: 600; color: #0f172a;">Defunciones (Fallecidos)</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; color: #0f172a;">${currStats.deaths}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #334155; font-weight: 600;">${prevStats.deaths}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${getDiff(currStats.deaths, prevStats.deaths, false, true)}</td>
              </tr>
              ${
                isAdmin
                  ? `
              <tr style="background-color: #fffbeb;">
                <td style="padding: 5px; border: 1px solid #e2e8f0; font-weight: 600; color: #b45309;">Ingresos por Aportes (C$)</td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #b45309;">${formatCurrency(currStats.contribSum)}</td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">${formatCurrency(prevStats.contribSum)}</td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center;">${getDiff(currStats.contribSum, prevStats.contribSum, true)}</td>
              </tr>
              <tr style="background-color: #fef2f2;">
                <td style="padding: 5px; border: 1px solid #e2e8f0; font-weight: 600; color: #be123c;">Egresos / Gastos Operativos (C$)</td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #be123c;">${formatCurrency(currStats.expenses)}</td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">${formatCurrency(prevStats.expenses)}</td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center;">${getDiff(currStats.expenses, prevStats.expenses, true, true)}</td>
              </tr>
              <tr style="background-color: #f0fdf4;">
                <td style="padding: 5px; border: 1px solid #e2e8f0; font-weight: 600; color: #047857;">Saldo Neto en Caja (C$)</td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #047857;">${formatCurrency(currStats.cashNet)}</td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">${formatCurrency(prevStats.cashNet)}</td>
                <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center;">${getDiff(currStats.cashNet, prevStats.cashNet, true)}</td>
              </tr>`
                  : ''
              }
            </tbody>
          </table>
        </div>

        <div style="margin-bottom: 15px; page-break-inside: avoid;">
          <h3 style="font-size: 9pt; font-weight: 600; margin-bottom: 6px; color: #0f766e; border-bottom: 1px solid #99f6e4; padding-bottom: 3px;">
            Resumen Trimestral de Niños, Adolescentes y Jóvenes al Corte (${currentHeader}: ${currStats.totalMinorsCutoff})
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 8pt; text-align: center; margin-bottom: 12px;">
            <thead>
              <tr style="background-color: #f0fdfa;">
                <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #0f766e;">Niños (0–10 años)</th>
                <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #6d28d9;">Adolescentes (11–15 años)</th>
                <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #0369a1;">Jóvenes (16+ años)</th>
                <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; background-color: #ccfbf1; color: #115e59;">Total General (${currentHeader})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: 600; color: #0f766e; font-size: 9.5pt;">${currStats.ninosCutoff} <span style="font-size: 7.5pt; font-weight: normal; color: #64748b;">(Ingresos ${currentHeader}: +${currStats.newNinos})</span></td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: 600; color: #6d28d9; font-size: 9.5pt;">${currStats.adolescentesCutoff} <span style="font-size: 7.5pt; font-weight: normal; color: #64748b;">(Ingresos ${currentHeader}: +${currStats.newAdolescentes})</span></td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: 600; color: #0369a1; font-size: 9.5pt;">${currStats.jovenesCutoff} <span style="font-size: 7.5pt; font-weight: normal; color: #64748b;">(Ingresos ${currentHeader}: +${currStats.newJovenes})</span></td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a; background-color: #f0fdfa; font-size: 9.5pt;">${currStats.totalMinorsCutoff}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-bottom: 15px; page-break-inside: avoid;">
          <h3 style="font-size: 9pt; font-weight: 600; margin-bottom: 6px; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">
            Resumen Contable de Categorías al Corte (Total Miembros Vivos: ${currStats.catActivos + currStats.catDirectivos + currStats.catNuevosCreyentes + currStats.inactives})
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 8pt; text-align: center; margin-bottom: 12px;">
            <thead>
              <tr style="background-color: #f1f5f9;">
                <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">Activos</th>
                <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">Directivos</th>
                <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">Nuevo Creyente</th>
                <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">Inactivos</th>
                <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; background-color: #e2e8f0;">Total Categorías</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: 600; color: #047857; font-size: 9.5pt;">${currStats.catActivos}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: 600; color: #1d4ed8; font-size: 9.5pt;">${currStats.catDirectivos}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: 600; color: #0369a1; font-size: 9.5pt;">${currStats.catNuevosCreyentes}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: 600; color: #64748b; font-size: 9.5pt;">${currStats.inactives}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a; background-color: #f8fafc; font-size: 9.5pt;">${currStats.catActivos + currStats.catDirectivos + currStats.catNuevosCreyentes + currStats.inactives}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-4" style="color: #0f172a;">
          <h3 style="font-size: 9pt; font-weight: 600; margin-bottom: 6px; color: #0f172a; border-bottom: 1px solid #94a3b8; padding-bottom: 3px; text-transform: uppercase;">
            Padrón de Adultos Vivos al Corte (${adultsAtCutoff.length})
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 8pt; text-align: left; color: #0f172a;">
            <thead>
              <tr style="background-color: #e2e8f0; border-bottom: 2px solid #94a3b8; color: #0f172a;">
                <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a; font-weight: 700;">Miembro</th>
                ${isAdmin ? '<th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a; font-weight: 700;">Cédula</th>' : ''}
                <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a; font-weight: 700;">Edad</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a; font-weight: 700;">Categoría</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a; font-weight: 700;">Condición</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a; font-weight: 700;">Ingreso</th>
              </tr>
            </thead>
            <tbody>
              ${adultsAtCutoff
                .map(
                  (a) => `
                <tr>
                  <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: 600; color: #0f172a;">${escapeHtml(a.fullName || a.nombreCompleto)}</td>
                  ${isAdmin ? `<td style="padding: 5px; border: 1px solid #cbd5e1; color: #1e293b; font-family: monospace;">${escapeHtml(a.idNumber || a.cedula || 'S/N')}</td>` : ''}
                  <td style="padding: 5px; border: 1px solid #cbd5e1; color: #1e293b;">${calculateAgeVerbose(a.birthDate || a.fechaNacimiento, 'No', '')}</td>
                  <td style="padding: 5px; border: 1px solid #cbd5e1; color: #1e293b; font-weight: 600;">${escapeHtml(a.category || a.categoria)}</td>
                  <td style="padding: 5px; border: 1px solid #cbd5e1; color: #1e293b;">${escapeHtml(a.conversionType || a.tipoConversion || '-')}</td>
                  <td style="padding: 5px; border: 1px solid #cbd5e1; color: #1e293b;">${escapeHtml(formatDisplayDate(a.joinDate || a.fechaIngreso))}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>

        ${disciplineTableHtml}

        <div style="margin-top: 35px; display: flex; justify-content: space-around; text-align: center; page-break-inside: avoid;">
          <div style="width: 180px;">
            <div style="border-top: 1px solid #000; margin-bottom: 3px;"></div>
            <p style="font-size: 7.5pt; font-weight: 600;">${escapeHtml(churchConfig.pastor || 'PASTOR GENERAL')}</p>
            <p style="font-size: 7pt; color: #64748b;">Pastor General</p>
          </div>
          <div style="width: 180px;">
            <div style="border-top: 1px solid #000; margin-bottom: 3px;"></div>
            <p style="font-size: 7.5pt; font-weight: 600;">${escapeHtml(author)}</p>
            <p style="font-size: 7pt; color: #64748b;">Secretario General</p>
          </div>
        </div>
      `;
}

// Años del reporte: desde el dato más antiguo registrado (ingresos, bautismos,
// aportes o caja) hasta el año actual. Conserva el año elegido si sigue disponible.
function populateReportYears() {
  const sel = document.getElementById('reportYearSelect');
  if (!sel) return;
  const previous = sel.value;
  const thisYear = parseInt(getTodayLocalIsoDate().slice(0, 4), 10);
  let minYear = Math.min(thisYear, 2023);
  const consider = (d) => {
    const y = parseInt(String(d || '').slice(0, 4), 10);
    if (y >= 1950 && y < minYear) minYear = y;
  };
  [...adults, ...children].forEach((m) => {
    consider(m.joinDate || m.fechaIngreso);
    consider(m.baptismDate || m.fechaBautismo);
  });
  contributions.forEach((c) => consider(c.date || c.fecha));
  cashFlow.forEach((c) => consider(c.date || c.fecha));
  const wanted = [];
  for (let y = thisYear; y >= minYear; y--) wanted.push(String(y));
  if ([...sel.options].map((o) => o.value).join() !== wanted.join()) {
    sel.innerHTML = wanted.map((y) => `<option value="${y}">${y}</option>`).join('');
  }
  sel.value = wanted.includes(previous) ? previous : String(thisYear);
}

function getLogoSrc() {
  const img = document.querySelector('.auth-logo') || document.getElementById('headerLogo');
  return img ? img.src : '';
}

// Generar el informe cuesta ~150 ms con bases grandes: en los campos de texto se espera
// a que el usuario deje de escribir (300 ms) en lugar de regenerarlo en cada tecla.
let pausaReporte = null;
function debouncedRenderOnScreenReport() {
  clearTimeout(pausaReporte);
  pausaReporte = setTimeout(renderOnScreenReport, 300);
}

function renderOnScreenReport() {
  const year = parseInt(document.getElementById('reportYearSelect').value, 10);
  const qVal = document.getElementById('reportQuarterSelect').value;
  const author = document.getElementById('reportAuthorInput').value.trim() || 'Administración';
  document.getElementById('onScreenReportContainer').innerHTML = buildHistoricalReport(year, qVal, author);

  // Marca de agua como fondo fijo: detrás del texto y siempre centrada en la pantalla
  const sheet = document.getElementById('reportSheet');
  const logo = getLogoSrc();
  if (sheet && logo && !sheet.dataset.wm) {
    sheet.style.backgroundImage = `linear-gradient(rgba(255,255,255,.93), rgba(255,255,255,.93)), url("${logo}")`;
    sheet.style.backgroundSize = 'auto, min(380px, 55vw)';
    sheet.dataset.wm = '1';
  }
}

function printReport() {
  const year = parseInt(document.getElementById('reportYearSelect').value, 10);
  const qVal = document.getElementById('reportQuarterSelect').value;
  const author = document.getElementById('reportAuthorInput').value.trim() || 'Administración';
  const printArea = document.getElementById('printOfficialReportArea');
  printArea.innerHTML =
    (window.AuthUI ? window.AuthUI.getPrintWatermarkHtml() : '') +
    `<div class="print-content">${buildHistoricalReport(year, qVal, author)}</div>`;
  setTimeout(() => {
    window.print();
    printArea.innerHTML = '';
  }, 250);
}
