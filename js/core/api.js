    // ────────────────────────────────────────────────────────────────────
    // AUTENTICACIÓN Y CONSUMO API MEDIANTE SESSIONSTORAGE
    // ────────────────────────────────────────────────────────────────────

    function getScriptUrl() {
      try { return localStorage.getItem(STORAGE_API_ENDPOINT) || ''; } catch (e) { return ''; }
    }

    function getSessionToken() {
      return sessionStorage.getItem(STORAGE_SESSION_TOKEN) || '';
    }

    function getCurrentRole() {
      return sessionStorage.getItem(STORAGE_USER_ROLE) || 'consulta';
    }

    let isLoggingIn = false;

    async function fetchWithTimeout(url, options, timeoutMs = 30000) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        return await fetch(url, { ...options, signal: ctrl.signal });
      } catch (err) {
        if (err && err.name === 'AbortError') {
          throw new Error("El servidor tardó demasiado en responder. Intenta de nuevo.");
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }

    async function fetchAPI(action, dataObj = null) {
      const url = getScriptUrl();
      const token = getSessionToken();
      if (!url) throw new Error("Falta la URL del servidor Apps Script.");

      const payload = { 
        token: token, 
        action: action, 
        clientId: getClientId() 
      };
      if (dataObj) payload.data = dataObj;

      let res;
      try {
        res = await fetchWithTimeout(url, { method: 'POST', body: JSON.stringify(payload) }, 30000);
      } catch (err) {
        throw new Error(err.message || "No hay conexión con el servidor. Revisa tu acceso a internet.");
      }

      if (!res.ok) {
        throw new Error(`Error en el servidor HTTP (${res.status}): ${res.statusText}`);
      }

      let result;
      try {
        result = await res.json();
      } catch (err) {
        throw new Error("Respuesta inválida del servidor. Verifica la URL o vuelve a desplegar el script.");
      }
      if (result.status === 'session_expired') {
        if (action !== 'logout' && token && token === getSessionToken()) logoutSystem(false);
        throw new Error(result.message);
      }
      return result;
    }

    function applySyncPayload(res) {
      if (res.soloEsp) hydrateEnglishFieldAliases(res);

      const allAdults = res.adults || [];
      adults = allAdults.filter(a => !a.isDeleted && !a.eliminado);
      deletedAdults = allAdults.filter(a => a.isDeleted || a.eliminado);

      const allChildren = res.children || [];
      children = allChildren.filter(c => !c.isDeleted && !c.eliminado);
      deletedChildren = allChildren.filter(c => c.isDeleted || c.eliminado);

      const allContribs = res.contributions || [];
      contributions = allContribs.filter(c => !c.isDeleted && !c.eliminado);
      deletedContributions = allContribs.filter(c => c.isDeleted || c.eliminado);

      const allCash = res.cashFlow || [];
      cashFlow = allCash.filter(cf => !cf.isDeleted && !cf.eliminado);
      deletedCashFlow = allCash.filter(cf => cf.isDeleted || cf.eliminado);

      if (res.churchConfig) {
        churchConfig = { ...churchConfig, ...res.churchConfig };
      }
      if (Array.isArray(res.events) && typeof window.mergeCloudEvents === 'function') {
        window.mergeCloudEvents(res.events);
      }

      applyRoleRestrictions();
      updateAllViews();
      document.getElementById('view-dashboard').classList.remove('dash-loading');
      document.getElementById('cloudStatusIcon').className = 'fa-solid fa-cloud text-emerald-400';
      document.getElementById('cloudStatusText').textContent = 'En Línea';
    }

    const REGEX_APPS_SCRIPT_URL = /^https:\/\/script\.google\.com\/(a\/macros\/[^/]+\/|macros\/)s\/[a-zA-Z0-9_-]+\/exec$/;

    async function handleDirectLogin(e) {
      e.preventDefault();
      if (isLoggingIn) return;

      const urlInput = document.getElementById('serverUrlInput').value.trim();
      const pinInput = document.getElementById('accessPinInput').value.trim();
      const statusBox = document.getElementById('authStatusBanner');
      const submitBtn = document.getElementById('btnLoginSubmit');

      if (!urlInput || !pinInput) {
        statusBox.className = "p-3 rounded-xl text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center gap-2";
        statusBox.textContent = "Ingresa la URL del servidor y tu PIN.";
        statusBox.classList.remove('hidden');
        if (window.AuthUI) window.AuthUI.shakeCard();
        return;
      }

      if (!REGEX_APPS_SCRIPT_URL.test(urlInput)) {
        statusBox.className = "p-3 rounded-xl text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center gap-2";
        statusBox.textContent = "URL inválida. Debe ser un enlace oficial de Google Apps Script terminado en /exec.";
        statusBox.classList.remove('hidden');
        if (window.AuthUI) window.AuthUI.shakeCard();
        return;
      }

      isLoggingIn = true;
      statusBox.className = "p-3 rounded-xl text-xs font-bold bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center gap-2";
      statusBox.textContent = "Verificando credenciales y cargando datos...";
      statusBox.classList.remove('hidden');
      submitBtn.disabled = true;

      const genInicio = sessionGenerationId;

      try {
        try { localStorage.setItem(STORAGE_API_ENDPOINT, urlInput); } catch (err) {}
        
        let authRes;
        try {
          authRes = await fetchWithTimeout(urlInput, {
            method: 'POST',
            body: JSON.stringify({ 
              action: 'login', 
              pin: pinInput,
              clientId: getClientId(),
              includeSync: true
            })
          }, 30000);
        } catch (err) {
          throw new Error(err.message || "No se pudo conectar con el servidor. Verifica la URL.");
        }

        let data;
        try {
          data = await authRes.json();
        } catch (err) {
          throw new Error("El servidor no respondió correctamente. Verifica la URL /exec y el despliegue.");
        }

        if (genInicio !== sessionGenerationId) return;

        if (data.status === 'ok' && data.token) {
          sessionStorage.setItem(STORAGE_SESSION_TOKEN, data.token);
          sessionStorage.setItem(STORAGE_USER_ROLE, data.role);
          document.getElementById('accessPinInput').value = '';
          resetInactivityTimer();

          statusBox.className = "p-3 rounded-xl text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center gap-2";
          statusBox.textContent = `Acceso concedido (${data.role === 'admin' ? 'Administrador' : 'Consulta'}).`;

          if (data.synced) {
            applySyncPayload(data);
            switchTab('dashboard');
          } else {
            document.getElementById('view-dashboard').classList.add('dash-loading');
            applyRoleRestrictions();
            switchTab('dashboard');
            syncFromCloud(false);
          }

          if (window.AuthUI) { await window.AuthUI.closeOverlay(); }
          if (genInicio === sessionGenerationId) {
            document.getElementById('authOverlay').classList.add('hidden');
            statusBox.classList.add('hidden');
          }
        } else {
          throw new Error(data.message || "PIN no autorizado.");
        }
      } catch (err) {
        statusBox.className = "p-3 rounded-xl text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center gap-2";
        statusBox.textContent = err.message;
        if (window.AuthUI) window.AuthUI.shakeCard();
      } finally {
        isLoggingIn = false;
        submitBtn.disabled = false;
      }
    }

    async function logoutSystem(confirmUser = true, customMessage = null) {
      if (!confirmUser || await showConfirmDialog({ title: 'Cerrar sesión', message: '¿Deseas cerrar la sesión? Para volver a entrar tendrás que ingresar tu PIN.', confirmText: 'Cerrar sesión' })) {
        if (inactivityTimer) {
          clearTimeout(inactivityTimer);
          inactivityTimer = null;
        }
        if (isLoggingOut) return;
        isLoggingOut = true;

        if (getSessionToken()) fetchAPI('logout').catch(() => {});

        sessionGenerationId++;
        isLoggingIn = false;
        syncInFlight = null;
        syncAgain = false;
        busyCount = 0;
        const topBarProg = document.getElementById('topProgress');
        if (topBarProg) topBarProg.classList.remove('active');
        document.getElementById('view-dashboard').classList.remove('dash-loading');

        const submitBtn = document.getElementById('btnLoginSubmit');
        if (submitBtn) submitBtn.disabled = false;
        if (window.AuthUI) window.AuthUI.cancelClose();

        sessionStorage.removeItem(STORAGE_SESSION_TOKEN);
        sessionStorage.removeItem(STORAGE_USER_ROLE);
        sessionStorage.removeItem('TEMP_GEMINI_KEY');
        localStorage.removeItem('SAVED_GEMINI_KEY');
        resetPhotoQueues();

        adults = []; children = []; contributions = []; cashFlow = [];
        deletedAdults = []; deletedChildren = []; deletedContributions = []; deletedCashFlow = [];
        if (typeof window.clearEventsState === 'function') window.clearEventsState();
        
        document.getElementById('accessPinInput').value = '';
        const statusBox = document.getElementById('authStatusBanner');
        statusBox.className = "p-3 rounded-xl text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center gap-2";
        statusBox.textContent = customMessage || "Sesión finalizada con éxito.";
        statusBox.classList.remove('hidden');

        const gate = document.getElementById('authOverlay');
        gate.classList.remove('auth-leaving', 'hidden');
        try { updateAllViews(); } finally { isLoggingOut = false; }
      }
    }

    function applyRoleRestrictions() {
      const role = getCurrentRole();
      const isConsulta = (role === 'consulta');

      const btnRegistro = document.getElementById('tabBtn-registro');
      const btnConfig = document.getElementById('btnOpenConfigMain');
      const roleBadge = document.getElementById('roleIndicator');
      const contributionForm = document.getElementById('contributionFormCard');
      const cashForm = document.getElementById('cashFlowFormBox');
      const btnTabCaja = document.getElementById('tabBtn-caja');
      const btnTabContrib = document.getElementById('tabBtn-contribuciones');
      const btnPapelera = document.getElementById('tabBtn-papelera');

      const cardBalance = document.getElementById('cardBalance');
      const cardCashFlow = document.getElementById('cardCashFlowChart');
      const cardDiscipline = document.getElementById('cardDisciplineKpi');
      const diagBadge = document.getElementById('diagBalanceBadge');
      const heroCard = document.getElementById('dashHeroCard');
      if (heroCard) {
        heroCard.classList.toggle('lg:col-span-2', !isConsulta);
        heroCard.classList.toggle('lg:col-span-3', isConsulta);
      }

      roleBadge.textContent = '';
      const icon = document.createElement('i');
      icon.className = 'fa-solid mr-1 ' + (!isConsulta ? 'fa-user-shield' : 'fa-eye');
      roleBadge.appendChild(icon);
      roleBadge.appendChild(document.createTextNode(!isConsulta ? 'ADMIN' : 'CONSULTA'));
      roleBadge.className = 'text-[10px] px-2.5 py-1.5 rounded-lg border font-bold flex items-center shrink-0 ' + 
        (!isConsulta ? 'bg-emerald-800 text-emerald-100 border-emerald-600' : 'bg-slate-700 text-slate-200 border-slate-600');
      roleBadge.classList.remove('hidden');

      const eventFormCard = document.getElementById('eventFormCard');
      [btnRegistro, btnConfig, btnTabCaja, btnTabContrib, btnPapelera, contributionForm, cashForm, eventFormCard, cardBalance, cardCashFlow, cardDiscipline, diagBadge].forEach(el => {
        if (el) el.classList.toggle('hidden', isConsulta);
      });

      if (isConsulta) {
        const restrictedViews = ['view-registro', 'view-contribuciones', 'view-caja', 'view-papelera'];
        const inRestricted = restrictedViews.some(id => {
          const sec = document.getElementById(id);
          return sec && !sec.classList.contains('hidden');
        });
        if (inRestricted) switchTab('dashboard');
      }

      renderDirectory();
      if (typeof window.renderEventsModule === 'function') window.renderEventsModule();
    }

    // Evita sincronizaciones simultáneas: si se pide otra mientras corre una,
    // se repite una sola vez al terminar.
    let syncInFlight = null;
    let syncAgain = false;
    // Cambia cada vez que se cierra sesión: una sincronización iniciada en una sesión
    // anterior se descarta en lugar de hacer esperar (y repetir la descarga) a la nueva.
    let sessionGenerationId = 0;
    let activeSyncGenerationId = -1;
    function syncFromCloud(showAlert = false) {
      if (syncInFlight && activeSyncGenerationId === sessionGenerationId) {
        syncAgain = true;
        return syncInFlight;
      }
      setBackgroundBusy(true);
      activeSyncGenerationId = sessionGenerationId;
      const esta = runSyncFromCloud(showAlert).finally(() => {
        if (syncInFlight !== esta) return; // ya la reemplazó otra sesión
        setBackgroundBusy(false);
        document.getElementById('view-dashboard').classList.remove('dash-loading');
        syncInFlight = null;
        if (syncAgain) {
          syncAgain = false;
          syncFromCloud(false);
        }
      });
      syncInFlight = esta;
      return esta;
    }

    // El servidor envía cada campo una sola vez (en español) para que la respuesta pese la mitad;
    // aquí se rellenan los nombres en inglés que usa el resto de la página. Debe coincidir con COLUMNAS_* de Code.js.
    const BACKEND_TO_CLIENT_FIELD_MAP = {
      adults: { nombreCompleto: 'fullName', cedula: 'idNumber', lugarNacimiento: 'birthPlace', genero: 'gender', fechaNacimiento: 'birthDate', estadoCivil: 'maritalStatus', conyugeEsMiembro: 'spouseIsMember', idConyuge: 'spouseId', nombreConyugeTexto: 'spouseText', padreEsMiembro: 'fatherIsMember', idPadre: 'fatherId', nombrePadreTexto: 'fatherText', madreEsMiembro: 'motherIsMember', idMadre: 'motherId', nombreMadreTexto: 'motherText', escolaridad: 'educationLevel', telefono: 'phone', direccion: 'address', categoria: 'category', tipoConversion: 'conversionType', fechaIngreso: 'joinDate', ministerioCargo: 'ministryRole', bautizado: 'isBaptized', fechaBautismo: 'baptismDate', lugarBautismo: 'baptismPlace', fallecido: 'isDeceased', fechaDefuncion: 'deceasedDate', enDisciplina: 'inDiscipline', inicioDisciplina: 'disciplineDate', mesesCastigo: 'disciplineMonths', finDisciplina: 'disciplineEndDate', disciplinaIndefinida: 'disciplineIndefinite', motivoDisciplina: 'disciplineReason', fotoUrl: 'photoBase64', eliminado: 'isDeleted', actualizadoEl: 'updatedAt' },
      children: { nombreCompleto: 'fullName', cedula: 'idNumber', genero: 'gender', fechaNacimiento: 'birthDate', lugarNacimiento: 'birthPlace', tutor1EsMiembro: 'tutor1IsMember', idTutor1: 'tutor1Id', nombreTutor1Texto: 'tutor1Text', tutor2EsMiembro: 'tutor2IsMember', idTutor2: 'tutor2Id', nombreTutor2Texto: 'tutor2Text', presentado: 'presentedToChurch', presentadoPor: 'presentedBy', fechaPresentacion: 'presentedDate', escolaridad: 'educationLevel', direccion: 'address', telefono: 'phone', categoria: 'category', tipoConversion: 'conversionType', fechaIngreso: 'joinDate', bautizado: 'isBaptized', fechaBautismo: 'baptismDate', lugarBautismo: 'baptismPlace', enDisciplina: 'inDiscipline', inicioDisciplina: 'disciplineDate', mesesCastigo: 'disciplineMonths', finDisciplina: 'disciplineEndDate', disciplinaIndefinida: 'disciplineIndefinite', motivoDisciplina: 'disciplineReason', fallecido: 'isDeceased', fechaDefuncion: 'deceasedDate', fotoUrl: 'photoBase64', eliminado: 'isDeleted', actualizadoEl: 'updatedAt' },
      contributions: { idMiembro: 'memberId', nombreMiembro: 'memberName', fecha: 'date', tipoContribucion: 'type', monto: 'amount', metodoPago: 'method', notasReferencia: 'notes', eliminado: 'isDeleted', registradoEl: 'createdAt' },
      cashFlow: { tipoMovimiento: 'movementType', categoriaConcepto: 'category', fecha: 'date', monto: 'amount', formaPago: 'method', reciboFactura: 'receipt', descripcionObservacion: 'notes', eliminado: 'isDeleted', registradoEl: 'createdAt' }
    };
    function hydrateEnglishFieldAliases(res) {
      Object.keys(BACKEND_TO_CLIENT_FIELD_MAP).forEach(clave => {
        const mapa = BACKEND_TO_CLIENT_FIELD_MAP[clave];
        const pares = Object.keys(mapa).map(esp => [esp, mapa[esp]]);
        (res[clave] || []).forEach(r => {
          for (let i = 0; i < pares.length; i++) {
            if (r[pares[i][1]] === undefined) r[pares[i][1]] = r[pares[i][0]] === undefined ? '' : r[pares[i][0]];
          }
        });
      });
    }

    async function runSyncFromCloud(showAlert) {
      if (!getSessionToken()) {
        document.getElementById('authOverlay').classList.remove('hidden');
        return;
      }
      document.getElementById('cloudStatusIcon').className = 'fa-solid fa-arrows-rotate fa-spin text-amber-400';
      document.getElementById('cloudStatusText').textContent = 'Sincronizando';
      const gen = sessionGenerationId;

      try {
        const res = await fetchAPI('sync');
        if (gen !== sessionGenerationId) return;
        if (res.status !== 'ok') throw new Error(res.message || 'Error al sincronizar con el servidor.');
        applySyncPayload(res);
        if (showAlert) showToast("Base de datos sincronizada desde Firestore con éxito.");
      } catch (err) {
        if (gen !== sessionGenerationId) return;
        document.getElementById('cloudStatusIcon').className = 'fa-solid fa-cloud-bolt text-rose-400';
        document.getElementById('cloudStatusText').textContent = 'Error';
        if (showAlert) showToast(err.message, "error");
        console.error("Error sincronizando:", err);
      }
    }
