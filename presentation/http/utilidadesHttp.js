/*
 * Capa: PRESENTACIÓN
 * Responsabilidad: utilidades HTTP: leer el cuerpo JSON de una solicitud,
 * responder en JSON y traducir los errores a códigos de estado HTTP.
 */
'use strict';

const { ErrorNegocio, ErrorNoEncontrado, ErrorValidacion } = require('../../negocio/errores');

const LIMITE_CUERPO = 1024 * 1024; // 1 MB

// Error de datos mal formados (sintaxis), antes de llegar al negocio.
class ErrorSolicitud extends Error {
  constructor(mensaje, errores = []) {
    super(mensaje);
    this.name = 'ErrorSolicitud';
    this.errores = errores;
  }
}

function leerCuerpoJson(req) {
  return new Promise((resolve, reject) => {
    const fragmentos = [];
    let tamano = 0;
    let excedido = false;

    req.on('data', (fragmento) => {
      if (excedido) return;
      tamano += fragmento.length;
      if (tamano > LIMITE_CUERPO) {
        excedido = true;
        reject(new ErrorSolicitud('El cuerpo de la solicitud supera el límite de 1 MB.'));
        return;
      }
      fragmentos.push(fragmento);
    });

    req.on('end', () => {
      if (excedido) return;
      const texto = Buffer.concat(fragmentos).toString('utf8').trim();
      if (texto === '') return resolve({});
      try {
        resolve(JSON.parse(texto));
      } catch {
        reject(new ErrorSolicitud('El cuerpo de la solicitud no es un JSON válido.'));
      }
    });

    req.on('error', reject);
  });
}

function responderJson(res, estado, datos) {
  const cuerpo = JSON.stringify(datos);
  res.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(cuerpo),
  });
  res.end(cuerpo);
}

function responderError(res, error) {
  if (error instanceof ErrorSolicitud) {
    return responderJson(res, 400, { error: error.message, detalles: error.errores });
  }
  if (error instanceof ErrorNoEncontrado) {
    return responderJson(res, 404, { error: error.message });
  }
  if (error instanceof ErrorValidacion) {
    return responderJson(res, 422, { error: error.message });
  }
  if (error instanceof ErrorNegocio) {
    return responderJson(res, 409, { error: error.message });
  }
  console.error(error);
  return responderJson(res, 500, { error: 'Error interno del servidor.' });
}

module.exports = { ErrorSolicitud, leerCuerpoJson, responderJson, responderError };
