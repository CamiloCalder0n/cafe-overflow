/*
 * Capa: NEGOCIO
 * Responsabilidad: funciones puras que calculan el subtotal, el descuento por
 * nivel (Regla 1) y la redención de DevPoints (Regla 3) de un pedido.
 * Orden de cálculo: subtotal → descuentoNivel → totalTrasNivel →
 * descuentoDevPoints → total.
 */
'use strict';

const { DESCUENTO_POR_NIVEL, VALOR_DEVPOINT } = require('../constantes');
const { ErrorValidacion } = require('../errores');

function calcularSubtotal(lineas) {
  return lineas.reduce((suma, linea) => suma + linea.precioUnitario * linea.cantidad, 0);
}

function porcentajeDescuento(nivel) {
  if (!Object.prototype.hasOwnProperty.call(DESCUENTO_POR_NIVEL, nivel)) {
    throw new ErrorValidacion(`El nivel "${nivel}" no existe.`);
  }
  return DESCUENTO_POR_NIVEL[nivel];
}

function maximoDevPointsRedimibles(totalTrasNivel, saldo) {
  return Math.max(0, Math.min(saldo, Math.floor(totalTrasNivel / VALOR_DEVPOINT)));
}

function calcularTotales({ lineas, nivel, saldoDevPoints, devPointsARedimir = 0 }) {
  const subtotal = calcularSubtotal(lineas);
  const porcentaje = porcentajeDescuento(nivel);
  const descuentoNivel = Math.round((subtotal * porcentaje) / 100);
  const totalTrasNivel = subtotal - descuentoNivel;
  const maximo = maximoDevPointsRedimibles(totalTrasNivel, saldoDevPoints);

  if (!Number.isInteger(devPointsARedimir) || devPointsARedimir < 0) {
    throw new ErrorValidacion('Los DevPoints a redimir deben ser un número entero mayor o igual a 0.');
  }
  if (devPointsARedimir > saldoDevPoints) {
    throw new ErrorValidacion(
      `Saldo de DevPoints insuficiente: quiere redimir ${devPointsARedimir} y solo tiene ${saldoDevPoints}.`
    );
  }
  if (devPointsARedimir > maximo) {
    throw new ErrorValidacion(
      `Máximo de DevPoints redimibles excedido: en este pedido puede redimir como máximo ${maximo}.`
    );
  }

  const descuentoDevPoints = devPointsARedimir * VALOR_DEVPOINT;
  const total = totalTrasNivel - descuentoDevPoints;

  return {
    subtotal,
    porcentajeDescuentoNivel: porcentaje,
    descuentoNivel,
    devPointsRedimidos: devPointsARedimir,
    descuentoDevPoints,
    total,
    maximoDevPointsRedimibles: maximo,
  };
}

module.exports = {
  calcularSubtotal,
  porcentajeDescuento,
  maximoDevPointsRedimibles,
  calcularTotales,
};
