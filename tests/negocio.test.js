/*
 * Pruebas de la CAPA DE NEGOCIO (17).
 * Usan AlmacenMemoria para no tocar el disco. Verifican las reglas de negocio
 * y las decisiones de interpretación de la especificación.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { AlmacenMemoria } = require('../persistencia/almacenes/almacenMemoria');
const {
  ProductoRepositorio,
  ClienteRepositorio,
  PedidoRepositorio,
} = require('../persistencia/repositorios/repositorios');
const { ProductoServicio } = require('../negocio/servicios/productoServicio');
const { ClienteServicio } = require('../negocio/servicios/clienteServicio');
const { PedidoServicio } = require('../negocio/servicios/pedidoServicio');
const { maximoDevPointsRedimibles } = require('../negocio/reglas/calculadoraDescuentos');
const { nivelPorAcumulado, devPointsGanados } = require('../negocio/reglas/programaLealtad');
const { ErrorValidacion, ErrorNegocio } = require('../negocio/errores');

const PRODUCTOS_POR_DEFECTO = [
  { id: 1, nombre: 'Espresso StackTrace', precioBase: 10000, stock: 10 },
  { id: 2, nombre: 'Combo BugHunter', precioBase: 100000, stock: 100 },
];

function cliente(id, nivel, { devPoints = 0, acumuladoCompras = 0 } = {}) {
  return { id, nombre: `Cliente ${id}`, correo: `cliente${id}@test.dev`, nivel, devPoints, acumuladoCompras };
}

function crearContexto({ clientes = [], productos = PRODUCTOS_POR_DEFECTO } = {}) {
  const almacen = new AlmacenMemoria({ productos, clientes, pedidos: [] });
  const repositorios = {
    productoRepositorio: new ProductoRepositorio(almacen),
    clienteRepositorio: new ClienteRepositorio(almacen),
    pedidoRepositorio: new PedidoRepositorio(almacen),
  };
  return {
    ...repositorios,
    productoServicio: new ProductoServicio(repositorios),
    clienteServicio: new ClienteServicio(repositorios),
    pedidoServicio: new PedidoServicio({ ...repositorios, reloj: () => new Date('2026-10-08T12:00:00Z') }),
  };
}

function entregar(pedidoServicio, pedidoId) {
  pedidoServicio.avanzarEstado(pedidoId); // En Preparación
  pedidoServicio.avanzarEstado(pedidoId); // Listo
  return pedidoServicio.avanzarEstado(pedidoId); // Entregado
}

const unCombo = [{ productoId: 2, cantidad: 1 }];

test('Regla 1: descuento por nivel sobre $100.000 (Junior 95.000, Mid 90.000, Senior 85.000)', () => {
  const ctx = crearContexto({ clientes: [cliente(1, 'Junior'), cliente(2, 'Mid'), cliente(3, 'Senior')] });
  const totales = [1, 2, 3].map((clienteId) => ctx.pedidoServicio.cotizar({ clienteId, items: unCombo }).total);
  assert.deepEqual(totales, [95000, 90000, 85000]);
});

test('Regla 2: un cliente nuevo inicia como Junior, con $0 acumulado y 0 DevPoints', () => {
  const ctx = crearContexto();
  const nuevo = ctx.clienteServicio.registrar({ nombre: 'Margaret Hamilton', correo: 'Margaret@Apollo.dev' });
  assert.equal(nuevo.nivel, 'Junior');
  assert.equal(nuevo.acumuladoCompras, 0);
  assert.equal(nuevo.devPoints, 0);
  assert.equal(nuevo.correo, 'margaret@apollo.dev');
});

test('Regla 2: umbrales exactos de ascenso', () => {
  assert.equal(nivelPorAcumulado(499999), 'Junior');
  assert.equal(nivelPorAcumulado(500000), 'Mid');
  assert.equal(nivelPorAcumulado(1499999), 'Mid');
  assert.equal(nivelPorAcumulado(1500000), 'Senior');
});

test('Regla 2: Junior con $405.000 compra un combo, llega a $500.000, asciende a Mid y la siguiente compra usa 10 %', () => {
  const ctx = crearContexto({ clientes: [cliente(1, 'Junior', { acumuladoCompras: 405000 })] });
  const pedido = ctx.pedidoServicio.registrar({ clienteId: 1, items: unCombo });
  assert.equal(pedido.total, 95000);

  const { lealtad } = entregar(ctx.pedidoServicio, pedido.id);
  assert.equal(lealtad.ascendio, true);
  assert.equal(lealtad.nivelAnterior, 'Junior');
  assert.equal(lealtad.nivelNuevo, 'Mid');

  const actualizado = ctx.clienteServicio.obtener(1);
  assert.equal(actualizado.acumuladoCompras, 500000);
  assert.equal(actualizado.nivel, 'Mid');

  const siguiente = ctx.pedidoServicio.cotizar({ clienteId: 1, items: unCombo });
  assert.equal(siguiente.porcentajeDescuentoNivel, 10);
  assert.equal(siguiente.total, 90000);
});

test('Regla 2: el ascenso solo ocurre al llegar a Entregado', () => {
  const ctx = crearContexto({ clientes: [cliente(1, 'Junior', { acumuladoCompras: 405000 })] });
  const pedido = ctx.pedidoServicio.registrar({ clienteId: 1, items: unCombo });

  ctx.pedidoServicio.avanzarEstado(pedido.id);
  assert.equal(ctx.clienteServicio.obtener(1).nivel, 'Junior', 'En Preparación no asciende');
  ctx.pedidoServicio.avanzarEstado(pedido.id);
  assert.equal(ctx.clienteServicio.obtener(1).nivel, 'Junior', 'Listo no asciende');
  assert.equal(ctx.clienteServicio.obtener(1).acumuladoCompras, 405000);

  ctx.pedidoServicio.avanzarEstado(pedido.id);
  assert.equal(ctx.clienteServicio.obtener(1).nivel, 'Mid', 'Entregado sí asciende');
});

test('Regla 2: Mid con $1.410.000 compra un combo (paga 90.000) y asciende a Senior', () => {
  const ctx = crearContexto({ clientes: [cliente(1, 'Mid', { acumuladoCompras: 1410000 })] });
  const pedido = ctx.pedidoServicio.registrar({ clienteId: 1, items: unCombo });
  assert.equal(pedido.total, 90000);
  const { lealtad } = entregar(ctx.pedidoServicio, pedido.id);
  assert.equal(lealtad.nivelNuevo, 'Senior');
  assert.equal(ctx.clienteServicio.obtener(1).acumuladoCompras, 1500000);
  assert.equal(ctx.clienteServicio.obtener(1).nivel, 'Senior');
});

test('Regla 3: 1 DevPoint por cada $20.000 (19.999 → 0, 20.000 → 1, 95.000 → 4)', () => {
  assert.equal(devPointsGanados(19999), 0);
  assert.equal(devPointsGanados(20000), 1);
  assert.equal(devPointsGanados(95000), 4);
});

test('Regla 3: los DevPoints se otorgan al entregar (95.000 → 4 puntos)', () => {
  const ctx = crearContexto({ clientes: [cliente(1, 'Junior')] });
  const pedido = ctx.pedidoServicio.registrar({ clienteId: 1, items: unCombo });
  assert.equal(pedido.devPointsGanados, 0);

  ctx.pedidoServicio.avanzarEstado(pedido.id);
  ctx.pedidoServicio.avanzarEstado(pedido.id);
  assert.equal(ctx.clienteServicio.obtener(1).devPoints, 0, 'antes de entregar no hay puntos');

  const { pedido: entregado, lealtad } = ctx.pedidoServicio.avanzarEstado(pedido.id);
  assert.equal(lealtad.devPointsGanados, 4);
  assert.equal(entregado.devPointsGanados, 4);
  assert.ok(entregado.fechaEntrega);
  assert.equal(ctx.clienteServicio.obtener(1).devPoints, 4);
});

test('Regla 3: redimir 10 DevPoints en $10.000 Junior → total 7.500, descuento 2.000 y saldo en 0', () => {
  const ctx = crearContexto({ clientes: [cliente(1, 'Junior', { devPoints: 10 })] });
  const pedido = ctx.pedidoServicio.registrar({
    clienteId: 1,
    items: [{ productoId: 1, cantidad: 1 }],
    devPointsARedimir: 10,
  });
  assert.equal(pedido.subtotal, 10000);
  assert.equal(pedido.descuentoNivel, 500);
  assert.equal(pedido.descuentoDevPoints, 2000);
  assert.equal(pedido.total, 7500);
  assert.equal(ctx.clienteServicio.obtener(1).devPoints, 0);
});

test('Regla 3: no se pueden redimir más DevPoints de los que se tienen', () => {
  const ctx = crearContexto({ clientes: [cliente(1, 'Junior', { devPoints: 5 })] });
  assert.throws(
    () => ctx.pedidoServicio.cotizar({ clienteId: 1, items: [{ productoId: 1, cantidad: 1 }], devPointsARedimir: 6 }),
    (error) => error instanceof ErrorValidacion && /insuficiente/i.test(error.message)
  );
});

test('Regla 3: con saldo 500 en $9.500 el máximo redimible es 47 y pedir 48 da error', () => {
  assert.equal(maximoDevPointsRedimibles(9500, 500), 47);
  const ctx = crearContexto({ clientes: [cliente(1, 'Junior', { devPoints: 500 })] });
  const items = [{ productoId: 1, cantidad: 1 }]; // $10.000 − 5 % = $9.500
  assert.equal(ctx.pedidoServicio.cotizar({ clienteId: 1, items }).maximoDevPointsRedimibles, 47);
  assert.equal(ctx.pedidoServicio.cotizar({ clienteId: 1, items, devPointsARedimir: 47 }).total, 100);
  assert.throws(
    () => ctx.pedidoServicio.cotizar({ clienteId: 1, items, devPointsARedimir: 48 }),
    (error) => error instanceof ErrorValidacion && /máximo/i.test(error.message)
  );
});

test('Regla 4: rechaza una cantidad mayor al stock y el stock no cambia', () => {
  const ctx = crearContexto({ clientes: [cliente(1, 'Junior')] });
  assert.throws(
    () => ctx.pedidoServicio.registrar({ clienteId: 1, items: [{ productoId: 1, cantidad: 11 }] }),
    (error) => error instanceof ErrorValidacion && /Stock insuficiente/.test(error.message)
  );
  assert.equal(ctx.productoServicio.obtener(1).stock, 10);
  assert.equal(ctx.pedidoServicio.listar().length, 0);
});

test('Regla 4: los ítems repetidos (6 + 5 > 10) se suman y se rechazan', () => {
  const ctx = crearContexto({ clientes: [cliente(1, 'Junior')] });
  assert.throws(
    () =>
      ctx.pedidoServicio.registrar({
        clienteId: 1,
        items: [{ productoId: 1, cantidad: 6 }, { productoId: 1, cantidad: 5 }],
      }),
    (error) => error instanceof ErrorValidacion && /Stock insuficiente/.test(error.message)
  );
  assert.equal(ctx.productoServicio.obtener(1).stock, 10);
});

test('Regla 4: registrar el pedido descuenta el stock (10 − 4 = 6)', () => {
  const ctx = crearContexto({ clientes: [cliente(1, 'Junior')] });
  const pedido = ctx.pedidoServicio.registrar({ clienteId: 1, items: [{ productoId: 1, cantidad: 4 }] });
  assert.equal(pedido.estado, 'Pendiente de pago');
  assert.equal(ctx.productoServicio.obtener(1).stock, 6);
});

test('Regla 4: con un pedido Pendiente de pago no se registra otro; tras avanzarlo, sí', () => {
  const ctx = crearContexto({ clientes: [cliente(1, 'Junior')] });
  const items = [{ productoId: 1, cantidad: 1 }];
  const primero = ctx.pedidoServicio.registrar({ clienteId: 1, items });
  assert.throws(
    () => ctx.pedidoServicio.registrar({ clienteId: 1, items }),
    (error) => error instanceof ErrorValidacion && /pendiente de pago/i.test(error.message)
  );
  ctx.pedidoServicio.avanzarEstado(primero.id, 'En Preparación');
  const segundo = ctx.pedidoServicio.registrar({ clienteId: 1, items });
  assert.equal(segundo.estado, 'Pendiente de pago');
});

test('Estados: saltar a Entregado da "Transición no permitida" y un pedido entregado no avanza más', () => {
  const ctx = crearContexto({ clientes: [cliente(1, 'Junior')] });
  const pedido = ctx.pedidoServicio.registrar({ clienteId: 1, items: unCombo });
  assert.throws(
    () => ctx.pedidoServicio.avanzarEstado(pedido.id, 'Entregado'),
    (error) => error instanceof ErrorNegocio && /Transición no permitida/.test(error.message)
  );
  assert.equal(ctx.pedidoServicio.obtener(pedido.id).estado, 'Pendiente de pago');

  entregar(ctx.pedidoServicio, pedido.id);
  assert.equal(ctx.pedidoServicio.obtener(pedido.id).estado, 'Entregado');
  assert.throws(() => ctx.pedidoServicio.avanzarEstado(pedido.id), ErrorNegocio);
});

test('Clientes: un correo duplicado (con mayúsculas distintas) da error', () => {
  const ctx = crearContexto();
  ctx.clienteServicio.registrar({ nombre: 'Ada', correo: 'ada@cafeoverflow.dev' });
  assert.throws(
    () => ctx.clienteServicio.registrar({ nombre: 'Otra Ada', correo: 'ADA@CafeOverflow.DEV' }),
    (error) => error instanceof ErrorNegocio && /correo/.test(error.message)
  );
  assert.equal(ctx.clienteServicio.listar().length, 1);
});
