// Pruebas del backend (Code.js, Google Apps Script) con servicios de Google simulados. npm test
// Code.js NO está en el repositorio (ver .gitignore): si el archivo no existe, estas pruebas se omiten.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const file = path.join(__dirname, '..', 'Code.js');
const present = fs.existsSync(file);

function loadBackend() {
  const cacheStore = new Map();
  const props = new Map();
  const cache = {
    get: (k) => (cacheStore.has(k) ? cacheStore.get(k) : null),
    put: (k, v) => {
      cacheStore.set(k, String(v));
    },
    remove: (k) => {
      cacheStore.delete(k);
    },
    putAll: (o) => Object.entries(o).forEach(([k, v]) => cacheStore.set(k, v))
  };
  const toSigned = (buf) => Array.from(buf, (b) => (b > 127 ? b - 256 : b));
  const sandbox = {
    CacheService: { getScriptCache: () => cache },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props.has(k) ? props.get(k) : null),
        setProperty: (k, v) => {
          props.set(k, v);
        }
      })
    },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      sleep: () => {},
      computeHmacSha256Signature: (value, key) =>
        toSigned(crypto.createHmac('sha256', key).update(String(value)).digest()),
      base64Encode: (bytes) => Buffer.from(bytes.map((b) => (b + 256) % 256)).toString('base64'),
      base64EncodeWebSafe: (x) =>
        Buffer.from(typeof x === 'string' ? x : x.map((b) => (b + 256) % 256)).toString('base64url'),
      base64Decode: (s) => toSigned(Buffer.from(s, 'base64')),
      newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes.map((b) => (b + 256) % 256)).toString('utf8') })
    },
    Logger: { log: () => {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
  vm.runInContext('logAuditEvent_ = function () {};', sandbox); // la auditoría va a Firestore: aquí no se prueba
  return { sandbox, cache, props, run: (code) => vm.runInContext(code, sandbox) };
}

const GLOBAL_SLOT_KEY = () => 'FAIL_GLOBAL_SYSTEM_' + Math.floor(Date.now() / (10 * 60 * 1000));

test('Code.js: validateAllowedValue_ ya no inventa valores en dinero ni en género', { skip: !present }, () => {
  const { run } = loadBackend();
  assert.equal(run("validateAllowedValue_('', ALLOWED_FIELD_VALUES.GENDER, 'Género').ok"), false);
  assert.equal(run("validateAllowedValue_('', ALLOWED_FIELD_VALUES.CASH_MOVEMENT_TYPE, 'Tipo').ok"), false);
  assert.equal(run("validateAllowedValue_('', ALLOWED_FIELD_VALUES.PAYMENT_METHOD, 'Pago').ok"), false);
  assert.equal(run("validateAllowedValue_('Salida', ALLOWED_FIELD_VALUES.CASH_MOVEMENT_TYPE, 'Tipo').value"), 'Salida');
  // los campos que sí tienen valor inicial razonable lo conservan
  assert.equal(run("validateAllowedValue_('', ALLOWED_FIELD_VALUES.YES_NO, 'Bautizado', 'No').value"), 'No');
});

test('Code.js: el bloqueo global no deja fuera a un dispositivo que ya inició sesión', { skip: !present }, () => {
  const { run, cache } = loadBackend();
  run("initializeAuthPins('Adm1n-Segura-2026', 'Cons1lta-Segura-2026')");
  assert.equal(run("verifyLoginPin_('Adm1n-Segura-2026', 'dispositivoA').role"), 'admin'); // queda como dispositivo conocido

  cache.put(GLOBAL_SLOT_KEY(), '40'); // ataque: ya hay más de 35 fallos en la ventana
  // dispositivo desconocido: bloqueado, aunque el PIN sea correcto
  const bloqueado = run("verifyLoginPin_('Adm1n-Segura-2026', 'intruso')");
  assert.equal(bloqueado.ok, false);
  assert.match(bloqueado.error, /demasiados intentos/);
  // dispositivo conocido: puede entrar
  assert.equal(run("verifyLoginPin_('Adm1n-Segura-2026', 'dispositivoA').ok"), true);
});

test('Code.js: el límite de 5 intentos por dispositivo sigue vigente incluso para dispositivos conocidos', {
  skip: !present
}, () => {
  const { run } = loadBackend();
  run("initializeAuthPins('Adm1n-Segura-2026', 'Cons1lta-Segura-2026')");
  assert.equal(run("verifyLoginPin_('Adm1n-Segura-2026', 'dispositivoA').ok"), true);
  for (let i = 0; i < 5; i++) assert.equal(run("verifyLoginPin_('mal-pin-12345', 'dispositivoA').ok"), false);
  const r = run("verifyLoginPin_('Adm1n-Segura-2026', 'dispositivoA')");
  assert.equal(r.ok, false);
  assert.match(r.error, /Dispositivo bloqueado/);
});

test('Code.js: la sesión se firma y se verifica; un token alterado se rechaza', { skip: !present }, () => {
  const { run } = loadBackend();
  run("initializeAuthPins('Adm1n-Segura-2026', 'Cons1lta-Segura-2026')");
  const token = run("issueSessionToken_('admin')");
  assert.equal(run(`verifySessionToken_(${JSON.stringify(token)}).role`), 'admin');
  assert.equal(run(`verifySessionToken_(${JSON.stringify(token.slice(0, -2) + 'xx')})`), null);
});
