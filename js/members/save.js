    // ────────────────────────────────────────────────────────────────────
    // GUARDADO Y LIMPIEZA PROFUNDA
    // ────────────────────────────────────────────────────────────────────

    // Las reglas de validación (constantes, nombres, teléfono, cédula, fechas, disciplina...) viven en js/core/validators.js

    async function handleMemberFormSubmit(e) {
      e.preventDefault();
      const summary = document.getElementById('validationSummary');
      const list = document.getElementById('validationList');
      list.innerHTML = '';
      summary.classList.add('hidden');

      const errors = [];
      const type = document.getElementById('memberType').value;
      const id = document.getElementById('memberId').value || '';
      const fullName = document.getElementById('fullName').value.trim();
      const birthDateStr = document.getElementById('birthDate').value;
      const joinDateStr = document.getElementById('joinDate').value;
      const isBaptized = document.getElementById('isBaptized').value === 'Sí';
      const baptismDateStr = document.getElementById('baptismDate').value;
      const isDeceased = document.getElementById('isDeceased').value === 'Sí';
      const deceasedDateStr = document.getElementById('deceasedDate').value;
      const inDiscipline = document.getElementById('inDiscipline').value === 'Sí';
      const disciplineDateStr = document.getElementById('disciplineDate').value;

      const birthDate = parseDateSafe(birthDateStr);
      const todayIso = getTodayLocalIsoDate();
      const categoryVal = document.getElementById('category').value;

      errors.push(...validateMemberBasics({
        fullName, phone: document.getElementById('phone').value.trim(), birth: birthDateStr, join: joinDateStr
      }, todayIso));

      const memberAgeYears = birthDate ? calculateAgeYears(birthDateStr, isDeceased ? 'Sí' : 'No', deceasedDateStr) : 0;
      const promotingChildIdCheck = (document.getElementById('promotingFromChildId').value || '').trim();

      errors.push(...validateBaptism({ isBaptized, baptism: baptismDateStr, birth: birthDateStr }, todayIso));
      errors.push(...validateDeceased({
        isDeceased, deceased: deceasedDateStr, birth: birthDateStr, join: joinDateStr, isBaptized, baptism: baptismDateStr
      }, todayIso));
      errors.push(...validateDiscipline({
        inDiscipline, isBaptized, isDeceased, category: categoryVal, start: disciplineDateStr,
        end: document.getElementById('disciplineEndDate').value,
        months: document.getElementById('disciplineMonths').value,
        indefinite: document.getElementById('disciplineIndefinite').checked,
        birth: birthDateStr, baptism: baptismDateStr
      }, todayIso));

      if (type === 'Adulto' && birthDate && memberAgeYears < MIN_ADULT_MEMBER_AGE) {
        errors.push(`Solo las personas de ${MIN_ADULT_MEMBER_AGE} años o más pueden registrarse como Adulto. Esta persona tiene ${memberAgeYears} año(s): regístrala en "Menor / Joven".`);
      }
      if (type === 'Adulto') {
        const idNumber = (memberAgeYears >= MIN_CEDULA_AGE) ? document.getElementById('idNumber').value.trim().toUpperCase() : '';
        if (memberAgeYears >= MIN_CEDULA_AGE) {
          const cedErrors = validateCedula(idNumber, birthDateStr);
          errors.push(...cedErrors);
          if (CEDULA_REGEX.test(idNumber)) {
            const dupAdult = adults.find(a => (a.idNumber || a.cedula || '').toUpperCase() === idNumber && String(a.id).trim() !== String(id).trim());
            if (dupAdult) errors.push(`La cédula ya está registrada en Adultos a nombre de: ${dupAdult.fullName || dupAdult.nombreCompleto}`);
            const dupMinor = children.find(c => (c.idNumber || c.cedula || '').toUpperCase() === idNumber && String(c.id).trim() !== promotingChildIdCheck);
            if (dupMinor) errors.push(`La cédula ya está registrada en Jóvenes a nombre de: ${dupMinor.fullName || dupMinor.nombreCompleto}`);
          }
        }

        const fatId = document.getElementById('fatherSelect').value;
        const motId = document.getElementById('motherSelect').value;
        if (document.getElementById('fatherIsMember').checked && document.getElementById('motherIsMember').checked && fatId && motId && fatId === motId) {
          errors.push("El Padre y la Madre no pueden ser la misma persona.");
        }

        const maritalValCheck = document.getElementById('maritalStatus').value;
        const isMarriedCheck = (maritalValCheck === 'Casado(a)' || maritalValCheck === 'Unión de Hecho');
        const spIdCheck = (isMarriedCheck && document.getElementById('spouseIsMember').checked)
          ? String(document.getElementById('spouseSelect').value || '').trim()
          : '';
        const fatIdCheck = document.getElementById('fatherIsMember').checked ? String(fatId || '').trim() : '';
        const motIdCheck = document.getElementById('motherIsMember').checked ? String(motId || '').trim() : '';

        const tempId = String(id || '__NEW_MEMBER__').trim();
        const kinshipMap = buildAdultsKinshipMap({
          id: tempId,
          padreEsMiembro: Boolean(fatIdCheck),
          idPadre: fatIdCheck,
          madreEsMiembro: Boolean(motIdCheck),
          idMadre: motIdCheck
        });

        // Casillas marcadas sin persona elegida, y nombres escritos a mano
        if (isMarriedCheck && document.getElementById('spouseIsMember').checked && !spIdCheck) {
          errors.push("Marcaste que el cónyuge es miembro: búscalo y elígelo en la lista, o desmarca la casilla.");
        }
        if (document.getElementById('fatherIsMember').checked && !fatIdCheck) {
          errors.push("Marcaste que el Padre es miembro: búscalo y elígelo en la lista, o desmarca la casilla.");
        }
        if (document.getElementById('motherIsMember').checked && !motIdCheck) {
          errors.push("Marcaste que la Madre es miembro: búscala y elígela en la lista, o desmarca la casilla.");
        }
        const textoNombre = (inputId, etiqueta, aplica) => {
          const v = aplica ? document.getElementById(inputId).value.trim() : '';
          errors.push(...validateOptionalName(v, etiqueta));
        };
        textoNombre('spouseText', 'del cónyuge', isMarriedCheck && !document.getElementById('spouseIsMember').checked);
        textoNombre('fatherText', 'del padre', !document.getElementById('fatherIsMember').checked);
        textoNombre('motherText', 'de la madre', !document.getElementById('motherIsMember').checked);

        // Padre y Madre: mismas reglas que las listas (no cónyuge, no hermano/a, no descendiente,
        // al menos 12 años mayor y género correcto)
        const ctxValida = {
          selfId: tempId, gender: String(document.getElementById('gender').value || '').trim().toLowerCase(),
          birthDate: birthDateStr, fatherId: fatIdCheck, motherId: motIdCheck, spouseId: spIdCheck, map: kinshipMap
        };
        if (fatIdCheck) {
          const fObj = adults.find(a => String(a.id).trim() === fatIdCheck);
          const motivo = fObj ? getInvalidParentReason(fObj, Object.assign({}, ctxValida, { rol: 'padre' })) : 'no está en el padrón activo';
          if (motivo) errors.push(`El Padre seleccionado no es válido: ${motivo}.`);
        }
        if (motIdCheck) {
          const mObj = adults.find(a => String(a.id).trim() === motIdCheck);
          const motivo = mObj ? getInvalidParentReason(mObj, Object.assign({}, ctxValida, { rol: 'madre' })) : 'no está en el padrón activo';
          if (motivo) errors.push(`La Madre seleccionada no es válida: ${motivo}.`);
        }

        if (spIdCheck) {
          const myGender = String(document.getElementById('gender').value || '').trim().toLowerCase();
          const spObj = adults.find(a => String(a.id).trim() === spIdCheck);
          const spGender = spObj ? String(spObj.gender || spObj.genero || '').trim().toLowerCase() : '';
          const spExistingId = spObj ? String(spObj.idConyuge || spObj.spouseId || '').trim() : '';
          const spHasMemberPartner = spObj ? Boolean(spObj.conyugeEsMiembro || spObj.spouseIsMember) : false;

          if (spObj && (spObj.isDeceased === 'Sí' || spObj.fallecido === 'Sí')) {
            errors.push("No se puede vincular como cónyuge a una persona fallecida.");
          } else if (spHasMemberPartner && spExistingId && spExistingId !== String(id).trim()) {
            errors.push("Matrimonio bloqueado: el cónyuge seleccionado ya figura casado(a) con otro miembro.");
          } else if (spIdCheck === fatIdCheck || spIdCheck === motIdCheck) {
            errors.push("El cónyuge no puede ser el Padre ni la Madre del miembro.");
          } else if (spGender && myGender && spGender === myGender) {
            errors.push("Matrimonio bloqueado: el sistema solo permite uniones conyugales entre personas de distinto género.");
          } else if (isAncestorOf(spIdCheck, tempId, kinshipMap) || isAncestorOf(tempId, spIdCheck, kinshipMap)) {
            errors.push("Matrimonio bloqueado: existe un vínculo familiar directo (padre/madre, hijo/a, abuelo/a o nieto/a) entre ambos miembros.");
          } else if (areSiblings(tempId, spIdCheck, kinshipMap)) {
            errors.push("Matrimonio bloqueado: ambos miembros figuran registrados como hermanos.");
          }
        }
      } else {
        const idNumberMinor = (memberAgeYears >= MIN_CEDULA_AGE) ? document.getElementById('idNumber').value.trim().toUpperCase() : '';
        if (memberAgeYears >= MIN_CEDULA_AGE && idNumberMinor) {
          const cedErrors = validateCedula(idNumberMinor, birthDateStr);
          errors.push(...cedErrors);
          if (CEDULA_REGEX.test(idNumberMinor)) {
            const dupAdult = adults.find(a => (a.idNumber || a.cedula || '').toUpperCase() === idNumberMinor);
            if (dupAdult) errors.push(`La cédula ya está registrada en Adultos a nombre de: ${dupAdult.fullName || dupAdult.nombreCompleto}`);
            const dupMinor = children.find(c => (c.idNumber || c.cedula || '').toUpperCase() === idNumberMinor && String(c.id).trim() !== String(id).trim());
            if (dupMinor) errors.push(`La cédula ya está registrada en Jóvenes a nombre de: ${dupMinor.fullName || dupMinor.nombreCompleto}`);
          }
        }

        const isPresCheck = document.getElementById('presentedToChurch').checked;
        const presDateStr = document.getElementById('presentedDate').value;
        errors.push(...validatePresentation({ isPresented: isPresCheck, date: presDateStr, birth: birthDateStr }, todayIso));

        const t1IsMemCheck = document.getElementById('tutor1IsMember').checked;
        const t1Id = document.getElementById('tutor1Select').value;
        const t1Txt = document.getElementById('tutor1Text').value.trim();
        const t2Id = document.getElementById('tutor2Select').value;
        const t2IsMemCheck = document.getElementById('tutor2IsMember').checked;
        if (t1IsMemCheck && !t1Id) errors.push("Selecciona al Tutor 1 (Miembro Adulto).");
        if (!t1IsMemCheck && !t1Txt) errors.push("Ingresa el nombre del Tutor 1.");
        if (!t1IsMemCheck) errors.push(...validateOptionalName(t1Txt, 'del Tutor 1'));
        if (t2IsMemCheck && !t2Id) errors.push("Marcaste que el Tutor 2 es miembro: búscalo y elígelo en la lista, o desmarca la casilla.");
        const t2Txt = document.getElementById('tutor2Text').value.trim();
        if (!t2IsMemCheck) errors.push(...validateOptionalName(t2Txt, 'del Tutor 2'));
        if (t1IsMemCheck && t2IsMemCheck && t1Id && t2Id && t1Id === t2Id) {
          errors.push("Tutor 1 y Tutor 2 no pueden ser el mismo miembro.");
        }
        // Un tutor legal debe ser mayor de edad (18+)
        [[t1IsMemCheck, t1Id, 'Tutor 1'], [t2IsMemCheck, t2Id, 'Tutor 2']].forEach(([esMiembro, tid, etiqueta]) => {
          if (!esMiembro || !tid) return;
          const t = adults.find(a => String(a.id).trim() === String(tid).trim());
          const edadT = t ? calculateAgeYears(t.birthDate || t.fechaNacimiento, 'No', '') : null;
          if (t && (t.birthDate || t.fechaNacimiento) && edadT < MIN_GUARDIAN_AGE) errors.push(`${etiqueta} debe ser mayor de edad (${MIN_GUARDIAN_AGE} años o más).`);
        });
      }

      if (errors.length > 0) {
        errors.forEach(err => {
          const li = document.createElement('li');
          li.textContent = err;
          list.appendChild(li);
        });
        summary.classList.remove('hidden');
        window.scrollTo({ top: summary.offsetTop - 80, behavior: 'smooth' });
        return;
      }

      showSaving("Guardando ficha y procesando fotografía...");

      try {
        let payloadData;
        const finalDiscipline = (isBaptized && !isDeceased && categoryVal !== 'Inactivo' && inDiscipline) ? 'Sí' : 'No';

        // Registro nuevo: id vacío, el servidor genera uno único
        const finalId = id;
        const fotoFinal = currentPhotoBase64;

        if (type === 'Adulto') {
          const maritalVal = document.getElementById('maritalStatus').value;
          const isMarried = (maritalVal === 'Casado(a)' || maritalVal === 'Unión de Hecho');
          const spIsMem = isMarried && document.getElementById('spouseIsMember').checked;
          const fatIsMem = document.getElementById('fatherIsMember').checked;
          const motIsMem = document.getElementById('motherIsMember').checked;

          payloadData = {
            id: finalId,
            nombreCompleto: fullName,
            cedula: (memberAgeYears >= 16) ? document.getElementById('idNumber').value.trim().toUpperCase() : '',
            lugarNacimiento: document.getElementById('birthPlace').value.trim(),
            genero: document.getElementById('gender').value,
            fechaNacimiento: birthDateStr,
            estadoCivil: maritalVal,
            conyugeEsMiembro: spIsMem,
            idConyuge: spIsMem ? document.getElementById('spouseSelect').value : '',
            nombreConyugeTexto: (isMarried && !spIsMem) ? document.getElementById('spouseText').value.trim() : '',
            padreEsMiembro: fatIsMem,
            idPadre: fatIsMem ? document.getElementById('fatherSelect').value : '',
            nombrePadreTexto: !fatIsMem ? document.getElementById('fatherText').value.trim() : '',
            madreEsMiembro: motIsMem,
            idMadre: motIsMem ? document.getElementById('motherSelect').value : '',
            nombreMadreTexto: !motIsMem ? document.getElementById('motherText').value.trim() : '',
            escolaridad: document.getElementById('educationLevel').value,
            telefono: document.getElementById('phone').value.trim(),
            direccion: document.getElementById('address').value.trim(),
            categoria: document.getElementById('category').value,
            tipoConversion: document.getElementById('conversionType').value,
            fechaIngreso: joinDateStr,
            ministerioCargo: document.getElementById('ministryRole').value.trim(),
            bautizado: document.getElementById('isBaptized').value,
            fechaBautismo: isBaptized ? baptismDateStr : '',
            lugarBautismo: isBaptized ? document.getElementById('baptismPlace').value.trim() : '',
            fallecido: document.getElementById('isDeceased').value,
            fechaDefuncion: isDeceased ? deceasedDateStr : '',
            enDisciplina: finalDiscipline,
            inicioDisciplina: finalDiscipline === 'Sí' ? disciplineDateStr : '',
            mesesCastigo: finalDiscipline === 'Sí' ? document.getElementById('disciplineMonths').value : '',
            finDisciplina: finalDiscipline === 'Sí' ? document.getElementById('disciplineEndDate').value : '',
            disciplinaIndefinida: finalDiscipline === 'Sí' ? document.getElementById('disciplineIndefinite').checked : false,
            motivoDisciplina: finalDiscipline === 'Sí' ? document.getElementById('disciplineReason').value.trim() : '',
            fotoUrl: fotoFinal,
            eliminado: false,
            isDeleted: false
          };
        } else {
          const t1IsMem = document.getElementById('tutor1IsMember').checked;
          const t2IsMem = document.getElementById('tutor2IsMember').checked;
          const isPres = document.getElementById('presentedToChurch').checked;

          payloadData = {
            id: finalId,
            nombreCompleto: fullName,
            cedula: (memberAgeYears >= 16) ? document.getElementById('idNumber').value.trim().toUpperCase() : '',
            genero: document.getElementById('gender').value,
            fechaNacimiento: birthDateStr,
            lugarNacimiento: document.getElementById('birthPlace').value.trim(),
            tutor1EsMiembro: t1IsMem,
            idTutor1: t1IsMem ? document.getElementById('tutor1Select').value : '',
            nombreTutor1Texto: !t1IsMem ? document.getElementById('tutor1Text').value.trim() : '',
            tutor2EsMiembro: t2IsMem,
            idTutor2: t2IsMem ? document.getElementById('tutor2Select').value : '',
            nombreTutor2Texto: !t2IsMem ? document.getElementById('tutor2Text').value.trim() : '',
            presentado: isPres,
            presentadoPor: isPres ? document.getElementById('presentedBy').value.trim() : '',
            fechaPresentacion: isPres ? document.getElementById('presentedDate').value : '',
            escolaridad: document.getElementById('educationLevel').value,
            direccion: document.getElementById('address').value.trim(),
            telefono: document.getElementById('phone').value.trim(),
            categoria: document.getElementById('category').value,
            tipoConversion: (memberAgeYears >= 11) ? document.getElementById('conversionType').value : '',
            fechaIngreso: joinDateStr,
            bautizado: document.getElementById('isBaptized').value,
            fechaBautismo: isBaptized ? baptismDateStr : '',
            lugarBautismo: isBaptized ? document.getElementById('baptismPlace').value.trim() : '',
            enDisciplina: finalDiscipline,
            inicioDisciplina: finalDiscipline === 'Sí' ? disciplineDateStr : '',
            mesesCastigo: finalDiscipline === 'Sí' ? document.getElementById('disciplineMonths').value : '',
            finDisciplina: finalDiscipline === 'Sí' ? document.getElementById('disciplineEndDate').value : '',
            disciplinaIndefinida: finalDiscipline === 'Sí' ? document.getElementById('disciplineIndefinite').checked : false,
            motivoDisciplina: finalDiscipline === 'Sí' ? document.getElementById('disciplineReason').value.trim() : '',
            fallecido: document.getElementById('isDeceased').value,
            fechaDefuncion: isDeceased ? deceasedDateStr : '',
            fotoUrl: fotoFinal,
            eliminado: false,
            isDeleted: false
          };
        }

        const promotingChildId = (document.getElementById('promotingFromChildId').value || '').trim();
        const isPromoting = (type === 'Adulto' && Boolean(promotingChildId));
        if (isPromoting) {
          payloadData.promotingFromChildId = promotingChildId;
        }

        const actionName = isPromoting ? 'promoteChildToAdult' : ((type === 'Adulto') ? 'saveAdult' : 'saveChild');
        const saveRes = await fetchAPI(actionName, payloadData);
        if (saveRes.status !== 'ok') throw new Error(saveRes.message || 'No se pudo guardar la ficha.');

        const savedId = String(saveRes.id || finalId).trim();
        const savedRecord = saveRes.record || { ...payloadData, id: savedId };
        const lista = (type === 'Adulto') ? adults : children;
        const pos = lista.findIndex(x => String(x.id).trim() === savedId);
        const fichaAnterior = pos >= 0 ? lista[pos] : null;
        const afectaOtrasFichas = (type === 'Adulto') && involvesSpouseRelation(fichaAnterior, savedRecord, savedId);
        if (pos >= 0) lista[pos] = savedRecord; else lista.push(savedRecord);

        if (isPromoting) {
          children = children.filter(c => String(c.id).trim() !== promotingChildId);
          setActiveDirectoryTab('Adultos');
          showToast("¡Traspaso completado! El registro fue trasladado a Adultos y eliminado de Jóvenes.");
        } else {
          showToast("Ficha guardada exitosamente en Firestore.");
        }

        cancelEditMember('Adulto');
        switchTab('directorio');
        updateAllViews();
        // El servidor solo modifica OTRAS fichas al cambiar vínculos de cónyuge; en ese caso se
        // descarga la base para traerlas. En los demás guardados basta el registro devuelto.
        if (afectaOtrasFichas) syncFromCloud(false);

      } catch (err) {
        showToast(err.message, "error");
        console.error("Error guardando:", err);
      } finally {
        hideSaving();
      }
    }

    // ¿El guardado de este adulto toca la ficha de su cónyuge (actual, anterior o quien lo tenga como cónyuge)?
    function involvesSpouseRelation(anterior, nuevo, id) {
      const conyugeDe = (r) => r ? String(r.idConyuge || r.spouseId || '').trim() : '';
      if (conyugeDe(anterior) || conyugeDe(nuevo)) return true;
      return adults.some(a => String(a.id).trim() !== id && conyugeDe(a) === id);
    }

    function cancelEditMember(targetType = 'Adulto') {
      document.getElementById('memberForm').reset();
      const textFields = [
        'memberId', 'fullName', 'idNumber', 'birthDate', 'agePreview', 'birthPlace', 
        'phone', 'address', 'ministryRole', 'baptismDate', 'baptismPlace', 
        'deceasedDate', 'disciplineDate', 'disciplineMonths', 'disciplineEndDate', 
        'disciplineReason', 'spouseText', 'fatherText', 'motherText', 
        'tutor1Text', 'tutor2Text', 'presentedBy', 'presentedDate'
      ];
      textFields.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });

      const checkboxes = [
        'spouseIsMember', 'fatherIsMember', 'motherIsMember', 
        'tutor1IsMember', 'tutor2IsMember', 'presentedToChurch', 'disciplineIndefinite'
      ];
      checkboxes.forEach(id => { const el = document.getElementById(id); if(el) el.checked = (id === 'tutor1IsMember'); });

      const selects = [
        { id: 'gender', val: 'Masculino' },
        { id: 'maritalStatus', val: 'Soltero(a)' },
        { id: 'educationLevel', val: 'Preescolar' },
        { id: 'category', val: 'Activo' },
        { id: 'conversionType', val: '' },
        { id: 'isBaptized', val: 'No' },
        { id: 'isDeceased', val: 'No' },
        { id: 'inDiscipline', val: 'No' }
      ];
      selects.forEach(s => { const el = document.getElementById(s.id); if(el) el.value = s.val; });

      document.getElementById('spouseSelect').innerHTML = '';
      document.getElementById('fatherSelect').innerHTML = '';
      document.getElementById('motherSelect').innerHTML = '';
      document.getElementById('tutor1Select').innerHTML = '';
      document.getElementById('tutor2Select').innerHTML = '';

      document.getElementById('formHeaderTitle').textContent = 'Ficha de Registro';
      setFormIdBadge('');
      currentPhotoBase64 = '';
      document.getElementById('photoPreview').src = '';
      document.getElementById('photoPreview').classList.add('hidden');
      document.getElementById('photoPlaceholder').classList.remove('hidden');
      document.getElementById('validationSummary').classList.add('hidden');
      document.getElementById('baptismBox').classList.add('hidden');
      document.getElementById('deceasedBox').classList.add('hidden');
      document.getElementById('disciplineSection').classList.add('hidden');
      document.getElementById('disciplineBox').classList.add('hidden');
      const promInput = document.getElementById('promotingFromChildId');
      if (promInput) promInput.value = '';
      const promBanner = document.getElementById('promoteBanner');
      if (promBanner) promBanner.classList.add('hidden');
      
      setMemberType(targetType);
    }

