/*
 * Capa: NEGOCIO
 * Responsabilidad: casos de uso de pedidos: cotizar, registrar (valida stock y
 * pedido pendiente, reserva stock y DevPoints), avanzar por la máquina de
 * estados y, al entregar, aplicar el programa de lealtad al cliente.
 */
'use strict';

const { ESTADOS, SIGUIENTE_ESTADO } = require('../constantes');
const { ErrorNegocio, ErrorNoEncontrado, ErrorValidacion } = require('../errores');
const { calcularTotales } = require('../reglas/calculadoraDescuentos');
const { aplicarPedidoCompletado } = require('../reglas/programaLealtad');

class PedidoServicio {
  constructor({ pedidoRepositorio, productoRepositorio, clienteRepositorio, reloj = () => new Date() }) {
    this.pedidoRepositorio = pedidoRepositorio;
    this.productoRepositorio = productoRepositorio;
    this.clienteRepositorio = clienteRepositorio;
    this.reloj = reloj;
  }

  _obtenerCliente(clienteId) {
    const cliente = this.clienteRepositorio.buscarPorId(clienteId);
    if (!cliente) throw new ErrorNoEncontrado(`El cliente ${clienteId} no existe.`);
    return cliente;
  }

  // Valida los ítems, suma los repetidos, verifica stock y arma las líneas.
  _construirLineas(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new ErrorValidacion('El pedido debe tener al menos un producto.');
    }

    const cantidades = new Map();
    for (const item of items) {
      if (!Number.isInteger(item.cantidad) || item.cantidad <= 0) {
        throw new ErrorValidacion('Cada cantidad debe ser un número entero mayor que 0.');
      }
      const productoId = Number(item.productoId);
      cantidades.set(productoId, (cantidades.get(productoId) || 0) + item.cantidad);
    }

    const lineas = [];
    for (const [productoId, cantidad] of cantidades) {
      const producto = this.productoRepositorio.buscarPorId(productoId);
      if (!producto) throw new ErrorNoEncontrado(`El producto ${productoId} no existe.`);
      if (cantidad > producto.stock) {
        throw new ErrorValidacion(
          `Stock insuficiente para "${producto.nombre}": se piden ${cantidad} y hay ${producto.stock}.`
        );
      }
      lineas.push({
        productoId: producto.id,
        nombre: producto.nombre,
        cantidad,
        precioUnitario: producto.precioBase,
        subtotal: producto.precioBase * cantidad,
      });
    }
    return lineas;
  }

  cotizar({ clienteId, items, devPointsARedimir = 0 }) {
    const cliente = this._obtenerCliente(clienteId);
    const lineas = this._construirLineas(items);
    const totales = calcularTotales({
      lineas,
      nivel: cliente.nivel,
      saldoDevPoints: cliente.devPoints,
      devPointsARedimir: devPointsARedimir == null ? 0 : devPointsARedimir,
    });
    return { cliente, lineas, ...totales };
  }

  registrar({ clienteId, items, devPointsARedimir = 0 }) {
    const cliente = this._obtenerCliente(clienteId);
    const tienePendiente = this.pedidoRepositorio
      .listarPorCliente(cliente.id)
      .some((p) => p.estado === ESTADOS.PENDIENTE_PAGO);
    if (tienePendiente) {
      throw new ErrorValidacion(
        'El cliente ya tiene un pedido pendiente de pago. Debe confirmarse en caja antes de hacer otro.'
      );
    }

    const cotizacion = this.cotizar({ clienteId: cliente.id, items, devPointsARedimir });

    // Reserva de stock al registrar.
    for (const linea of cotizacion.lineas) {
      const producto = this.productoRepositorio.buscarPorId(linea.productoId);
      this.productoRepositorio.actualizar({ ...producto, stock: producto.stock - linea.cantidad });
    }

    // Los DevPoints redimidos salen del saldo al registrar.
    if (cotizacion.devPointsRedimidos > 0) {
      this.clienteRepositorio.actualizar({
        ...cliente,
        devPoints: cliente.devPoints - cotizacion.devPointsRedimidos,
      });
    }

    return this.pedidoRepositorio.crear({
      clienteId: cliente.id,
      items: cotizacion.lineas,
      estado: ESTADOS.PENDIENTE_PAGO,
      nivelAplicado: cliente.nivel,
      subtotal: cotizacion.subtotal,
      porcentajeDescuentoNivel: cotizacion.porcentajeDescuentoNivel,
      descuentoNivel: cotizacion.descuentoNivel,
      devPointsRedimidos: cotizacion.devPointsRedimidos,
      descuentoDevPoints: cotizacion.descuentoDevPoints,
      total: cotizacion.total,
      devPointsGanados: 0,
      fecha: this.reloj().toISOString(),
      fechaEntrega: null,
    });
  }

  avanzarEstado(pedidoId, estadoSolicitado) {
    const pedido = this.obtener(pedidoId);
    const siguiente = SIGUIENTE_ESTADO[pedido.estado];

    if (siguiente === null) {
      throw new ErrorNegocio(
        `Transición no permitida: el pedido ${pedido.id} ya está ${ESTADOS.ENTREGADO} y no puede cambiar.`
      );
    }
    if (estadoSolicitado !== undefined && estadoSolicitado !== null && estadoSolicitado !== siguiente) {
      throw new ErrorNegocio(
        `Transición no permitida: de "${pedido.estado}" solo se puede pasar a "${siguiente}".`
      );
    }

    const actualizado = { ...pedido, estado: siguiente };
    let lealtad = null;

    if (siguiente === ESTADOS.ENTREGADO) {
      const cliente = this._obtenerCliente(pedido.clienteId);
      lealtad = aplicarPedidoCompletado(cliente, pedido.total);
      this.clienteRepositorio.actualizar(lealtad.cliente);
      actualizado.devPointsGanados = lealtad.devPointsGanados;
      actualizado.fechaEntrega = this.reloj().toISOString();
    }

    return { pedido: this.pedidoRepositorio.actualizar(actualizado), lealtad };
  }

  obtener(id) {
    const pedido = this.pedidoRepositorio.buscarPorId(id);
    if (!pedido) throw new ErrorNoEncontrado(`El pedido ${id} no existe.`);
    return pedido;
  }

  listar({ clienteId, estado } = {}) {
    let pedidos =
      clienteId !== undefined && clienteId !== null
        ? this.pedidoRepositorio.listarPorCliente(clienteId)
        : this.pedidoRepositorio.listar();
    if (estado) pedidos = pedidos.filter((p) => p.estado === estado);
    return pedidos.sort((a, b) => b.id - a.id);
  }
}

module.exports = { PedidoServicio };
