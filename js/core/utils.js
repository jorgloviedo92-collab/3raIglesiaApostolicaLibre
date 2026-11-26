    // ────────────────────────────────────────────────────────────────────
    // FECHA LOCAL PRECISA (NICARAGUA UTC-6) Y ESCAPADO SEGURO
    // ────────────────────────────────────────────────────────────────────

    // Crear un Intl.DateTimeFormat es costoso; se crea una sola vez y se reutiliza.
    // (Antes se creaba en cada llamada, y esta función se llama una vez por cada edad calculada.)
    const NICARAGUA_ISO_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit' });
    function getTodayLocalIsoDate() {
      return NICARAGUA_ISO_DATE_FORMATTER.format(new Date());
    }

    function parseDateSafe(dateStr) {
      if (!dateStr) return null;
      const s = String(dateStr).split('T')[0];
      const p = s.split('-');
      if (p.length !== 3 || !/^\d{4}$/.test(p[0]) || !/^\d{1,2}$/.test(p[1]) || !/^\d{1,2}$/.test(p[2])) return null;
      const y = parseInt(p[0], 10), m = parseInt(p[1], 10), d = parseInt(p[2], 10);
      if (y < 1900 || y > 2100) return null;
      // setFullYear evita que años 0-99 se interpreten como 19xx; se rechazan fechas que "rebotan" (31 de febrero, mes 13...)
      const date = new Date(2000, 0, 1);
      date.setFullYear(y, m - 1, d);
      if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
      return date;
    }

    // Monto monetario: acepta solo números positivos con un máximo de 2 decimales y devuelve el valor redondeado al centavo (o null si no es válido)
    function parseMoneyAmount(raw) {
      const txt = String(raw === null || raw === undefined ? '' : raw).trim();
      if (!/^\d+(\.\d{1,2})?$/.test(txt)) return null;
      const n = Math.round(parseFloat(txt) * 100) / 100;
      return (n >= 0.01 && n <= 9999999) ? n : null;
    }

    function formatDisplayDate(dateStr) {
      if (!dateStr) return 'S/F';
      const d = parseDateSafe(dateStr);
      if (!d) return String(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      })[tag] || tag);
    }

    function sanitizeDriveUrl(url) {
      if (!url || typeof url !== 'string') return '';
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:' && 
           (parsed.hostname === 'lh3.googleusercontent.com' || parsed.hostname === 'drive.google.com')) {
          return parsed.href;
        }
      } catch (e) {}
      return '';
    }

    function calculateAgeYears(birthDateStr, isDeceased, deceasedDateStr) {
      if (!birthDateStr) return 0;
      const birth = parseDateSafe(birthDateStr);
      if (!birth) return 0;
      const end = (isDeceased === 'Sí' && deceasedDateStr)
        ? (parseDateSafe(deceasedDateStr) || parseDateSafe(getTodayLocalIsoDate()) || new Date())
        : (parseDateSafe(getTodayLocalIsoDate()) || new Date());
      let years = end.getFullYear() - birth.getFullYear();
      const mDiff = end.getMonth() - birth.getMonth();
      if (mDiff < 0 || (mDiff === 0 && end.getDate() < birth.getDate())) years--;
      return Math.max(0, years);
    }

    function getMinorStage(birthDateStr, isDeceased, deceasedDateStr) {
      const years = calculateAgeYears(birthDateStr, isDeceased, deceasedDateStr);
      if (years >= 16) {
        return { key: 'Joven', label: 'Joven (16+)', badgeClass: 'bg-sky-100 text-sky-800 border border-sky-200' };
      }
      if (years >= 11) {
        return { key: 'Adolescente', label: 'Adolescente (11-15)', badgeClass: 'bg-purple-100 text-purple-800 border border-purple-200' };
      }
      return { key: 'Nino', label: 'Niño(a) (0-10)', badgeClass: 'bg-teal-100 text-teal-800 border border-teal-200' };
    }

    function calculateAgeVerbose(birthDateStr, isDeceased, deceasedDateStr) {
      if (!birthDateStr) return '0 años';
      const birth = parseDateSafe(birthDateStr);
      if (!birth) return '0 años';
      const end = (isDeceased === 'Sí' && deceasedDateStr)
        ? (parseDateSafe(deceasedDateStr) || parseDateSafe(getTodayLocalIsoDate()) || new Date())
        : (parseDateSafe(getTodayLocalIsoDate()) || new Date());
      let years = end.getFullYear() - birth.getFullYear();
      let months = end.getMonth() - birth.getMonth();
      if (end.getDate() < birth.getDate()) months--;
      if (months < 0) { years--; months += 12; }
      return `${Math.max(0, years)} años${months > 0 ? `, ${months} m` : ''}`;
    }

