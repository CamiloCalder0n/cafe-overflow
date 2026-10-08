/*
 * Capa: PRESENTACIÓN
 * Responsabilidad: controladores HTTP. Cada manejador lee el cuerpo, valida la
 * sintaxis, delega en el servicio de negocio y responde en JSON. No contiene
 * reglas de negocio. Firma de cada manejador: (req, res, params, consulta).
 */
'use strict';

const { ErrorSolicitud, leerCuerpoJson, responderJson } = require('../http/utilidadesHttp');
const {
  validarCliente,
  validarProducto,
  validarReabastecimiento,
  validarPedido,
  validarCambioEstado,
} = require('../http/validacionSintactica');

function idDeRuta(params) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ErrorSolicitud('Datos de la solicitud inválidos.', ['El id de la ruta debe ser un entero positivo.']);
  }
  return id;
}

function crearControladorProductos(productoServicio) {
  return {
    listar: async (req, res) => {
      responderJson(res, 200, productoServicio.listarMenu());
    },
    crear: async (req, res) => {
      const datos = validarProducto(await leerCuerpoJson(req));
      responderJson(res, 201, productoServicio.crear(datos));
    },
    reabastecer: async (req, res, params) => {
      const id = idDeRuta(params);
      const { unidades } = validarReabastecimiento(await leerCuerpoJson(req));
      responderJson(res, 200, productoServicio.reabastecer(id, unidades));
    },
  };
}

function crearControladorClientes(clienteServicio) {
  return {
    listar: async (req, res) => {
      responderJson(res, 200, clienteServicio.listar());
    },
    obtener: async (req, res, params) => {
      responderJson(res, 200, clienteServicio.obtener(idDeRuta(params)));
    },
    registrar: async (req, res) => {
      const datos = validarCliente(await leerCuerpoJson(req));
      responderJson(res, 201, clienteServicio.registrar(datos));
    },
  };
}

function crearControladorPedidos(pedidoServicio) {
  return {
    listar: async (req, res, params, consulta) => {
      const filtros = {};
      const clienteId = consulta.get('clienteId');
      const estado = consulta.get('estado');
      if (clienteId) {
        if (!/^\d+$/.test(clienteId)) {
          throw new ErrorSolicitud('Datos de la solicitud inválidos.', ['"clienteId" debe ser un número entero.']);
        }
        filtros.clienteId = Number(clienteId);
      }
      if (estado) filtros.estado = estado;
      responderJson(res, 200, pedidoServicio.listar(filtros));
    },
    cotizar: async (req, res) => {
      const datos = validarPedido(await leerCuerpoJson(req));
      responderJson(res, 200, pedidoServicio.cotizar(datos));
    },
    obtener: async (req, res, params) => {
      responderJson(res, 200, pedidoServicio.obtener(idDeRuta(params)));
    },
    registrar: async (req, res) => {
      const datos = validarPedido(await leerCuerpoJson(req));
      responderJson(res, 201, pedidoServicio.registrar(datos));
    },
    avanzarEstado: async (req, res, params) => {
      const id = idDeRuta(params);
      const { estado } = validarCambioEstado(await leerCuerpoJson(req));
      responderJson(res, 200, pedidoServicio.avanzarEstado(id, estado));
    },
  };
}

module.exports = { crearControladorProductos, crearControladorClientes, crearControladorPedidos };
