// Pruebas de js/core/validators.js. Se ejecutan con: npm test  (Node 18+, sin dependencias)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// validators.js es un script clásico del navegador: se carga en un contexto aislado y se exponen sus nombres
const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'validators.js'), 'utf8');
const names = [...code.matchAll(/^    (?:function|const)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
const raw = vm.runInNewContext(`${code}\n;({ ${names.join(', ')} })`, {});
// Los objetos creados dentro del contexto aislado tienen otros prototipos: se normalizan para poder compararlos con deepEqual
const V = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, typeof v === 'function' && /^[a-z]/.test(k)
  ? (...args) => { const r = v(...args); return (r && typeof r === 'object' && !(r instanceof Date)) ? JSON.parse(JSON.stringify(r)) : r; }
  : v]));

const TODAY = '2026-06-15';

test('parseDateSafe: acepta fechas reales y rechaza las imposibles', () => {
  assert.equal(raw.parseDateSafe('2024-02-29').getDate(), 29);       // bisiesto
  assert.equal(raw.parseDateSafe('1990-05-15T00:00:00Z').getMonth(), 4); // ISO con hora
  for (const malo of ['2025-02-31', '2025-02-29', '2025-13-01', '2025-00-10', '0005-01-01', '1899-12-31', '2101-01-01', '20250-01-01', '25-01-01', 'abc', '', null, undefined]) {
    assert.equal(V.parseDateSafe(malo), null, String(malo));
  }
});

test('ageInYears: cumpleaños, bisiestos y valores inválidos', () => {
  assert.equal(V.ageInYears('2010-06-15', '2026-06-15'), 16);  // cumple hoy
  assert.equal(V.ageInYears('2010-06-16', '2026-06-15'), 15);  // cumple mañana
  assert.equal(V.ageInYears('2000-02-29', '2026-02-28'), 25);
  assert.equal(V.ageInYears('2000-02-29', '2026-03-01'), 26);
  assert.equal(V.ageInYears('2030-01-01', '2026-01-01'), 0);   // nunca negativo
  assert.equal(V.ageInYears('basura', '2026-01-01'), 0);
});

test('parseMoneyAmount: solo positivos con máximo 2 decimales', () => {
  assert.equal(V.parseMoneyAmount('12.5'), 12.5);
  assert.equal(V.parseMoneyAmount('0.01'), 0.01);
  assert.equal(V.parseMoneyAmount('9999999'), 9999999);
  for (const malo of ['0', '0.00', '0.004', '1.234', '-5', '1e5', '10000000', '12abc', '', ' ', null, undefined, '1,5']) {
    assert.equal(V.parseMoneyAmount(malo), null, String(malo));
  }
});

test('isValidPersonName', () => {
  for (const ok of ['Ana Pérez', "María D'Souza", 'José-Luis Núñez', 'Dr. Juan Gómez']) assert.ok(V.isValidPersonName(ok), ok);
  for (const malo of ['', 'Al', 'A.', '12345', 'Juan123', 'Ana <b>', '...', 'x'.repeat(101)]) assert.ok(!V.isValidPersonName(malo), malo);
});

test('isValidPhoneNumber: vacío es válido; 8 a 15 dígitos', () => {
  for (const ok of ['', '88880000', '8888-8888', '+505 8888 8888', '(505) 2222-3333']) assert.ok(V.isValidPhoneNumber(ok), ok);
  for (const malo of ['1234567', '1234567890123456', 'abcdefgh', '8888-88aa', '88 88']) assert.ok(!V.isValidPhoneNumber(malo), malo);
});

test('isWeakPin', () => {
  for (const debil of ['11111111', '12345678', '87654321', 'abcdefgh', 'password', 'admin123', '12341234']) assert.ok(V.isWeakPin(debil), debil);
  for (const fuerte of ['Xk93mq72', 'Iglesia#2026', '48201937']) assert.ok(!V.isWeakPin(fuerte), fuerte);
});

test('validateCedula: formato y fecha codificada', () => {
  assert.deepEqual(V.validateCedula('001-150890-0002A', '1990-08-15'), []);
  assert.equal(V.validateCedula('001-150890-0002', '1990-08-15').length, 1);   // sin letra
  assert.equal(V.validateCedula('001150890-0002A', '1990-08-15').length, 1);   // sin guiones
  assert.match(V.validateCedula('001-150890-0002A', '1991-08-15')[0], /no coincide/);
  assert.deepEqual(V.validateCedula('001-150890-0002A', ''), []);               // sin fecha no se compara
});

test('validateMemberBasics', () => {
  const ok = { fullName: 'Ana Pérez', phone: '8888-8888', birth: '1990-08-15', join: '2010-01-01' };
  assert.deepEqual(V.validateMemberBasics(ok, TODAY), []);
  assert.equal(V.validateMemberBasics({ ...ok, fullName: '' }, TODAY).length, 1);
  assert.equal(V.validateMemberBasics({ ...ok, fullName: 'A1' }, TODAY).length, 1);
  assert.equal(V.validateMemberBasics({ ...ok, phone: '123' }, TODAY).length, 1);
  assert.match(V.validateMemberBasics({ ...ok, birth: '' }, TODAY)[0], /nacimiento es obligatoria/);
  assert.match(V.validateMemberBasics({ ...ok, birth: '2027-01-01' }, TODAY)[0], /futura/);
  assert.match(V.validateMemberBasics({ ...ok, birth: '2025-02-31' }, TODAY)[0], /obligatoria/); // fecha imposible
  assert.match(V.validateMemberBasics({ ...ok, join: '1980-01-01' }, TODAY)[0], /anterior al nacimiento/);
  assert.match(V.validateMemberBasics({ ...ok, join: '2027-01-01' }, TODAY)[0], /futura/);
  assert.match(V.validateMemberBasics({ ...ok, join: '' }, TODAY)[0], /ingreso.*obligatoria/);
});

test('validateBaptism: bautizado exige fecha válida y coherente', () => {
  const b = { isBaptized: true, baptism: '2012-05-01', birth: '1990-08-15' };
  assert.deepEqual(V.validateBaptism(b, TODAY), []);
  assert.deepEqual(V.validateBaptism({ ...b, isBaptized: false, baptism: '' }, TODAY), []);
  assert.match(V.validateBaptism({ ...b, baptism: '' }, TODAY)[0], /debe tener la fecha/);
  assert.match(V.validateBaptism({ ...b, baptism: '2025-02-31' }, TODAY)[0], /no es válida/);
  assert.match(V.validateBaptism({ ...b, baptism: '2030-01-01' }, TODAY)[0], /futura/);
  assert.match(V.validateBaptism({ ...b, baptism: '1980-01-01' }, TODAY)[0], /anterior al nacimiento/);
});

test('validateDeceased', () => {
  const d = { isDeceased: true, deceased: '2020-01-01', birth: '1950-01-01', join: '1990-01-01', isBaptized: true, baptism: '1990-06-01' };
  assert.deepEqual(V.validateDeceased(d, TODAY), []);
  assert.deepEqual(V.validateDeceased({ ...d, isDeceased: false, deceased: '' }, TODAY), []);
  assert.match(V.validateDeceased({ ...d, deceased: '' }, TODAY)[0], /fecha exacta/);
  assert.match(V.validateDeceased({ ...d, deceased: '2030-01-01' }, TODAY)[0], /futura/);
  assert.match(V.validateDeceased({ ...d, deceased: '1940-01-01' }, TODAY)[0], /anterior al nacimiento/);
  assert.match(V.validateDeceased({ ...d, join: '2021-01-01' }, TODAY)[0], /ingreso.*posterior/);
  assert.match(V.validateDeceased({ ...d, baptism: '2021-01-01' }, TODAY)[0], /bautismo.*posterior/);
});

test('validateDiscipline', () => {
  const d = { inDiscipline: true, isBaptized: true, isDeceased: false, category: 'Activo', start: '2025-01-01', end: '2025-07-01', months: '6', indefinite: false, birth: '1990-01-01', baptism: '2010-01-01' };
  assert.deepEqual(V.validateDiscipline(d, TODAY), []);
  assert.deepEqual(V.validateDiscipline({ ...d, inDiscipline: false, isBaptized: false }, TODAY), []);
  assert.deepEqual(V.validateDiscipline({ ...d, indefinite: true, months: '', end: '' }, TODAY), []);
  assert.match(V.validateDiscipline({ ...d, isBaptized: false, baptism: '' }, TODAY)[0], /no bautizado/);
  assert.match(V.validateDiscipline({ ...d, isDeceased: true }, TODAY)[0], /fallecida/);
  assert.match(V.validateDiscipline({ ...d, category: 'Inactivo' }, TODAY)[0], /Inactivo/);
  assert.match(V.validateDiscipline({ ...d, start: '' }, TODAY)[0], /fecha de inicio/);
  assert.match(V.validateDiscipline({ ...d, start: '2030-01-01' }, TODAY)[0], /futura/);
  assert.match(V.validateDiscipline({ ...d, start: '2005-01-01' }, TODAY)[0], /anterior a la fecha de bautismo/);
  assert.match(V.validateDiscipline({ ...d, months: '0' }, TODAY)[0], /meses/);
  assert.match(V.validateDiscipline({ ...d, months: '121' }, TODAY)[0], /meses/);
  assert.match(V.validateDiscipline({ ...d, end: '' }, TODAY)[0], /fin estimado/);
  assert.match(V.validateDiscipline({ ...d, end: '2024-01-01' }, TODAY)[0], /fin.*anterior/);
});

test('validatePresentation y validateOptionalName', () => {
  assert.deepEqual(V.validatePresentation({ isPresented: true, date: '2015-01-01', birth: '2014-01-01' }, TODAY), []);
  assert.deepEqual(V.validatePresentation({ isPresented: false, date: '2030-01-01', birth: '2014-01-01' }, TODAY), []);
  assert.match(V.validatePresentation({ isPresented: true, date: '2030-01-01', birth: '2014-01-01' }, TODAY)[0], /futura/);
  assert.match(V.validatePresentation({ isPresented: true, date: '2013-01-01', birth: '2014-01-01' }, TODAY)[0], /anterior al nacimiento/);
  assert.deepEqual(V.validateOptionalName('', 'del padre'), []);
  assert.deepEqual(V.validateOptionalName('Juan Pérez', 'del padre'), []);
  assert.match(V.validateOptionalName('J1', 'de la madre')[0], /^El nombre de la madre solo puede/);
});

test('validateContribution', () => {
  const c = { memberFound: true, date: '2026-06-01', amount: '150.50', type: 'Diezmo', notes: '', memberBirth: '1990-01-01', memberDeceased: false };
  assert.deepEqual(V.validateContribution(c, TODAY), { error: '', amount: 150.5 });
  const err = (o) => V.validateContribution({ ...c, ...o }, TODAY).error;
  assert.match(err({ memberFound: false }), /miembro válido/);
  assert.match(err({ date: '' }), /Indica la fecha/);
  assert.match(err({ date: '2025-02-31' }), /no es válida/);
  assert.match(err({ date: '2026-06-16' }), /futura/);
  assert.match(err({ amount: '0.004' }), /monto/);
  assert.match(err({ amount: '1e5' }), /monto/);
  assert.match(err({ type: '' }), /tipo/);
  assert.match(err({ notes: 'x'.repeat(201) }), /200/);
  assert.match(err({ date: '1980-01-01' }), /nacimiento/);
  assert.match(err({ memberDeceased: true }), /fallecido/);
});

test('validateCashMovement', () => {
  const c = { date: '2026-06-01', amount: '99.99', category: 'Servicios', notes: '' };
  assert.deepEqual(V.validateCashMovement(c, TODAY), { error: '', amount: 99.99 });
  const err = (o) => V.validateCashMovement({ ...c, ...o }, TODAY).error;
  assert.match(err({ date: '' }), /Indica la fecha/);
  assert.match(err({ date: '2026-06-16' }), /futura/);
  assert.match(err({ amount: '-1' }), /monto/);
  assert.match(err({ category: '' }), /categoría/);
  assert.match(err({ notes: 'x'.repeat(201) }), /200/);
});

test('validateEvent y eventDoneBlockReason', () => {
  const e = { title: 'Culto de oración', date: '2026-06-20', startTime: '18:00', endTime: '20:00', location: 'Templo', responsible: 'Pastor', notes: '', status: 'Programado' };
  const run = (o) => V.validateEvent({ ...e, ...o }, TODAY, '10:00');
  assert.equal(run({}), '');
  assert.match(run({ title: '' }), /título y la fecha/);
  assert.match(run({ title: 'ab' }), /entre 3 y 120/);
  assert.match(run({ date: '2025-02-31' }), /no es válida/);
  assert.match(run({ notes: 'x'.repeat(401) }), /largo permitido/);
  assert.match(run({ startTime: '', endTime: '20:00' }), /hora de inicio/);
  assert.match(run({ endTime: '18:00' }), /posterior/);
  assert.match(run({ endTime: '17:00' }), /posterior/);
  assert.match(run({ status: 'Realizado' }), /ya llegó/);                       // fecha futura
  assert.equal(run({ status: 'Realizado', date: '2026-06-01' }), '');
  assert.match(run({ status: 'Realizado', date: TODAY, startTime: '18:00', endTime: '' }), /todavía no ha comenzado/);
  assert.equal(V.eventDoneBlockReason(TODAY, '09:00', TODAY, '10:00'), '');
});

test('validateChurchConfig: datos y cambio de PIN', () => {
  const base = { name: 'Iglesia Central', pastor: 'Juan Pérez', secretary: '', changePin: false, pinActual: '', newPinAdmin: '', newPinConsulta: '' };
  assert.equal(V.validateChurchConfig(base), '');
  assert.match(V.validateChurchConfig({ ...base, name: 'ab' }), /obligatorio/);
  assert.match(V.validateChurchConfig({ ...base, pastor: 'J1' }), /Pastor/);
  assert.match(V.validateChurchConfig({ ...base, secretary: '12' }), /Secretario/);
  const pin = { ...base, changePin: true, pinActual: 'actualPin1', newPinAdmin: 'Xk93mq72', newPinConsulta: 'Zt58wp41' };
  assert.equal(V.validateChurchConfig(pin), '');
  assert.match(V.validateChurchConfig({ ...pin, pinActual: '' }), /PIN actual/);
  assert.match(V.validateChurchConfig({ ...pin, newPinAdmin: 'Ab1' }), /entre 8 y 64/);
  assert.match(V.validateChurchConfig({ ...pin, newPinAdmin: 'x'.repeat(65) }), /entre 8 y 64/);
  assert.match(V.validateChurchConfig({ ...pin, newPinAdmin: '12345678' }), /más seguros/);
  assert.match(V.validateChurchConfig({ ...pin, newPinConsulta: 'Xk93mq72' }), /diferentes/);
  assert.match(V.validateChurchConfig({ ...pin, newPinAdmin: 'actualPin1' }), /distintos del PIN actual/);
});

test('validateServerUrl: formato, servidor fijo y cambio de servidor', () => {
  const A = 'https://script.google.com/macros/s/AKfycbAAAAAAAAAA/exec';
  const B = 'https://script.google.com/macros/s/AKfycbBBBBBBBBBB/exec';
  const run = (...args) => V.validateServerUrl(...args);
  assert.deepEqual(run(A, '', ''), { ok: true, error: '', needsConfirm: false });        // primera vez
  assert.deepEqual(run(A, '', A), { ok: true, error: '', needsConfirm: false });         // el mismo de siempre
  assert.deepEqual(run(B, '', A), { ok: true, error: '', needsConfirm: true });          // distinto: pide confirmación
  assert.deepEqual(run(A, A, B), { ok: true, error: '', needsConfirm: false });          // coincide con el fijo
  assert.match(run(B, A, A).error, /servidor oficial/);                                   // fijo: rechaza otro
  assert.equal(run(B, A, A).ok, false);
  assert.match(run('', '', '').error, /Ingresa la URL/);
  for (const malo of ['http://script.google.com/macros/s/AKfyc/exec', 'https://evil.com/macros/s/AKfyc/exec',
    'https://script.google.com.evil.com/macros/s/AKfyc/exec', 'https://script.google.com/macros/s/AKfyc/dev', 'javascript:alert(1)']) {
    assert.equal(run(malo, '', '').ok, false, malo);
  }
});
