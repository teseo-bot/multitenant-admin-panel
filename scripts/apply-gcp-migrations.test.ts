// scripts/apply-gcp-migrations.test.ts
//
// Un solo defecto es el que justifica este archivo: el runner NO descubre archivos del
// directorio, aplica una lista escrita a mano. Escribir una migración y no registrarla no
// produce ningún error — produce SILENCIO, y en producción falta la columna mientras el repo
// se ve perfectamente consistente.
//
// Ya ocurrió dos veces: la 012 quedó sin aplicar desde el 2026-08-03 (se coló de rezagada
// cuando alguien registró la 013) y la 014 de ADR-212 se escribió sin registrar. Este test
// convierte ese silencio en rojo.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { MIGRATION_FILES, validateMigrationShape } from './apply-gcp-migrations';

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations-gcp');

function migracionesEnDisco(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

describe('MIGRATION_FILES — la lista es la única fuente de verdad, así que se audita', () => {
  it('toda migración en disco está registrada (si no, no se aplica NUNCA)', () => {
    const registradas = new Set<string>(MIGRATION_FILES);
    const huerfanas = migracionesEnDisco().filter((f) => !registradas.has(f));
    assert.deepEqual(
      huerfanas,
      [],
      `Migraciones en migrations-gcp/ que el runner ignora: ${huerfanas.join(', ')}. ` +
        'Añádelas a MIGRATION_FILES en el mismo commit o no llegarán a producción.'
    );
  });

  it('toda migración registrada existe en disco', () => {
    const faltantes = MIGRATION_FILES.filter(
      (f) => !fs.existsSync(path.join(MIGRATIONS_DIR, f))
    );
    assert.deepEqual(faltantes, [], `Registradas pero ausentes del directorio: ${faltantes.join(', ')}`);
  });

  it('la lista va en orden numérico estricto: el orden de aplicación son las dependencias', () => {
    const prefijos = MIGRATION_FILES.map((f) => f.slice(0, 3));
    const ordenados = [...prefijos].sort();
    assert.deepEqual(prefijos, ordenados, 'MIGRATION_FILES está desordenada respecto al prefijo numérico');
  });

  it('no hay prefijos numéricos duplicados: dos 014 distintas se aplicarían en orden indefinido', () => {
    const prefijos = migracionesEnDisco().map((f) => f.slice(0, 3));
    const duplicados = prefijos.filter((p, i) => prefijos.indexOf(p) !== i);
    assert.deepEqual(duplicados, [], `Prefijos repetidos en migrations-gcp/: ${duplicados.join(', ')}`);
  });

  it('toda migración registrada pasa la validación de forma que aplica el runner', () => {
    // Esto se valida en tiempo de ejecución contra la DB de producción; aquí sale gratis y
    // antes. Un BEGIN sin COMMIT aborta el despliegue a mitad de la lista.
    for (const file of MIGRATION_FILES) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      const r = validateMigrationShape(sql, file);
      assert.ok(r.ok, `${file}: ${r.reason}`);
    }
  });
});

describe('validateMigrationShape', () => {
  it('acepta BEGIN/COMMIT balanceados', () => {
    assert.ok(validateMigrationShape('BEGIN;\nSELECT 1;\nCOMMIT;', 'x.sql').ok);
  });

  it('rechaza un COMMIT que falta — el caso que dejaría la transacción abierta', () => {
    const r = validateMigrationShape('BEGIN;\nSELECT 1;', 'x.sql');
    assert.equal(r.ok, false);
    assert.match(r.reason!, /desbalanceados/);
  });

  it('rechaza un archivo vacío', () => {
    const r = validateMigrationShape('   \n  ', 'x.sql');
    assert.equal(r.ok, false);
    assert.match(r.reason!, /vacío/);
  });
});
