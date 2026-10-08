/*
 * Capa: PERSISTENCIA
 * Responsabilidad: operaciones genéricas de consulta, creación y actualización
 * de registros de una colección. No evalúa ninguna regla de negocio.
 */
'use strict';

class RepositorioBase {
  constructor(almacen, coleccion) {
    this.almacen = almacen;
    this.coleccion = coleccion;
  }

  listar() {
    return this.almacen.leerColeccion(this.coleccion);
  }

  buscarPorId(id) {
    const idNumerico = Number(id);
    return this.listar().find((registro) => registro.id === idNumerico) || null;
  }

  buscarPor(campo, valor) {
    return this.listar().filter((registro) => registro[campo] === valor);
  }

  crear(registro) {
    const registros = this.listar();
    const id = registros.reduce((maximo, r) => Math.max(maximo, r.id), 0) + 1;
    const nuevo = { id, ...registro };
    registros.push(nuevo);
    this.almacen.guardarColeccion(this.coleccion, registros);
    return nuevo;
  }

  actualizar(registro) {
    const registros = this.listar();
    const indice = registros.findIndex((r) => r.id === Number(registro.id));
    if (indice === -1) return null;
    registros[indice] = { ...registro, id: registros[indice].id };
    this.almacen.guardarColeccion(this.coleccion, registros);
    return registros[indice];
  }
}

module.exports = { RepositorioBase };
