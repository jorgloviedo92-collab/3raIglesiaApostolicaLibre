    // ────────────────────────────────────────────────────────────────────
    // RENDERIZADO VISUAL
    // ────────────────────────────────────────────────────────────────────

    function renderDirectory() {
      const tbody = document.getElementById('directoryTableBody');
      tbody.innerHTML = '';
      const q = document.getElementById('searchInput').value.trim().toLowerCase();
      const cat = document.getElementById('filterCategory').value;
      const gen = document.getElementById('filterGender').value;
      const isAdultTab = (currentDirTab === 'Adultos');
      const stageByTab = { Ninos: 'Nino', Adolescentes: 'Adolescente', Jovenes: 'Joven' };
      const dataset = isAdultTab ? adults : children.filter(c => {
        const isDec = (c.isDeceased === 'Sí' || c.fallecido === 'Sí');
        const st = getMinorStage(c.birthDate || c.fechaNacimiento, isDec ? 'Sí' : 'No', c.deceasedDate || c.fechaDefuncion);
        return st.key === stageByTab[currentDirTab];
      });
      const isAdmin = getCurrentRole() === 'admin';

      // 1. Filtrar sobre el total completo de registros (sin afectar búsqueda ni filtros)
      const filtered = dataset.filter(item => {
        const categoryVal = item.category || item.categoria;
        const genderVal = item.gender || item.genero;
        const nameVal = item.fullName || item.nombreCompleto || '';
        const idVal = item.idNumber || item.cedula || '';
        const isDeceased = (item.isDeceased === 'Sí' || item.fallecido === 'Sí');
        const isBaptized = (item.isBaptized === 'Sí' || item.bautizado === 'Sí');
        const inDiscipline = (!isDeceased && isBaptized && categoryVal !== 'Inactivo' && (item.inDiscipline === 'Sí' || item.enDisciplina === 'Sí'));

        if (cat !== 'ALL' && cat !== 'Fallecido' && cat !== 'Disciplina' && cat !== 'Bautizado' && cat !== 'NoBautizado' && categoryVal !== cat) return false;
        if (cat === 'NoBautizado' && isBaptized) return false;
        if (cat === 'Fallecido' && !isDeceased) return false;
        if (cat === 'Bautizado' && !isBaptized) return false;
        if (cat === 'Disciplina' && !inDiscipline) return false;
        if (gen !== 'ALL' && genderVal !== gen) return false;
        if (q && !nameVal.toLowerCase().includes(q) && !idVal.toLowerCase().includes(q)) return false;
        return true;
      });

      dirListaFiltrada = filtered; // para Exportar / Imprimir lista

      // 2. Paginación visual de 25 registros por página
      const totalItems = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / DIR_PAGE_SIZE));
      if (currentDirPage > totalPages) currentDirPage = totalPages;
      if (currentDirPage < 1) currentDirPage = 1;

      const startIdx = (currentDirPage - 1) * DIR_PAGE_SIZE;
      const endIdx = Math.min(startIdx + DIR_PAGE_SIZE, totalItems);
      const pageItems = filtered.slice(startIdx, endIdx);

      if (pageItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-10 text-center text-slate-400 font-bold">No se encontraron registros con los filtros aplicados.</td></tr>';
        renderDirectoryPagination(0, 1, 0, 0);
        return;
      }

      pageItems.forEach(item => {
        const categoryVal = item.category || item.categoria;
        const genderVal = item.gender || item.genero;
        const nameVal = item.fullName || item.nombreCompleto || '';
        const idVal = item.idNumber || item.cedula || '';
        const isDeceased = (item.isDeceased === 'Sí' || item.fallecido === 'Sí');
        const isBaptized = (item.isBaptized === 'Sí' || item.bautizado === 'Sí');
        const inDiscipline = (!isDeceased && isBaptized && categoryVal !== 'Inactivo' && (item.inDiscipline === 'Sí' || item.enDisciplina === 'Sí'));

        const tr = document.createElement('tr');
        tr.className = isDeceased ? 'border-b border-slate-300 bg-slate-100 opacity-80' : 'hover:bg-slate-50 border-b border-slate-200 transition';

        const tdMember = document.createElement('td');
        tdMember.className = 'py-3 px-4 flex items-center gap-3';
        
        const photoRef = item.photoBase64 || item.fotoUrl;
        const initial = document.createElement('div');
        initial.className = 'w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center font-bold text-slate-600 text-sm shrink-0';
        initial.textContent = nameVal.charAt(0).toUpperCase();

        if (photoRef) {
          const img = document.createElement('img');
          img.className = `w-10 h-10 rounded-full object-cover border shrink-0 ${isDeceased ? 'grayscale' : ''}`;
          if (photoRef.startsWith('DRIVE_FILE:')) {
            const cachedUri = getCachedPhotoUrl(photoRef);
            if (cachedUri) {
              img.src = cachedUri;
              tdMember.appendChild(img);
            } else {
              tdMember.appendChild(initial);
              resolvePhotoUrl(photoRef).then(dataUri => {
                if (dataUri && tdMember.contains(initial)) { img.src = dataUri; tdMember.replaceChild(img, initial); }
              });
            }
          } else {
            const safeUrl = sanitizeDriveUrl(photoRef);
            if (safeUrl) { img.src = safeUrl; tdMember.appendChild(img); } else { tdMember.appendChild(initial); }
          }
        } else {
          tdMember.appendChild(initial);
        }

        const memberInfo = document.createElement('div');
        const nameP = document.createElement('p');
        nameP.className = 'font-bold text-slate-800';
        nameP.textContent = nameVal;
        if (isDeceased) {
          const decBadge = document.createElement('span');
          decBadge.className = 'bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded ml-1 font-bold';
          decBadge.textContent = 'FALLECIDO';
          nameP.appendChild(decBadge);
        }
        const idP = document.createElement('p');
        idP.className = 'text-[11px] text-slate-500 font-mono';
        if (currentDirTab === 'Adultos') {
          idP.textContent = 'Cédula: ' + (idVal || 'S/N');
        } else if (currentDirTab === 'Jovenes' && idVal) {
          idP.textContent = 'Cédula: ' + idVal + ' · ID: ' + item.id;
        } else {
          idP.textContent = 'ID: ' + item.id;
        }
        memberInfo.appendChild(nameP);
        memberInfo.appendChild(idP);
        tdMember.appendChild(memberInfo);

        const tdAge = document.createElement('td');
        tdAge.className = 'py-3 px-4';
        const ageP = document.createElement('p');
        ageP.className = 'font-bold text-slate-700';
        ageP.textContent = calculateAgeVerbose(item.birthDate || item.fechaNacimiento, isDeceased ? 'Sí' : 'No', item.deceasedDate || item.fechaDefuncion);
        const genP = document.createElement('p');
        genP.className = 'text-xs text-slate-500';
        genP.textContent = genderVal;
        tdAge.appendChild(ageP);
        tdAge.appendChild(genP);

        const tdRel = document.createElement('td');
        tdRel.className = 'py-3 px-4 text-xs leading-relaxed';
        if (currentDirTab === 'Adultos') {
          const marital = item.maritalStatus || item.estadoCivil;
          if (['Casado(a)', 'Unión de Hecho'].includes(marital)) {
            const spId = item.spouseId || item.idConyuge;
            const spMem = item.spouseIsMember || item.conyugeEsMiembro;
            const spObj = adults.find(a => String(a.id).trim() === String(spId).trim());
            const spName = spMem ? (spObj ? (spObj.nombreCompleto || spObj.fullName) : 'No hallado') : (item.spouseText || item.nombreConyugeTexto);
            tdRel.innerHTML += `<strong>Cónyuge:</strong> ${escapeHtml(spName || 'S/N')}<br>`;
          }
          const fatId = item.fatherId || item.idPadre;
          const fatMem = item.fatherIsMember || item.padreEsMiembro;
          const fatObj = adults.find(a => String(a.id).trim() === String(fatId).trim());
          const fatName = fatMem ? (fatObj ? (fatObj.nombreCompleto || fatObj.fullName) : 'No hallado') : (item.fatherText || item.nombrePadreTexto);
          if (fatName) tdRel.innerHTML += `<strong>Padre:</strong> ${escapeHtml(fatName)}<br>`;

          const motId = item.motherId || item.idMadre;
          const motMem = item.motherIsMember || item.madreEsMiembro;
          const motObj = adults.find(a => String(a.id).trim() === String(motId).trim());
          const motName = motMem ? (motObj ? (motObj.nombreCompleto || motObj.fullName) : 'No hallado') : (item.motherText || item.nombreMadreTexto);
          if (motName) tdRel.innerHTML += `<strong>Madre:</strong> ${escapeHtml(motName)}`;
        } else {
          const t1Id = item.tutor1Id || item.idTutor1;
          const t1Mem = item.tutor1IsMember || item.tutor1EsMiembro;
          const t1Obj = adults.find(a => String(a.id).trim() === String(t1Id).trim());
          const t1Name = t1Mem ? (t1Obj ? (t1Obj.nombreCompleto || t1Obj.fullName) : 'No hallado') : (item.tutor1Text || item.nombreTutor1Texto);
          tdRel.innerHTML = `<strong>Tutor 1:</strong> ${escapeHtml(t1Name || 'S/N')}`;
        }

        const minorStage = !isAdultTab
          ? getMinorStage(item.birthDate || item.fechaNacimiento, isDeceased ? 'Sí' : 'No', item.deceasedDate || item.fechaDefuncion)
          : null;
        // Traslado a Adulto 100% manual: disponible únicamente para Adolescentes y Jóvenes (no en tabla de Niños)
        // Solo las personas de 15 años o más pueden pasar a Adultos
        const canPromoteNow = (!isAdultTab && !isDeceased &&
          calculateAgeYears(item.birthDate || item.fechaNacimiento, 'No', '') >= MIN_ADULT_MEMBER_AGE);

        const tdCat = document.createElement('td');
        tdCat.className = 'py-3 px-4 text-xs';
        const badge = document.createElement('span');
        badge.className = 'bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold';
        badge.textContent = categoryVal;
        tdCat.appendChild(badge);
        if (minorStage) {
          const stageBadge = document.createElement('span');
          stageBadge.className = `inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${minorStage.badgeClass}`;
          stageBadge.textContent = minorStage.label;
          tdCat.appendChild(document.createElement('br'));
          tdCat.appendChild(stageBadge);
        }
        if (isBaptized) {
          const bapInfo = document.createElement('p');
          bapInfo.className = 'text-[10px] text-cyan-700 font-semibold mt-0.5';
          bapInfo.innerHTML = '<i class="fa-solid fa-water"></i> Bautizado';
          tdCat.appendChild(bapInfo);
        }
        if (inDiscipline) {
          const discInfo = document.createElement('p');
          discInfo.className = 'text-[10px] text-rose-600 font-bold mt-0.5';
          discInfo.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Disciplina';
          tdCat.appendChild(discInfo);
        }

        const tdActions = document.createElement('td');
        tdActions.className = 'py-3 px-4 text-right whitespace-nowrap';

        if (isAdmin && canPromoteNow) {
          const btnProm = document.createElement('button');
          btnProm.className = 'text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-1.5 rounded-lg text-[11px] font-bold mr-1 act-promote';
          btnProm.setAttribute('data-id', item.id);
          btnProm.title = 'Pasar manualmente a Miembro Adulto';
          btnProm.innerHTML = '<i class="fa-solid fa-user-plus pointer-events-none mr-1"></i><span class="pointer-events-none">Adulto</span>';
          tdActions.appendChild(btnProm);
        }

        const btnView = document.createElement('button');
        btnView.className = 'text-blue-600 p-2 hover:bg-blue-50 rounded-lg act-view';
        btnView.setAttribute('data-id', item.id);
        btnView.setAttribute('data-type', isAdultTab ? 'Adultos' : 'Menores');
        btnView.title = 'Ver Expediente';
        btnView.innerHTML = '<i class="fa-solid fa-eye pointer-events-none"></i>';
        tdActions.appendChild(btnView);

        if (isAdmin) {
          const btnEdit = document.createElement('button');
          btnEdit.className = 'text-slate-600 p-2 hover:bg-slate-100 rounded-lg ml-1 act-edit';
          btnEdit.setAttribute('data-id', item.id);
          btnEdit.setAttribute('data-type', isAdultTab ? 'Adulto' : 'Menor');
          btnEdit.title = 'Editar';
          btnEdit.innerHTML = '<i class="fa-solid fa-pen pointer-events-none"></i>';
          tdActions.appendChild(btnEdit);

          const btnDel = document.createElement('button');
          btnDel.className = 'text-rose-600 p-2 hover:bg-rose-50 rounded-lg ml-1 act-del';
          btnDel.setAttribute('data-id', item.id);
          btnDel.setAttribute('data-table', isAdultTab ? 'adult' : 'child');
          btnDel.setAttribute('data-name', nameVal);
          btnDel.title = 'Dar de baja';
          btnDel.innerHTML = '<i class="fa-solid fa-trash pointer-events-none"></i>';
          tdActions.appendChild(btnDel);
        }

        tr.appendChild(tdMember);
        tr.appendChild(tdAge);
        tr.appendChild(tdRel);
        tr.appendChild(tdCat);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      });

      renderDirectoryPagination(totalItems, totalPages, startIdx, endIdx);
    }

    function renderDirectoryPagination(totalItems, totalPages, startIdx, endIdx) {
      const container = document.getElementById('directoryPagination');
      if (!container) return;

      const labelTipo = (currentDirTab === 'Adultos') ? 'adultos' : (currentDirTab === 'Ninos' ? 'niños' : (currentDirTab === 'Adolescentes' ? 'adolescentes' : 'jóvenes'));
      const infoText = totalItems === 0
        ? `Mostrando 0 ${labelTipo}`
        : `Mostrando <strong>${startIdx + 1}–${endIdx}</strong> de <strong>${totalItems}</strong> ${labelTipo} (Página ${currentDirPage} de ${totalPages})`;

      // Ventana compacta de botones numéricos (máximo 5 páginas visibles)
      let startPage = Math.max(1, currentDirPage - 2);
      let endPage = Math.min(totalPages, startPage + 4);
      if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

      let pageBtns = '';
      if (startPage > 1) {
        pageBtns += `<button type="button" data-page="1" class="dir-page-btn px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold transition">1</button>`;
        if (startPage > 2) pageBtns += `<span class="px-1 text-slate-400">…</span>`;
      }
      for (let p = startPage; p <= endPage; p++) {
        const activeCls = (p === currentDirPage)
          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100';
        pageBtns += `<button type="button" data-page="${p}" class="dir-page-btn px-2.5 py-1.5 rounded-lg border font-bold transition ${activeCls}">${p}</button>`;
      }
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pageBtns += `<span class="px-1 text-slate-400">…</span>`;
        pageBtns += `<button type="button" data-page="${totalPages}" class="dir-page-btn px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold transition">${totalPages}</button>`;
      }

      const prevDisabled = currentDirPage <= 1 ? 'disabled opacity-40 cursor-not-allowed' : 'hover:bg-slate-100';
      const nextDisabled = currentDirPage >= totalPages ? 'disabled opacity-40 cursor-not-allowed' : 'hover:bg-slate-100';

      container.innerHTML = `
        <div class="text-slate-600 font-medium">${infoText}</div>
        <div class="flex items-center gap-1 flex-wrap">
          <button type="button" data-page="1" ${currentDirPage <= 1 ? 'disabled' : ''} class="dir-page-btn px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold transition ${prevDisabled}" title="Primera página">
            <i class="fa-solid fa-angles-left pointer-events-none"></i>
          </button>
          <button type="button" data-page="${currentDirPage - 1}" ${currentDirPage <= 1 ? 'disabled' : ''} class="dir-page-btn px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold transition ${prevDisabled}" title="Página anterior">
            <i class="fa-solid fa-chevron-left pointer-events-none mr-1"></i><span class="hidden sm:inline pointer-events-none">Anterior</span>
          </button>
          ${pageBtns}
          <button type="button" data-page="${currentDirPage + 1}" ${currentDirPage >= totalPages ? 'disabled' : ''} class="dir-page-btn px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold transition ${nextDisabled}" title="Página siguiente">
            <span class="hidden sm:inline pointer-events-none">Siguiente</span><i class="fa-solid fa-chevron-right pointer-events-none ml-1"></i>
          </button>
          <button type="button" data-page="${totalPages}" ${currentDirPage >= totalPages ? 'disabled' : ''} class="dir-page-btn px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold transition ${nextDisabled}" title="Última página">
            <i class="fa-solid fa-angles-right pointer-events-none"></i>
          </button>
        </div>
      `;
    }

    function goToDirectoryPage(page) {
      currentDirPage = page;
      renderDirectory();
      const dirSection = document.getElementById('view-directorio');
      if (dirSection) {
        window.scrollTo({ top: Math.max(0, dirSection.offsetTop - 70), behavior: 'smooth' });
      }
    }

    // Barra lateral contraída (escritorio). Con la barra contraída, cada ícono muestra su nombre al pasar el mouse.
    function setSidebarCollapsed(collapsed) {
      document.body.classList.toggle('sidebar-collapsed', collapsed);
      const btn = document.getElementById('btnSidebarToggle');
      if (btn) {
        btn.title = collapsed ? 'Expandir menú (Ctrl+B)' : 'Contraer menú (Ctrl+B)';
        btn.setAttribute('aria-expanded', String(!collapsed));
      }
      document.querySelectorAll('#mainHeader nav button').forEach(b => {
        const label = b.querySelector('.nav-label');
        if (collapsed && label) b.title = label.textContent.trim();
        else b.removeAttribute('title');
      });
      try { localStorage.setItem('ecclesia_sidebar_collapsed', collapsed ? '1' : '0'); } catch (e) {}
    }

    // Menú desplegable de la cabecera (celular y tableta)
    function setMobileMenu(open) {
      const hdr = document.getElementById('mainHeader');
      const btn = document.getElementById('btnMobileMenu');
      if (!hdr || !btn) return;
      hdr.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.title = open ? 'Cerrar menú' : 'Abrir menú';
      btn.querySelector('i').className = 'fa-solid ' + (open ? 'fa-xmark' : 'fa-bars') + ' text-xs';
      syncStickyHeaderHeight();
    }

    function syncStickyHeaderHeight() {
      const hdr = document.getElementById('mainHeader');
      if (window.innerWidth >= 1024) {
        document.documentElement.style.setProperty('--header-h', '68px');
      } else if (hdr) {
        document.documentElement.style.setProperty('--header-h', hdr.offsetHeight + 'px');
      }
    }

    // Paginación de Contribuciones y Caja: solo se dibujan las filas de la página visible
    // (con miles de registros, dibujar todo hacía lenta cada sincronización).
    const TABLE_PAGE_SIZE = 50;
    let currentContribPage = 1;
    let currentCashPage = 1;
    let lastCashFilter = null;

    function renderTablePager(tbody, pagerId, page, totalItems, etiqueta, onGo) {
      let pager = document.getElementById(pagerId);
      if (!pager) {
        const tabla = tbody.closest('table');
        if (!tabla) return;
        const ancla = tabla.parentElement && tabla.parentElement.classList.contains('overflow-x-auto') ? tabla.parentElement : tabla;
        pager = document.createElement('div');
        pager.id = pagerId;
        pager.className = 'no-print flex flex-col sm:flex-row items-center justify-between gap-2 px-3 py-3 text-xs border-t border-slate-100';
        ancla.insertAdjacentElement('afterend', pager);
        pager.addEventListener('click', (e) => {
          const b = e.target.closest('button[data-page]');
          if (b && !b.disabled) pager._onGo(parseInt(b.getAttribute('data-page'), 10));
        });
      }
      pager._onGo = onGo;
      const totalPages = Math.max(1, Math.ceil(totalItems / TABLE_PAGE_SIZE));
      if (totalItems <= TABLE_PAGE_SIZE) {
        pager.innerHTML = totalItems ? `<div class="text-slate-600 font-medium">Mostrando <strong>${totalItems}</strong> ${etiqueta}</div>` : '';
        return;
      }
      const ini = (page - 1) * TABLE_PAGE_SIZE + 1;
      const fin = Math.min(page * TABLE_PAGE_SIZE, totalItems);
      let startPage = Math.max(1, page - 2);
      let endPage = Math.min(totalPages, startPage + 4);
      if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
      const btn = (p, html, title, extra) => `<button type="button" data-page="${p}" ${extra || ''} title="${title}" class="px-2.5 py-1.5 rounded-lg border font-bold transition ${p === page && !extra && /^\d+$/.test(html) ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'} ${extra ? 'opacity-40 cursor-not-allowed' : ''}">${html}</button>`;
      let nums = '';
      if (startPage > 1) nums += btn(1, '1', 'Página 1') + (startPage > 2 ? '<span class="px-1 text-slate-400">…</span>' : '');
      for (let p = startPage; p <= endPage; p++) nums += btn(p, String(p), 'Página ' + p);
      if (endPage < totalPages) nums += (endPage < totalPages - 1 ? '<span class="px-1 text-slate-400">…</span>' : '') + btn(totalPages, String(totalPages), 'Página ' + totalPages);
      pager.innerHTML = `
        <div class="text-slate-600 font-medium">Mostrando <strong>${ini}–${fin}</strong> de <strong>${totalItems}</strong> ${etiqueta} (Página ${page} de ${totalPages})</div>
        <div class="flex items-center gap-1 flex-wrap">
          ${btn(page - 1, '<i class="fa-solid fa-chevron-left pointer-events-none"></i>', 'Página anterior', page <= 1 ? 'disabled' : '')}
          ${nums}
          ${btn(page + 1, '<i class="fa-solid fa-chevron-right pointer-events-none"></i>', 'Página siguiente', page >= totalPages ? 'disabled' : '')}
        </div>`;
    }

    // ── Búsqueda, orden, exportación CSV e impresión institucional de listados ──
    let dirListaFiltrada = [];
    const ordenTablas = { contrib: { key: 'date', dir: 'desc' }, cash: { key: 'date', dir: 'desc' } };
    const normTxt = (v) => String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const VALOR_ORDEN = {
      contrib: {
        date: c => c.date || c.fecha || '', member: c => normTxt(c.memberName || c.nombreMiembro), type: c => normTxt(c.type || c.tipoContribucion),
        method: c => normTxt(c.method || c.metodoPago), amount: c => parseFloat(c.amount || c.monto) || 0
      },
      cash: {
        date: c => c.date || c.fecha || '', type: c => c.movementType || c.tipoMovimiento || '', receipt: c => normTxt(c.receipt || c.reciboFactura),
        concept: c => normTxt(c.category || c.categoriaConcepto), notes: c => normTxt(c.notes || c.descripcionObservacion), amount: c => parseFloat(c.amount || c.monto) || 0
      }
    };
    function sortRecordsList(lista, tabla) {
      const o = ordenTablas[tabla], f = VALOR_ORDEN[tabla][o.key], s = o.dir === 'asc' ? 1 : -1;
      return lista.map((x, i) => [x, i]).sort((a, b) => {
        const va = f(a[0]), vb = f(b[0]);
        return (va < vb ? -1 : va > vb ? 1 : a[1] - b[1]) * s;
      }).map(p => p[0]);
    }
    function getFilteredContributions() {
      const q = normTxt((document.getElementById('contributionSearchInput') || {}).value || '').trim();
      const palabras = q.split(/\s+/).filter(Boolean);
      const lista = palabras.length ? contributions.filter(c => {
        const t = normTxt([c.memberName || c.nombreMiembro, c.type || c.tipoContribucion, c.method || c.metodoPago, c.notes || c.notasReferencia, formatDisplayDate(c.date || c.fecha)].join(' '));
        return palabras.every(p => t.includes(p));
      }) : contributions;
      return sortRecordsList(lista, 'contrib');
    }
    function getFilteredCashMovements() {
      const filter = document.getElementById('cashTypeFilter').value;
      const q = normTxt((document.getElementById('cashSearchInput') || {}).value || '').trim();
      const palabras = q.split(/\s+/).filter(Boolean);
      const lista = cashFlow.filter(cf => {
        if (filter !== 'ALL' && (cf.movementType || cf.tipoMovimiento) !== filter) return false;
        if (!palabras.length) return true;
        const t = normTxt([cf.receipt || cf.reciboFactura, cf.category || cf.categoriaConcepto, cf.notes || cf.descripcionObservacion, cf.movementType || cf.tipoMovimiento, formatDisplayDate(cf.date || cf.fecha)].join(' '));
        return palabras.every(p => t.includes(p));
      });
      return sortRecordsList(lista, 'cash');
    }
    function updateSortIndicators(tbodyId, o) {
      const tabla = document.getElementById(tbodyId) && document.getElementById(tbodyId).closest('table');
      if (!tabla) return;
      tabla.querySelectorAll('th[data-sort]').forEach(th => {
        th.setAttribute('aria-sort', th.getAttribute('data-sort') === o.key ? (o.dir === 'asc' ? 'ascending' : 'descending') : 'none');
        th.tabIndex = 0;
      });
    }
    function bindSortableTableHeaders(tbodyId, tabla, render) {
      const t = document.getElementById(tbodyId) && document.getElementById(tbodyId).closest('table');
      if (!t) return;
      const cambiar = (th) => {
        const k = th.getAttribute('data-sort');
        const o = ordenTablas[tabla];
        if (o.key === k) o.dir = o.dir === 'asc' ? 'desc' : 'asc';
        else { o.key = k; o.dir = (k === 'date' || k === 'amount') ? 'desc' : 'asc'; }
        render();
      };
      t.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => cambiar(th));
        th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cambiar(th); } });
      });
    }

    function downloadCsvFile(nombreBase, encabezados, filas) {
      const celda = (v) => {
        let t = v == null ? '' : String(v);
        if (/^[=+\-@\t\r]/.test(t) && !/^-?\d+(\.\d+)?$/.test(t)) t = "'" + t; // evita fórmulas al abrir en Excel
        return '"' + t.replace(/"/g, '""') + '"';
      };
      const texto = [encabezados, ...filas].map(f => f.map(celda).join(',')).join('\r\n');
      const blob = new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${nombreBase}_${getTodayLocalIsoDate()}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      showToast(`Se descargó ${filas.length} registro(s) en ${a.download}.`);
    }

    function getInstitutionalLogoHtml() {
      try { if (typeof currentCertLogoBase64 === 'string' && currentCertLogoBase64) return currentCertLogoBase64; } catch (e) {}
      const img = document.getElementById('headerLogo');
      return img ? img.src : '';
    }
    function buildDocumentHeaderHtml(titulo, filtrosTexto) {
      const logo = getInstitutionalLogoHtml();
      const rol = getCurrentRole() === 'admin' ? 'Administrador' : 'Consulta';
      return `
        <div class="doc-head">
          ${logo ? `<img src="${escapeHtml(logo)}" alt="" />` : ''}
          <div>
            <p class="doc-org">${escapeHtml(churchConfig.name || 'Iglesia Local')}</p>
            <p class="doc-sub">${escapeHtml(churchConfig.address || '')}</p>
          </div>
          <div class="doc-meta">
            <div><strong>Emisión:</strong> ${escapeHtml(formatDisplayDate(getTodayLocalIsoDate()))}</div>
            <div><strong>Emitido por:</strong> ${escapeHtml(rol)}</div>
          </div>
        </div>
        <p class="doc-title">${escapeHtml(titulo)}</p>
        ${filtrosTexto ? `<p class="doc-filtros">${escapeHtml(filtrosTexto)}</p>` : ''}`;
    }
    // columnas: [{ t: 'Título', num: true }]; filas: arreglos de texto; pie: arreglo opcional (misma cantidad de columnas)
    function printInstitutionalTable(titulo, filtrosTexto, columnas, filas, pie, conFirmas) {
      const printArea = document.getElementById('printOfficialReportArea');
      const th = columnas.map(c => `<th${c.num ? ' class="num"' : ''}>${escapeHtml(c.t)}</th>`).join('');
      const cuerpo = filas.length
        ? filas.map(f => '<tr>' + f.map((v, i) => `<td${columnas[i].num ? ' class="num"' : ''}>${escapeHtml(v)}</td>`).join('') + '</tr>').join('')
        : `<tr><td colspan="${columnas.length}" style="text-align:center;color:#64748b;">Sin registros para los filtros aplicados.</td></tr>`;
      const tfoot = pie ? '<tfoot><tr>' + pie.map((v, i) => `<td${columnas[i].num ? ' class="num"' : ''}>${escapeHtml(v)}</td>`).join('') + '</tr></tfoot>' : '';
      const firmas = conFirmas ? `<div class="doc-firmas"><div>${escapeHtml(churchConfig.pastor || 'Pastor General')}</div><div>${escapeHtml(churchConfig.secretary || 'Secretaría / Tesorería')}</div></div>` : '';
      printArea.innerHTML = (window.AuthUI ? window.AuthUI.getPrintWatermarkHtml() : '') +
        `<div class="print-content">${buildDocumentHeaderHtml(titulo, filtrosTexto)}
          <table class="doc-table"><thead><tr>${th}</tr></thead><tbody>${cuerpo}</tbody>${tfoot}</table>
          <p class="doc-filtros" style="margin-top:6px;">Total de registros: ${filas.length}</p>${firmas}</div>`;
      setTimeout(() => { window.print(); printArea.innerHTML = ''; }, 250);
    }

    function buildContributionsExportData() {
      const lista = getFilteredContributions();
      const filas = lista.map(c => [formatDisplayDate(c.date || c.fecha), c.memberName || c.nombreMiembro || '', c.type || c.tipoContribucion || '',
        c.method || c.metodoPago || '', c.notes || c.notasReferencia || '', (parseFloat(c.amount || c.monto) || 0)]);
      const total = lista.reduce((a, c) => a + (parseFloat(c.amount || c.monto) || 0), 0);
      const q = (document.getElementById('contributionSearchInput') || {}).value || '';
      return { filas, total, filtros: q.trim() ? `Búsqueda: "${q.trim()}"` : 'Todos los aportes asentados' };
    }
    function buildCashBookExportData() {
      const lista = getFilteredCashMovements();
      let ent = 0, sal = 0;
      const filas = lista.map(cf => {
        const amt = parseFloat(cf.amount || cf.monto) || 0;
        const tipo = cf.movementType || cf.tipoMovimiento || '';
        if (tipo === 'Entrada') ent += amt; else sal += amt;
        return [formatDisplayDate(cf.date || cf.fecha), tipo, cf.receipt || cf.reciboFactura || 'S/N', cf.category || cf.categoriaConcepto || '',
          cf.notes || cf.descripcionObservacion || '', tipo === 'Entrada' ? amt : -amt];
      });
      const sel = document.getElementById('cashTypeFilter');
      const q = (document.getElementById('cashSearchInput') || {}).value || '';
      const partes = [sel.options[sel.selectedIndex].text];
      if (q.trim()) partes.push(`Búsqueda: "${q.trim()}"`);
      return { filas, ent, sal, filtros: partes.join(' · ') };
    }
    function buildDirectoryExportData() {
      const esAdulto = currentDirTab === 'Adultos';
      const nombreDe = (id) => { const a = adults.find(x => String(x.id) === String(id)); return a ? (a.fullName || a.nombreCompleto) : ''; };
      const edad = (m) => calculateAgeYears(m.birthDate || m.fechaNacimiento, m.isDeceased || m.fallecido, m.deceasedDate || m.fechaDefuncion);
      const tutor = (m, n) => (m[`tutor${n}IsMember`] || m[`tutor${n}EsMiembro`]) ? nombreDe(m[`tutor${n}Id`] || m[`idTutor${n}`]) : (m[`tutor${n}Text`] || m[`nombreTutor${n}Texto`] || '');
      const enc = esAdulto
        ? ['ID', 'Nombre completo', 'Cédula', 'Género', 'Fecha de nacimiento', 'Edad', 'Estado civil', 'Teléfono', 'Dirección', 'Categoría', 'Bautizado', 'Fecha de bautismo', 'Fecha de ingreso', 'Fallecido']
        : ['ID', 'Nombre completo', 'Género', 'Fecha de nacimiento', 'Edad', 'Tutor 1', 'Tutor 2', 'Teléfono', 'Dirección', 'Categoría', 'Bautizado', 'Fecha de ingreso', 'Fallecido'];
      const filas = dirListaFiltrada.map(m => esAdulto
        ? [m.id, m.fullName || m.nombreCompleto, m.idNumber || m.cedula, m.gender || m.genero, formatDisplayDate(m.birthDate || m.fechaNacimiento), edad(m),
           m.maritalStatus || m.estadoCivil, m.phone || m.telefono, m.address || m.direccion, m.category || m.categoria, m.isBaptized || m.bautizado,
           formatDisplayDate(m.baptismDate || m.fechaBautismo), formatDisplayDate(m.joinDate || m.fechaIngreso), m.isDeceased || m.fallecido]
        : [m.id, m.fullName || m.nombreCompleto, m.gender || m.genero, formatDisplayDate(m.birthDate || m.fechaNacimiento), edad(m), tutor(m, 1), tutor(m, 2),
           m.phone || m.telefono, m.address || m.direccion, m.category || m.categoria, m.isBaptized || m.bautizado, formatDisplayDate(m.joinDate || m.fechaIngreso), m.isDeceased || m.fallecido]);
      const etiqueta = { Adultos: 'Adultos', Ninos: 'Niños (0–10)', Adolescentes: 'Adolescentes (11–15)', Jovenes: 'Jóvenes (16+)' }[currentDirTab] || currentDirTab;
      const cat = document.getElementById('filterCategory'), gen = document.getElementById('filterGender');
      const q = document.getElementById('searchInput').value.trim();
      const partes = [etiqueta, cat.options[cat.selectedIndex].text, gen.options[gen.selectedIndex].text];
      if (q) partes.push(`Búsqueda: "${q}"`);
      return { esAdulto, enc, filas, etiqueta, filtros: partes.join(' · ') };
    }

    function initializeTableToolbars() {
      const reRender = { contrib: () => { currentContribPage = 1; renderContributionsTable(); }, cash: () => { currentCashPage = 1; renderCashTable(); } };
      let tBusca = null;
      const conPausa = (fn) => () => { clearTimeout(tBusca); tBusca = setTimeout(fn, 180); };
      const cs = document.getElementById('contributionSearchInput'); if (cs) cs.addEventListener('input', conPausa(reRender.contrib));
      const fs = document.getElementById('cashSearchInput'); if (fs) fs.addEventListener('input', conPausa(reRender.cash));
      bindSortableTableHeaders('contributionsTableBody', 'contrib', reRender.contrib);
      bindSortableTableHeaders('cashTableBody', 'cash', reRender.cash);

      document.getElementById('btnExportContributionsCsv').addEventListener('click', () => {
        const d = buildContributionsExportData();
        downloadCsvFile('contribuciones', ['Fecha', 'Miembro', 'Tipo', 'Método', 'Nota / Referencia', 'Monto (C$)'], d.filas.map(f => f.map((v, i) => i === 5 ? v.toFixed(2) : v)));
      });
      document.getElementById('btnPrintContributions').addEventListener('click', () => {
        const d = buildContributionsExportData();
        printInstitutionalTable('Libro de Contribuciones y Aportes', d.filtros,
          [{ t: 'Fecha' }, { t: 'Miembro' }, { t: 'Tipo' }, { t: 'Método' }, { t: 'Nota / Referencia' }, { t: 'Monto', num: true }],
          d.filas.map(f => f.map((v, i) => i === 5 ? formatCurrency(v) : v)), ['', '', '', '', 'TOTAL', formatCurrency(d.total)], true);
      });
      document.getElementById('btnExportCashCsv').addEventListener('click', () => {
        const d = buildCashBookExportData();
        downloadCsvFile('caja', ['Fecha', 'Tipo', 'Recibo', 'Concepto', 'Detalle', 'Monto (C$)'], d.filas.map(f => f.map((v, i) => i === 5 ? v.toFixed(2) : v)));
      });
      document.getElementById('btnPrintCashBook').addEventListener('click', () => {
        const d = buildCashBookExportData();
        printInstitutionalTable('Libro Diario de Caja', d.filtros,
          [{ t: 'Fecha' }, { t: 'Tipo' }, { t: 'Recibo' }, { t: 'Concepto' }, { t: 'Detalle' }, { t: 'Monto', num: true }],
          d.filas.map(f => f.map((v, i) => i === 5 ? (v < 0 ? '-' + formatCurrency(-v) : '+' + formatCurrency(v)) : v)),
          ['', '', '', '', `Entradas ${formatCurrency(d.ent)} · Salidas ${formatCurrency(d.sal)}`, 'Neto ' + formatCurrency(d.ent - d.sal)], true);
      });
      document.getElementById('btnExportDirectoryCsv').addEventListener('click', () => {
        const d = buildDirectoryExportData();
        downloadCsvFile('directorio_' + normTxt(d.etiqueta).replace(/[^a-z]+/g, '_').replace(/^_|_$/g, ''), d.enc, d.filas);
      });
      document.getElementById('btnPrintDirectory').addEventListener('click', () => {
        const d = buildDirectoryExportData();
        const idx = d.esAdulto ? [1, 2, 5, 3, 7, 9, 10] : [1, 4, 2, 5, 6, 9, 10];
        printInstitutionalTable('Directorio de Membresía · ' + d.etiqueta, d.filtros, idx.map(i => ({ t: d.enc[i] })), d.filas.map(f => idx.map(i => f[i])), null, false);
      });
    }

    function goToTablePage(tbody, render, setPage, page) {
      setPage(page);
      render();
      const tabla = tbody.closest('table');
      if (tabla) window.scrollTo({ top: Math.max(0, tabla.getBoundingClientRect().top + window.scrollY - 120), behavior: 'smooth' });
    }

    function renderContributionsTable() {
      const tbody = document.getElementById('contributionsTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      let sum = 0;
      const isAdmin = getCurrentRole() === 'admin';

      contributions.forEach(c => { sum += parseFloat(c.amount || c.monto) || 0; });
      const lista = getFilteredContributions();
      const buscado = lista.length !== contributions.length;
      const sumLista = buscado ? lista.reduce((a, c) => a + (parseFloat(c.amount || c.monto) || 0), 0) : sum;
      const totalPages = Math.max(1, Math.ceil(lista.length / TABLE_PAGE_SIZE));
      currentContribPage = Math.min(Math.max(1, currentContribPage), totalPages);
      const desde = (currentContribPage - 1) * TABLE_PAGE_SIZE;
      const frag = document.createDocumentFragment();
      updateSortIndicators('contributionsTableBody', ordenTablas.contrib);
      if (!lista.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" class="py-8 text-center text-slate-400 font-semibold">${contributions.length ? 'Ningún aporte coincide con la búsqueda.' : 'Aún no hay aportes registrados.'}</td>`;
        frag.appendChild(tr);
      }

      lista.slice(desde, desde + TABLE_PAGE_SIZE).forEach(c => {
        const amt = parseFloat(c.amount || c.monto) || 0;
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition';

        const tdDate = document.createElement('td');
        tdDate.className = 'py-2.5 px-3 font-semibold';
        tdDate.textContent = formatDisplayDate(c.date || c.fecha);

        const tdMem = document.createElement('td');
        tdMem.className = 'py-2.5 px-3 font-bold text-slate-800';
        tdMem.textContent = c.memberName || c.nombreMiembro || '';

        const tdType = document.createElement('td');
        tdType.className = 'py-2.5 px-3';
        const typeBadge = document.createElement('span');
        typeBadge.className = 'bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold text-[11px]';
        typeBadge.textContent = c.type || c.tipoContribucion || '';
        tdType.appendChild(typeBadge);

        const tdMethod = document.createElement('td');
        tdMethod.className = 'py-2.5 px-3 text-slate-500';
        tdMethod.textContent = c.method || c.metodoPago || '';

        const tdAmt = document.createElement('td');
        tdAmt.className = 'py-2.5 px-3 text-right font-bold text-emerald-600';
        tdAmt.textContent = `${formatCurrency(amt)}`;

        const tdAct = document.createElement('td');
        tdAct.className = 'py-2.5 px-3 text-right no-print';
        if (isAdmin) {
          const btnDel = document.createElement('button');
          btnDel.className = 'text-rose-600 hover:text-rose-800 p-1 act-del-contrib';
          btnDel.setAttribute('data-id', c.id);
          btnDel.setAttribute('data-name', `Aporte ${formatCurrency(amt)} de${c.memberName || c.nombreMiembro}`);
          btnDel.innerHTML = '<i class="fa-solid fa-trash pointer-events-none"></i>';
          tdAct.appendChild(btnDel);
        }

        tr.appendChild(tdDate);
        tr.appendChild(tdMem);
        tr.appendChild(tdType);
        tr.appendChild(tdMethod);
        tr.appendChild(tdAmt);
        tr.appendChild(tdAct);
        frag.appendChild(tr);
      });
      tbody.appendChild(frag);
      renderTablePager(tbody, 'contributionPagination', currentContribPage, lista.length, 'aportes',
        (p) => goToTablePage(tbody, renderContributionsTable, (v) => { currentContribPage = v; }, p));

      document.getElementById('contributionTotalBadge').textContent = buscado ? `Total filtrado: ${formatCurrency(sumLista)}` : `Total: ${formatCurrency(sum)}`;
    }

    function renderCashTable() {
      const tbody = document.getElementById('cashTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      const filter = document.getElementById('cashTypeFilter').value;
      const isAdmin = getCurrentRole() === 'admin';
      let totalIncome = 0; let totalExpense = 0;

      contributions.forEach(c => { totalIncome += (parseFloat(c.amount || c.monto) || 0); });

      cashFlow.forEach(cf => {
        const amt = parseFloat(cf.amount || cf.monto) || 0;
        const movType = cf.movementType || cf.tipoMovimiento;
        if (movType === 'Entrada') totalIncome += amt; else totalExpense += amt;
      });
      const filas = getFilteredCashMovements();
      if (filter !== lastCashFilter) { currentCashPage = 1; lastCashFilter = filter; }
      const totalPages = Math.max(1, Math.ceil(filas.length / TABLE_PAGE_SIZE));
      currentCashPage = Math.min(Math.max(1, currentCashPage), totalPages);
      const desde = (currentCashPage - 1) * TABLE_PAGE_SIZE;
      const frag = document.createDocumentFragment();
      updateSortIndicators('cashTableBody', ordenTablas.cash);
      if (!filas.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="7" class="py-8 text-center text-slate-400 font-semibold">${cashFlow.length ? 'Ningún movimiento coincide con el filtro o la búsqueda.' : 'Aún no hay movimientos de caja registrados.'}</td>`;
        frag.appendChild(tr);
      }

      filas.slice(desde, desde + TABLE_PAGE_SIZE).forEach(cf => {
        const amt = parseFloat(cf.amount || cf.monto) || 0;
        const movType = cf.movementType || cf.tipoMovimiento;
        const isIncome = movType === 'Entrada';
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition';

        const tdDate = document.createElement('td');
        tdDate.className = 'py-2.5 px-3 font-semibold';
        tdDate.textContent = formatDisplayDate(cf.date || cf.fecha);

        const tdType = document.createElement('td');
        tdType.className = 'py-2.5 px-3';
        const typeBadge = document.createElement('span');
        typeBadge.className = `px-2 py-0.5 rounded font-bold text-[10px] ${isIncome ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`;
        typeBadge.textContent = movType;
        tdType.appendChild(typeBadge);

        const tdRec = document.createElement('td');
        tdRec.className = 'py-2.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap';
        tdRec.textContent = cf.receipt || cf.reciboFactura || 'S/N';

        const tdCat = document.createElement('td');
        tdCat.className = 'py-2.5 px-3 font-bold text-slate-800';
        tdCat.textContent = cf.category || cf.categoriaConcepto || '';

        const tdNotes = document.createElement('td');
        tdNotes.className = 'py-2.5 px-3 text-slate-500';
        tdNotes.textContent = cf.notes || cf.descripcionObservacion || '-';

        const tdAmt = document.createElement('td');
        tdAmt.className = `py-2.5 px-3 text-right font-black ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`;
        tdAmt.textContent = `${isIncome ? '+' : '-'}${formatCurrency(amt)}`;

        const tdAct = document.createElement('td');
        tdAct.className = 'py-2.5 px-3 text-right no-print';
        if (isAdmin) {
          const btnDel = document.createElement('button');
          btnDel.className = 'text-rose-600 hover:text-rose-800 p-1 act-del-cash';
          btnDel.setAttribute('data-id', cf.id);
          btnDel.setAttribute('data-name', `Movimiento ${cf.receipt || cf.reciboFactura} (${formatCurrency(amt)})`);
          btnDel.innerHTML = '<i class="fa-solid fa-trash pointer-events-none"></i>';
          tdAct.appendChild(btnDel);
        }

        tr.appendChild(tdDate);
        tr.appendChild(tdType);
        tr.appendChild(tdRec);
        tr.appendChild(tdCat);
        tr.appendChild(tdNotes);
        tr.appendChild(tdAmt);
        tr.appendChild(tdAct);
        frag.appendChild(tr);
      });
      tbody.appendChild(frag);
      renderTablePager(tbody, 'cashPagination', currentCashPage, filas.length, 'movimientos',
        (p) => goToTablePage(tbody, renderCashTable, (v) => { currentCashPage = v; }, p));

      const netBalance = totalIncome - totalExpense;
      document.getElementById('cashIncomeTotal').textContent = `${formatCurrency(totalIncome)}`;
      document.getElementById('cashExpenseTotal').textContent = `${formatCurrency(totalExpense)}`;
      const netElem = document.getElementById('cashBalanceNet');
      netElem.textContent = `${formatCurrency(netBalance)}`;
      netElem.className = `cash-amount font-black mt-1 ${netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`;
    }

