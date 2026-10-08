/*
 * Capa: PRESENTACIÓN
 * Responsabilidad: enrutador HTTP hecho a mano. Registra rutas por método y
 * convierte los patrones con parámetros (":id") en expresiones regulares.
 */
'use strict';

class Enrutador {
  constructor() {
    this.rutas = [];
  }

  _registrar(metodo, patron, manejador) {
    const nombres = [];
    const fuente = patron
      .split('/')
      .map((segmento) => {
        if (segmento.startsWith(':')) {
          nombres.push(segmento.slice(1));
          return '([^/]+)';
        }
        return segmento.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    this.rutas.push({ metodo, expresion: new RegExp(`^${fuente}/?$`), nombres, manejador });
    return this;
  }

  get(patron, manejador) {
    return this._registrar('GET', patron, manejador);
  }

  post(patron, manejador) {
    return this._registrar('POST', patron, manejador);
  }

  patch(patron, manejador) {
    return this._registrar('PATCH', patron, manejador);
  }

  // Devuelve { manejador, params } de la primera ruta que coincida, o null.
  resolver(metodo, ruta) {
    for (const r of this.rutas) {
      if (r.metodo !== metodo) continue;
      const coincidencia = r.expresion.exec(ruta);
      if (!coincidencia) continue;
      const params = {};
      r.nombres.forEach((nombre, i) => {
        params[nombre] = decodeURIComponent(coincidencia[i + 1]);
      });
      return { manejador: r.manejador, params };
    }
    return null;
  }
}

module.exports = { Enrutador };
