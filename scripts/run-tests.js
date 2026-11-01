#!/usr/bin/env node
// ======================================================================
// BasketballRPE-Web — scripts/run-tests.js
// Ejecuta TODOS los tests (test/*.test.js) uno a uno y avisa de cuáles fallan.
// Sin dependencias: solo hace falta Node.
//
//   Uso local:   node scripts/run-tests.js
//   En GitHub:   lo lanza el trabajo «Tests» de .github/workflows/deploy.yml
//                antes de cada despliegue y avisa en rojo si algún test falla.
//
// Si algún test falla, el script termina con error (código 1) y lo marca en la pestaña Actions de GitHub.
// Que eso bloquee o no el despliegue lo decide .github/workflows/deploy.yml (hoy: solo avisa).
//
// Un test pasa si su proceso termina con código 0. Cada test se ejecuta en su propio
// proceso (así uno que se cuelgue o rompa no afecta a los demás) y con un límite de tiempo.
// ======================================================================

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEST_DIR = path.join(ROOT, 'test');
const TIMEOUT_MS = 120 * 1000;
const IN_GITHUB = process.env.GITHUB_ACTIONS === 'true';

// Los tests acaban en ".test.js". Los demás .js de test/ son ayudantes compartidos (no se ejecutan solos).
const files = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.test.js')).sort();
if (files.length === 0) {
    console.error('No se encontró ningún test en test/*.test.js: algo va mal con la carpeta test/.');
    process.exit(1);
}

const failed = [];
const started = Date.now();

for (const file of files) {
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [path.join('test', file)], {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: TIMEOUT_MS,
        maxBuffer: 32 * 1024 * 1024
    });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const timedOut = r.error && r.error.code === 'ETIMEDOUT';
    const ok = r.status === 0 && !r.error;

    if (ok) {
        console.log(`  ✓ ${file}  (${secs} s)`);
        continue;
    }

    failed.push(file);
    console.log(`  ✗ ${file}  (${secs} s)${timedOut ? '  ← superó el límite de tiempo' : ''}`);
    if (IN_GITHUB) {
        console.log(`::error file=test/${file},title=Test fallido::${file} no ha pasado`);
        console.log(`::group::Salida de ${file}`);
    }
    const output = `${r.stdout || ''}${r.stderr || ''}${r.error ? `\n${r.error.message}` : ''}`.trimEnd();
    console.log(output.split('\n').map(l => `      ${l}`).join('\n'));
    if (IN_GITHUB) console.log('::endgroup::');
}

const total = ((Date.now() - started) / 1000).toFixed(1);
console.log('');
if (failed.length) {
    console.log(`❌ ${failed.length} de ${files.length} tests han fallado (${total} s): ${failed.join(', ')}`);
    process.exit(1);
}
console.log(`✅ ${files.length} de ${files.length} tests en verde (${total} s)`);
