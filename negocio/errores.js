/*
 * Capa: NEGOCIO
 * Responsabilidad: jerarquía de errores del dominio. La presentación los usa
 * para traducirlos a códigos HTTP sin conocer las reglas que los producen.
 *   ErrorNegocio      → conflicto con una regla del negocio (base).
 *   ErrorNoEncontrado → la entidad solicitada no existe.
 *   ErrorValidacion   → los datos no cumplen una regla de negocio.
 */
'use strict';

class ErrorNegocio extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = this.constructor.name;
  }
}

class ErrorNoEncontrado extends ErrorNegocio {}

class ErrorValidacion extends ErrorNegocio {}

module.exports = { ErrorNegocio, ErrorNoEncontrado, ErrorValidacion };
