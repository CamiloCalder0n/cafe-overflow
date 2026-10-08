/*
 * Pruebas de ARQUITECTURA (5) — fitness functions.
 * Leen el código fuente de cada capa y verifican que se respeten las
 * dependencias permitidas entre capas (capas cerradas).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

function archivosJs(carpeta) {
  const resultado = [];
  for (const entrada of fs.readdirSync(carpeta, { withFileTypes: true })) {
    const ruta = path.join(carpeta, entrada.name);
    if (entrada.isDirectory()) resultado.push(...archivosJs(ruta));
    else if (entrada.name.endsWith('.js')) resultado.push(ruta);
  }
  return resultado;
}

function quitarComentarios(codigo) {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// Devuelve los módulos importados por un archivo; los relativos se resuelven a ruta absoluta.
function importaciones(archivo) {
  const codigo = quitarComentarios(fs.readFileSync(archivo, 'utf8'));
  const modulos = [];
  for (const [, modulo] of codigo.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    modulos.push(modulo.startsWith('.') ? path.resolve(path.dirname(archivo), modulo) : modulo);
  }
  return modulos;
}

function apuntaA(modulo, capa) {
  const carpeta = path.join(RAIZ, capa);
  return modulo === carpeta || modulo.startsWith(carpeta + path.sep);
}

function violaciones(capa, prohibidas) {
  const encontradas = [];
  for (const archivo of archivosJs(path.join(RAIZ, capa))) {
    for (const modulo of importaciones(archivo)) {
      if (prohibidas.some((p) => apuntaA(modulo, p))) {
        encontradas.push(`${path.relative(RAIZ, archivo)} → ${path.relative(RAIZ, modulo)}`);
      }
    }
  }
  return encontradas;
}

test('Arquitectura: negocio/ no importa presentation/ ni persistencia/', () => {
  assert.deepEqual(violaciones('negocio', ['presentation', 'persistencia']), []);
});

test('Arquitectura: negocio/ no importa http, fs, path ni url, no usa JSON.parse/stringify y no contiene HTML', () => {
  const prohibidos = ['http', 'https', 'fs', 'path', 'url'];
  const problemas = [];
  for (const archivo of archivosJs(path.join(RAIZ, 'negocio'))) {
    const relativo = path.relative(RAIZ, archivo);
    for (const modulo of importaciones(archivo)) {
      if (prohibidos.includes(modulo.replace(/^node:/, ''))) problemas.push(`${relativo} importa "${modulo}"`);
      if (!modulo.startsWith(path.join(RAIZ, 'negocio')) && !path.isAbsolute(modulo)) {
        problemas.push(`${relativo} importa un módulo externo "${modulo}"`);
      }
    }
    const codigo = quitarComentarios(fs.readFileSync(archivo, 'utf8'));
    if (/JSON\s*\.\s*(parse|stringify)/.test(codigo)) problemas.push(`${relativo} usa JSON.parse/stringify`);
    if (/<\/?[a-zA-Z][a-zA-Z0-9-]*(\s[^<>]*)?\/?>/.test(codigo)) problemas.push(`${relativo} contiene etiquetas HTML`);
  }
  assert.deepEqual(problemas, []);
});

test('Arquitectura: presentation/ no importa persistencia/', () => {
  assert.deepEqual(violaciones('presentation', ['persistencia']), []);
});

test('Arquitectura: persistencia/ no importa negocio/ ni presentation/', () => {
  assert.deepEqual(violaciones('persistencia', ['negocio', 'presentation']), []);
});

test('Arquitectura: presentation/public/app.js solo consulta rutas que empiezan por /api/', () => {
  const codigo = quitarComentarios(fs.readFileSync(path.join(RAIZ, 'presentation', 'public', 'app.js'), 'utf8'));

  // Todas las rutas literales pasadas a solicitar(...) o fetch(...).
  const rutas = [...codigo.matchAll(/\b(?:solicitar|fetch)\(\s*(['"`])(.*?)\1/g)].map((m) => m[2]);
  assert.ok(rutas.length > 0, 'app.js debería consultar la API');
  for (const ruta of rutas) assert.ok(ruta.startsWith('/api/'), `Ruta no permitida: ${ruta}`);

  // fetch solo se usa dentro de solicitar(ruta, ...) con la variable "ruta".
  const usosFetch = [...codigo.matchAll(/\bfetch\(\s*([^,)]+)/g)].map((m) => m[1].trim());
  for (const argumento of usosFetch) {
    assert.ok(argumento === 'ruta' || /^['"`]\/api\//.test(argumento), `fetch con argumento no permitido: ${argumento}`);
  }
});
