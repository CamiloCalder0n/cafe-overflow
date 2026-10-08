/*
 * Capa: PRESENTACIÓN (navegador)
 * Responsabilidad: pintar la interfaz y capturar las acciones del usuario.
 * REGLA CLAVE: este archivo NO calcula totales, descuentos ni niveles. Cada
 * cambio del carrito pide la cotización a POST /api/pedidos/cotizar y solo
 * muestra lo que devuelve el servidor. El DOM se construye con createElement
 * y textContent (nunca innerHTML con datos del usuario).
 */
'use strict';

(function () {
  const formatoMoneda = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
  const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

  // ---------- Textos y adornos de la vista (no son reglas de negocio) ----------

  // Etiqueta del botón de la barra según el estado actual del pedido.
  const ACCION_POR_ESTADO = {
    'Pendiente de pago': 'Confirmar pago → En preparación',
    'En Preparación': 'Marcar como listo',
    Listo: 'Entregar al cliente',
  };

  // Orden en que se dibujan los pasos y las columnas (solo visualización).
  const PASOS_VISIBLES = ['Pendiente de pago', 'En Preparación', 'Listo', 'Entregado'];

  const CLASE_ESTADO = {
    'Pendiente de pago': 'pendiente',
    'En Preparación': 'preparacion',
    Listo: 'listo',
    Entregado: 'entregado',
  };

  // Categoría decorativa según palabras del nombre del producto.
  const DECORACION_PRODUCTO = [
    { palabras: ['combo'], categoria: 'combo' },
    { palabras: ['cold brew', 'frappé', 'frappe', 'helado'], categoria: 'bebida fría' },
    { palabras: ['té', 'te', 'chai', 'matcha'], categoria: 'infusión' },
    { palabras: ['croissant', 'pan'], categoria: 'panadería' },
    { palabras: ['brownie', 'galleta', 'torta', 'muffin'], categoria: 'postre' },
    { palabras: ['sándwich', 'sandwich', 'wrap'], categoria: 'comida' },
  ];

  const TAZA_ASCII = ['   ( (', '    ) )', '  ........', '  |      |]', '  \\      /', "   `----'"].join('\n');

  const estado = {
    clientes: [],
    productos: [],
    clienteId: null,
    carrito: new Map(), // productoId → cantidad
    cotizacion: null,
    pestana: 'menu',
  };

  const $ = (id) => document.getElementById(id);
  const moneda = (valor) => formatoMoneda.format(valor);

  // ---------- Utilidades de DOM ----------

  function el(etiqueta, opciones = {}, hijos = []) {
    const nodo = document.createElement(etiqueta);
    if (opciones.clase) nodo.className = opciones.clase;
    if (opciones.texto !== undefined) nodo.textContent = String(opciones.texto);
    if (opciones.atributos) {
      for (const [nombre, valor] of Object.entries(opciones.atributos)) nodo.setAttribute(nombre, valor);
    }
    if (opciones.alHacerClic) nodo.addEventListener('click', opciones.alHacerClic);
    for (const hijo of hijos) if (hijo) nodo.appendChild(hijo);
    return nodo;
  }

  function vaciar(nodo) {
    while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
  }

  function avisar(mensaje, tipo = 'exito') {
    const aviso = el('div', { clase: `aviso ${tipo}`, atributos: { role: 'status' } }, [
      el('span', { clase: 'aviso-icono', texto: tipo === 'error' ? '✗' : '✓' }),
      el('span', { texto: mensaje }),
    ]);
    $('avisos').appendChild(aviso);
    setTimeout(() => {
      aviso.classList.add('saliendo');
      setTimeout(() => aviso.remove(), 260);
    }, tipo === 'error' ? 6000 : 4500);
  }

  function decoracion(nombre) {
    const texto = nombre.toLowerCase();
    const palabrasNombre = texto.split(/[^a-záéíóúñü]+/);
    const coincide = (p) => (p.includes(' ') ? texto.includes(p) : palabrasNombre.includes(p));
    const encontrada = DECORACION_PRODUCTO.find((d) => d.palabras.some(coincide));
    return encontrada || { categoria: 'bebida caliente' };
  }

  function iniciales(nombre) {
    return nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0].toUpperCase())
      .join('');
  }

  function insigniaNivel(nivel) {
    return el('span', { clase: `insignia nivel-${nivel}`, texto: nivel });
  }

  function insigniaEstado(estadoPedido) {
    return el('span', { clase: `estado estado-${CLASE_ESTADO[estadoPedido] || 'pendiente'}`, texto: estadoPedido });
  }

  function vacioConTaza(mensaje) {
    return el('div', { clase: 'vacio-panel' }, [el('pre', { texto: TAZA_ASCII, atributos: { 'aria-hidden': 'true' } }), el('p', { texto: mensaje })]);
  }

  // ---------- Comunicación con la API ----------

  async function solicitar(ruta, { metodo = 'GET', cuerpo } = {}) {
    const opciones = { method: metodo, headers: {} };
    if (cuerpo !== undefined) {
      opciones.headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }
    const respuesta = await fetch(ruta, opciones);
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      const detalles = Array.isArray(datos.detalles) && datos.detalles.length ? ` ${datos.detalles.join(' ')}` : '';
      throw new Error((datos.error || `Error ${respuesta.status}`) + detalles);
    }
    return datos;
  }

  const api = {
    productos: () => solicitar('/api/productos'),
    crearProducto: (datos) => solicitar('/api/productos', { metodo: 'POST', cuerpo: datos }),
    reabastecer: (id, unidades) => solicitar(`/api/productos/${id}/stock`, { metodo: 'PATCH', cuerpo: { unidades } }),
    clientes: () => solicitar('/api/clientes'),
    registrarCliente: (datos) => solicitar('/api/clientes', { metodo: 'POST', cuerpo: datos }),
    pedidosDeCliente: (id) => solicitar(`/api/pedidos?clienteId=${encodeURIComponent(id)}`),
    todosLosPedidos: () => solicitar('/api/pedidos'),
    cotizar: (datos) => solicitar('/api/pedidos/cotizar', { metodo: 'POST', cuerpo: datos }),
    registrarPedido: (datos) => solicitar('/api/pedidos', { metodo: 'POST', cuerpo: datos }),
    avanzarEstado: (id) => solicitar(`/api/pedidos/${id}/estado`, { metodo: 'PATCH', cuerpo: {} }),
  };

  // ---------- Cliente seleccionado ----------

  function clienteActual() {
    return estado.clientes.find((c) => c.id === estado.clienteId) || null;
  }

  function pintarSelectorClientes() {
    const selector = $('selectorCliente');
    vaciar(selector);
    for (const cliente of estado.clientes) {
      selector.appendChild(el('option', { texto: `${cliente.nombre} · ${cliente.nivel}`, atributos: { value: cliente.id } }));
    }
    if (estado.clienteId !== null) selector.value = String(estado.clienteId);
  }

  function pintarTarjetaCliente() {
    const tarjeta = $('tarjetaCliente');
    vaciar(tarjeta);
    tarjeta.className = 'tarjeta tarjeta-cliente';
    const cliente = clienteActual();
    if (!cliente) {
      tarjeta.appendChild(el('span', { clase: 'tenue', texto: 'No hay clientes registrados. Crea uno en la pestaña Registro.' }));
      return;
    }
    tarjeta.classList.add(`nivel-${cliente.nivel}`);

    const estadistica = (etiqueta, valor, acento = false) =>
      el('div', { clase: 'estadistica' }, [
        el('span', { clase: 'etiqueta', texto: etiqueta }),
        el('span', { clase: `valor${acento ? ' acento' : ''}`, texto: valor }),
      ]);

    tarjeta.append(
      el('div', { clase: 'avatar', texto: iniciales(cliente.nombre), atributos: { 'aria-hidden': 'true' } }),
      el('div', { clase: 'cliente-info' }, [
        el('div', { clase: 'cliente-nombre' }, [el('span', { texto: cliente.nombre }), insigniaNivel(cliente.nivel)]),
        el('div', { clase: 'cliente-correo', texto: cliente.correo }),
      ]),
      el('div', { clase: 'estadisticas' }, [
        estadistica('⬡ DevPoints', cliente.devPoints, true),
        estadistica('Σ Acumulado', moneda(cliente.acumuladoCompras)),
      ])
    );
  }

  async function recargarClientes() {
    estado.clientes = await api.clientes();
    if (!estado.clientes.some((c) => c.id === estado.clienteId)) {
      estado.clienteId = estado.clientes.length ? estado.clientes[0].id : null;
    }
    pintarSelectorClientes();
    pintarTarjetaCliente();
  }

  // ---------- Menú y carrito ----------

  function pintarProductos() {
    const grid = $('gridProductos');
    vaciar(grid);
    for (const producto of estado.productos) {
      const enCarrito = estado.carrito.get(producto.id) || 0;
      const { categoria } = decoracion(producto.nombre);
      const boton = el('button', {
        clase: 'boton boton-ancho',
        texto: producto.stock === 0 ? 'Agotado' : '+ Agregar',
        alHacerClic: () => cambiarCantidad(producto.id, 1),
      });
      boton.disabled = producto.stock === 0 || enCarrito >= producto.stock;

      const clases = ['tarjeta', 'producto'];
      if (enCarrito > 0) clases.push('en-carrito');
      if (producto.stock === 0) clases.push('agotado');

      grid.appendChild(
        el('article', { clase: clases.join(' ') }, [
          enCarrito > 0 ? el('span', { clase: 'globo-cantidad', texto: enCarrito, atributos: { 'aria-label': `${enCarrito} en el carrito` } }) : null,
          el('div', { clase: 'producto-cabeza' }, [
            el('span', { clase: 'producto-icono', texto: iniciales(producto.nombre), atributos: { 'aria-hidden': 'true' } }),
            el('span', { clase: 'producto-categoria', texto: `#${categoria.replace(/\s/g, '-')}` }),
          ]),
          el('h3', { texto: producto.nombre }),
          el('div', { clase: 'producto-pie' }, [
            el('span', { clase: 'precio', texto: moneda(producto.precioBase) }),
            el('span', { clase: `stock${producto.stock === 0 ? ' cero' : ''}`, texto: `stock ${producto.stock}` }),
          ]),
          boton,
        ])
      );
    }

    const selector = $('selectorReabastecer');
    const seleccionado = selector.value;
    vaciar(selector);
    for (const producto of estado.productos) {
      selector.appendChild(el('option', { texto: `${producto.nombre} (stock ${producto.stock})`, atributos: { value: producto.id } }));
    }
    if (seleccionado) selector.value = seleccionado;
  }

  function cambiarCantidad(productoId, delta) {
    const nueva = (estado.carrito.get(productoId) || 0) + delta;
    if (nueva <= 0) estado.carrito.delete(productoId);
    else estado.carrito.set(productoId, nueva);
    pintarProductos();
    pintarCarrito();
    programarCotizacion();
  }

  function pintarCarrito() {
    const lista = $('listaCarrito');
    vaciar(lista);
    $('contadorCarrito').textContent = String([...estado.carrito.values()].reduce((a, b) => a + b, 0));

    if (estado.carrito.size === 0) {
      lista.appendChild(
        el('li', { clase: 'carrito-vacio' }, [
          el('pre', { texto: TAZA_ASCII, atributos: { 'aria-hidden': 'true' } }),
          el('span', { texto: 'Carrito vacío: agrega algo del menú.' }),
        ])
      );
      return;
    }
    // El subtotal de cada línea viene de la cotización del servidor.
    const lineasCotizadas = new Map((estado.cotizacion ? estado.cotizacion.lineas : []).map((l) => [l.productoId, l]));
    for (const [productoId, cantidad] of estado.carrito) {
      const producto = estado.productos.find((p) => p.id === productoId);
      const linea = lineasCotizadas.get(productoId);
      lista.appendChild(
        el('li', { clase: 'item-carrito' }, [
          el('span', { clase: 'item-nombre', texto: producto ? producto.nombre : `Producto ${productoId}` }),
          el('span', { clase: 'controles' }, [
            el('button', { clase: 'boton boton-mini', texto: '−', alHacerClic: () => cambiarCantidad(productoId, -1), atributos: { 'aria-label': 'Quitar uno', type: 'button' } }),
            el('span', { texto: cantidad }),
            el('button', { clase: 'boton boton-mini', texto: '+', alHacerClic: () => cambiarCantidad(productoId, 1), atributos: { 'aria-label': 'Agregar uno', type: 'button' } }),
          ]),
          el('span', {
            clase: 'linea',
            texto: linea ? `${linea.cantidad} × ${moneda(linea.precioUnitario)} = ${moneda(linea.subtotal)}` : 'cotizando…',
          }),
        ])
      );
    }
  }

  function pintarResumen() {
    const resumen = $('resumen');
    vaciar(resumen);
    const c = estado.cotizacion;
    $('maximoDevPoints').textContent = c ? `(máx. ${c.maximoDevPointsRedimibles})` : '';
    $('botonMaximoDevPoints').disabled = !c || c.maximoDevPointsRedimibles === 0;
    if (c) $('devPointsARedimir').max = String(c.maximoDevPointsRedimibles);
    if (!c) return;
    const fila = (titulo, valor, clase = '') => {
      resumen.append(el('dt', { clase, texto: titulo }), el('dd', { clase, texto: valor }));
    };
    fila('Subtotal', moneda(c.subtotal));
    fila(`Nivel ${c.cliente.nivel} (−${c.porcentajeDescuentoNivel} %)`, `− ${moneda(c.descuentoNivel)}`, 'descuento');
    fila(`⬡ DevPoints (${c.devPointsRedimidos})`, `− ${moneda(c.descuentoDevPoints)}`, 'descuento');
    fila('Total', moneda(c.total), 'total');
  }

  let temporizadorCotizacion = null;
  let numeroCotizacion = 0;

  function programarCotizacion() {
    clearTimeout(temporizadorCotizacion);
    temporizadorCotizacion = setTimeout(cotizar, 200);
  }

  function leerDevPoints() {
    const texto = $('devPointsARedimir').value.trim();
    return texto === '' ? 0 : Number(texto);
  }

  async function cotizar() {
    const numero = ++numeroCotizacion;
    const boton = $('botonPedido');
    const errorCotizacion = $('errorCotizacion');
    if (estado.carrito.size === 0 || estado.clienteId === null) {
      estado.cotizacion = null;
      errorCotizacion.textContent = '';
      boton.disabled = true;
      pintarResumen();
      pintarCarrito();
      return;
    }
    try {
      const cotizacion = await api.cotizar(cuerpoPedido());
      if (numero !== numeroCotizacion) return; // llegó una cotización más reciente
      estado.cotizacion = cotizacion;
      errorCotizacion.textContent = '';
      boton.disabled = false;
    } catch (error) {
      if (numero !== numeroCotizacion) return;
      estado.cotizacion = null;
      errorCotizacion.textContent = `✗ ${error.message}`;
      boton.disabled = true;
    }
    pintarResumen();
    pintarCarrito();
  }

  function cuerpoPedido() {
    return {
      clienteId: estado.clienteId,
      items: [...estado.carrito].map(([productoId, cantidad]) => ({ productoId, cantidad })),
      devPointsARedimir: leerDevPoints(),
    };
  }

  async function realizarPedido() {
    const boton = $('botonPedido');
    boton.disabled = true;
    try {
      const pedido = await api.registrarPedido(cuerpoPedido());
      avisar(`Pedido #${pedido.id} registrado por ${moneda(pedido.total)}. Estado: ${pedido.estado}. Paga en caja.`);
      estado.carrito.clear();
      $('devPointsARedimir').value = '0';
      await Promise.all([recargarProductos(), recargarClientes()]);
      pintarCarrito();
      await cotizar();
    } catch (error) {
      avisar(error.message, 'error');
      boton.disabled = false;
    }
  }

  async function recargarProductos() {
    estado.productos = await api.productos();
    pintarProductos();
  }

  // ---------- Pedidos ----------

  function progresoPedido(estadoPedido) {
    const indiceActual = PASOS_VISIBLES.indexOf(estadoPedido);
    return el(
      'div',
      { clase: 'progreso', atributos: { 'aria-hidden': 'true' } },
      PASOS_VISIBLES.map((paso, i) => {
        let clase = 'paso';
        if (i <= indiceActual) clase += ' hecho';
        if (i === indiceActual) clase += ' actual';
        return el('span', { clase, texto: paso });
      })
    );
  }

  function tarjetaPedido(pedido, { conCliente = false, accion = null, conProgreso = true } = {}) {
    const cliente = estado.clientes.find((c) => c.id === pedido.clienteId);
    const items = el(
      'ul',
      { clase: 'pedido-items' },
      pedido.items.map((i) => el('li', {}, [el('span', { texto: `${i.cantidad} × ${i.nombre}` }), el('span', { clase: 'cifra', texto: moneda(i.subtotal) })]))
    );

    const chips = [el('span', { clase: 'chip', texto: `subtotal ${moneda(pedido.subtotal)}` })];
    if (pedido.descuentoNivel > 0) chips.push(el('span', { clase: 'chip positivo', texto: `${pedido.nivelAplicado} −${moneda(pedido.descuentoNivel)}` }));
    if (pedido.devPointsRedimidos > 0) chips.push(el('span', { clase: 'chip positivo', texto: `⬡ ${pedido.devPointsRedimidos} pts −${moneda(pedido.descuentoDevPoints)}` }));
    if (pedido.devPointsGanados > 0) chips.push(el('span', { clase: 'chip positivo', texto: `+${pedido.devPointsGanados} DevPoints ganados` }));

    let meta = `registrado ${formatoFecha.format(new Date(pedido.fecha))}`;
    if (pedido.fechaEntrega) meta += ` · entregado ${formatoFecha.format(new Date(pedido.fechaEntrega))}`;

    return el('article', { clase: 'tarjeta pedido' }, [
      // En la barra el estado ya lo indica la columna, así que no se repite en la tarjeta.
      el('div', { clase: 'pedido-cabecera' }, [el('span', { clase: 'pedido-id', texto: `pedido #${pedido.id}` }), conProgreso ? insigniaEstado(pedido.estado) : null]),
      conCliente ? el('div', { clase: 'pedido-cliente', texto: cliente ? cliente.nombre : `Cliente ${pedido.clienteId}` }) : null,
      conProgreso ? progresoPedido(pedido.estado) : null,
      items,
      el('div', { clase: 'pedido-desglose' }, chips),
      el('div', { clase: 'pedido-total' }, [el('span', { clase: 'tenue', texto: 'Total pagado' }), el('span', { clase: 'cifra', texto: moneda(pedido.total) })]),
      el('div', { clase: 'pedido-meta', texto: meta }),
      accion,
    ]);
  }

  async function pintarMisPedidos() {
    const contenedor = $('listaMisPedidos');
    if (estado.clienteId === null) return vaciar(contenedor);
    const pedidos = await api.pedidosDeCliente(estado.clienteId);
    vaciar(contenedor);
    if (pedidos.length === 0) {
      contenedor.appendChild(vacioConTaza('Este cliente aún no tiene pedidos. ¡Hora del primer café!'));
      return;
    }
    for (const pedido of pedidos) contenedor.appendChild(tarjetaPedido(pedido));
  }

  async function pintarBarra() {
    const contenedor = $('listaBarra');
    const pedidos = await api.todosLosPedidos();
    vaciar(contenedor);

    // Una columna por cada estado que tiene acción en la barra (tablero kanban).
    for (const estadoColumna of Object.keys(ACCION_POR_ESTADO)) {
      const delEstado = pedidos.filter((p) => p.estado === estadoColumna).reverse(); // los más antiguos primero
      const columna = el('section', { clase: 'columna' }, [
        el('div', { clase: 'columna-cabecera' }, [insigniaEstado(estadoColumna), el('span', { clase: 'contador', texto: delEstado.length })]),
      ]);
      if (delEstado.length === 0) {
        columna.appendChild(el('div', { clase: 'columna-vacia', texto: '// sin pedidos' }));
      }
      for (const pedido of delEstado) {
        const boton = el('button', {
          clase: 'boton boton-primario boton-ancho',
          texto: ACCION_POR_ESTADO[pedido.estado],
          alHacerClic: () => avanzar(pedido.id, boton),
        });
        columna.appendChild(tarjetaPedido(pedido, { conCliente: true, accion: boton, conProgreso: false }));
      }
      contenedor.appendChild(columna);
    }
  }

  async function avanzar(pedidoId, boton) {
    boton.disabled = true;
    try {
      const { pedido, lealtad } = await api.avanzarEstado(pedidoId);
      if (lealtad) {
        let mensaje = `Pedido #${pedido.id} entregado. ${lealtad.cliente.nombre} ganó ${lealtad.devPointsGanados} DevPoints.`;
        if (lealtad.ascendio) mensaje += ` ¡Ascendió de ${lealtad.nivelAnterior} a ${lealtad.nivelNuevo}!`;
        avisar(mensaje);
      } else {
        avisar(`Pedido #${pedido.id}: ${pedido.estado}.`);
      }
      await recargarClientes();
      await pintarBarra();
      programarCotizacion();
    } catch (error) {
      avisar(error.message, 'error');
      boton.disabled = false;
    }
  }

  // ---------- Pestañas ----------

  async function mostrarPestana(nombre) {
    estado.pestana = nombre;
    history.replaceState(null, '', `#${nombre}`);
    for (const boton of document.querySelectorAll('.pestana')) {
      const activa = boton.dataset.pestana === nombre;
      boton.classList.toggle('activa', activa);
      boton.setAttribute('aria-selected', String(activa));
    }
    for (const panel of document.querySelectorAll('.panel')) {
      panel.classList.toggle('activo', panel.id === `panel-${nombre}`);
    }
    try {
      if (nombre === 'pedidos') await pintarMisPedidos();
      if (nombre === 'barra') await pintarBarra();
      if (nombre === 'menu') await recargarProductos();
    } catch (error) {
      avisar(error.message, 'error');
    }
  }

  // ---------- Formularios de registro ----------

  // Validación sintáctica del navegador (requeridos, tipos, formato de correo).
  function formularioValido(formulario) {
    if (formulario.checkValidity()) return true;
    formulario.reportValidity();
    return false;
  }

  async function registrarCliente(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (!formularioValido(formulario)) return;
    const datos = new FormData(formulario);
    try {
      const cliente = await api.registrarCliente({ nombre: datos.get('nombre'), correo: datos.get('correo') });
      avisar(`Cliente ${cliente.nombre} registrado como ${cliente.nivel}.`);
      formulario.reset();
      estado.clienteId = cliente.id;
      await recargarClientes();
      programarCotizacion();
    } catch (error) {
      avisar(error.message, 'error');
    }
  }

  async function crearProducto(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (!formularioValido(formulario)) return;
    const datos = new FormData(formulario);
    try {
      const producto = await api.crearProducto({
        nombre: datos.get('nombre'),
        precioBase: Number(datos.get('precioBase')),
        stock: Number(datos.get('stock')),
      });
      avisar(`Producto "${producto.nombre}" agregado al menú.`);
      formulario.reset();
      await recargarProductos();
    } catch (error) {
      avisar(error.message, 'error');
    }
  }

  async function reabastecer(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (!formularioValido(formulario)) return;
    const datos = new FormData(formulario);
    try {
      const producto = await api.reabastecer(Number(datos.get('productoId')), Number(datos.get('unidades')));
      avisar(`"${producto.nombre}" ahora tiene ${producto.stock} unidades.`);
      formulario.reset();
      await recargarProductos();
    } catch (error) {
      avisar(error.message, 'error');
    }
  }

  // ---------- Inicio ----------

  async function iniciar() {
    for (const boton of document.querySelectorAll('.pestana')) {
      boton.addEventListener('click', () => mostrarPestana(boton.dataset.pestana));
    }
    $('selectorCliente').addEventListener('change', (e) => {
      estado.clienteId = Number(e.target.value);
      $('devPointsARedimir').value = '0';
      pintarTarjetaCliente();
      programarCotizacion();
      if (estado.pestana === 'pedidos') pintarMisPedidos().catch((error) => avisar(error.message, 'error'));
    });
    $('devPointsARedimir').addEventListener('input', programarCotizacion);
    // "Usar máx." toma el máximo que informó el servidor en la última cotización.
    $('botonMaximoDevPoints').addEventListener('click', () => {
      if (!estado.cotizacion) return;
      $('devPointsARedimir').value = String(estado.cotizacion.maximoDevPointsRedimibles);
      programarCotizacion();
    });
    $('botonPedido').addEventListener('click', realizarPedido);
    $('botonRefrescarBarra').addEventListener('click', () => pintarBarra().catch((error) => avisar(error.message, 'error')));
    $('formCliente').addEventListener('submit', registrarCliente);
    $('formProducto').addEventListener('submit', crearProducto);
    $('formReabastecer').addEventListener('submit', reabastecer);

    try {
      await Promise.all([recargarClientes(), recargarProductos()]);
      pintarCarrito();
      pintarResumen();
      // Permite abrir una pestaña desde la URL, por ejemplo /#barra.
      const pestanaInicial = location.hash.slice(1);
      if (document.querySelector(`.pestana[data-pestana="${CSS.escape(pestanaInicial)}"]`)) await mostrarPestana(pestanaInicial);
    } catch (error) {
      avisar(`No se pudo cargar la información: ${error.message}`, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
