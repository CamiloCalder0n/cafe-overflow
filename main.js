/*
 * COMPOSITION ROOT
 * Responsabilidad: único archivo que conoce las tres capas. Construye la
 * persistencia (almacén + repositorios), inyecta los repositorios en los
 * servicios de negocio y entrega los servicios a la presentación.
 */
'use strict';

const path = require('path');

// Capa de persistencia
const { AlmacenJson } = require('./persistencia/almacenes/almacenJson');
const {
  ProductoRepositorio,
  ClienteRepositorio,
  PedidoRepositorio,
} = require('./persistencia/repositorios/repositorios');
const { semilla } = require('./persistencia/data/semilla');

// Capa de negocio
const { ProductoServicio } = require('./negocio/servicios/productoServicio');
const { ClienteServicio } = require('./negocio/servicios/clienteServicio');
const { PedidoServicio } = require('./negocio/servicios/pedidoServicio');

// Capa de presentación
const { crearServidor } = require('./presentation/servidor');

// 1. Almacén JSON (se crea con la semilla si no existe).
const rutaBaseDatos = process.env.DB_PATH || path.join(__dirname, 'persistencia', 'data', 'db.json');
const almacen = new AlmacenJson(rutaBaseDatos, semilla);

// 2. Repositorios.
const repositorios = {
  productoRepositorio: new ProductoRepositorio(almacen),
  clienteRepositorio: new ClienteRepositorio(almacen),
  pedidoRepositorio: new PedidoRepositorio(almacen),
};

// 3. Servicios de negocio con los repositorios inyectados.
const servicios = {
  productoServicio: new ProductoServicio(repositorios),
  clienteServicio: new ClienteServicio(repositorios),
  pedidoServicio: new PedidoServicio(repositorios),
};

// 4. Servidor HTTP.
const puerto = process.env.PORT || 3000;
crearServidor(servicios).listen(puerto, () => {
  console.log(`☕ Café Overflow escuchando en http://localhost:${puerto}`);
});
