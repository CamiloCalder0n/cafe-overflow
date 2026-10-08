/*
 * Capa: PRESENTACIÓN
 * Responsabilidad: servidor HTTP nativo de Node.js. Atiende la API REST bajo
 * /api/* y sirve los archivos estáticos de la interfaz (public/), protegido
 * contra path traversal. Recibe los servicios de negocio ya construidos.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const { Enrutador } = require('./http/enrutador');
const { ErrorSolicitud, responderJson, responderError } = require('./http/utilidadesHttp');
const {
  crearControladorProductos,
  crearControladorClientes,
  crearControladorPedidos,
} = require('./controladores/controladores');

const CARPETA_PUBLICA = path.join(__dirname, 'public');

const TIPOS_CONTENIDO = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function crearEnrutador({ productoServicio, clienteServicio, pedidoServicio }) {
  const productos = crearControladorProductos(productoServicio);
  const clientes = crearControladorClientes(clienteServicio);
  const pedidos = crearControladorPedidos(pedidoServicio);

  return new Enrutador()
    .get('/api/productos', productos.listar)
    .post('/api/productos', productos.crear)
    .patch('/api/productos/:id/stock', productos.reabastecer)
    .get('/api/clientes', clientes.listar)
    .get('/api/clientes/:id', clientes.obtener)
    .post('/api/clientes', clientes.registrar)
    .get('/api/pedidos', pedidos.listar)
    // "cotizar" se registra antes de "/api/pedidos/:id" para que no se confunda con un id.
    .post('/api/pedidos/cotizar', pedidos.cotizar)
    .get('/api/pedidos/:id', pedidos.obtener)
    .post('/api/pedidos', pedidos.registrar)
    .patch('/api/pedidos/:id/estado', pedidos.avanzarEstado);
}

function responderNoEncontrado(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 - Recurso no encontrado');
}

function servirEstatico(rutaCruda, res) {
  let ruta;
  try {
    ruta = decodeURIComponent(rutaCruda);
  } catch {
    throw new ErrorSolicitud('La ruta solicitada no es válida.');
  }
  if (ruta.includes('\0')) return responderNoEncontrado(res);
  if (ruta === '/') ruta = '/index.html';

  // Protección contra path traversal: la ruta final debe seguir dentro de public/.
  const rutaArchivo = path.normalize(path.join(CARPETA_PUBLICA, ruta));
  if (!rutaArchivo.startsWith(CARPETA_PUBLICA + path.sep)) return responderNoEncontrado(res);

  fs.stat(rutaArchivo, (errorStat, info) => {
    if (errorStat || !info.isFile()) return responderNoEncontrado(res);
    const tipo = TIPOS_CONTENIDO[path.extname(rutaArchivo).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': tipo, 'Content-Length': info.size });
    fs.createReadStream(rutaArchivo).pipe(res);
  });
}

function crearServidor(servicios) {
  const enrutador = crearEnrutador(servicios);

  return http.createServer(async (req, res) => {
    try {
      // Se usa la ruta "cruda" (sin normalizar) para poder detectar intentos de path traversal.
      const [rutaCruda, cadenaConsulta = ''] = req.url.split('?');
      const consulta = new URLSearchParams(cadenaConsulta);

      if (rutaCruda === '/api' || rutaCruda.startsWith('/api/')) {
        const coincidencia = enrutador.resolver(req.method, rutaCruda);
        if (!coincidencia) {
          return responderJson(res, 404, { error: `Ruta no encontrada: ${req.method} ${rutaCruda}` });
        }
        return await coincidencia.manejador(req, res, coincidencia.params, consulta);
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') return responderNoEncontrado(res);
      return servirEstatico(rutaCruda, res);
    } catch (error) {
      return responderError(res, error);
    }
  });
}

module.exports = { crearServidor };
