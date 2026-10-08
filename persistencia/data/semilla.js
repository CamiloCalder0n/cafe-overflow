/*
 * Capa: PERSISTENCIA
 * Responsabilidad: datos iniciales con los que se crea la base de datos JSON
 * la primera vez que se ejecuta la aplicación.
 */
'use strict';

const semilla = {
  productos: [
    { id: 1, nombre: 'Espresso StackTrace', precioBase: 6000, stock: 50 },
    { id: 2, nombre: 'Americano NullPointer', precioBase: 7000, stock: 50 },
    { id: 3, nombre: 'Capuchino Callback', precioBase: 9500, stock: 40 },
    { id: 4, nombre: 'Latte Lambda', precioBase: 10500, stock: 40 },
    { id: 5, nombre: 'Té Async/Await', precioBase: 8000, stock: 35 },
    { id: 6, nombre: 'Mocha Merge Conflict', precioBase: 11000, stock: 30 },
    { id: 7, nombre: 'Cold Brew Kernel', precioBase: 12000, stock: 25 },
    { id: 8, nombre: 'Croissant Recursivo', precioBase: 7500, stock: 20 },
    { id: 9, nombre: 'Brownie Deadlock', precioBase: 8500, stock: 20 },
    { id: 10, nombre: 'Sándwich Full Stack', precioBase: 18000, stock: 15 },
    { id: 11, nombre: 'Combo BugHunter', precioBase: 25000, stock: 15 },
    { id: 12, nombre: 'Combo Deploy Friday', precioBase: 32000, stock: 10 },
  ],
  clientes: [
    { id: 1, nombre: 'Ada Lovelace', correo: 'ada@cafeoverflow.dev', nivel: 'Junior', devPoints: 0, acumuladoCompras: 0 },
    { id: 2, nombre: 'Linus Torvalds', correo: 'linus@cafeoverflow.dev', nivel: 'Mid', devPoints: 31, acumuladoCompras: 620000 },
    { id: 3, nombre: 'Grace Hopper', correo: 'grace@cafeoverflow.dev', nivel: 'Senior', devPoints: 85, acumuladoCompras: 1710000 },
  ],
  pedidos: [],
};

module.exports = { semilla };
