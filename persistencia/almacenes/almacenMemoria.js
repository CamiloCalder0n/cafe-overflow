/*
 * Capa: PERSISTENCIA
 * Responsabilidad: almacén en memoria con la misma interfaz que AlmacenJson.
 * Se usa en las pruebas para no tocar el disco. Clona los datos al leer y al
 * guardar para que nadie modifique el estado interno por referencia.
 */
'use strict';

class AlmacenMemoria {
  constructor(datosIniciales = {}) {
    this.datos = structuredClone(datosIniciales);
  }

  leerColeccion(nombre) {
    return Array.isArray(this.datos[nombre]) ? structuredClone(this.datos[nombre]) : [];
  }

  guardarColeccion(nombre, registros) {
    this.datos[nombre] = structuredClone(registros);
  }
}

module.exports = { AlmacenMemoria };
