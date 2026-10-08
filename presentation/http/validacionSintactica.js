/*
 * Capa: PRESENTACIÓN
 * Responsabilidad: validación SINTÁCTICA de los datos que llegan por HTTP
 * (campos requeridos, tipos, longitud y formato de correo). No evalúa reglas
 * de negocio: eso le corresponde a la capa de negocio.
 */
'use strict';

const { ErrorSolicitud } = require('./utilidadesHttp');

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LONGITUD_MAXIMA_TEXTO = 120;

function esObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function validarTexto(errores, valor, campo) {
  if (valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '')) {
    errores.push(`El campo "${campo}" es obligatorio.`);
  } else if (typeof valor !== 'string') {
    errores.push(`El campo "${campo}" debe ser texto.`);
  } else if (valor.length > LONGITUD_MAXIMA_TEXTO) {
    errores.push(`El campo "${campo}" admite como máximo ${LONGITUD_MAXIMA_TEXTO} caracteres.`);
  }
}

function validarEntero(errores, valor, campo, { requerido = true } = {}) {
  if (valor === undefined || valor === null) {
    if (requerido) errores.push(`El campo "${campo}" es obligatorio.`);
  } else if (typeof valor !== 'number' || !Number.isInteger(valor)) {
    errores.push(`El campo "${campo}" debe ser un número entero.`);
  }
}

function lanzarSiHayErrores(errores) {
  if (errores.length > 0) throw new ErrorSolicitud('Datos de la solicitud inválidos.', errores);
}

function exigirObjeto(cuerpo) {
  if (!esObjeto(cuerpo)) {
    throw new ErrorSolicitud('Datos de la solicitud inválidos.', ['El cuerpo debe ser un objeto JSON.']);
  }
}

function validarCliente(cuerpo) {
  exigirObjeto(cuerpo);
  const errores = [];
  validarTexto(errores, cuerpo.nombre, 'nombre');
  validarTexto(errores, cuerpo.correo, 'correo');
  if (typeof cuerpo.correo === 'string' && cuerpo.correo.trim() !== '' && !REGEX_CORREO.test(cuerpo.correo.trim())) {
    errores.push('El campo "correo" no tiene un formato de correo válido (ejemplo: nombre@dominio.com).');
  }
  lanzarSiHayErrores(errores);
  return { nombre: cuerpo.nombre.trim(), correo: cuerpo.correo.trim() };
}

function validarProducto(cuerpo) {
  exigirObjeto(cuerpo);
  const errores = [];
  validarTexto(errores, cuerpo.nombre, 'nombre');
  validarEntero(errores, cuerpo.precioBase, 'precioBase');
  validarEntero(errores, cuerpo.stock, 'stock');
  lanzarSiHayErrores(errores);
  return { nombre: cuerpo.nombre.trim(), precioBase: cuerpo.precioBase, stock: cuerpo.stock };
}

function validarReabastecimiento(cuerpo) {
  exigirObjeto(cuerpo);
  const errores = [];
  validarEntero(errores, cuerpo.unidades, 'unidades');
  lanzarSiHayErrores(errores);
  return { unidades: cuerpo.unidades };
}

function validarPedido(cuerpo) {
  exigirObjeto(cuerpo);
  const errores = [];
  validarEntero(errores, cuerpo.clienteId, 'clienteId');
  validarEntero(errores, cuerpo.devPointsARedimir, 'devPointsARedimir', { requerido: false });

  if (!Array.isArray(cuerpo.items) || cuerpo.items.length === 0) {
    errores.push('El campo "items" es obligatorio y debe ser una lista con al menos un elemento.');
  } else {
    cuerpo.items.forEach((item, i) => {
      if (!esObjeto(item)) {
        errores.push(`El ítem ${i + 1} debe ser un objeto { productoId, cantidad }.`);
        return;
      }
      validarEntero(errores, item.productoId, `items[${i}].productoId`);
      validarEntero(errores, item.cantidad, `items[${i}].cantidad`);
    });
  }
  lanzarSiHayErrores(errores);
  return {
    clienteId: cuerpo.clienteId,
    items: cuerpo.items.map((item) => ({ productoId: item.productoId, cantidad: item.cantidad })),
    devPointsARedimir: cuerpo.devPointsARedimir ?? 0,
  };
}

function validarCambioEstado(cuerpo) {
  exigirObjeto(cuerpo);
  const errores = [];
  if (cuerpo.estado !== undefined && cuerpo.estado !== null) {
    validarTexto(errores, cuerpo.estado, 'estado');
  }
  lanzarSiHayErrores(errores);
  return { estado: cuerpo.estado ?? undefined };
}

module.exports = {
  validarCliente,
  validarProducto,
  validarReabastecimiento,
  validarPedido,
  validarCambioEstado,
};
