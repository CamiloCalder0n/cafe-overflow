/*
 * Capa: PERSISTENCIA
 * Responsabilidad: repositorios concretos de cada entidad (productos, clientes
 * y pedidos) con sus consultas específicas.
 */
'use strict';

const { RepositorioBase } = require('./repositorioBase');

class ProductoRepositorio extends RepositorioBase {
  constructor(almacen) {
    super(almacen, 'productos');
  }
}

class ClienteRepositorio extends RepositorioBase {
  constructor(almacen) {
    super(almacen, 'clientes');
  }

  buscarPorCorreo(correo) {
    const buscado = String(correo).toLowerCase();
    return this.listar().find((c) => String(c.correo).toLowerCase() === buscado) || null;
  }
}

class PedidoRepositorio extends RepositorioBase {
  constructor(almacen) {
    super(almacen, 'pedidos');
  }

  listarPorCliente(clienteId) {
    return this.buscarPor('clienteId', Number(clienteId));
  }

  listarPorEstado(estado) {
    return this.buscarPor('estado', estado);
  }
}

module.exports = { ProductoRepositorio, ClienteRepositorio, PedidoRepositorio };
