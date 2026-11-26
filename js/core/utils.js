// ────────────────────────────────────────────────────────────────────
// FECHA LOCAL PRECISA (NICARAGUA UTC-6) Y ESCAPADO SEGURO
// ────────────────────────────────────────────────────────────────────

// Crear un Intl.DateTimeFormat es costoso; se crea una sola vez y se reutiliza.
// (Antes se creaba en cada llamada, y esta función se llama una vez por cada edad calculada.)
const NICARAGUA_ISO_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Managua',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});
function getTodayLocalIsoDate() {
  return NICARAGUA_ISO_DATE_FORMATTER.format(new Date());
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
  return String(str).replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      })[tag] || tag
  );
}

function sanitizeDriveUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'lh3.googleusercontent.com' || parsed.hostname === 'drive.google.com')
    ) {
      return parsed.href;
    }
  } catch (e) {}
  return '';
}

function calculateAgeYears(birthDateStr, isDeceased, deceasedDateStr) {
  if (!birthDateStr || !parseDateSafe(birthDateStr)) return 0;
  const todayIso = getTodayLocalIsoDate();
  const endIso = isDeceased === 'Sí' && parseDateSafe(deceasedDateStr) ? deceasedDateStr : todayIso;
  return ageInYears(birthDateStr, endIso);
}

function getMinorStage(birthDateStr, isDeceased, deceasedDateStr) {
  const years = calculateAgeYears(birthDateStr, isDeceased, deceasedDateStr);
  if (years >= 16) {
    return { key: 'Joven', label: 'Joven (16+)', badgeClass: 'bg-sky-100 text-sky-800 border border-sky-200' };
  }
  if (years >= 11) {
    return {
      key: 'Adolescente',
      label: 'Adolescente (11-15)',
      badgeClass: 'bg-purple-100 text-purple-800 border border-purple-200'
    };
  }
  return { key: 'Nino', label: 'Niño(a) (0-10)', badgeClass: 'bg-teal-100 text-teal-800 border border-teal-200' };
}

function calculateAgeVerbose(birthDateStr, isDeceased, deceasedDateStr) {
  if (!birthDateStr) return '0 años';
  const birth = parseDateSafe(birthDateStr);
  if (!birth) return '0 años';
  const end =
    isDeceased === 'Sí' && deceasedDateStr
      ? parseDateSafe(deceasedDateStr) || parseDateSafe(getTodayLocalIsoDate()) || new Date()
      : parseDateSafe(getTodayLocalIsoDate()) || new Date();
  let years = end.getFullYear() - birth.getFullYear();
  let months = end.getMonth() - birth.getMonth();
  if (end.getDate() < birth.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  return `${Math.max(0, years)} años${months > 0 ? `, ${months} m` : ''}`;
}
