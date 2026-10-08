/*
 * Capa: NEGOCIO
 * Responsabilidad: constantes del dominio de Café Overflow (niveles, descuentos,
 * umbrales de ascenso, valor de los DevPoints y máquina de estados del pedido).
 */
'use strict';

const NIVELES = Object.freeze({
  JUNIOR: 'Junior',
  MID: 'Mid',
  SENIOR: 'Senior',
});

// Porcentaje de descuento sobre el subtotal (Regla 1).
const DESCUENTO_POR_NIVEL = Object.freeze({
  [NIVELES.JUNIOR]: 5,
  [NIVELES.MID]: 10,
  [NIVELES.SENIOR]: 15,
});

const UMBRAL_NIVEL = Object.freeze({
  [NIVELES.MID]: 500000,
  [NIVELES.SENIOR]: 1500000,
});

const PESOS_POR_DEVPOINT_GANADO = 20000;
const VALOR_DEVPOINT = 200;

const ESTADOS = Object.freeze({
  PENDIENTE_PAGO: 'Pendiente de pago',
  EN_PREPARACION: 'En Preparación',
  LISTO: 'Listo',
  ENTREGADO: 'Entregado',
});

const SIGUIENTE_ESTADO = Object.freeze({
  [ESTADOS.PENDIENTE_PAGO]: ESTADOS.EN_PREPARACION,
  [ESTADOS.EN_PREPARACION]: ESTADOS.LISTO,
  [ESTADOS.LISTO]: ESTADOS.ENTREGADO,
  [ESTADOS.ENTREGADO]: null,
});

module.exports = {
  NIVELES,
  DESCUENTO_POR_NIVEL,
  UMBRAL_NIVEL,
  PESOS_POR_DEVPOINT_GANADO,
  VALOR_DEVPOINT,
  ESTADOS,
  SIGUIENTE_ESTADO,
};
