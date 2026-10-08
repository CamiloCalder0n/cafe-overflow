/*
 * Capa: NEGOCIO
 * Responsabilidad: casos de uso de clientes (listar, obtener y registrar).
 * Todo cliente nuevo inicia como Junior con $0 acumulado y 0 DevPoints, y el
 * correo es único sin distinguir mayúsculas.
 */
'use strict';

const { NIVELES } = require('../constantes');
const { ErrorNegocio, ErrorNoEncontrado, ErrorValidacion } = require('../errores');

class ClienteServicio {
  constructor({ clienteRepositorio }) {
    this.clienteRepositorio = clienteRepositorio;
  }

  listar() {
    return this.clienteRepositorio.listar();
  }

  obtener(id) {
    const cliente = this.clienteRepositorio.buscarPorId(id);
    if (!cliente) throw new ErrorNoEncontrado(`El cliente ${id} no existe.`);
    return cliente;
  }

  registrar({ nombre, correo }) {
    const nombreLimpio = String(nombre || '').trim();
    const correoNormalizado = String(correo || '').trim().toLowerCase();
    if (!nombreLimpio) throw new ErrorValidacion('El nombre del cliente es obligatorio.');
    if (!correoNormalizado) throw new ErrorValidacion('El correo del cliente es obligatorio.');
    if (this.clienteRepositorio.buscarPorCorreo(correoNormalizado)) {
      throw new ErrorNegocio(`Ya existe un cliente registrado con el correo ${correoNormalizado}.`);
    }

    return this.clienteRepositorio.crear({
      nombre: nombreLimpio,
      correo: correoNormalizado,
      nivel: NIVELES.JUNIOR,
      devPoints: 0,
      acumuladoCompras: 0,
    });
  }
}

module.exports = { ClienteServicio };
