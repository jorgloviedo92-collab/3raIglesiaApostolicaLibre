/* ════════════════════════════════════════════════════════════════════
   BUSCADOR DE PERSONAS (Cónyuge, Padre, Madre, Tutores, Contribuyente, Certificados)
   Convierte una lista desplegable en un campo donde se escribe parte del
   nombre o la cédula y se elige entre las coincidencias.
   La <select> original sigue existiendo (oculta) y es la que lee el resto
   del sistema, así que guardar, editar y validar funcionan igual que antes.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  var MAX_VISIBLES = 60; // con listas muy grandes se muestran 60 y se pide afinar la búsqueda
  var valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  var idxDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
  var uid = 0;

  function normalizar(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  // Índice por ID de adultos y menores (se rehace solo cuando cambian las listas), para buscar rápido aun con miles de personas
  var indiceAdultos = null, indiceMenores = null, indiceTam = -1, indice = new Map();
  function personaPorId(id) {
    var la = (typeof adults !== 'undefined' && Array.isArray(adults)) ? adults : [];
    var lm = (typeof children !== 'undefined' && Array.isArray(children)) ? children : [];
    if (la !== indiceAdultos || lm !== indiceMenores || indiceTam !== la.length + lm.length) {
      indice = new Map();
      lm.forEach(function (c) { indice.set(String(c.id).trim(), c); });
      la.forEach(function (a) { indice.set(String(a.id).trim(), a); });
      indiceAdultos = la; indiceMenores = lm; indiceTam = la.length + lm.length;
    }
    return indice.get(String(id).trim());
  }

  // Datos extra para distinguir personas con el mismo nombre (cédula y edad)
  function detallePersona(id) {
    try {
      var p = personaPorId(id);
      if (!p) return '';
      var partes = [];
      var ced = p.idNumber || p.cedula;
      if (ced) partes.push(ced);
      var nac = p.birthDate || p.fechaNacimiento;
      if (nac && typeof calculateAgeYears === 'function') partes.push(calculateAgeYears(nac, 'No', '') + ' años');
      return partes.join(' · ');
    } catch (e) { return ''; }
  }

  function createPersonPickerInstance(sel) {
    if (!sel || sel.dataset.pp) return;
    sel.dataset.pp = '1';
    var listId = 'person-picker-list-' + (++uid);

    var box = document.createElement('div');
    box.className = 'person-picker-combo';
    var field = document.createElement('div');
    field.className = 'person-picker-field';
    var input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', listId);
    // Mismo estilo que tenía la lista (bordes, colores), sin la clase que la oculta
    input.className = sel.className.replace(/\bhidden\b/g, '') + ' person-picker-input';
    var lupa = document.createElement('i');
    lupa.className = 'fa-solid fa-magnifying-glass person-picker-lupa';
    lupa.setAttribute('aria-hidden', 'true');
    var limpiar = document.createElement('button');
    limpiar.type = 'button';
    limpiar.className = 'person-picker-clear';
    limpiar.setAttribute('aria-label', 'Quitar selección');
    limpiar.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    var list = document.createElement('ul');
    list.id = listId;
    list.className = 'person-picker-list';
    list.setAttribute('role', 'listbox');
    list.hidden = true;

    field.append(lupa, input, limpiar);
    box.append(field, list);
    sel.insertAdjacentElement('afterend', box);
    sel.classList.add('person-picker-native');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');

    var activo = -1;
    var visibles = [];
    var placeholder = '';

    function opciones() {
      return Array.prototype.filter.call(sel.options, function (o) { return o.value !== ''; });
    }
    function textoSeleccionado() {
      var o = sel.options[idxDesc.get.call(sel)];
      return o && o.value !== '' ? o.text : '';
    }
    function sincronizar() {
      var vacio = sel.options[0] && sel.options[0].value === '' ? sel.options[0].text : '';
      placeholder = vacio ? vacio.replace(/^Selecciona?r?e?\s*/i, 'Buscar ').replace(/\.\.\.$/, '') + ' por nombre o cédula…' : 'Buscar por nombre o cédula…';
      input.placeholder = placeholder;
      if (document.activeElement !== input) input.value = textoSeleccionado();
      box.classList.toggle('person-picker-has-value', !!valueDesc.get.call(sel));
      box.hidden = sel.classList.contains('hidden');
      input.disabled = sel.disabled;
      input.setCustomValidity('');
    }

    function pintar(filtro) {
      var palabras = normalizar(filtro).split(/\s+/).filter(Boolean);
      var todas = opciones();
      var coincidencias = palabras.length ? todas.filter(function (o) {
        var t = normalizar(o.text + ' ' + detallePersona(o.value));
        return palabras.every(function (p) { return t.indexOf(p) !== -1; });
      }) : todas;
      visibles = coincidencias.slice(0, MAX_VISIBLES);
      list.innerHTML = '';
      var actual = valueDesc.get.call(sel);
      visibles.forEach(function (o, i) {
        var li = document.createElement('li');
        li.id = listId + '-' + i;
        li.className = 'person-picker-item' + (o.value === actual ? ' person-picker-current' : '');
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', o.value === actual ? 'true' : 'false');
        var nombre = document.createElement('span');
        nombre.className = 'person-picker-name';
        nombre.textContent = o.text;
        li.appendChild(nombre);
        var det = detallePersona(o.value);
        if (det && o.text.indexOf(det.split(' · ')[0]) === -1) {
          var d = document.createElement('span');
          d.className = 'person-picker-meta';
          d.textContent = det;
          li.appendChild(d);
        }
        li.addEventListener('mousedown', function (e) { e.preventDefault(); elegir(o.value); });
        list.appendChild(li);
      });
      if (!coincidencias.length) {
        var vacio = document.createElement('li');
        vacio.className = 'person-picker-empty';
        vacio.textContent = todas.length ? 'Ninguna persona coincide con «' + filtro.trim() + '».' : 'No hay personas disponibles para esta selección.';
        list.appendChild(vacio);
      } else if (coincidencias.length > visibles.length) {
        var mas = document.createElement('li');
        mas.className = 'person-picker-empty';
        mas.textContent = 'Hay ' + (coincidencias.length - visibles.length) + ' más. Escribe más letras para afinar la búsqueda.';
        list.appendChild(mas);
      }
      marcar(visibles.length === 1 || palabras.length ? 0 : -1);
    }

    function marcar(i) {
      activo = i;
      Array.prototype.forEach.call(list.querySelectorAll('.person-picker-item'), function (li, k) {
        li.classList.toggle('person-picker-active', k === i);
      });
      var li = i >= 0 ? document.getElementById(listId + '-' + i) : null;
      if (li) { input.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
      else input.removeAttribute('aria-activedescendant');
    }

    function abrir() {
      if (input.disabled) return;
      pintar(input.value === textoSeleccionado() ? '' : input.value);
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      box.classList.add('person-picker-open');
    }
    function cerrar() {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      box.classList.remove('person-picker-open');
      input.removeAttribute('aria-activedescendant');
    }
    function elegir(valor) {
      valueDesc.set.call(sel, valor);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      input.value = textoSeleccionado();
      box.classList.toggle('person-picker-has-value', !!valor);
      input.setCustomValidity('');
      cerrar();
    }

    input.addEventListener('focus', function () { input.select(); abrir(); });
    input.addEventListener('click', function () { if (list.hidden) abrir(); });
    input.addEventListener('input', function () { input.setCustomValidity(''); pintar(input.value); list.hidden = false; input.setAttribute('aria-expanded', 'true'); box.classList.add('person-picker-open'); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) abrir(); else marcar(Math.min(visibles.length - 1, activo + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); marcar(Math.max(0, activo - 1)); }
      else if (e.key === 'Enter') { if (!list.hidden && activo >= 0 && visibles[activo]) { e.preventDefault(); elegir(visibles[activo].value); } }
      else if (e.key === 'Escape') { if (!list.hidden) { e.preventDefault(); input.value = textoSeleccionado(); cerrar(); } }
      else if (e.key === 'Tab') { cerrar(); }
    });
    input.addEventListener('blur', function () {
      // Si se escribió algo sin elegir, se vuelve a mostrar la selección vigente
      setTimeout(function () { input.value = textoSeleccionado(); cerrar(); }, 120);
    });
    limpiar.addEventListener('click', function () { elegir(''); input.focus(); });

    // Si el formulario exige la selección (p. ej. Miembro contribuyente), el aviso sale en el buscador
    sel.addEventListener('invalid', function (e) {
      e.preventDefault();
      input.setCustomValidity('Escribe y elige una persona de la lista.');
      input.reportValidity();
    });

    // Cambios hechos por el sistema (editar ficha, limpiar formulario, recargar listas)
    Object.defineProperty(sel, 'value', {
      configurable: true,
      get: function () { return valueDesc.get.call(this); },
      set: function (v) { valueDesc.set.call(this, v); sincronizar(); }
    });
    Object.defineProperty(sel, 'selectedIndex', {
      configurable: true,
      get: function () { return idxDesc.get.call(this); },
      set: function (v) { idxDesc.set.call(this, v); sincronizar(); }
    });
    new MutationObserver(sincronizar).observe(sel, { childList: true, attributes: true, attributeFilter: ['class', 'disabled'] });
    if (sel.form) sel.form.addEventListener('reset', function () { setTimeout(sincronizar, 0); });
    sincronizar();
  }

  ['spouseSelect', 'fatherSelect', 'motherSelect', 'tutor1Select', 'tutor2Select', 'contributionMemberSelect', 'certMemberSelect']
    .forEach(function (id) { createPersonPickerInstance(document.getElementById(id)); });
  window.createPersonPicker = createPersonPickerInstance;
})();
