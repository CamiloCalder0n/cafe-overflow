/*
 * Capa: PERSISTENCIA
 * Responsabilidad: almacenar las colecciones de la aplicación en un archivo JSON
 * usando el módulo nativo fs. Las operaciones son síncronas para que cada
 * lectura-modificación-escritura sea atómica dentro del hilo único de Node.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');

class AlmacenJson {
  constructor(rutaArchivo, datosIniciales = {}) {
    this.rutaArchivo = rutaArchivo;
    if (!fs.existsSync(rutaArchivo)) {
      fs.mkdirSync(path.dirname(rutaArchivo), { recursive: true });
      this._escribir(datosIniciales);
    }
  }

  _leer() {
    const contenido = fs.readFileSync(this.rutaArchivo, 'utf8');
    return contenido.trim() === '' ? {} : JSON.parse(contenido);
  }

  // Escritura atómica: primero a un archivo temporal y luego se renombra.
  _escribir(datos) {
    const rutaTemporal = `${this.rutaArchivo}.tmp`;
    fs.writeFileSync(rutaTemporal, JSON.stringify(datos, null, 2), 'utf8');
    fs.renameSync(rutaTemporal, this.rutaArchivo);
  }

  leerColeccion(nombre) {
    const datos = this._leer();
    return Array.isArray(datos[nombre]) ? datos[nombre] : [];
  }

  guardarColeccion(nombre, registros) {
    const datos = this._leer();
    datos[nombre] = registros;
    this._escribir(datos);
  }
}

module.exports = { AlmacenJson };
