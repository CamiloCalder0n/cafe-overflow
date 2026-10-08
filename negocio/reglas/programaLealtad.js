/*
 * Capa: NEGOCIO
 * Responsabilidad: funciones puras del programa de lealtad: nivel según el
 * acumulado de compras (Regla 2) y DevPoints ganados por consumo (Regla 3).
 */
'use strict';

const { NIVELES, UMBRAL_NIVEL, PESOS_POR_DEVPOINT_GANADO } = require('../constantes');

const ORDEN_NIVELES = [NIVELES.JUNIOR, NIVELES.MID, NIVELES.SENIOR];

function nivelPorAcumulado(acumulado) {
  if (acumulado >= UMBRAL_NIVEL[NIVELES.SENIOR]) return NIVELES.SENIOR;
  if (acumulado >= UMBRAL_NIVEL[NIVELES.MID]) return NIVELES.MID;
  return NIVELES.JUNIOR;
}

function devPointsGanados(monto) {
  return Math.floor(monto / PESOS_POR_DEVPOINT_GANADO);
}

// Aplica un pedido completado (Entregado) al cliente. "Monto" es el total pagado.
// Devuelve el cliente actualizado sin guardarlo; el nivel nunca baja.
function aplicarPedidoCompletado(cliente, monto) {
  const ganados = devPointsGanados(monto);
  const acumuladoCompras = cliente.acumuladoCompras + monto;
  const nivelAnterior = cliente.nivel;
  const nivelCalculado = nivelPorAcumulado(acumuladoCompras);
  const nivelNuevo =
    ORDEN_NIVELES.indexOf(nivelCalculado) > ORDEN_NIVELES.indexOf(nivelAnterior)
      ? nivelCalculado
      : nivelAnterior;

  return {
    cliente: {
      ...cliente,
      acumuladoCompras,
      devPoints: cliente.devPoints + ganados,
      nivel: nivelNuevo,
    },
    devPointsGanados: ganados,
    ascendio: nivelNuevo !== nivelAnterior,
    nivelAnterior,
    nivelNuevo,
  };
}

module.exports = { nivelPorAcumulado, devPointsGanados, aplicarPedidoCompletado };
