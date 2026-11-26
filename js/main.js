    // ────────────────────────────────────────────────────────────────────
    // EVENTOS AL CARGAR LA PÁGINA
    // ────────────────────────────────────────────────────────────────────

    window.addEventListener('DOMContentLoaded', () => {
      const savedUrl = getScriptUrl();
      if (savedUrl) document.getElementById('serverUrlInput').value = savedUrl;

      toggleDisciplineAvailability();
      setCashFlowRangeLastMonths(6);
      document.getElementById('cashFlowStartDate').addEventListener('change', renderCashFlowChart);
      document.getElementById('cashFlowEndDate').addEventListener('change', renderCashFlowChart);
      document.getElementById('btnCashFlowLast6Months').addEventListener('click', () => { setCashFlowRangeLastMonths(6); renderCashFlowChart(); });

      // Reportes: años según los datos y trimestre actual por defecto
      populateReportYears();
      const rptQuarterSelect = document.getElementById('reportQuarterSelect');
      if (rptQuarterSelect) {
        const month = parseInt(getTodayLocalIsoDate().slice(5, 7), 10);
        rptQuarterSelect.value = String(Math.floor((month - 1) / 3) + 1);
      }

      document.getElementById('loginForm').addEventListener('submit', handleDirectLogin);
      document.getElementById('memberForm').addEventListener('submit', handleMemberFormSubmit);
      document.getElementById('contributionForm').addEventListener('submit', handleContribSubmit);
      document.getElementById('cashFlowForm').addEventListener('submit', handleCashMovementSubmit);

      document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
      });

      document.getElementById('disciplineAlertFilters').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-filter]');
        if (!btn) return;
        discAlertState.filter = btn.getAttribute('data-filter');
        discAlertState.showAll = false;
        renderDisciplineAlerts();
      });
      document.getElementById('disciplineAlertShowMoreBtn').addEventListener('click', () => {
        discAlertState.showAll = !discAlertState.showAll;
        renderDisciplineAlerts();
      });
      document.getElementById('disciplineAlertToggleBtn').addEventListener('click', () => {
        discAlertState.collapsed = !discAlertState.collapsed;
        try { localStorage.setItem('ecclesia_disc_collapsed', discAlertState.collapsed ? '1' : '0'); } catch (e) {}
        renderDisciplineAlerts();
      });

      document.getElementById('disciplineAlertList').addEventListener('click', (e) => {
        const btnView = e.target.closest('.btn-alert-view');
        if (btnView) {
          viewMemberModal(btnView.getAttribute('data-id'), btnView.getAttribute('data-type'));
          return;
        }
        const btnLift = e.target.closest('.btn-alert-lift');
        if (btnLift) {
          executeLiftDiscipline(
            btnLift.getAttribute('data-table'),
            btnLift.getAttribute('data-id'),
            btnLift.getAttribute('data-name')
          );
        }
      });

      document.getElementById('directoryTableBody').addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        if (btn.classList.contains('act-promote')) startPromoteMinorToAdult(id);
        else if (btn.classList.contains('act-view')) viewMemberModal(id, btn.getAttribute('data-type'));
        else if (btn.classList.contains('act-edit')) editMember(id, btn.getAttribute('data-type'));
        else if (btn.classList.contains('act-del')) executeLogicalDelete(btn.getAttribute('data-table'), id, btn.getAttribute('data-name'));
      });

      document.getElementById('contributionsTableBody').addEventListener('click', (e) => {
        const btn = e.target.closest('.act-del-contrib');
        if (btn) executeLogicalDelete('contribution', btn.getAttribute('data-id'), btn.getAttribute('data-name'));
      });

      document.getElementById('cashTableBody').addEventListener('click', (e) => {
        const btn = e.target.closest('.act-del-cash');
        if (btn) executeLogicalDelete('cash', btn.getAttribute('data-id'), btn.getAttribute('data-name'));
      });

      document.getElementById('dirTabAdults').addEventListener('click', () => setActiveDirectoryTab('Adultos'));
      document.getElementById('dirTabChildren').addEventListener('click', () => setActiveDirectoryTab('Ninos'));
      document.getElementById('dirTabTeens').addEventListener('click', () => setActiveDirectoryTab('Adolescentes'));
      document.getElementById('dirTabYouth').addEventListener('click', () => setActiveDirectoryTab('Jovenes'));

      const onDirectoryFilterChange = () => {
        currentDirPage = 1;
        renderDirectory();
        const scroller = document.getElementById('directoryTableWrapper');
        if (scroller) scroller.scrollTop = 0;
      };
      document.getElementById('searchInput').addEventListener('input', onDirectoryFilterChange);
      document.getElementById('filterCategory').addEventListener('change', onDirectoryFilterChange);
      document.getElementById('filterGender').addEventListener('change', onDirectoryFilterChange);

      document.getElementById('directoryPagination').addEventListener('click', (e) => {
        const btn = e.target.closest('.dir-page-btn');
        if (!btn || btn.disabled) return;
        const targetPage = parseInt(btn.getAttribute('data-page'), 10);
        if (!isNaN(targetPage)) goToDirectoryPage(targetPage);
      });

      syncStickyHeaderHeight();
      window.addEventListener('resize', syncStickyHeaderHeight);

      // Barra lateral: estado recordado, botón y atajo Ctrl+B (escritorio); menú desplegable (celular)
      let sidebarCollapsed = false;
      try { sidebarCollapsed = localStorage.getItem('ecclesia_sidebar_collapsed') === '1'; } catch (e) {}
      setSidebarCollapsed(sidebarCollapsed);
      document.getElementById('btnSidebarToggle').addEventListener('click', () => {
        setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'));
      });
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && window.innerWidth >= 1024) {
          e.preventDefault();
          setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'));
        }
      });
      document.getElementById('btnMobileMenu').addEventListener('click', () => {
        setMobileMenu(!document.getElementById('mainHeader').classList.contains('menu-open'));
      });
      document.getElementById('cashTypeFilter').addEventListener('change', renderCashTable);
      initializeTableToolbars();

      document.getElementById('btnTypeAdult').addEventListener('click', () => {
        if (document.getElementById('memberType').value !== 'Adulto') cancelEditMember('Adulto');
      });
      
      document.getElementById('btnTypeChild').addEventListener('click', () => {
        if (document.getElementById('memberType').value !== 'Menor') cancelEditMember('Menor');
      });

      document.getElementById('birthDate').addEventListener('change', updateAgePreview);
      document.getElementById('birthDate').addEventListener('input', updateAgePreview);
      document.getElementById('isDeceased').addEventListener('change', () => {
        document.getElementById('deceasedBox').classList.toggle('hidden', document.getElementById('isDeceased').value !== 'Sí');
        toggleDisciplineAvailability();
        updateAgePreview();
      });
      document.getElementById('deceasedDate').addEventListener('change', updateAgePreview);
      document.getElementById('isBaptized').addEventListener('change', () => {
        document.getElementById('baptismBox').classList.toggle('hidden', document.getElementById('isBaptized').value !== 'Sí');
        toggleDisciplineAvailability();
      });
      document.getElementById('category').addEventListener('change', toggleDisciplineAvailability);
      document.getElementById('inDiscipline').addEventListener('change', toggleDisciplineFields);
      document.getElementById('disciplineDate').addEventListener('change', calcDisciplineEnd);
      document.getElementById('disciplineMonths').addEventListener('input', calcDisciplineEnd);
      document.getElementById('disciplineIndefinite').addEventListener('change', calcDisciplineEnd);

      document.getElementById('gender').addEventListener('change', () => populateSelectors());
      // Cada elección recalcula las demás listas (p. ej. elegir cónyuge la saca de Padre/Madre)
      document.getElementById('spouseSelect').addEventListener('change', () => populateSelectors('spouse'));
      document.getElementById('fatherSelect').addEventListener('change', () => populateSelectors('father'));
      document.getElementById('motherSelect').addEventListener('change', () => populateSelectors('mother'));
      document.getElementById('birthDate').addEventListener('change', () => populateSelectors());
      ['spouseIsMember', 'fatherIsMember', 'motherIsMember'].forEach(id =>
        document.getElementById(id).addEventListener('change', () => populateSelectors()));
      document.getElementById('maritalStatus').addEventListener('change', toggleAdultFamily);
      document.getElementById('spouseIsMember').addEventListener('change', toggleAdultFamily);
      document.getElementById('fatherIsMember').addEventListener('change', toggleAdultFamily);
      document.getElementById('motherIsMember').addEventListener('change', toggleAdultFamily);

      document.getElementById('tutor1IsMember').addEventListener('change', toggleChildFamily);
      document.getElementById('tutor2IsMember').addEventListener('change', toggleChildFamily);
      document.getElementById('presentedToChurch').addEventListener('change', toggleChildFamily);

      document.getElementById('cashMovementTypeSelect').addEventListener('change', updateCashCategorySelect);

      document.getElementById('photoFileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { showToast("Formato inválido. Solo se admiten PNG, JPG o WEBP.", "error"); return; }
        if (file.size > 2 * 1024 * 1024) { showToast("La fotografía no debe superar 2MB.", "error"); return; }
        const r = new FileReader();
        r.onload = (ev) => {
          const img = new Image();
          img.onerror = () => showToast("No se pudo leer la imagen seleccionada.", "error");
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX = 240;
            let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h *= MAX/w; w = MAX; } } else { if (h > MAX) { w *= MAX/h; h = MAX; } }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            currentPhotoBase64 = canvas.toDataURL('image/jpeg', 0.8);
            document.getElementById('photoPreview').src = currentPhotoBase64;
            document.getElementById('photoPreview').classList.remove('hidden');
            document.getElementById('photoPlaceholder').classList.add('hidden');
          };
          img.src = ev.target.result;
        };
        r.readAsDataURL(file);
      });

      document.getElementById('btnClearPhoto').addEventListener('click', () => {
        currentPhotoBase64 = '';
        document.getElementById('photoPreview').src = '';
        document.getElementById('photoPreview').classList.add('hidden');
        document.getElementById('photoPlaceholder').classList.remove('hidden');
      });

      document.getElementById('btnCloseModalTop').addEventListener('click', () => document.getElementById('memberModal').classList.replace('flex', 'hidden'));
      document.getElementById('btnCloseModalBottom').addEventListener('click', () => document.getElementById('memberModal').classList.replace('flex', 'hidden'));
      
      document.getElementById('btnCancelMember').addEventListener('click', () => {
        cancelEditMember('Adulto');
        switchTab('directorio');
      });

      document.getElementById('btnHeaderSync').addEventListener('click', () => syncFromCloud(true));
      document.getElementById('btnHeaderLogout').addEventListener('click', () => logoutSystem(true));
      document.getElementById('btnHeaderReportes').addEventListener('click', () => switchTab('reportes'));

      document.getElementById('btnRefreshReport').addEventListener('click', renderOnScreenReport);
      document.getElementById('btnPrintReportScreen').addEventListener('click', printReport);
      document.getElementById('reportYearSelect').addEventListener('change', renderOnScreenReport);
      document.getElementById('reportQuarterSelect').addEventListener('change', renderOnScreenReport);
      document.getElementById('reportAuthorInput').addEventListener('input', debouncedRenderOnScreenReport);

      document.getElementById('cardAdultsTrigger').addEventListener('click', () => {
        document.getElementById('dirTabAdults').click();
        switchTab('directorio');
      });
      document.getElementById('cardChildrenTrigger').addEventListener('click', () => {
        document.getElementById('dirTabChildren').click();
        switchTab('directorio');
      });

      document.getElementById('btnOpenConfigMain').addEventListener('click', () => {
        document.getElementById('cfgChurchName').value = churchConfig.name || '';
        document.getElementById('cfgPastorName').value = churchConfig.pastor || '';
        document.getElementById('cfgSecretaryName').value = churchConfig.secretary || '';
        document.getElementById('cfgChurchAddress').value = churchConfig.address || '';
        document.getElementById('checkChangePin').checked = false;
        document.getElementById('pinEditBox').classList.add('hidden');
        document.getElementById('cfgPinActual').value = '';
        document.getElementById('cfgPinAdmin').value = '';
        document.getElementById('cfgPinConsulta').value = '';
        document.getElementById('configModal').classList.replace('hidden', 'flex');
      });

      document.getElementById('btnCloseConfigTop').addEventListener('click', () => document.getElementById('configModal').classList.replace('flex', 'hidden'));
      document.getElementById('btnCloseConfigBottom').addEventListener('click', () => document.getElementById('configModal').classList.replace('flex', 'hidden'));
      document.getElementById('checkChangePin').addEventListener('change', (e) => {
        document.getElementById('pinEditBox').classList.toggle('hidden', !e.target.checked);
      });

      document.getElementById('churchConfigForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const isChangingPin = document.getElementById('checkChangePin').checked;
        const cfgData = {
          name: document.getElementById('cfgChurchName').value.trim(),
          pastor: document.getElementById('cfgPastorName').value.trim(),
          secretary: document.getElementById('cfgSecretaryName').value.trim(),
          address: document.getElementById('cfgChurchAddress').value.trim(),
          changePin: isChangingPin,
          pinActual: document.getElementById('cfgPinActual').value.trim(),
          newPinAdmin: document.getElementById('cfgPinAdmin').value.trim(),
          newPinConsulta: document.getElementById('cfgPinConsulta').value.trim()
        };

        const cfgError = validateChurchConfig(cfgData);
        if (cfgError) {
          showToast(cfgError, "error");
          return;
        }

        showSaving("Guardando configuración...");
        try {
          const res = await fetchAPI('config', cfgData);
          if (res.status === 'ok') {
            document.getElementById('configModal').classList.replace('flex', 'hidden');
            if (isChangingPin) {
              showToast("PINs actualizados. Inicia sesión con tu nueva clave.");
              await logoutSystem(false, "PINs actualizados con éxito. Ingresa con tu nuevo PIN.");
            } else {
              if (res.churchConfig) churchConfig = { ...churchConfig, ...res.churchConfig };
              updateAllViews();
              showToast("Configuración institucional guardada.");
            }
          } else {
            throw new Error(res.message);
          }
        } catch (err) {
          showToast(err.message, "error");
        } finally {
          hideSaving();
        }
      });

      document.getElementById('idNumber').addEventListener('input', (e) => {
        let val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        // Posiciones 1-13 solo dígitos; la posición 14 es la letra final
        val = val.split('').reduce((acc, ch) => (acc.length < 13 ? /\d/.test(ch) : /[A-Z]/.test(ch)) ? acc + ch : acc, '');
        if (val.length > 14) val = val.substring(0, 14);
        let formatted = '';
        if (val.length > 0) formatted += val.substring(0, 3);
        if (val.length > 3) formatted += '-' + val.substring(3, 9);
        if (val.length > 9) formatted += '-' + val.substring(9, 14);
        e.target.value = formatted;
      });

      // EVENTOS DE LA PAPELERA
      document.getElementById('trashModuleFilter').addEventListener('change', renderTrashTable);
      document.getElementById('btnEmptyTrash').addEventListener('click', executeEmptyTrash);
      document.getElementById('trashTableBody').addEventListener('click', (e) => {
        const btn = e.target.closest('.act-restore');
        if (btn) executeLogicalRestore(btn.getAttribute('data-table'), btn.getAttribute('data-id'));
      });

      // ARRANQUE INICIAL
      if (getSessionToken()) {
        document.getElementById('authOverlay').classList.add('hidden');
        applyRoleRestrictions();
        resetInactivityTimer();
        syncFromCloud(false);
      } else {
        document.getElementById('authOverlay').classList.remove('hidden');
      }
    });
