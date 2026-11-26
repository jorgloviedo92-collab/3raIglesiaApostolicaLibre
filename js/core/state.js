// ────────────────────────────────────────────────────────────────────
// VARIABLES DE ESTADO Y SEGURIDAD EFÍMERA BLINDADA V9.0
// ────────────────────────────────────────────────────────────────────
const STORAGE_SESSION_TOKEN = 'ecclesiasoft_token_v9';
const STORAGE_USER_ROLE = 'ecclesiasoft_role_v9';
const STORAGE_API_ENDPOINT = 'ecclesiasoft_script_endpoint';
const STORAGE_CLIENT_ID = 'ecclesiasoft_client_fingerprint';

const photoMemoryCache = new Map();
let inactivityTimer = null;
let isLoggingOut = false;

function getClientId() {
  let cid = sessionStorage.getItem(STORAGE_CLIENT_ID);
  if (!cid) {
    // Aleatorio criptográfico: el servidor usa este identificador para reconocer dispositivos
    // que ya iniciaron sesión, así que no debe poder adivinarse.
    let rnd = '';
    try {
      rnd = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      rnd = Math.random().toString(36).substring(2, 10);
    }
    cid = 'cli_' + rnd + '_' + Date.now().toString(36);
    sessionStorage.setItem(STORAGE_CLIENT_ID, cid);
  }
  return cid;
}

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (getSessionToken()) {
    inactivityTimer = setTimeout(
      () => {
        showToast('Sesión cerrada automáticamente por inactividad (30 min).', 'error');
        logoutSystem(false);
      },
      30 * 60 * 1000
    ); // 30 minutos
  }
}
['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach((evt) => {
  window.addEventListener(evt, resetInactivityTimer, { passive: true });
});

const photoPendingPromises = new Map();
let photoBatchQueue = [];
let photoBatchTimer = null;

function resetPhotoQueues() {
  if (photoBatchTimer) {
    clearTimeout(photoBatchTimer);
    photoBatchTimer = null;
  }
  photoBatchQueue.forEach((item) => item.resolve(''));
  photoBatchQueue = [];
  photoPendingPromises.clear();
  photoMemoryCache.clear();
}

function getCachedPhotoUrl(photoRef) {
  if (!photoRef || typeof photoRef !== 'string') return '';
  if (photoRef.startsWith('DRIVE_FILE:')) {
    const fileId = photoRef.replace('DRIVE_FILE:', '').trim();
    return photoMemoryCache.get(fileId) || '';
  }
  return '';
}

async function flushPhotoBatch() {
  photoBatchTimer = null;
  if (!photoBatchQueue.length) return;
  const batch = photoBatchQueue.splice(0, 15);
  if (photoBatchQueue.length) {
    photoBatchTimer = setTimeout(flushPhotoBatch, 30);
  }

  const gen = sessionGenerationId;
  const fileIds = batch.map((b) => b.fileId);
  try {
    const res = await fetchAPI('getPhotosBatch', { fileIds });
    if (gen !== sessionGenerationId) {
      batch.forEach((b) => {
        photoPendingPromises.delete(b.fileId);
        b.resolve('');
      });
      return;
    }
    const map = res && res.status === 'ok' && res.photos ? res.photos : {};
    batch.forEach((b) => {
      const uri = map[b.fileId] || '';
      if (uri) photoMemoryCache.set(b.fileId, uri);
      photoPendingPromises.delete(b.fileId);
      b.resolve(uri);
    });
  } catch (e) {
    console.warn('Fallo al obtener lote de fotos privadas:', e);
    batch.forEach((b) => {
      photoPendingPromises.delete(b.fileId);
      b.resolve('');
    });
  }
}

function resolvePhotoUrl(photoRef) {
  if (!photoRef || typeof photoRef !== 'string') return Promise.resolve('');
  if (photoRef.startsWith('data:image/') || photoRef.startsWith('https://')) {
    return Promise.resolve(photoRef);
  }
  if (photoRef.startsWith('DRIVE_FILE:')) {
    const fileId = photoRef.replace('DRIVE_FILE:', '').trim();
    if (photoMemoryCache.has(fileId)) {
      return Promise.resolve(photoMemoryCache.get(fileId));
    }
    if (photoPendingPromises.has(fileId)) {
      return photoPendingPromises.get(fileId);
    }
    const p = new Promise((resolve) => {
      photoBatchQueue.push({ fileId, resolve });
      if (!photoBatchTimer) {
        photoBatchTimer = setTimeout(flushPhotoBatch, 40);
      }
    });
    photoPendingPromises.set(fileId, p);
    return p;
  }
  return Promise.resolve('');
}

let adults = [];
let children = [];
let contributions = [];
let cashFlow = [];

// Variables para la papelera
let deletedAdults = [];
let deletedChildren = [];
let deletedContributions = [];
let deletedCashFlow = [];

let currentPhotoBase64 = '';
let churchConfig = { name: 'Iglesia Local', pastor: '', secretary: '', address: '' };
let chartInstances = {};
let currentDirTab = 'Adultos';
const DIR_PAGE_SIZE = 25;
let currentDirPage = 1;

const CASH_CATEGORIES = {
  Entrada: [
    'Ofrenda Diaria / de Culto',
    'Venta de Comida / Actividades',
    'Donaciones Especiales',
    'Aportes para Eventos / Retiros',
    'Otras Entradas'
  ],
  Salida: [
    'Energía Eléctrica',
    'Agua Potable',
    'Mantenimiento e Infraestructura',
    'Compra de Instrumentos / Sonido',
    'Artículos de Aseo y Limpieza',
    'Papelería y Oficina',
    'Viáticos y Apoyo Pastoral',
    'Otros Gastos Operativos'
  ]
};
