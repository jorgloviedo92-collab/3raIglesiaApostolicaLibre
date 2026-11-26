// Pruebas de las reglas de parentesco de js/members/form-logic.js (padre, madre, cónyuge). npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// form-logic.js es un script clásico del navegador. Solo se usan sus funciones de parentesco, que no tocan
// el DOM: se carga en un contexto aislado con la lista global `adults` y la constante que necesita.
const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'members', 'form-logic.js'), 'utf8');
const sandbox = { adults: [], MIN_PARENT_AGE_DIFF: 12, document: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const persona = (id, extra = {}) => ({ id, birthDate: '1960-01-01', gender: 'Masculino', ...extra });
const mapa = (lista, override = null) => { sandbox.adults = lista; return sandbox.buildAdultsKinshipMap(override); };
const motivoPadre = (cand, ctx) => sandbox.getInvalidParentReason(cand, { rol: 'padre', ...ctx });
const motivoMadre = (cand, ctx) => sandbox.getInvalidParentReason(cand, { rol: 'madre', ...ctx });

test('isAncestorOf: encuentra abuelos y no entra en ciclos', () => {
  const lista = [
    persona('A'),                                                             // abuelo
    persona('B', { fatherIsMember: true, fatherId: 'A' }),                    // padre
    persona('C', { fatherIsMember: true, fatherId: 'B' })                     // nieto
  ];
  const m = mapa(lista);
  assert.equal(sandbox.isAncestorOf('B', 'C', m), true);
  assert.equal(sandbox.isAncestorOf('A', 'C', m), true);
  assert.equal(sandbox.isAncestorOf('C', 'A', m), false);
  assert.equal(sandbox.isAncestorOf('', 'C', m), false);

  // datos corruptos: A es hijo de C y C de A. No debe quedarse en un ciclo infinito
  const ciclo = mapa([
    persona('A', { fatherIsMember: true, fatherId: 'C' }),
    persona('C', { fatherIsMember: true, fatherId: 'A' })
  ]);
  assert.equal(sandbox.isAncestorOf('X', 'A', ciclo), false);
});

test('isAncestorOf: usa el registro del formulario aunque aún no esté guardado', () => {
  const m = mapa([persona('B')], { id: '__NEW__', padreEsMiembro: true, idPadre: 'B' });
  assert.equal(sandbox.isAncestorOf('B', '__NEW__', m), true);
});

test('areSiblings: comparten padre o madre (también medios hermanos)', () => {
  const m = mapa([
    persona('H1', { fatherIsMember: true, fatherId: 'P', motherIsMember: true, motherId: 'M1' }),
    persona('H2', { fatherIsMember: true, fatherId: 'P', motherIsMember: true, motherId: 'M2' }),
    persona('H3', { fatherIsMember: true, fatherId: 'Q' }),
    persona('H4')
  ]);
  assert.equal(sandbox.areSiblings('H1', 'H2', m), true);   // medio hermano por el padre
  assert.equal(sandbox.areSiblings('H1', 'H3', m), false);
  assert.equal(sandbox.areSiblings('H1', 'H4', m), false);
  assert.equal(sandbox.areSiblings('H1', 'H1', m), false);  // consigo mismo no
  assert.equal(sandbox.areSiblings('H1', 'NOEXISTE', m), false);
});

test('areSiblings: un padre no registrado como miembro no cuenta', () => {
  const m = mapa([
    persona('H1', { fatherIsMember: false, fatherId: 'P' }),
    persona('H2', { fatherIsMember: false, fatherId: 'P' })
  ]);
  assert.equal(sandbox.areSiblings('H1', 'H2', m), false);
});

test('getInvalidParentReason: género, mismo miembro y edad', () => {
  const m = mapa([]);
  const ctx = { selfId: 'YO', birthDate: '1990-06-15', map: m };
  assert.equal(motivoPadre(persona('P', { birthDate: '1960-01-01' }), ctx), '');
  assert.match(motivoPadre(persona('P', { gender: 'Femenino' }), ctx), /femenino/);
  assert.match(motivoMadre(persona('M', { gender: 'Masculino' }), ctx), /masculino/);
  assert.match(motivoPadre(persona('YO'), ctx), /mismo miembro/);
  // 11 años mayor: no alcanza; exactamente 12 años cumplidos sí
  assert.match(motivoPadre(persona('P', { birthDate: '1979-06-16' }), ctx), /al menos 12/);
  assert.equal(motivoPadre(persona('P', { birthDate: '1978-06-15' }), ctx), '');
  assert.match(motivoPadre(persona('P', { birthDate: '1978-06-16' }), ctx), /al menos 12/);
});

test('getInvalidParentReason: cónyuge, descendiente y hermano no pueden ser padre/madre', () => {
  const lista = [
    persona('HIJO', { fatherIsMember: true, fatherId: 'YO' }),
    persona('HERMANO', { fatherIsMember: true, fatherId: 'PAPA' }),
    persona('ESPOSA', { gender: 'Femenino' })
  ];
  const m = mapa(lista);
  const ctx = { selfId: 'YO', birthDate: '2000-01-01', map: m, fatherId: 'PAPA', spouseId: 'ESPOSA' };
  assert.match(motivoPadre(lista[0], ctx), /descendiente/);
  assert.match(motivoPadre(lista[1], ctx), /hermano/);
  assert.match(motivoMadre(lista[2], ctx), /cónyuge/);
  // la ficha de la candidata ya dice que está casada con este miembro
  assert.match(motivoMadre(persona('OTRA', { gender: 'Femenino', idConyuge: 'YO' }), { ...ctx, spouseId: '' }), /cónyuge/);
});

test('getInvalidParentReason: no repetir al otro progenitor', () => {
  const m = mapa([]);
  const ctx = { selfId: 'YO', birthDate: '2000-01-01', map: m, motherId: 'X' };
  assert.match(motivoPadre(persona('X'), ctx), /ya es la madre/);
  assert.match(motivoMadre(persona('Y', { gender: 'Femenino' }), { ...ctx, motherId: '', fatherId: 'Y' }), /ya es el padre/);
});

test('getInvalidSpouseReason: reglas de cónyuge', () => {
  const lista = [
    persona('PAPA'),
    persona('MAMA', { gender: 'Femenino' }),
    persona('YO', { fatherIsMember: true, fatherId: 'PAPA', motherIsMember: true, motherId: 'MAMA', gender: 'Masculino' }),
    persona('HIJA', { gender: 'Femenino', fatherIsMember: true, fatherId: 'YO' }),
    persona('HERMANA', { gender: 'Femenino', fatherIsMember: true, fatherId: 'PAPA' })
  ];
  const m = mapa(lista);
  const ctx = { selfId: 'YO', gender: 'masculino', fatherId: 'PAPA', motherId: 'MAMA', map: m };
  const spouse = (cand) => sandbox.getInvalidSpouseReason(cand, ctx);

  assert.equal(spouse(persona('N', { gender: 'Femenino' })), '');
  assert.match(spouse(persona('YO')), /mismo miembro/);
  assert.match(spouse(persona('N', { gender: 'Masculino' })), /mismo género/);
  assert.match(spouse(persona('N', { gender: 'Femenino', isDeceased: 'Sí' })), /fallecido/);
  assert.match(spouse(persona('N', { gender: 'Femenino', spouseIsMember: true, spouseId: 'OTRO' })), /otro miembro/);
  assert.equal(spouse(persona('N', { gender: 'Femenino', spouseIsMember: true, spouseId: 'YO' })), ''); // ya es su cónyuge: se permite
  assert.match(spouse(lista[1]), /madre/);
  assert.match(spouse(lista[3]), /descendiente/);
  assert.match(spouse(lista[4]), /hermano/);
});

test('calculateIsoYearDiff: años completos y fechas mal formadas', () => {
  assert.equal(sandbox.calculateIsoYearDiff('1990-06-15', '2002-06-15'), 12);
  assert.equal(sandbox.calculateIsoYearDiff('1990-06-15', '2002-06-14'), 11);
  assert.equal(sandbox.calculateIsoYearDiff('1990-6-15', '2002-06-15'), null);
  assert.equal(sandbox.calculateIsoYearDiff('', '2002-06-15'), null);
});
