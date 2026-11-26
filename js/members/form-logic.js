// ────────────────────────────────────────────────────────────────────
// LÓGICA DE FORMULARIO: EDAD Y DISCIPLINA
// ────────────────────────────────────────────────────────────────────

function syncIdentityAndFaithFieldVisibility() {
  const type = document.getElementById('memberType').value;
  const isAdult = type === 'Adulto';
  const bDate = document.getElementById('birthDate').value;
  const isDec = document.getElementById('isDeceased').value;
  const decDate = document.getElementById('deceasedDate').value;
  const ageYears = bDate ? calculateAgeYears(bDate, isDec, decDate) : null;

  const cedContainer = document.getElementById('cedulaContainer');
  const cedInput = document.getElementById('idNumber');
  const cedLabel = document.getElementById('cedulaLabel');

  // El campo Cédula aplica ÚNICAMENTE para personas de 16 años a más
  const showCedula = isAdult ? ageYears === null || ageYears >= 16 : ageYears !== null && ageYears >= 16;

  if (cedContainer) cedContainer.classList.toggle('hidden', !showCedula);
  if (cedInput) cedInput.required = isAdult && showCedula;
  if (cedLabel) {
    cedLabel.textContent = isAdult ? 'Cédula *' : 'Cédula (Joven 16+)';
  }

  // Condición de Fe (Aceptación / Reconcilio): en Adultos siempre visible; en Menores únicamente para Adolescentes (11-15) y Jóvenes (16+)
  const convContainer = document.getElementById('conversionTypeContainer');
  const convSelect = document.getElementById('conversionType');
  const showConversion = isAdult || (ageYears !== null && ageYears >= 11);
  if (convContainer) {
    convContainer.classList.toggle('hidden', !showConversion);
  }
  if (!showConversion && convSelect) {
    convSelect.value = '';
  }
}

function updateAgePreview() {
  const bDate = document.getElementById('birthDate').value;
  if (bDate) {
    const isDec = document.getElementById('isDeceased').value;
    const decDate = document.getElementById('deceasedDate').value;
    let txt = calculateAgeVerbose(bDate, isDec, decDate);
    if (document.getElementById('memberType').value === 'Menor') {
      const st = getMinorStage(bDate, isDec, decDate);
      txt += ` (${st.label})`;
    }
    document.getElementById('agePreview').value = txt;
  } else {
    document.getElementById('agePreview').value = '';
  }
  syncIdentityAndFaithFieldVisibility();
}

function toggleDisciplineAvailability() {
  const isBaptized = document.getElementById('isBaptized').value === 'Sí';
  const isDeceased = document.getElementById('isDeceased').value === 'Sí';
  const isInactive = document.getElementById('category').value === 'Inactivo';
  const discSection = document.getElementById('disciplineSection');

  if (isBaptized && !isDeceased && !isInactive) {
    discSection.classList.remove('hidden');
  } else {
    discSection.classList.add('hidden');
    document.getElementById('inDiscipline').value = 'No';
    document.getElementById('disciplineDate').value = '';
    document.getElementById('disciplineMonths').value = '';
    document.getElementById('disciplineEndDate').value = '';
    document.getElementById('disciplineIndefinite').checked = false;
    document.getElementById('disciplineReason').value = '';
  }
  toggleDisciplineFields();
}

function toggleDisciplineFields() {
  const inDisc = document.getElementById('inDiscipline').value === 'Sí';
  document.getElementById('disciplineBox').classList.toggle('hidden', !inDisc);
}

function calcDisciplineEnd() {
  if (document.getElementById('disciplineIndefinite').checked) {
    document.getElementById('disciplineEndDate').value = '';
    document.getElementById('disciplineEndDate').disabled = true;
  } else {
    document.getElementById('disciplineEndDate').disabled = false;
    const dStr = document.getElementById('disciplineDate').value;
    const m = parseInt(document.getElementById('disciplineMonths').value, 10) || 0;
    const d = parseDateSafe(dStr);
    if (d && m > 0) {
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + m);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, lastDay));
      const y = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      document.getElementById('disciplineEndDate').value = `${y}-${mm}-${dd}`;
    }
  }
}

function toggleAdultFamily() {
  const marital = document.getElementById('maritalStatus').value;
  const spouseBox = document.getElementById('spouseBox');
  const isMarried = marital === 'Casado(a)' || marital === 'Unión de Hecho';
  spouseBox.classList.toggle('hidden', !isMarried);

  const spMem = document.getElementById('spouseIsMember').checked;
  document.getElementById('spouseSelect').classList.toggle('hidden', !spMem);
  document.getElementById('spouseText').classList.toggle('hidden', spMem);

  const fatMem = document.getElementById('fatherIsMember').checked;
  document.getElementById('fatherSelect').classList.toggle('hidden', !fatMem);
  document.getElementById('fatherText').classList.toggle('hidden', fatMem);

  const motMem = document.getElementById('motherIsMember').checked;
  document.getElementById('motherSelect').classList.toggle('hidden', !motMem);
  document.getElementById('motherText').classList.toggle('hidden', motMem);
}

function toggleChildFamily() {
  const t1Mem = document.getElementById('tutor1IsMember').checked;
  document.getElementById('tutor1Select').classList.toggle('hidden', !t1Mem);
  document.getElementById('tutor1Text').classList.toggle('hidden', t1Mem);

  const t2Mem = document.getElementById('tutor2IsMember').checked;
  document.getElementById('tutor2Select').classList.toggle('hidden', !t2Mem);
  document.getElementById('tutor2Text').classList.toggle('hidden', t2Mem);

  const pres = document.getElementById('presentedToChurch').checked;
  document.getElementById('presentedBy').classList.toggle('hidden', !pres);
  document.getElementById('presentedDate').classList.toggle('hidden', !pres);
}

function getParentIds(doc) {
  if (!doc) return { padre: '', madre: '' };
  const padre = doc.padreEsMiembro || doc.fatherIsMember ? String(doc.idPadre || doc.fatherId || '').trim() : '';
  const madre = doc.madreEsMiembro || doc.motherIsMember ? String(doc.idMadre || doc.motherId || '').trim() : '';
  return { padre, madre };
}

function buildAdultsKinshipMap(overrideRecord = null) {
  const map = new Map();
  adults.forEach((a) => map.set(String(a.id).trim(), a));
  if (overrideRecord && overrideRecord.id) {
    map.set(String(overrideRecord.id).trim(), overrideRecord);
  }
  return map;
}

function isAncestorOf(possibleAncestorId, personId, adultsMap) {
  if (!possibleAncestorId || !personId) return false;
  const target = String(possibleAncestorId).trim();
  const queue = [String(personId).trim()];
  const visited = new Set();

  while (queue.length > 0) {
    const curr = queue.shift();
    if (!curr || visited.has(curr)) continue;
    visited.add(curr);

    const doc = adultsMap.get(curr);
    if (!doc) continue;
    const { padre, madre } = getParentIds(doc);

    if (padre === target || madre === target) return true;
    if (padre && !visited.has(padre)) queue.push(padre);
    if (madre && !visited.has(madre)) queue.push(madre);
  }
  return false;
}

function areSiblings(idA, idB, adultsMap) {
  if (!idA || !idB || idA === idB) return false;
  const pA = getParentIds(adultsMap.get(idA));
  const pB = getParentIds(adultsMap.get(idB));
  return Boolean((pA.padre && pB.padre && pA.padre === pB.padre) || (pA.madre && pB.madre && pA.madre === pB.madre));
}

// ── Reglas de parentesco para las listas de Cónyuge, Padre y Madre ──
// Se aplican sobre lo que está seleccionado AHORA en el formulario (aunque no se haya guardado),
// para que no aparezcan como opción personas imposibles. El servidor valida lo mismo al guardar.

// Devuelve el motivo por el que "cand" NO puede ser padre/madre del miembro ('' si sí puede)
function getInvalidParentReason(cand, ctx) {
  const candId = String(cand.id).trim();
  const genero = String(cand.gender || cand.genero || '').trim();
  if (candId === ctx.selfId) return 'es el mismo miembro';
  if (ctx.rol === 'padre' && genero === 'Femenino') return 'figura con género femenino';
  if (ctx.rol === 'madre' && genero === 'Masculino') return 'figura con género masculino';
  // Su cónyuge (el elegido en el formulario o el que tiene registrado)
  if (ctx.spouseId && candId === ctx.spouseId) return 'es su cónyuge';
  const candSpouse = String(cand.spouseId || cand.idConyuge || '').trim();
  if (ctx.selfId && candSpouse === ctx.selfId) return 'figura como su cónyuge';
  // Sus descendientes (hijos, nietos…)
  if (isAncestorOf(ctx.selfId, candId, ctx.map)) return 'es su descendiente (hijo/a o nieto/a)';
  // Sus hermanos: comparten padre o madre con el miembro (por lo elegido en el formulario)
  const pCand = getParentIds(cand);
  if (
    (ctx.fatherId && pCand.padre === ctx.fatherId) ||
    (ctx.motherId && pCand.madre === ctx.motherId) ||
    areSiblings(ctx.selfId, candId, ctx.map)
  )
    return 'es su hermano/a';
  // El otro progenitor ya elegido no puede repetirse
  if (ctx.rol === 'padre' && ctx.motherId && candId === ctx.motherId) return 'ya es la madre';
  if (ctx.rol === 'madre' && ctx.fatherId && candId === ctx.fatherId) return 'ya es el padre';
  // Edad: el progenitor debe ser al menos 12 años mayor
  const nacCand = String(cand.birthDate || cand.fechaNacimiento || '').split('T')[0];
  if (ctx.birthDate && nacCand) {
    const dif = calculateIsoYearDiff(nacCand, ctx.birthDate);
    if (dif !== null && dif < MIN_PARENT_AGE_DIFF) return `no es al menos ${MIN_PARENT_AGE_DIFF} años mayor`;
  }
  return '';
}

// Devuelve el motivo por el que "cand" NO puede ser cónyuge del miembro ('' si sí puede)
function getInvalidSpouseReason(cand, ctx) {
  const candId = String(cand.id).trim();
  if (candId === ctx.selfId) return 'es el mismo miembro';
  if (cand.isDeceased === 'Sí' || cand.fallecido === 'Sí') return 'figura como fallecido/a';
  const candGender = String(cand.gender || cand.genero || '')
    .trim()
    .toLowerCase();
  if (ctx.gender && candGender && candGender === ctx.gender) return 'es del mismo género';
  const spouseId = String(cand.spouseId || cand.idConyuge || '').trim();
  if ((cand.spouseIsMember || cand.conyugeEsMiembro) && spouseId && spouseId !== ctx.selfId)
    return 'ya está casado/a con otro miembro';
  if (candId === ctx.fatherId) return 'es su padre';
  if (candId === ctx.motherId) return 'es su madre';
  if (isAncestorOf(candId, ctx.selfId, ctx.map)) return 'es su ascendiente (padre/madre o abuelo/a)';
  if (isAncestorOf(ctx.selfId, candId, ctx.map)) return 'es su descendiente (hijo/a o nieto/a)';
  const pCand = getParentIds(cand);
  if (
    (ctx.fatherId && pCand.padre === ctx.fatherId) ||
    (ctx.motherId && pCand.madre === ctx.motherId) ||
    areSiblings(ctx.selfId, candId, ctx.map)
  )
    return 'es su hermano/a';
  return '';
}

// Años completos entre dos fechas ISO (null si alguna no es válida)
function calculateIsoYearDiff(mayorIso, menorIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mayorIso) || !/^\d{4}-\d{2}-\d{2}$/.test(menorIso)) return null;
  const a = mayorIso.split('-').map(Number),
    b = menorIso.split('-').map(Number);
  let d = b[0] - a[0];
  if (b[1] < a[1] || (b[1] === a[1] && b[2] < a[2])) d--;
  return d;
}

// origen: campo que el usuario acaba de cambiar ('spouse' | 'father' | 'mother'); tiene prioridad
// si choca con otra selección. Al cargar una ficha se da prioridad al cónyuge.
function populateSelectors(origen) {
  if (origen !== 'father' && origen !== 'mother') origen = 'spouse';
  const currentId = String(document.getElementById('memberId').value || '').trim();
  const currentGender = String(document.getElementById('gender').value || '')
    .trim()
    .toLowerCase();

  const spouseSel = document.getElementById('spouseSelect');
  const fatherSel = document.getElementById('fatherSelect');
  const motherSel = document.getElementById('motherSelect');
  const tutor1Sel = document.getElementById('tutor1Select');
  const tutor2Sel = document.getElementById('tutor2Select');

  const prevSpouse = spouseSel.value;
  const prevFather = fatherSel.value;
  const prevMother = motherSel.value;
  const prevTutor1 = tutor1Sel.value;
  const prevTutor2 = tutor2Sel.value;

  // El miembro tal como está en el formulario (para un registro nuevo se usa un ID temporal)
  const selfId = currentId || '__registro_nuevo__';
  const marcado = (id) => document.getElementById(id).checked;
  const isAdultForm = document.getElementById('memberType').value === 'Adulto';
  const ctxBase = {
    selfId: selfId,
    gender: currentGender,
    birthDate: String(document.getElementById('birthDate').value || '').trim(),
    fatherId: isAdultForm && marcado('fatherIsMember') ? String(prevFather || '').trim() : '',
    motherId: isAdultForm && marcado('motherIsMember') ? String(prevMother || '').trim() : '',
    spouseId: isAdultForm && marcado('spouseIsMember') ? String(prevSpouse || '').trim() : ''
  };
  const rehacerMapa = () => {
    ctxBase.map = buildAdultsKinshipMap({
      id: selfId,
      fatherIsMember: Boolean(ctxBase.fatherId),
      fatherId: ctxBase.fatherId,
      motherIsMember: Boolean(ctxBase.motherId),
      motherId: ctxBase.motherId
    });
  };
  rehacerMapa();

  // Selecciones vigentes que chocan entre sí: se quita la que NO se acaba de elegir y se explica por qué
  const avisos = [];
  const campos = {
    spouse: { clave: 'spouseId', etiqueta: 'Cónyuge', motivo: (p) => getInvalidSpouseReason(p, ctxBase) },
    father: {
      clave: 'fatherId',
      etiqueta: 'Padre',
      motivo: (p) => getInvalidParentReason(p, Object.assign({}, ctxBase, { rol: 'padre' }))
    },
    mother: {
      clave: 'motherId',
      etiqueta: 'Madre',
      motivo: (p) => getInvalidParentReason(p, Object.assign({}, ctxBase, { rol: 'madre' }))
    }
  };
  const orden = ['spouse', 'father', 'mother'].filter((c) => c !== origen).concat(origen);
  orden.forEach((c) => {
    const campo = campos[c];
    const id = ctxBase[campo.clave];
    if (!id) return;
    const p = adults.find((a) => String(a.id).trim() === id);
    const motivo = p ? campo.motivo(p) : 'ya no está en el padrón activo';
    if (!motivo) return;
    ctxBase[campo.clave] = '';
    rehacerMapa();
    avisos.push(
      `${campo.etiqueta}: se quitó a ${p ? p.fullName || p.nombreCompleto : 'la persona elegida'} porque ${motivo}.`
    );
  });

  const eligibleSpouses = adults.filter((a) => !getInvalidSpouseReason(a, ctxBase));
  const posiblesPadres = adults.filter((a) => !getInvalidParentReason(a, Object.assign({}, ctxBase, { rol: 'padre' })));
  const posiblesMadres = adults.filter((a) => !getInvalidParentReason(a, Object.assign({}, ctxBase, { rol: 'madre' })));

  spouseSel.innerHTML =
    '<option value="">Seleccione Cónyuge...</option>' +
    eligibleSpouses
      .map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.fullName || a.nombreCompleto)}</option>`)
      .join('');
  const keepSpouse = ctxBase.spouseId || (marcado('spouseIsMember') ? '' : prevSpouse);
  if (keepSpouse && eligibleSpouses.some((a) => String(a.id) === String(keepSpouse))) {
    spouseSel.value = keepSpouse;
  }

  fatherSel.innerHTML =
    '<option value="">Seleccione al Padre...</option>' +
    posiblesPadres
      .map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.fullName || a.nombreCompleto)}</option>`)
      .join('');
  const keepFather = ctxBase.fatherId || (marcado('fatherIsMember') ? '' : prevFather);
  if (keepFather && posiblesPadres.some((a) => String(a.id) === String(keepFather))) {
    fatherSel.value = keepFather;
  }

  motherSel.innerHTML =
    '<option value="">Seleccione a la Madre...</option>' +
    posiblesMadres
      .map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.fullName || a.nombreCompleto)}</option>`)
      .join('');
  const keepMother = ctxBase.motherId || (marcado('motherIsMember') ? '' : prevMother);
  if (keepMother && posiblesMadres.some((a) => String(a.id) === String(keepMother))) {
    motherSel.value = keepMother;
  }

  if (avisos.length && typeof showToast === 'function') showToast(avisos.join(' '), 'error');

  // Tutores: vivos y mayores de edad
  const adultTutors = adults.filter((a) => {
    if (a.isDeceased === 'Sí' || a.fallecido === 'Sí') return false;
    const nac = a.birthDate || a.fechaNacimiento;
    return !nac || calculateAgeYears(nac, 'No', '') >= MIN_GUARDIAN_AGE;
  });
  tutor1Sel.innerHTML =
    '<option value="">Seleccione Tutor 1...</option>' +
    adultTutors
      .map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.fullName || a.nombreCompleto)}</option>`)
      .join('');
  if (prevTutor1 && adultTutors.some((a) => String(a.id) === String(prevTutor1))) {
    tutor1Sel.value = prevTutor1;
  }

  tutor2Sel.innerHTML =
    '<option value="">Seleccione Tutor 2...</option>' +
    adultTutors
      .map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.fullName || a.nombreCompleto)}</option>`)
      .join('');
  if (prevTutor2 && adultTutors.some((a) => String(a.id) === String(prevTutor2))) {
    tutor2Sel.value = prevTutor2;
  }
}

function setMemberType(type) {
  document.getElementById('memberType').value = type;
  const isAdult = type === 'Adulto';

  document.getElementById('btnTypeAdult').className = isAdult
    ? 'px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white transition'
    : 'px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition';
  document.getElementById('btnTypeChild').className = !isAdult
    ? 'px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 text-white transition'
    : 'px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition';

  document.getElementById('adultFamilyBox').classList.toggle('hidden', !isAdult);
  document.getElementById('childFamilyBox').classList.toggle('hidden', isAdult);
  document.getElementById('ministryContainer').classList.toggle('hidden', !isAdult);
  syncIdentityAndFaithFieldVisibility();

  populateSelectors();
  toggleAdultFamily();
  toggleChildFamily();
  toggleDisciplineAvailability();
}
