/*
 * Capa: NEGOCIO
 * Responsabilidad: casos de uso del menú de productos (listar, obtener, crear
 * y reabastecer). Recibe el repositorio por inyección de dependencias.
 */
'use strict';

const { ErrorNegocio, ErrorNoEncontrado, ErrorValidacion } = require('../errores');

class ProductoServicio {
  constructor({ productoRepositorio }) {
    this.productoRepositorio = productoRepositorio;
  }

  listarMenu() {
    return this.productoRepositorio.listar();
  }

  obtener(id) {
    const producto = this.productoRepositorio.buscarPorId(id);
    if (!producto) throw new ErrorNoEncontrado(`El producto ${id} no existe.`);
    return producto;
  }

  crear({ nombre, precioBase, stock }) {
    const nombreLimpio = String(nombre || '').trim();
    if (!nombreLimpio) throw new ErrorValidacion('El nombre del producto es obligatorio.');
    if (!Number.isInteger(precioBase) || precioBase <= 0) {
      throw new ErrorValidacion('El precio base debe ser un entero mayor que 0.');
    }
    if (!Number.isInteger(stock) || stock < 0) {
      throw new ErrorValidacion('El stock debe ser un entero mayor o igual a 0.');
    }
    const repetido = this.productoRepositorio
      .listar()
      .some((p) => p.nombre.trim().toLowerCase() === nombreLimpio.toLowerCase());
    if (repetido) throw new ErrorNegocio(`Ya existe un producto llamado "${nombreLimpio}".`);

    return this.productoRepositorio.crear({ nombre: nombreLimpio, precioBase, stock });
  }

  reabastecer(id, unidades) {
    if (!Number.isInteger(unidades) || unidades <= 0) {
      throw new ErrorValidacion('Las unidades a reabastecer deben ser un entero mayor que 0.');
    }
    const producto = this.obtener(id);
    return this.productoRepositorio.actualizar({ ...producto, stock: producto.stock + unidades });
  }
}

module.exports = { ProductoServicio };
