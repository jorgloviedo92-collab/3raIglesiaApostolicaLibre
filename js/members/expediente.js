    // ────────────────────────────────────────────────────────────────────
    // EXPEDIENTE INSTITUCIONAL (MODAL)
    // ────────────────────────────────────────────────────────────────────

    // Muestra en el encabezado de la Ficha de Registro el ID que asignó el sistema
    function setFormIdBadge(id, textoAlterno) {
      const el = document.getElementById('formHeaderId');
      if (!el) return;
      el.innerHTML = '<i class="fa-solid fa-fingerprint mr-1" aria-hidden="true"></i>';
      el.appendChild(document.createTextNode(
        id ? 'ID del sistema: ' + id : (textoAlterno || 'ID del sistema: se asigna al guardar')
      ));
    }

    // Copia un texto al portapapeles (con alternativa para navegadores sin acceso)
    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch (e2) {}
        ta.remove();
      }
    }

    function viewMemberModal(id, type) {
      const isAdult = (type === 'Adultos');
      const m = isAdult 
        ? adults.find(a => String(a.id).trim() === String(id).trim()) 
        : children.find(c => String(c.id).trim() === String(id).trim());
      if (!m) return;

      const container = document.getElementById('memberModalContent');
      container.innerHTML = '';

      const nameVal = m.fullName || m.nombreCompleto || '';
      const isDeceased = (m.isDeceased === 'Sí' || m.fallecido === 'Sí');
      const isBaptized = (m.isBaptized === 'Sí' || m.bautizado === 'Sí');
      const inDiscipline = (!isDeceased && isBaptized && (m.category || m.categoria) !== 'Inactivo' && (m.inDiscipline === 'Sí' || m.enDisciplina === 'Sí'));
      const bDate = m.birthDate || m.fechaNacimiento;
      const dDate = m.deceasedDate || m.fechaDefuncion;
      const isAdmin = (getCurrentRole() === 'admin');

      const photoRef = m.photoBase64 || m.fotoUrl;
      let imgElem = document.createElement('div');
      imgElem.className = 'w-20 h-20 rounded-full bg-slate-200 flex justify-center items-center text-3xl font-bold text-slate-500 shrink-0';
      imgElem.textContent = nameVal.charAt(0).toUpperCase();

      if (photoRef) {
        if (photoRef.startsWith('DRIVE_FILE:')) {
          resolvePhotoUrl(photoRef).then(dataUri => {
            if (dataUri) {
              const realImg = document.createElement('img');
              realImg.src = dataUri;
              realImg.className = `w-20 h-20 rounded-full object-cover border-4 border-blue-100 shadow shrink-0 ${isDeceased ? 'grayscale' : ''}`;
              if (topCard.contains(imgElem)) topCard.replaceChild(realImg, imgElem);
            }
          });
        } else {
          const safeUrl = sanitizeDriveUrl(photoRef);
          if (safeUrl) {
            const realImg = document.createElement('img');
            realImg.src = safeUrl;
            realImg.className = `w-20 h-20 rounded-full object-cover border-4 border-blue-100 shadow shrink-0 ${isDeceased ? 'grayscale' : ''}`;
            imgElem = realImg;
          }
        }
      }

      const topCard = document.createElement('div');
      topCard.className = 'flex gap-5 items-center border-b border-slate-200 pb-4';
      topCard.appendChild(imgElem);

      const headerDetails = document.createElement('div');
      const title = document.createElement('h2');
      title.className = 'text-xl font-bold text-slate-800';
      title.textContent = nameVal;
      if (isDeceased) {
        const dBadge = document.createElement('span');
        dBadge.className = 'bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded ml-2 font-bold';
        dBadge.textContent = `FALLECIDO (${formatDisplayDate(dDate)})`;
        title.appendChild(dBadge);
      } else if (!isAdult) {
        const st = getMinorStage(bDate, 'No', '');
        const sBadge = document.createElement('span');
        sBadge.className = `text-[10px] px-2 py-0.5 rounded-full ml-2 font-bold align-middle ${st.badgeClass}`;
        sBadge.textContent = st.label;
        title.appendChild(sBadge);
      }
      const mAgeYears = calculateAgeYears(bDate, isDeceased ? 'Sí' : 'No', dDate);
      const mCedula = (m.idNumber || m.cedula || '').trim();
      const showCedulaInModal = (mAgeYears >= 16 || Boolean(mCedula));
      const sub = document.createElement('p');
      sub.className = 'text-xs text-slate-500 mt-1';
      // El ID del sistema va aparte (chip debajo); aquí solo cédula, tipo de registro, edad y género
      const idPrefix = isAdult
        ? (showCedulaInModal ? ('Cédula: ' + (mCedula || 'S/N')) : '')
        : (mAgeYears >= 16 ? ('Registro Joven | Cédula: ' + (mCedula || 'S/N')) : 'Registro Menor');
      sub.textContent = [idPrefix, `Edad: ${calculateAgeVerbose(bDate, isDeceased ? 'Sí' : 'No', dDate)}`, `Género: ${m.gender || m.genero || 'S/E'}`]
        .filter(Boolean).join(' | ');

      // Chip con el ID asignado por el sistema y botón para copiarlo
      const idChip = document.createElement('div');
      idChip.className = 'mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 pl-2.5 pr-1 py-0.5 text-[11px] text-slate-600';
      const idLabel = document.createElement('span');
      idLabel.innerHTML = '<i class="fa-solid fa-fingerprint text-slate-400 mr-1" aria-hidden="true"></i>ID del sistema:';
      const idValue = document.createElement('code');
      idValue.className = 'font-mono font-bold text-slate-800 select-all';
      idValue.textContent = String(m.id);
      const idCopy = document.createElement('button');
      idCopy.type = 'button';
      idCopy.className = 'w-6 h-6 rounded-md text-slate-400 hover:text-blue-600 hover:bg-white transition';
      idCopy.title = 'Copiar ID';
      idCopy.setAttribute('aria-label', 'Copiar ID del sistema');
      idCopy.innerHTML = '<i class="fa-regular fa-copy" aria-hidden="true"></i>';
      idCopy.addEventListener('click', async () => {
        await copyText(String(m.id));
        idCopy.innerHTML = '<i class="fa-solid fa-check text-emerald-600" aria-hidden="true"></i>';
        setTimeout(() => { idCopy.innerHTML = '<i class="fa-regular fa-copy" aria-hidden="true"></i>'; }, 1500);
      });
      idChip.append(idLabel, idValue, idCopy);

      headerDetails.appendChild(title);
      headerDetails.appendChild(sub);
      headerDetails.appendChild(idChip);
      topCard.appendChild(headerDetails);
      container.appendChild(topCard);

      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs';

      const convVal = (m.conversionType || m.tipoConversion || '').trim();
      const showConvModal = (isAdult || mAgeYears >= 11 || Boolean(convVal));
      const ecleCard = `
        <div class="bg-blue-50 p-4 rounded-2xl border border-blue-200">
          <h4 class="font-bold text-blue-800 mb-2 border-b border-blue-200 pb-1"><i class="fa-solid fa-cross"></i> Datos Eclesiásticos</h4>
          <p class="mb-1"><strong>Categoría:</strong> ${escapeHtml(m.category || m.categoria)}</p>
          ${showConvModal ? `<p class="mb-1"><strong>Condición de Fe:</strong> ${escapeHtml(convVal || 'No especificado')}</p>` : ''}
          <p class="mb-1"><strong>Fecha Ingreso:</strong> ${escapeHtml(formatDisplayDate(m.joinDate || m.fechaIngreso))}</p>
          ${isAdult ? `<p class="mb-1"><strong>Ministerio / Cargo:</strong> ${escapeHtml(m.ministryRole || m.ministerioCargo || 'Ninguno')}</p>` : ''}
          <p><strong>Bautismo en Agua:</strong> ${isBaptized ? (escapeHtml(formatDisplayDate(m.baptismDate || m.fechaBautismo)) + ' (' + escapeHtml(m.baptismPlace || m.lugarBautismo || 'Templo Local') + ')') : 'No bautizado'}</p>
        </div>
      `;

      const contactCard = `
        <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <h4 class="font-bold text-slate-700 mb-2 border-b border-slate-200 pb-1"><i class="fa-solid fa-address-card"></i> Contacto y Datos Civiles</h4>
          ${(!isAdult && showCedulaInModal) ? `<p class="mb-1"><strong>Cédula:</strong> ${escapeHtml(mCedula || 'No registrada')}</p>` : ''}
          <p class="mb-1"><strong>Fecha de Nacimiento:</strong> ${escapeHtml(bDate ? formatDisplayDate(bDate) : 'No registrada')}</p>
          <p class="mb-1"><strong>Lugar de Nacimiento:</strong> ${escapeHtml(m.birthPlace || m.lugarNacimiento || 'No registrado')}</p>
          ${isAdult ? `<p class="mb-1"><strong>Estado Civil:</strong> ${escapeHtml(m.maritalStatus || m.estadoCivil || 'Soltero(a)')}</p>` : ''}
          <p class="mb-1"><strong>Dirección:</strong> ${escapeHtml(m.address || m.direccion || 'No registrada')}</p>
          <p class="mb-1"><strong>Teléfono:</strong> ${escapeHtml(m.phone || m.telefono || 'No registrado')}</p>
          <p><strong>Escolaridad:</strong> ${escapeHtml(m.educationLevel || m.escolaridad || 'No registrada')}</p>
        </div>
      `;

      grid.innerHTML = ecleCard + contactCard;

      // Mostrar siempre la fecha de nacimiento en la cabecera (Adultos y Niños/Adolescentes)
      const birthDateDisplay = bDate ? `Nacimiento: ${formatDisplayDate(bDate)}` : '';
      if (birthDateDisplay && sub) {
        sub.textContent += ` | ${birthDateDisplay}`;
      }

      if (isAdult) {
        const myIdStr = String(m.id).trim();
        // Buscar hijos menores registrados (por tutores) Y hijos adultos registrados (por padre / madre)
        const myMinorKids = children.filter(c => 
          (c.tutor1Id && String(c.tutor1Id).trim() === myIdStr) || 
          (c.idTutor1 && String(c.idTutor1).trim() === myIdStr) ||
          (c.tutor2Id && String(c.tutor2Id).trim() === myIdStr) ||
          (c.idTutor2 && String(c.idTutor2).trim() === myIdStr)
        );

        const myAdultKids = adults.filter(a => 
          String(a.id).trim() !== myIdStr && (
            (a.idPadre && String(a.idPadre).trim() === myIdStr) ||
            (a.fatherId && String(a.fatherId).trim() === myIdStr) ||
            (a.idMadre && String(a.idMadre).trim() === myIdStr) ||
            (a.motherId && String(a.motherId).trim() === myIdStr)
          )
        );

        const allMyKids = [
          ...myAdultKids.map(a => ({
            name: a.fullName || a.nombreCompleto,
            bDate: a.birthDate || a.fechaNacimiento,
            isDec: (a.isDeceased === 'Sí' || a.fallecido === 'Sí'),
            decDate: a.deceasedDate || a.fechaDefuncion,
            badgeText: 'Adulto',
            badgeCls: 'bg-indigo-100 text-indigo-800 border border-indigo-200'
          })),
          ...myMinorKids.map(k => {
            const isDec = (k.isDeceased === 'Sí' || k.fallecido === 'Sí');
            const st = getMinorStage(k.birthDate || k.fechaNacimiento, isDec ? 'Sí' : 'No', k.deceasedDate || k.fechaDefuncion);
            return {
              name: k.fullName || k.nombreCompleto,
              bDate: k.birthDate || k.fechaNacimiento,
              isDec: isDec,
              decDate: k.deceasedDate || k.fechaDefuncion,
              badgeText: st.label,
              badgeCls: st.badgeClass
            };
          })
        ];

        const kidsHtml = allMyKids.length > 0 
          ? allMyKids.map(k => `<li class="font-semibold text-amber-900">${escapeHtml(k.name)} <span class="inline-block text-[10px] font-bold px-1.5 py-0.2 rounded-full ${k.badgeCls}">${escapeHtml(k.badgeText)}</span> <span class="text-[11px] font-normal text-amber-700">(${calculateAgeVerbose(k.bDate, k.isDec ? 'Sí' : 'No', k.decDate)} · Nac: ${escapeHtml(formatDisplayDate(k.bDate))}) ${k.isDec ? '[Fallecido]' : ''}</span></li>`).join('') 
          : '<li class="text-slate-400">Sin hijos registrados en el sistema</li>';

        let spName = 'No aplica / Soltero(a)';
        const marital = m.maritalStatus || m.estadoCivil;
        if (['Casado(a)', 'Unión de Hecho'].includes(marital)) {
          const spId = m.spouseId || m.idConyuge;
          const spMem = m.spouseIsMember || m.conyugeEsMiembro;
          const spObj = adults.find(a => String(a.id).trim() === String(spId).trim());
          spName = spMem ? (spObj ? (spObj.nombreCompleto || spObj.fullName) : 'Miembro no localizado') : (m.spouseText || m.nombreConyugeTexto || 'No especificado');
        }

        const fatId = m.fatherId || m.idPadre;
        const fatMem = m.fatherIsMember || m.padreEsMiembro;
        const fatObj = adults.find(a => String(a.id).trim() === String(fatId).trim());
        const fatName = fatMem ? (fatObj ? (fatObj.nombreCompleto || fatObj.fullName) : 'Miembro no localizado') : (m.fatherText || m.nombrePadreTexto || 'No registrado');

        const motId = m.motherId || m.idMadre;
        const motMem = m.motherIsMember || m.madreEsMiembro;
        const motObj = adults.find(a => String(a.id).trim() === String(motId).trim());
        const motName = motMem ? (motObj ? (motObj.nombreCompleto || motObj.fullName) : 'Miembro no localizado') : (m.motherText || m.nombreMadreTexto || 'No registrada');

        const familyCard = document.createElement('div');
        familyCard.className = 'bg-amber-50 p-4 rounded-2xl border border-amber-200';
        familyCard.innerHTML = `
          <h4 class="font-bold text-amber-800 mb-2 border-b border-amber-300 pb-1"><i class="fa-solid fa-people-roof"></i> Familia y Vínculos</h4>
          <p class="text-xs mb-1"><strong>Cónyuge:</strong> ${escapeHtml(spName)}</p>
          <p class="text-xs mb-1"><strong>Padre:</strong> ${escapeHtml(fatName)}</p>
          <p class="text-xs mb-2"><strong>Madre:</strong> ${escapeHtml(motName)}</p>
          <p class="text-xs font-bold text-amber-900 mb-1">Hijos Registrados (${allMyKids.length} — ${myAdultKids.length} Adulto(s), ${myMinorKids.length} Menor(es)):</p>
          <ul class="text-xs list-disc list-inside space-y-1 text-amber-800">${kidsHtml}</ul>
        `;
        grid.appendChild(familyCard);

        if (isAdmin) {
          const myContribs = contributions.filter(ct => String(ct.memberId || ct.idMiembro).trim() === String(m.id).trim());
          const totalContrib = myContribs.reduce((acc, c) => acc + (parseFloat(c.amount || c.monto) || 0), 0);
          const contribListHtml = myContribs.length > 0 
            ? myContribs.slice(0, 5).map(c => `<li>${escapeHtml(formatDisplayDate(c.date || c.fecha))} - <strong>${escapeHtml(c.type || c.tipoContribucion)}</strong>: ${formatCurrency((parseFloat(c.amount || c.monto) || 0))}</li>`).join('') 
            : '<li class="text-slate-400">Sin aportes registrados</li>';

          const financeCard = document.createElement('div');
          financeCard.className = 'bg-emerald-50 p-4 rounded-2xl border border-emerald-200';
          financeCard.innerHTML = `
            <h4 class="font-bold text-emerald-800 mb-2 border-b border-emerald-300 pb-1 flex justify-between items-center">
              <span><i class="fa-solid fa-hand-holding-dollar"></i> Contribuciones</span>
              <span class="text-xs font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">Total: ${formatCurrency(totalContrib)}</span>
            </h4>
            <ul class="text-xs space-y-1 text-emerald-800">${contribListHtml}</ul>
          `;
          grid.appendChild(financeCard);
        }

      } else {
        const t1Id = m.tutor1Id || m.idTutor1;
        const t1Mem = m.tutor1IsMember || m.tutor1EsMiembro;
        const t1Obj = t1Mem ? adults.find(a => String(a.id).trim() === String(t1Id).trim()) : null;
        const t1Name = t1Obj ? `${t1Obj.fullName || t1Obj.nombreCompleto} (Tel: ${t1Obj.phone || t1Obj.telefono || 'S/N'})` : (m.tutor1Text || m.nombreTutor1Texto || 'No asignado');

        const t2Id = m.tutor2Id || m.idTutor2;
        const t2Mem = m.tutor2IsMember || m.tutor2EsMiembro;
        const t2Obj = t2Mem ? adults.find(a => String(a.id).trim() === String(t2Id).trim()) : null;
        const t2Name = t2Obj ? `${t2Obj.fullName || t2Obj.nombreCompleto} (Tel: ${t2Obj.phone || t2Obj.telefono || 'S/N'})` : (m.tutor2Text || m.nombreTutor2Texto || 'No registrado');

        const pres = (m.presentedToChurch || m.presentado);
        const presText = pres 
          ? `Presentado por ${escapeHtml(m.presentedBy || m.presentadoPor || 'Pastor')} el ${escapeHtml(formatDisplayDate(m.presentedDate || m.fechaPresentacion || m.joinDate || m.fechaIngreso))}` 
          : 'No presentado en dedicación';

        const tutorCard = document.createElement('div');
        tutorCard.className = 'col-span-1 sm:col-span-2 bg-teal-50 p-4 rounded-xl border border-teal-200';
        tutorCard.innerHTML = `
          <h4 class="font-bold text-teal-800 mb-2 border-b border-teal-300 pb-1"><i class="fa-solid fa-shield-cat"></i> Tutores Legales Asignados</h4>
          <p class="text-xs mb-1"><strong>Tutor 1:</strong> ${escapeHtml(t1Name)}</p>
          <p class="text-xs mb-1"><strong>Tutor 2:</strong> ${escapeHtml(t2Name)}</p>
          <p class="text-xs mt-2 text-teal-900 border-t border-teal-200 pt-1"><strong>Dedicación Eclesiástica:</strong> ${presText}</p>
        `;
        grid.appendChild(tutorCard);
      }

      if (inDiscipline) {
        let statusText = 'Indefinido';
        const isIndef = (m.disciplineIndefinite || m.disciplinaIndefinida);
        const endDateStr = m.disciplineEndDate || m.finDisciplina;

        if (!isIndef && endDateStr) {
          const endDate = parseDateSafe(endDateStr);
          const today = parseDateSafe(getTodayLocalIsoDate());
          if (endDate && today) {
            const diff = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
            if (diff > 0) statusText = `En curso (Faltan ${diff} días)`;
            else if (diff === 0) statusText = `Vence HOY`;
            else statusText = `Período cumplido hace ${Math.abs(diff)} días`;
          }
        }

        const discCard = document.createElement('div');
        discCard.className = 'col-span-1 sm:col-span-2 bg-rose-50 p-4 rounded-2xl border border-rose-200 text-rose-900 shadow-sm';
        discCard.innerHTML = `
          <h4 class="font-bold mb-2 border-b border-rose-300 pb-1 flex items-center justify-between">
            <span><i class="fa-solid fa-scale-balanced mr-1.5"></i> Seguimiento de Disciplina Pastoral</span>
            <span class="text-[11px] font-extrabold bg-rose-200 text-rose-900 px-2.5 py-0.5 rounded-full">${statusText}</span>
          </h4>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
            <p><strong>Fecha Inicio:</strong> ${escapeHtml(formatDisplayDate(m.disciplineDate || m.inicioDisciplina))}</p>
            <p><strong>Duración:</strong> ${isIndef ? 'Indefinido' : (escapeHtml(m.disciplineMonths || m.mesesCastigo || '0') + ' meses')}</p>
            <p><strong>Fecha Fin:</strong> ${isIndef ? 'Indefinido' : escapeHtml(formatDisplayDate(endDateStr))}</p>
            <p><strong>Estado:</strong> ${isIndef ? 'Sujeto a revisión pastoral' : 'Programado'}</p>
          </div>
          <p class="text-xs border-t border-rose-200 pt-1.5"><strong>Motivo / Observaciones:</strong> ${escapeHtml(m.disciplineReason || m.motivoDisciplina || 'Sin notas adicionales especificadas.')}</p>
        `;
        grid.appendChild(discCard);
      }

      container.appendChild(grid);
      document.getElementById('memberModal').classList.replace('hidden', 'flex');
    }

    function showFormPhoto(src) {
      document.getElementById('photoPreview').src = src;
      document.getElementById('photoPreview').classList.remove('hidden');
      document.getElementById('photoPlaceholder').classList.add('hidden');
    }

    function loadPhotoIntoForm(photoRef) {
      if (!photoRef) return;
      if (photoRef.startsWith('DRIVE_FILE:')) {
        currentPhotoBase64 = photoRef;
        resolvePhotoUrl(photoRef).then(dataUri => { if (dataUri) showFormPhoto(dataUri); });
      } else if (photoRef.startsWith('data:image/')) {
        currentPhotoBase64 = photoRef;
        showFormPhoto(photoRef);
      } else {
        const safeUrl = sanitizeDriveUrl(photoRef);
        if (safeUrl) {
          currentPhotoBase64 = safeUrl;
          showFormPhoto(safeUrl);
        }
      }
    }

    function editMember(id, type) {
      cancelEditMember(type); 
      const isAdult = (type === 'Adulto');
      const m = isAdult ? adults.find(a => String(a.id).trim() === String(id).trim()) : children.find(c => String(c.id).trim() === String(id).trim());
      if (!m) return;

      setMemberType(type);
      document.getElementById('memberId').value = m.id;
      document.getElementById('fullName').value = m.fullName || m.nombreCompleto || '';
      document.getElementById('gender').value = m.gender || m.genero || 'Masculino';
      document.getElementById('birthDate').value = (m.birthDate || m.fechaNacimiento || '').split('T')[0];
      document.getElementById('birthPlace').value = m.birthPlace || m.lugarNacimiento || '';
      document.getElementById('phone').value = m.phone || m.telefono || '';
      document.getElementById('address').value = m.address || m.direccion || '';
      document.getElementById('educationLevel').value = m.educationLevel || m.escolaridad || '';
      document.getElementById('category').value = m.category || m.categoria || 'Activo';
      document.getElementById('conversionType').value = m.conversionType || m.tipoConversion || '';
      document.getElementById('joinDate').value = (m.joinDate || m.fechaIngreso || '').split('T')[0];
      document.getElementById('isBaptized').value = m.isBaptized || m.bautizado || 'No';
      document.getElementById('baptismDate').value = (m.baptismDate || m.fechaBautismo || '').split('T')[0];
      document.getElementById('baptismPlace').value = m.baptismPlace || m.lugarBautismo || '';
      document.getElementById('isDeceased').value = m.isDeceased || m.fallecido || 'No';
      document.getElementById('deceasedDate').value = (m.deceasedDate || m.fechaDefuncion || '').split('T')[0];
      document.getElementById('inDiscipline').value = m.inDiscipline || m.enDisciplina || 'No';
      document.getElementById('disciplineDate').value = (m.disciplineDate || m.inicioDisciplina || '').split('T')[0];
      document.getElementById('disciplineMonths').value = m.disciplineMonths || m.mesesCastigo || '';
      document.getElementById('disciplineEndDate').value = (m.disciplineEndDate || m.finDisciplina || '').split('T')[0];
      document.getElementById('disciplineIndefinite').checked = !!(m.disciplineIndefinite || m.disciplinaIndefinida);
      document.getElementById('disciplineReason').value = m.disciplineReason || m.motivoDisciplina || '';

      document.getElementById('baptismBox').classList.toggle('hidden', document.getElementById('isBaptized').value !== 'Sí');
      document.getElementById('deceasedBox').classList.toggle('hidden', document.getElementById('isDeceased').value !== 'Sí');

      if (isAdult) {
        document.getElementById('idNumber').value = m.idNumber || m.cedula || '';
        document.getElementById('maritalStatus').value = m.maritalStatus || m.estadoCivil || 'Soltero(a)';
        document.getElementById('spouseIsMember').checked = !!(m.spouseIsMember || m.conyugeEsMiembro);
        document.getElementById('fatherIsMember').checked = !!(m.fatherIsMember || m.padreEsMiembro);
        document.getElementById('motherIsMember').checked = !!(m.motherIsMember || m.madreEsMiembro);
        // Se cargan primero los vínculos guardados y luego se arman las listas con las reglas de
        // parentesco: si la ficha tenía un vínculo imposible (p. ej. la esposa también como madre),
        // se quita y se avisa el motivo.
        const cargarVinculo = (selId, esMiembro, idGuardado) => {
          const sel = document.getElementById(selId);
          const vid = esMiembro ? String(idGuardado || '').trim() : '';
          sel.innerHTML = vid ? `<option value="${escapeHtml(vid)}">${escapeHtml(vid)}</option>` : '<option value=""></option>';
          sel.value = vid;
        };
        cargarVinculo('spouseSelect', m.spouseIsMember || m.conyugeEsMiembro, m.spouseId || m.idConyuge);
        cargarVinculo('fatherSelect', m.fatherIsMember || m.padreEsMiembro, m.fatherId || m.idPadre);
        cargarVinculo('motherSelect', m.motherIsMember || m.madreEsMiembro, m.motherId || m.idMadre);
        if (!(m.spouseIsMember || m.conyugeEsMiembro)) document.getElementById('spouseText').value = m.spouseText || m.nombreConyugeTexto || '';
        if (!(m.fatherIsMember || m.padreEsMiembro)) document.getElementById('fatherText').value = m.fatherText || m.nombrePadreTexto || '';
        if (!(m.motherIsMember || m.madreEsMiembro)) document.getElementById('motherText').value = m.motherText || m.nombreMadreTexto || '';
        populateSelectors();

        document.getElementById('ministryRole').value = m.ministryRole || m.ministerioCargo || '';
      } else {
        document.getElementById('idNumber').value = m.idNumber || m.cedula || '';
        document.getElementById('tutor1IsMember').checked = !!(m.tutor1IsMember || m.tutor1EsMiembro);
        document.getElementById('tutor2IsMember').checked = !!(m.tutor2IsMember || m.tutor2EsMiembro);
        populateSelectors();

        if (m.tutor1IsMember || m.tutor1EsMiembro) document.getElementById('tutor1Select').value = m.tutor1Id || m.idTutor1;
        else document.getElementById('tutor1Text').value = m.tutor1Text || m.nombreTutor1Texto || '';

        if (m.tutor2IsMember || m.tutor2EsMiembro) document.getElementById('tutor2Select').value = m.tutor2Id || m.idTutor2;
        else document.getElementById('tutor2Text').value = m.tutor2Text || m.nombreTutor2Texto || '';

        document.getElementById('presentedToChurch').checked = !!(m.presentedToChurch || m.presentado);
        document.getElementById('presentedBy').value = m.presentedBy || m.presentadoPor || '';
        document.getElementById('presentedDate').value = (m.presentedDate || m.fechaPresentacion || '').split('T')[0];
      }

      loadPhotoIntoForm(m.photoBase64 || m.fotoUrl);

      updateAgePreview();
      toggleAdultFamily();
      toggleChildFamily();
      toggleDisciplineAvailability();
      calcDisciplineEnd();
      document.getElementById('formHeaderTitle').textContent = `Editar ${type}: ${m.fullName || m.nombreCompleto}`;
      setFormIdBadge(m.id);
      switchTab('registro');
    }

