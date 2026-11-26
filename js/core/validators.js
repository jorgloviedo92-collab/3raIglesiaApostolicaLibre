    // ────────────────────────────────────────────────────────────────────
    // VALIDACIONES (funciones puras)
    //
    // Este archivo NO toca el DOM, la red ni el reloj: todo lo que necesita llega por
    // parámetros (incluida la fecha de "hoy", en formato ISO AAAA-MM-DD). Así las reglas se
    // pueden probar con `npm test` (tests/validators.test.js) y se reutilizan igual en todos los formularios.
    //
    // Convención: las funciones validate* devuelven una lista de mensajes (vacía = válido) o,
    // las de una sola regla por pantalla, un texto con el primer error ('' = válido).
    // Debe cargarse antes que cualquier otro archivo de js/.
    // ────────────────────────────────────────────────────────────────────

    const MIN_PARENT_AGE_DIFF = 12;
    const MIN_GUARDIAN_AGE = 18; // un tutor legal debe ser mayor de edad (el servidor valida lo mismo)
    const MIN_ADULT_MEMBER_AGE = 15; // solo personas de 15 años o más se registran en Adultos (el servidor valida lo mismo)
    const MIN_CEDULA_AGE = 16; // desde esta edad se registra la cédula
    const MIN_PIN_LENGTH = 8;
    const MAX_PIN_LENGTH = 64;
    const MAX_MONEY_AMOUNT = 9999999;
    const MAX_NOTES_LENGTH = 200;
    const FULL_NAME_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]{3,100}$/;
    const CEDULA_REGEX = /^\d{3}-\d{6}-\d{4}[A-Za-z]$/;
    const NAME_RULE_TEXT = 'solo puede contener letras, espacios, puntos, apóstrofos o guiones (mínimo 3 letras)';

    const REGEX_APPS_SCRIPT_URL = /^https:\/\/script\.google\.com\/(a\/macros\/[^/]+\/|macros\/)s\/[a-zA-Z0-9_-]+\/exec$/;

    // ── Fechas ──────────────────────────────────────────────────────────

    // Convierte 'AAAA-MM-DD' (o ISO con hora) en Date local. Devuelve null si no es una fecha real
    // (31 de febrero, mes 13, año fuera de 1900-2100, años de 2 dígitos...).
    function parseDateSafe(dateStr) {
      if (!dateStr) return null;
      const s = String(dateStr).split('T')[0];
      const p = s.split('-');
      if (p.length !== 3 || !/^\d{4}$/.test(p[0]) || !/^\d{1,2}$/.test(p[1]) || !/^\d{1,2}$/.test(p[2])) return null;
      const y = parseInt(p[0], 10), m = parseInt(p[1], 10), d = parseInt(p[2], 10);
      if (y < 1900 || y > 2100) return null;
      // setFullYear evita que años 0-99 se interpreten como 19xx; se rechazan fechas que "rebotan"
      const date = new Date(2000, 0, 1);
      date.setFullYear(y, m - 1, d);
      if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
      return date;
    }

    // Años completos cumplidos entre dos fechas ISO. 0 si el nacimiento es inválido; nunca negativo.
    function ageInYears(birthIso, referenceIso) {
      const birth = parseDateSafe(birthIso);
      const end = parseDateSafe(referenceIso);
      if (!birth || !end) return 0;
      let years = end.getFullYear() - birth.getFullYear();
      const mDiff = end.getMonth() - birth.getMonth();
      if (mDiff < 0 || (mDiff === 0 && end.getDate() < birth.getDate())) years--;
      return Math.max(0, years);
    }

    // Años completos entre dos fechas ISO, sin validar el calendario (null si falta alguna o no tiene 3 partes)
    function diffYearsBetweenIso(olderDateStr, youngerDateStr) {
      if (!olderDateStr || !youngerDateStr) return null;
      const a = String(olderDateStr).split('T')[0].split('-').map(Number);
      const b = String(youngerDateStr).split('T')[0].split('-').map(Number);
      if (a.length !== 3 || b.length !== 3) return null;
      let diff = b[0] - a[0];
      if (b[1] < a[1] || (b[1] === a[1] && b[2] < a[2])) diff--;
      return diff;
    }

    // ── Campos sueltos ──────────────────────────────────────────────────

    function isValidPersonName(nombre) {
      return FULL_NAME_REGEX.test(nombre) && (nombre.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) || []).length >= 3;
    }

    function isValidPhoneNumber(tel) {
      if (!tel) return true;
      const digitos = tel.replace(/\D/g, '');
      return /^[+]?[0-9 ()-]+$/.test(tel) && digitos.length >= 8 && digitos.length <= 15;
    }

    function isWeakPin(pin) {
      const p = String(pin).toLowerCase();
      if (/^(.)\1+$/.test(p)) return true;
      const secuencia = '0123456789abcdefghijklmnopqrstuvwxyz';
      if (secuencia.includes(p) || secuencia.split('').reverse().join('').includes(p)) return true;
      return ['password', 'contraseña', 'contrasena', 'iglesia1', 'qwertyui', 'admin123', 'abc12345', '12341234'].includes(p);
    }

    // La cédula nicaragüense codifica la fecha de nacimiento como DDMMAA en las posiciones 5-10
    function isCedulaMatchingBirthDate(cedula, birthDateStr) {
      if (!cedula || !birthDateStr) return true;
      const cleanDate = String(birthDateStr).split('T')[0];
      const parts = cleanDate.split('-');
      if (parts.length !== 3) return true;
      const expected = parts[2] + parts[1] + parts[0].slice(-2); // DDMMAA
      return cedula.substring(4, 10) === expected;
    }

    // Formato y coherencia con la fecha de nacimiento. La cédula debe venir en mayúsculas y recortada.
    function validateCedula(cedula, birthIso) {
      if (!CEDULA_REGEX.test(cedula)) return ['Formato de cédula nicaragüense incompleto (Ejemplo: 001-150890-0002A).'];
      if (birthIso && !isCedulaMatchingBirthDate(cedula, birthIso)) {
        return ['La fecha codificada en la cédula (DDMMAA) no coincide con la fecha de nacimiento.'];
      }
      return [];
    }

    // Monto monetario: solo números positivos con máximo 2 decimales (sin notación científica).
    // Devuelve el valor redondeado al centavo, o null si no es válido.
    function parseMoneyAmount(raw) {
      const txt = String(raw === null || raw === undefined ? '' : raw).trim();
      if (!/^\d+(\.\d{1,2})?$/.test(txt)) return null;
      const n = Math.round(parseFloat(txt) * 100) / 100;
      return (n >= 0.01 && n <= MAX_MONEY_AMOUNT) ? n : null;
    }

    // ── Ficha de miembro ────────────────────────────────────────────────

    // f: { fullName, phone, birth, join }
    function validateMemberBasics(f, todayIso) {
      const errors = [];
      const today = parseDateSafe(todayIso);
      const birth = parseDateSafe(f.birth);
      const join = parseDateSafe(f.join);

      if (!f.fullName) errors.push('El nombre completo es obligatorio.');
      else if (!isValidPersonName(f.fullName)) errors.push('El nombre ' + NAME_RULE_TEXT + '.');
      if (!isValidPhoneNumber(f.phone || '')) errors.push('Teléfono inválido: use solo números (8 a 15 dígitos), por ejemplo 8888-8888.');

      if (!birth) errors.push('La fecha de nacimiento es obligatoria.');
      else if (birth > today) errors.push('La fecha de nacimiento no puede ser una fecha futura.');

      if (!join) errors.push('La fecha de ingreso a la iglesia es obligatoria.');
      else if (birth && join < birth) errors.push('La fecha de ingreso no puede ser anterior al nacimiento.');
      else if (join > today) errors.push('La fecha de ingreso no puede ser futura.');
      return errors;
    }

    // f: { isBaptized, baptism, birth }
    function validateBaptism(f, todayIso) {
      const errors = [];
      if (!f.isBaptized) return errors;
      if (!f.baptism) { errors.push('Un miembro bautizado debe tener la fecha de bautismo.'); return errors; }
      const bap = parseDateSafe(f.baptism);
      if (!bap) { errors.push('La fecha de bautismo no es válida.'); return errors; }
      const birth = parseDateSafe(f.birth);
      if (bap > parseDateSafe(todayIso)) errors.push('La fecha de bautismo no puede ser una fecha futura.');
      if (birth && bap < birth) errors.push('La fecha de bautismo no puede ser anterior al nacimiento.');
      return errors;
    }

    // f: { isDeceased, deceased, birth, join, isBaptized, baptism }
    function validateDeceased(f, todayIso) {
      const errors = [];
      if (!f.isDeceased) return errors;
      if (!f.deceased) errors.push('Debe indicar la fecha exacta de defunción.');
      const dec = parseDateSafe(f.deceased);
      const birth = parseDateSafe(f.birth);
      const join = parseDateSafe(f.join);
      if (dec && dec > parseDateSafe(todayIso)) errors.push('La fecha de defunción no puede ser futura.');
      if (dec && birth && dec < birth) errors.push('La fecha de defunción no puede ser anterior al nacimiento.');
      // Nada de la vida en la iglesia puede ocurrir después de la defunción
      if (dec && join && join > dec) errors.push('La fecha de ingreso no puede ser posterior a la defunción.');
      if (dec && f.isBaptized && f.baptism) {
        const bap = parseDateSafe(f.baptism);
        if (bap && bap > dec) errors.push('La fecha de bautismo no puede ser posterior a la defunción.');
      }
      return errors;
    }

    // f: { inDiscipline, isBaptized, isDeceased, category, start, end, months, indefinite, birth, baptism }
    function validateDiscipline(f, todayIso) {
      const errors = [];
      if (!f.inDiscipline) return errors;
      const birth = parseDateSafe(f.birth);
      if (!f.isBaptized) errors.push('Un miembro no bautizado en agua no puede estar sujeto a disciplina eclesiástica.');
      if (f.isDeceased) errors.push('Una persona fallecida no puede figurar en disciplina pastoral.');
      if (f.category === 'Inactivo') errors.push('Un miembro en categoría Inactivo no puede figurar en disciplina pastoral.');
      if (!f.start) errors.push('Ingresa la fecha de inicio de la sanción pastoral.');
      const start = parseDateSafe(f.start);
      if (start && start > parseDateSafe(todayIso)) errors.push('La fecha de inicio de disciplina no puede ser futura.');
      if (start && birth && start < birth) errors.push('La fecha de disciplina no puede ser anterior al nacimiento.');
      // La disciplina solo aplica a bautizados: no puede iniciar antes del bautismo
      const bap = (f.isBaptized && f.baptism) ? parseDateSafe(f.baptism) : null;
      if (start && bap && start < bap) errors.push('La fecha de inicio de disciplina no puede ser anterior a la fecha de bautismo.');
      if (!f.indefinite) {
        const months = parseInt(f.months, 10);
        if (isNaN(months) || months < 1 || months > 120) {
          errors.push("Indica los meses de sanción pastoral (entre 1 y 120 meses) o marca 'Indefinido'.");
        }
        if (!f.end) {
          errors.push('La fecha de fin estimado de disciplina es obligatoria cuando no es indefinida.');
        } else {
          const end = parseDateSafe(f.end);
          if (start && end && end < start) errors.push('La fecha de fin de disciplina no puede ser anterior a la fecha de inicio.');
        }
      }
      return errors;
    }

    // f: { isPresented, date, birth } — presentación del menor en la iglesia
    function validatePresentation(f, todayIso) {
      const errors = [];
      if (!f.isPresented || !f.date) return errors;
      const pres = parseDateSafe(f.date);
      const birth = parseDateSafe(f.birth);
      if (pres && pres > parseDateSafe(todayIso)) errors.push('La fecha de presentación no puede ser futura.');
      if (pres && birth && pres < birth) errors.push('La fecha de presentación no puede ser anterior al nacimiento.');
      return errors;
    }

    // Un nombre escrito a mano (cónyuge, padre, madre, tutor): vacío es válido, lleno debe cumplir la regla.
    // etiqueta lleva la preposición: 'del cónyuge', 'de la madre', 'del Tutor 1'.
    function validateOptionalName(value, etiqueta) {
      return (value && !isValidPersonName(value)) ? ['El nombre ' + etiqueta + ' ' + NAME_RULE_TEXT + '.'] : [];
    }

    // ── Aportes y caja ──────────────────────────────────────────────────

    function _amountError(raw) {
      const amount = parseMoneyAmount(raw);
      return amount === null
        ? { error: 'El monto debe estar entre 0.01 y 9,999,999, con máximo 2 decimales.', amount: null }
        : { error: '', amount };
    }

    // f: { memberFound, memberDeceased, date, amount, type, notes, memberBirth }
    // Devuelve { error, amount }; error = primer problema encontrado ('' si todo es válido).
    function validateContribution(f, todayIso) {
      if (!f.memberFound) return { error: 'Selecciona un miembro válido.', amount: null };
      // El servidor rechaza aportes de personas fallecidas
      if (f.memberDeceased) return { error: 'El miembro contribuyente figura como fallecido.', amount: null };
      if (!f.date) return { error: 'Indica la fecha de la contribución.', amount: null };
      if (!parseDateSafe(f.date)) return { error: 'La fecha de la contribución no es válida.', amount: null };
      if (f.date > todayIso) return { error: 'La fecha de la contribución no puede ser futura.', amount: null };
      const m = _amountError(f.amount);
      if (m.error) return m;
      if (!f.type) return { error: 'Selecciona el tipo de contribución.', amount: null };
      if (String(f.notes || '').trim().length > MAX_NOTES_LENGTH) return { error: 'Las notas no pueden superar ' + MAX_NOTES_LENGTH + ' caracteres.', amount: null };
      const nac = String(f.memberBirth || '').split('T')[0];
      if (nac && f.date < nac) return { error: 'La fecha de la contribución no puede ser anterior al nacimiento del miembro.', amount: null };
      return m;
    }

    // f: { date, amount, category, notes }
    function validateCashMovement(f, todayIso) {
      if (!f.date) return { error: 'Indica la fecha del movimiento de caja.', amount: null };
      if (!parseDateSafe(f.date)) return { error: 'La fecha del movimiento de caja no es válida.', amount: null };
      if (f.date > todayIso) return { error: 'La fecha del movimiento de caja no puede ser futura.', amount: null };
      const m = _amountError(f.amount);
      if (m.error) return m;
      if (!f.category) return { error: 'Selecciona el concepto o categoría del movimiento.', amount: null };
      if (String(f.notes || '').trim().length > MAX_NOTES_LENGTH) return { error: 'La descripción no puede superar ' + MAX_NOTES_LENGTH + ' caracteres.', amount: null };
      return m;
    }

    // ── Eventos ─────────────────────────────────────────────────────────

    // Motivo por el que un evento NO puede marcarse como Realizado ('' si sí puede). nowHHMM: hora actual 'HH:MM' (24 h).
    function eventDoneBlockReason(date, startTime, todayIso, nowHHMM) {
      if (!date) return 'Indica la fecha del evento antes de marcarlo como realizado.';
      if (date > todayIso) return 'Solo se puede marcar como realizado un evento cuya fecha ya llegó.';
      if (date === todayIso && startTime && startTime > nowHHMM) {
        return 'Este evento todavía no ha comenzado; podrás marcarlo como realizado a partir de su hora de inicio.';
      }
      return '';
    }

    // f: { title, date, startTime, endTime, location, responsible, notes, status }
    function validateEvent(f, todayIso, nowHHMM) {
      if (!f.title || !f.date) return 'Completa el título y la fecha del evento.';
      if (f.title.length < 3 || f.title.length > 120) return 'El título del evento debe tener entre 3 y 120 caracteres.';
      if (!parseDateSafe(f.date)) return 'La fecha del evento no es válida.';
      if ((f.location || '').length > 120 || (f.responsible || '').length > 100 || (f.notes || '').length > 400) {
        return 'Lugar (120), responsable (100) o notas (400) exceden el largo permitido.';
      }
      if (f.endTime && !f.startTime) return 'Indica la hora de inicio antes de la hora de fin.';
      if (f.startTime && f.endTime && f.endTime <= f.startTime) return 'La hora de fin debe ser posterior a la hora de inicio.';
      if (f.status === 'Realizado') return eventDoneBlockReason(f.date, f.startTime, todayIso, nowHHMM);
      return '';
    }

    // ── Servidor ────────────────────────────────────────────────────────

    // input: dirección escrita en el login. fixedUrl: dirección oficial configurada ('' si no hay).
    // savedUrl: dirección usada la última vez en este navegador ('' si no hay).
    // Devuelve { ok, error, needsConfirm }: needsConfirm = true cuando el PIN iría a un servidor distinto del habitual.
    function validateServerUrl(input, fixedUrl, savedUrl) {
      if (!input) return { ok: false, error: 'Ingresa la URL del servidor y tu PIN.', needsConfirm: false };
      if (!REGEX_APPS_SCRIPT_URL.test(input)) {
        return { ok: false, error: 'URL inválida. Debe ser un enlace oficial de Google Apps Script terminado en /exec.', needsConfirm: false };
      }
      if (fixedUrl) {
        return input === fixedUrl
          ? { ok: true, error: '', needsConfirm: false }
          : { ok: false, error: 'Este sistema solo puede conectarse al servidor oficial configurado.', needsConfirm: false };
      }
      return { ok: true, error: '', needsConfirm: Boolean(savedUrl) && input !== savedUrl };
    }

    // ── Configuración institucional y PIN ───────────────────────────────

    // cfg: { name, pastor, secretary, changePin, pinActual, newPinAdmin, newPinConsulta }
    function validateChurchConfig(cfg) {
      if ((cfg.name || '').length < 3) return 'El nombre de la iglesia es obligatorio (mínimo 3 caracteres).';
      if (cfg.pastor && !isValidPersonName(cfg.pastor)) return 'El nombre del Pastor ' + NAME_RULE_TEXT + '.';
      if (cfg.secretary && !isValidPersonName(cfg.secretary)) return 'El nombre del Secretario ' + NAME_RULE_TEXT + '.';
      if (!cfg.changePin) return '';
      if (!cfg.pinActual || !cfg.newPinAdmin || !cfg.newPinConsulta) return 'Ingresa el PIN actual y ambos nuevos PINs.';
      const lenOk = (v) => v.length >= MIN_PIN_LENGTH && v.length <= MAX_PIN_LENGTH;
      if (!lenOk(cfg.newPinAdmin) || !lenOk(cfg.newPinConsulta)) return 'Los nuevos PINs deben tener entre ' + MIN_PIN_LENGTH + ' y ' + MAX_PIN_LENGTH + ' caracteres.';
      if (isWeakPin(cfg.newPinAdmin) || isWeakPin(cfg.newPinConsulta)) return 'Elige PINs más seguros: evita números repetidos, secuencias (12345678) o valores comunes.';
      if (cfg.newPinAdmin === cfg.newPinConsulta) return 'El PIN de Administrador y el de Consulta deben ser diferentes.';
      if (cfg.newPinAdmin === cfg.pinActual || cfg.newPinConsulta === cfg.pinActual) return 'Los nuevos PINs deben ser distintos del PIN actual.';
      return '';
    }
