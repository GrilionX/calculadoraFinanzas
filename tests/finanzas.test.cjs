const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
let server, browser, url;
let versionWorkerPrueba = 0;

before(async () => {
    const root = path.resolve(__dirname, '..');
    server = http.createServer((req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        const ruta = pathname.startsWith('/app-prueba/') ? pathname.slice('/app-prueba'.length) : pathname;
        const file = path.resolve(root, '.' + (ruta === '/' ? '/index.html' : ruta));
        if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        fs.readFile(file, (error, data) => {
            if (error) { res.writeHead(404).end(); return; }
            res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' :
                file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : file.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html');
            if (file.endsWith('sw.js') && versionWorkerPrueba) data = Buffer.from(data.toString().replace('2026-11-24-gestion-3', '2026-11-23-prueba-' + versionWorkerPrueba));
            res.end(data);
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true,
        ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });

async function abrir(t, grupo = false) {
    const context = await browser.newContext();
    t.after(() => context.close());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(url);
    assert.deepEqual(errors, [], 'La aplicación debe arrancar sin errores');
    await page.evaluate(grupo => {
        const datos = crearDatosIniciales();
        datos.nominas = [{ version: 1, id: 'n1', referencia: 'Pago de prueba', periodo: 'semanal',
            montoCentavos: 100000, reparto: [{ id: 'deudas', nombre: 'Deudas', porcentaje: 100, montoCentavos: 100000 }] }];
        datos.gruposDeudas = [{ id: 'g1', nombre: 'Grupo de prueba', modalidad: grupo ? 'grupo' : 'individual', movimientosFondo: [] }];
        datos.deudas = [{ id: 'd1', nombre: 'Deuda de prueba', grupoId: 'g1', objetivoCentavos: 10000,
            prioridad: 1, aportaciones: [], aportacionesNomina: [], transferencias: [], liquidada: false }];
        if (!aplicarDatos(datos) || !guardar()) throw new Error('No se pudo preparar el caso');
        mostrarDeudas();
        campoNominaOrigen.value = 'n1';
        actualizarCategoriasOrigen();
        campoCategoriaOrigen.value = 'deudas';
    }, grupo);
    return { page, errors };
}

test('arranque, cálculos existentes, apartado, corrección desde el formulario y recarga', async t => {
    const { page, errors } = await abrir(t);
    assert.equal(await page.evaluate(() => { ejecutarPruebas(); return fallos; }), 0);
    assert.equal(await page.evaluate(() => registrarApartadoConNomina('deuda', 'd1', '50')), true);
    assert.equal(await page.evaluate(() => calcularDisponibleCategoria(nominas[0], 'deudas', obtenerApartadosNomina()).disponibleCentavos), 95000);
    await page.locator('#motivo-correccion').fill('Cantidad equivocada');
    await page.locator('#deshacer-cambio').click();
    assert.match(await page.locator('#mensaje-correccion').textContent(), /Corrección guardada/);
    await page.reload();
    assert.deepEqual(await page.evaluate(() => ({ disponible: calcularDisponibleCategoria(nominas[0], 'deudas', obtenerApartadosNomina()).disponibleCentavos,
        historial: historialCorrecciones.length, reserva: calcularReservaDeuda(deudas[0]), habilitado: guardadoHabilitado })),
    { disponible: 100000, historial: 2, reserva: 0, habilitado: true });
    assert.deepEqual(errors, []);
});

test('distribución y modalidad se revierten sin liberar dos veces la nómina', async t => {
    const { page, errors } = await abrir(t, true);
    const result = await page.evaluate(() => {
        const revertir = () => deshacerUltimoCambio('Prueba de corrección', ultimaCorreccionDisponible().id);
        const disponible = () => calcularDisponibleCategoria(nominas[0], 'deudas', obtenerApartadosNomina()).disponibleCentavos;
        const apartado = registrarApartadoGrupo('g1', '100');
        distribuirFondoGrupo('g1');
        const asignado = calcularReservaDeuda(deudas[0]);
        const deshecho = revertir();
        const fondo = resumirFondoGrupo(gruposDeudas[0]).fondoCentavos;
        const saldo = disponible();
        cambiarModalidadGrupo('g1', 'individual');
        const individual = gruposDeudas[0].modalidad;
        const modalidadDeshecha = revertir();
        const final = disponible();
        const apartadoDeshecho = revertir();
        return { apartado, asignado, deshecho, fondo, saldo, individual, modalidadDeshecha,
            final, apartadoDeshecho, libre: disponible(), registros: historialCorrecciones.length };
    });
    assert.deepEqual(result, { apartado: true, asignado: 10000, deshecho: true, fondo: 10000,
        saldo: 90000, individual: 'individual', modalidadDeshecha: true, final: 90000,
        apartadoDeshecho: true, libre: 100000, registros: 6 });
    await page.reload();
    assert.equal(await page.evaluate(() => guardadoHabilitado), true);
    assert.deepEqual(errors, []);
});

test('un pago confirmado bloquea la reversión y no libera disponibilidad', async t => {
    const { page } = await abrir(t);
    const result = await page.evaluate(() => {
        registrarApartadoConNomina('deuda', 'd1', '100');
        liquidarDeuda('d1');
        return { liquidada: deudas[0].liquidada,
            deshecho: deshacerUltimoCambio('No permitido', ultimaCorreccionDisponible().id),
            disponible: calcularDisponibleCategoria(nominas[0], 'deudas', obtenerApartadosNomina()).disponibleCentavos };
    });
    assert.deepEqual(result, { liquidada: true, deshecho: false, disponible: 90000 });
});

test('fallo de almacenamiento revierte el cambio y no añade historial', async t => {
    const { page } = await abrir(t);
    assert.deepEqual(await page.evaluate(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new Error('Espacio agotado'); };
        const registrado = registrarApartadoConNomina('deuda', 'd1', '50');
        Storage.prototype.setItem = original;
        return { registrado, historial: historialCorrecciones.length, reserva: calcularReservaDeuda(deudas[0]) };
    }), { registrado: false, historial: 0, reserva: 0 });
});

test('copias antiguas, historial corrupto y reversión repetida', async t => {
    const { page } = await abrir(t);
    assert.deepEqual(await page.evaluate(() => {
        registrarApartadoConNomina('deuda', 'd1', '50');
        const id = ultimaCorreccionDisponible().id;
        const paquete = copiar(construirPaquete());
        const corrupto = copiar(paquete);
        corrupto.historialCorrecciones[0].despues.deudas[0].objetivoCentavos = 1;
        const rechazado = !aplicarDatos(corrupto);
        const intacto = calcularReservaDeuda(deudas[0]) === 5000;
        const primera = deshacerUltimoCambio('Error', id);
        const segunda = deshacerUltimoCambio('Error repetido', id);
        delete paquete.historialCorrecciones;
        const antigua = aplicarDatos(paquete);
        return { rechazado, intacto, primera, segunda, antigua, historial: historialCorrecciones.length };
    }), { rechazado: true, intacto: true, primera: true, segunda: false, antigua: true, historial: 0 });
});

test('borrado total conserva claves ajenas y bloquea otra pestaña', async t => {
    const { page } = await abrir(t);
    await page.evaluate(() => { localStorage.setItem('ajena', 'conservar'); registrarApartadoConNomina('deuda', 'd1', '50'); });
    const otra = await page.context().newPage();
    await otra.goto(url);
    await page.locator(".zona-borrado > summary").click();
    await Promise.all([page.waitForEvent('load'), borrarTodoEnPrueba(page)]);
    assert.deepEqual(await page.evaluate(() => ({ deudas: deudas.length, grupos: gruposDeudas.length,
        nominas: nominas.length, historial: historialCorrecciones.length, ahorro: movimientosAhorros.length,
        ajena: localStorage.getItem('ajena'), guardado: guardadoHabilitado })),
    { deudas: 0, grupos: 0, nominas: 0, historial: 0, ahorro: 0, ajena: 'conservar', guardado: true });
    await otra.waitForFunction(() => reinicioDetectado);
    assert.equal(await otra.evaluate(() => guardar()), false);
});

test('registro nuevo normalizado, corrección fallida y motivo obligatorio', async t => {
    const { page } = await abrir(t);
    assert.deepEqual(await page.evaluate(() => {
        deudas.push({ id: 'd2', nombre: 'Otra deuda', grupoId: null, objetivoCentavos: 20000,
            prioridad: 2, aportaciones: [], liquidada: false });
        const guardado = guardar();
        const id = ultimaCorreccionDisponible().id;
        const sinMotivo = deshacerUltimoCambio('  ', id);
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new Error('Sin espacio'); };
        const fallo = deshacerUltimoCambio('Registro equivocado', id);
        Storage.prototype.setItem = original;
        const conservadas = deudas.length;
        const corregido = deshacerUltimoCambio('Registro equivocado', id);
        return { guardado, sinMotivo, fallo, conservadas, corregido, restantes: deudas.length };
    }), { guardado: true, sinMotivo: false, fallo: false, conservadas: 2, corregido: true, restantes: 1 });
});

test('otra pestaña no sobrescribe un apartado más reciente', async t => {
    const { page } = await abrir(t);
    const otra = await page.context().newPage();
    await otra.goto(url);
    await page.evaluate(() => registrarApartadoConNomina('deuda', 'd1', '50'));
    assert.equal(await otra.evaluate(() => guardar()), false);
    assert.equal(await otra.evaluate(() => reinicioDetectado), true);
    await otra.reload();
    assert.equal(await otra.evaluate(() => calcularReservaDeuda(deudas[0])), 5000);
});


async function abrirGastosPrueba(t) {
    const resultado = await abrir(t);
    await resultado.page.evaluate(() => {
        const datos = construirPaquete();
        datos.nominas = [{ version: 1, id: "n1", referencia: "Pago básico", periodo: "semanal",
            montoCentavos: 200000, reparto: repartirNomina(200000, copiarCategoriasIniciales()) }];
        if (!aplicarDatos(datos) || !guardar()) throw new Error("Preparación de gastos inválida");
        mostrarDeudas();
        campoNominaOrigen.value = "n1";
        actualizarCategoriasOrigen();
        campoCategoriaOrigen.value = "basicos";
    });
    return resultado;
}

test('gastos: formulario, suma inmediata por categoría y persistencia', async t => {
    const { page, errors } = await abrirGastosPrueba(t);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#abrir-gastos").click();
    await page.locator("#nombre-categoria-gasto").fill("Comida");
    await page.locator("#formulario-categoria-gasto button").click();
    await page.locator("#gasto-concepto").fill("Supermercado");
    await page.locator("#gasto-monto").fill("150");
    assert.match(await page.locator("#gasto-previa").textContent(), /950/);
    await page.locator("#gasto-registrar").click();
    assert.equal(await page.evaluate(() => resumenGastosNomina("n1").disponibleCentavos), 95000);
    assert.match(await page.locator("#gastos-por-categoria").textContent(), /Comida.*150/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.reload();
    assert.equal(await page.evaluate(() => gastosBasicos.length), 1);
    assert.equal(await page.evaluate(() => resumenGastosNomina("n1").gastadoCentavos), 15000);
    assert.deepEqual(errors, []);
});

test('gastos: categorías únicas, fechas válidas, importes positivos y límite exacto', async t => {
    const { page } = await abrirGastosPrueba(t);
    const result = await page.evaluate(() => {
        const categoria = agregarCategoriaGasto("Comida");
        const duplicada = agregarCategoriaGasto(" comida ");
        const base = { nominaId: "n1", subcategoriaId: categoriasGastos[0].id,
            concepto: "Prueba", fecha: "2026-11-22", monto: "1100" };
        const fecha = registrarGastoBasico({ ...base, fecha: "2026-02-30" });
        const negativo = registrarGastoBasico({ ...base, monto: "-1" });
        const exceso = registrarGastoBasico({ ...base, monto: "1100.01" });
        const exacto = registrarGastoBasico(base);
        const repetido = registrarGastoBasico({ ...base, monto: "0.01" });
        return { categoria, duplicada, fecha, negativo, exceso, exacto, repetido,
            disponible: resumenGastosNomina("n1").disponibleCentavos };
    });
    assert.deepEqual(result, { categoria: true, duplicada: false, fecha: false, negativo: false,
        exceso: false, exacto: true, repetido: false, disponible: 0 });
});

test('gastos: el porcentaje se toma de cada nómina sin mezclar pagos', async t => {
    const { page } = await abrirGastosPrueba(t);
    const result = await page.evaluate(() => {
        nominas.push({ version: 1, id: "n2", referencia: "Otro pago", periodo: "unico", montoCentavos: 100000,
            reparto: repartirNomina(100000, [
                { id: "basicos", nombre: "Gastos básicos", porcentaje: 20 },
                { id: "ahorro", nombre: "Ahorro", porcentaje: 80 }
            ]) });
        guardar();
        agregarCategoriaGasto("Transporte");
        registrarGastoBasico({ nominaId: "n2", subcategoriaId: categoriasGastos[0].id,
            concepto: "Viaje", fecha: "2026-11-22", monto: "50" });
        return { primerPago: resumenGastosNomina("n1").disponibleCentavos,
            segundoPago: resumenGastosNomina("n2").disponibleCentavos,
            asignado: resumenGastosNomina("n2").asignadoCentavos };
    });
    assert.deepEqual(result, { primerPago: 110000, segundoPago: 15000, asignado: 20000 });
});

test('gastos: no se duplica dinero entre reservas y compras, ni al corregir deudas', async t => {
    const { page } = await abrirGastosPrueba(t);
    const result = await page.evaluate(() => {
        agregarCategoriaGasto("Servicios");
        registrarApartadoConNomina("deuda", "d1", "100");
        const gasto = { nominaId: "n1", subcategoriaId: categoriasGastos[0].id,
            concepto: "Servicio", fecha: "2026-11-22", monto: "1000" };
        const exceso = registrarGastoBasico({ ...gasto, monto: "1000.01" });
        const exacto = registrarGastoBasico(gasto);
        const antes = resumenGastosNomina("n1").disponibleCentavos;
        const corregido = deshacerUltimoCambio("Apartado equivocado", ultimaCorreccionDisponible().id);
        const despues = resumenGastosNomina("n1").disponibleCentavos;
        const bloqueado = registrarApartadoConNomina("deuda", "d1", "100.01");
        return { exceso, exacto, antes, corregido, despues, bloqueado, gastos: gastosBasicos.length };
    });
    assert.deepEqual(result, { exceso: false, exacto: true, antes: 0, corregido: true, despues: 10000, bloqueado: false, gastos: 1 });
});

test('gastos: anulación con motivo y fallo al guardar conservan saldos', async t => {
    const { page } = await abrirGastosPrueba(t);
    const result = await page.evaluate(() => {
        agregarCategoriaGasto("Renta");
        const gasto = { nominaId: "n1", subcategoriaId: categoriasGastos[0].id,
            concepto: "Pago", fecha: "2026-11-22", monto: "100" };
        registrarGastoBasico(gasto);
        const id = gastosBasicos[0].id;
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new Error("Sin espacio"); };
        const fallido = registrarGastoBasico(gasto);
        const anulacionFallida = anularGastoBasico(id, "Error");
        Storage.prototype.setItem = original;
        const sinMotivo = anularGastoBasico(id, " ");
        const antes = resumenGastosNomina("n1").disponibleCentavos;
        const anulada = anularGastoBasico(id, "Error");
        const repetida = anularGastoBasico(id, "Otra vez");
        return { fallido, anulacionFallida, sinMotivo, antes, anulada, repetida,
            despues: resumenGastosNomina("n1").disponibleCentavos, registros: gastosBasicos.length };
    });
    assert.deepEqual(result, { fallido: false, anulacionFallida: false, sinMotivo: false, antes: 100000,
        anulada: true, repetida: false, despues: 110000, registros: 1 });
});

test('gastos: importación corrupta, copias antiguas y restablecimiento', async t => {
    const { page } = await abrirGastosPrueba(t);
    const result = await page.evaluate(() => {
        agregarCategoriaGasto("Comida");
        registrarGastoBasico({ nominaId: "n1", subcategoriaId: categoriasGastos[0].id,
            concepto: "Comida", fecha: "2026-11-22", monto: "150" });
        const paquete = copiar(construirPaquete());
        const corrupto = copiar(paquete);
        corrupto.gastosBasicos[0].montoCentavos = 110001;
        const rechazado = !aplicarDatos(corrupto);
        const intacto = gastosBasicos[0].montoCentavos === 15000;
        const restaurado = aplicarDatos(paquete);
        delete paquete.gastosBasicos;
        delete paquete.categoriasGastos;
        const antigua = aplicarDatos(paquete);
        const vacios = gastosBasicos.length === 0 && categoriasGastos.length === 0;
        const inicial = crearDatosIniciales();
        return { rechazado, intacto, restaurado, antigua, vacios,
            reinicio: inicial.gastosBasicos.length === 0 && inicial.categoriasGastos.length === 0 };
    });
    assert.deepEqual(result, { rechazado: true, intacto: true, restaurado: true, antigua: true, vacios: true, reinicio: true });
});


test('categorías: renombrar, archivar y reactivar conservan gastos e identidad', async t => {
    const { page } = await abrirGastosPrueba(t);
    assert.deepEqual(await page.evaluate(() => {
        agregarCategoriaGasto("Comida");
        const id = categoriasGastos[0].id;
        const datos = { nominaId: "n1", subcategoriaId: id, concepto: "Compra", fecha: "2026-11-22", monto: "100" };
        registrarGastoBasico(datos);
        const renombrada = renombrarCategoriaGasto(id, "Supermercado");
        const archivada = archivarCategoriaGasto(id, true);
        const bloqueado = registrarGastoBasico(datos);
        const saldoArchivada = resumenGastosNomina("n1").disponibleCentavos;
        const reactivada = archivarCategoriaGasto(id, false);
        const nuevo = registrarGastoBasico(datos);
        return { renombrada, archivada, bloqueado, saldoArchivada, reactivada, nuevo,
            nombre: categoriasGastos[0].nombre, identidad: gastosBasicos.every(g => g.subcategoriaId === id) };
    }), { renombrada: true, archivada: true, bloqueado: false, saldoArchivada: 100000,
        reactivada: true, nuevo: true, nombre: "Supermercado", identidad: true });
    await page.reload();
    assert.equal(await page.evaluate(() => categoriasGastos[0].nombre), "Supermercado");
    assert.equal(await page.evaluate(() => gastosBasicos.length), 2);
});

test('categorías: nombres únicos por presupuesto y rechazo de cambios inválidos', async t => {
    const { page } = await abrirGastosPrueba(t);
    assert.deepEqual(await page.evaluate(() => {
        const basicos = agregarCategoriaGasto("Compras");
        const ocio = agregarCategoriaGasto("Compras", "ocio");
        const duplicada = agregarCategoriaGasto(" compras ", "ocio");
        agregarCategoriaGasto("Comida");
        const renombrarDuplicada = renombrarCategoriaGasto(categoriasGastos.at(-1).id, "Compras");
        const vacia = renombrarCategoriaGasto(categoriasGastos[0].id, " ");
        const ahorro = agregarCategoriaGasto("Aportación", "ahorro");
        return { basicos, ocio, duplicada, renombrarDuplicada, vacia, ahorro };
    }), { basicos: true, ocio: true, duplicada: false, renombrarDuplicada: false, vacia: false, ahorro: false });
});

test('gastos: ocio respeta su saldo sin descontar básicos y rechaza categorías cruzadas', async t => {
    const { page } = await abrirGastosPrueba(t);
    assert.deepEqual(await page.evaluate(() => {
        agregarCategoriaGasto("Salidas", "ocio");
        const id = categoriasGastos[0].id;
        const datos = { nominaId: "n1", categoriaId: "ocio", subcategoriaId: id,
            concepto: "Cine", fecha: "2026-11-22", monto: "60" };
        const registrado = registrarGastoBasico(datos);
        const cruzado = registrarGastoBasico({ ...datos, categoriaId: "basicos" });
        const exceso = registrarGastoBasico({ ...datos, monto: "40.01" });
        const copia = copiar(construirPaquete());
        copia.gastosBasicos[0].categoriaId = "basicos";
        const importacion = aplicarDatos(copia);
        return { registrado, cruzado, exceso, importacion,
            basicos: resumenGastosNomina("n1").disponibleCentavos,
            ocio: resumenGastosNomina("n1", "ocio").disponibleCentavos };
    }), { registrado: true, cruzado: false, exceso: false, importacion: false, basicos: 110000, ocio: 4000 });
});

test('categorías: migración de versión anterior y guardado fallido', async t => {
    const { page } = await abrirGastosPrueba(t);
    assert.deepEqual(await page.evaluate(() => {
        agregarCategoriaGasto("Comida");
        registrarGastoBasico({ nominaId: "n1", subcategoriaId: categoriasGastos[0].id,
            concepto: "Compra", fecha: "2026-11-22", monto: "10" });
        const antigua = copiar(construirPaquete());
        delete antigua.categoriasGastos[0].categoriaId;
        delete antigua.categoriasGastos[0].archivada;
        const migrada = aplicarDatos(antigua);
        const id = categoriasGastos[0].id;
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new Error("Sin espacio"); };
        const nombre = renombrarCategoriaGasto(id, "Otro");
        const archivo = archivarCategoriaGasto(id, true);
        Storage.prototype.setItem = original;
        return { migrada, nombre, archivo, actual: categoriasGastos[0].nombre,
            presupuesto: categoriasGastos[0].categoriaId, archivada: categoriasGastos[0].archivada,
            total: resumenGastosNomina("n1").gastadoCentavos };
    }), { migrada: true, nombre: false, archivo: false, actual: "Comida", presupuesto: "basicos", archivada: false, total: 1000 });
});

test('gastos: interfaz móvil de ocio y categoría archivada', async t => {
    const { page, errors } = await abrirGastosPrueba(t);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#abrir-gastos").click();
    await page.locator("#gasto-origen").selectOption("ocio");
    await page.locator("#nombre-categoria-gasto").fill("Cine");
    await page.locator("#formulario-categoria-gasto button").click();
    await page.locator("#gasto-concepto").fill("Entrada");
    await page.locator("#gasto-monto").fill("50");
    await page.locator("#gasto-registrar").click();
    await page.getByRole("button", { name: "Archivar categoría: Cine", exact: true }).click();
    assert.equal(await page.locator("#gasto-categoria option").count(), 1);
    assert.match(await page.locator("#gastos-por-categoria").textContent(), /Archivada.*50/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole("button", { name: "Reactivar categoría: Cine", exact: true }).click();
    await page.locator("#gastos-por-categoria summary").click();
    await page.locator("#gastos-por-categoria input").fill("Películas");
    await page.getByRole("button", { name: "Guardar nombre", exact: true }).click();
    assert.match(await page.locator("#historial-gastos").textContent(), /Películas/);
    assert.deepEqual(errors, []);
});


test('ahorro: origen, límites y retiros sin liberar la nómina', async t => {
    const { page } = await abrirGastosPrueba(t);
    assert.deepEqual(await page.evaluate(() => {
        const sinOrigen = registrarAhorroVinculado("aportacion", "Prueba", "10", "");
        const aporte = registrarAhorroVinculado("aportacion", "Ahorro", "200", "n1");
        const disponible = calcularDisponibleCategoria(nominas[0], "ahorro", obtenerCompromisosNomina()).disponibleCentavos;
        const exceso = registrarAhorroVinculado("aportacion", "Exceso", "100.01", "n1");
        const retiro = registrarAhorroVinculado("retiro", "Uso personal", "50", "");
        const despues = calcularDisponibleCategoria(nominas[0], "ahorro", obtenerCompromisosNomina()).disponibleCentavos;
        return { sinOrigen, aporte, disponible, exceso, retiro, despues, saldo: calcularSaldoAhorro(movimientosAhorros) };
    }), { sinOrigen: false, aporte: true, disponible: 10000, exceso: false, retiro: true, despues: 10000, saldo: 15000 });
    await page.reload();
    assert.equal(await page.evaluate(() => movimientosAhorros[0].origenNomina.nominaId), "n1");
});

test('ahorro: anulación conserva cronología y permite corregir retiro primero', async t => {
    const { page } = await abrirGastosPrueba(t);
    assert.deepEqual(await page.evaluate(() => {
        registrarAhorroVinculado("aportacion", "Prueba", "100", "n1");
        registrarAhorroVinculado("retiro", "Uso", "50", "");
        const aporte = movimientosAhorros[0].id, retiro = movimientosAhorros[1].id;
        const bloqueada = anularMovimientoAhorro(aporte, "Importe equivocado");
        const corregidoRetiro = anularMovimientoAhorro(retiro, "Retiro equivocado");
        const corregidoAporte = anularMovimientoAhorro(aporte, "Importe equivocado");
        const repetida = anularMovimientoAhorro(aporte, "Otra vez");
        return { bloqueada, corregidoRetiro, corregidoAporte, repetida,
            saldo: calcularSaldoAhorro(movimientosAhorros), historial: movimientosAhorros.length,
            disponible: calcularDisponibleCategoria(nominas[0], "ahorro", obtenerCompromisosNomina()).disponibleCentavos };
    }), { bloqueada: false, corregidoRetiro: true, corregidoAporte: true, repetida: false, saldo: 0, historial: 2, disponible: 30000 });
});

test('ahorro: apartados y ahorro comparten disponibilidad y fallos no alteran datos', async t => {
    const { page } = await abrirGastosPrueba(t);
    assert.deepEqual(await page.evaluate(() => {
        campoCategoriaOrigen.value = "ahorro";
        registrarApartadoConNomina("deuda", "d1", "100");
        const exceso = registrarAhorroVinculado("aportacion", "Prueba", "200.01", "n1");
        const aporte = registrarAhorroVinculado("aportacion", "Prueba", "200", "n1");
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new Error("Sin espacio"); };
        const fallido = registrarAhorroVinculado("retiro", "Uso", "10", "");
        Storage.prototype.setItem = original;
        return { exceso, aporte, fallido, saldo: calcularSaldoAhorro(movimientosAhorros), cantidad: movimientosAhorros.length };
    }), { exceso: false, aporte: true, fallido: false, saldo: 20000, cantidad: 1 });
});

test('ajustes: objetivos respetan reservas y conservan motivo al recargar', async t => {
    const { page } = await abrirGastosPrueba(t);
    assert.deepEqual(await page.evaluate(() => {
        registrarApartadoConNomina("deuda", "d1", "50");
        const menor = ajustarObjetivoDeuda("d1", "49", "Saldo actualizado");
        const mayor = ajustarObjetivoDeuda("d1", "200", "Intereses");
        const motivo = historialCorrecciones.at(-1).motivo;
        return { menor, mayor, motivo, objetivo: deudas[0].objetivoCentavos, reserva: calcularReservaDeuda(deudas[0]) };
    }), { menor: false, mayor: true, motivo: "Intereses", objetivo: 20000, reserva: 5000 });
    await page.reload();
    assert.equal(await page.evaluate(() => guardadoHabilitado), true);
});

test('ajustes: corrección selectiva y anulación de apartado preservan historial', async t => {
    const { page } = await abrirGastosPrueba(t);
    assert.deepEqual(await page.evaluate(() => {
        registrarApartadoConNomina("deuda", "d1", "20");
        registrarApartadoConNomina("deuda", "d1", "30");
        const primero = deudas[0].aportacionesNomina[0].id;
        const corregido = corregirApartadoConcreto(primero, "40", "Importe correcto");
        const total = calcularReservaDeuda(deudas[0]);
        const anulado = corregirApartadoConcreto(primero, "0", "No correspondía");
        const original = historialCorrecciones.some(e => e.antes.deudas.some(d =>
            d.aportacionesNomina.some(m => m.id === primero && m.montoCentavos === 2000)));
        return { corregido, total, anulado, original, final: calcularReservaDeuda(deudas[0]) };
    }), { corregido: true, total: 7000, anulado: true, original: true, final: 3000 });
    await page.reload();
    assert.equal(await page.evaluate(() => guardadoHabilitado), true);
});

test('ajustes: protección de fondos distribuidos y pagos confirmados', async t => {
    const { page } = await abrir(t, true);
    assert.deepEqual(await page.evaluate(() => {
        registrarApartadoGrupo("g1", "100");
        const id = gruposDeudas[0].movimientosFondo[0].origenNomina.id;
        const menor = ajustarObjetivoDeuda("d1", "99", "Cambio");
        distribuirFondoGrupo("g1");
        const bloqueado = corregirApartadoConcreto(id, "50", "Error");
        liquidarDeuda("d1");
        const pagada = ajustarObjetivoDeuda("d1", "200", "Cambio");
        return { menor, bloqueado, pagada };
    }), { menor: false, bloqueado: false, pagada: false });
});

test('ahorro: copias antiguas, origen corrupto y formulario móvil', async t => {
    const { page, errors } = await abrirGastosPrueba(t);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#boton-ahorro").click();
    await page.locator("#ahorro-nomina").selectOption("n1");
    await page.locator("#concepto-ahorro").fill("Fondo personal");
    await page.locator("#monto-ahorro").fill("100");
    await page.locator("#formulario-ahorro button").click();
    assert.equal(await page.evaluate(() => calcularSaldoAhorro(movimientosAhorros)), 10000);
    assert.deepEqual(await page.evaluate(() => {
        const copia = copiar(construirPaquete());
        copia.movimientosAhorros[0].origenNomina.nominaId = "inexistente";
        const rechazada = !aplicarDatos(copia);
        copia.movimientosAhorros = [{ tipo: "aportacion", concepto: "Anterior", montoCentavos: 5000 }];
        const antigua = aplicarDatos(copia);
        return { rechazada, antigua, saldo: calcularSaldoAhorro(movimientosAhorros) };
    }), { rechazada: true, antigua: true, saldo: 5000 });
    assert.deepEqual(errors, []);
});


test('grupos: renombrar preserva pagos e identidad; nombres duplicados rechazados', async t => {
    const { page } = await abrir(t);
    assert.deepEqual(await page.evaluate(() => {
        registrarApartadoConNomina("deuda", "d1", "100");
        liquidarDeuda("d1");
        const renombrado = renombrarGrupoDeudas("g1", "Compras personales");
        const vacio = renombrarGrupoDeudas("g1", " ");
        gruposDeudas.push({ id: "g2", nombre: "Otro", modalidad: "individual", movimientosFondo: [] });
        guardar();
        const duplicado = renombrarGrupoDeudas("g1", " otro ");
        return { renombrado, vacio, duplicado, grupo: deudas[0].grupoId, pagada: deudas[0].liquidada };
    }), { renombrado: true, vacio: false, duplicado: false, grupo: "g1", pagada: true });
    await page.reload();
    assert.equal(await page.evaluate(() => gruposDeudas[0].nombre), "Compras personales");
    assert.equal(await page.evaluate(() => guardadoHabilitado), true);
});

test('grupos: mover apartados individuales conserva saldos y eliminar vacío mantiene historial', async t => {
    const { page } = await abrir(t);
    assert.deepEqual(await page.evaluate(() => {
        registrarApartadoConNomina("deuda", "d1", "50");
        gruposDeudas.push({ id: "g2", nombre: "Destino", modalidad: "individual", movimientosFondo: [] });
        guardar();
        const movida = trasladarDeudaGrupo("d1", "g2");
        const eliminado = eliminarGrupoVacio("g1");
        const ocupado = eliminarGrupoVacio("g2");
        const historial = historialCorrecciones.at(-1).antes.gruposDeudas.some(g => g.id === "g1");
        return { movida, eliminado, ocupado, historial, reserva: calcularReservaDeuda(deudas[0]),
            disponible: calcularDisponibleCategoria(nominas[0], "deudas", obtenerCompromisosNomina()).disponibleCentavos };
    }), { movida: true, eliminado: true, ocupado: false, historial: true, reserva: 5000, disponible: 95000 });
    await page.reload();
    assert.equal(await page.evaluate(() => guardadoHabilitado), true);
    assert.equal(await page.evaluate(() => deudas[0].grupoId), "g2");
});

test('grupos: fondos y transferencias bloquean reorganización sin borrar movimientos', async t => {
    const { page } = await abrir(t, true);
    assert.deepEqual(await page.evaluate(() => {
        registrarApartadoGrupo("g1", "50");
        const conFondo = trasladarDeudaGrupo("d1", null);
        cambiarModalidadGrupo("g1", "individual");
        const conTransferencias = trasladarDeudaGrupo("d1", null);
        const borrar = eliminarGrupoVacio("g1");
        return { conFondo, conTransferencias, borrar, referencias: deudas[0].transferencias.length };
    }), { conFondo: false, conTransferencias: false, borrar: false, referencias: 1 });
});

test('grupos: fallo de guardado mantiene nombre y grupo anteriores', async t => {
    const { page } = await abrir(t);
    assert.deepEqual(await page.evaluate(() => {
        const nombre = gruposDeudas[0].nombre;
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new Error("Sin espacio"); };
        const renombrado = renombrarGrupoDeudas("g1", "Nuevo");
        const traslado = trasladarDeudaGrupo("d1", null);
        Storage.prototype.setItem = original;
        return { renombrado, traslado, intacto: gruposDeudas[0].nombre === nombre, grupo: deudas[0].grupoId };
    }), { renombrado: false, traslado: false, intacto: true, grupo: "g1" });
});

test('resumen: nóminas, gastos, ahorro y deudas concilian sin contar dos veces', async t => {
    const { page } = await abrirGastosPrueba(t);
    assert.deepEqual(await page.evaluate(() => {
        agregarCategoriaGasto("Comida");
        registrarGastoBasico({ nominaId: "n1", subcategoriaId: categoriasGastos[0].id,
            concepto: "Compra", fecha: "2026-11-22", monto: "150" });
        registrarAhorroVinculado("aportacion", "Ahorro", "200", "n1");
        registrarAhorroVinculado("retiro", "Uso personal", "50", "");
        campoCategoriaOrigen.value = "deudas";
        registrarApartadoConNomina("deuda", "d1", "100");
        liquidarDeuda("d1");
        const r = calcularResumenFinanciero();
        return { ingresos: r.ingresos, gastos: r.gastos, ahorro: r.ahorroDestinado,
            deudas: r.destinadoDeudas, libre: r.disponible, ahorroActual: r.ahorroActual,
            reservas: r.reservasActuales, pagado: r.pagadoDeudas, pendiente: r.deudaPendiente };
    }), { ingresos: 200000, gastos: 15000, ahorro: 20000, deudas: 10000, libre: 155000,
        ahorroActual: 15000, reservas: 0, pagado: 10000, pendiente: 0 });
});

test('resumen: distribuir y transferir no duplica las reservas del grupo', async t => {
    const { page } = await abrir(t, true);
    assert.deepEqual(await page.evaluate(() => {
        registrarApartadoGrupo("g1", "100");
        const antes = calcularResumenFinanciero();
        distribuirFondoGrupo("g1");
        const despues = calcularResumenFinanciero();
        liquidarDeuda("d1");
        const pagado = calcularResumenFinanciero();
        return { antes: antes.reservasActuales, despues: despues.reservasActuales,
            destinado: despues.destinadoDeudas, libre: despues.disponible,
            pagado: pagado.pagadoDeudas, reservaFinal: pagado.reservasActuales };
    }), { antes: 10000, despues: 10000, destinado: 10000, libre: 90000, pagado: 10000, reservaFinal: 0 });
});

test('resumen: datos antiguos separados, filtro por nómina y exceso numérico', async t => {
    const { page } = await abrir(t);
    assert.deepEqual(await page.evaluate(() => {
        movimientosAhorros = [{ tipo: "aportacion", concepto: "Anterior", montoCentavos: 5000 }];
        deudas[0].aportaciones.push(2000);
        guardar();
        nominas.push({ version: 1, id: "n2", referencia: "Segundo", periodo: "unico",
            montoCentavos: 50000, reparto: [{ id: "ocio", nombre: "Ocio", porcentaje: 100, montoCentavos: 50000 }] });
        guardar();
        const r = calcularResumenFinanciero("n2");
        let rechazado = false;
        try { sumarCentavosResumen([Number.MAX_SAFE_INTEGER, 1]); } catch { rechazado = true; }
        return { ingresos: r.ingresos, libre: r.disponible, ahorro: r.ahorroDestinado,
            actual: r.ahorroActual, reservas: r.reservasActuales, rechazado };
    }), { ingresos: 50000, libre: 50000, ahorro: 0, actual: 5000, reservas: 2000, rechazado: true });
});

test('grupos y resumen: controles móviles y actualización visible', async t => {
    const { page, errors } = await abrir(t);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.match(await page.locator("#resumen-ingresos").textContent(), /1,000/);
    await page.locator("#boton-deudas").click();
    await page.locator(".administrador-grupos summary").click();
    await page.locator("#administrar-grupo").selectOption("g1");
    await page.locator("#administrar-nombre").fill("Grupo personal");
    await page.locator("#formulario-renombrar-grupo button").click();
    await page.locator("#trasladar-deuda").selectOption("d1");
    await page.locator("#trasladar-destino").selectOption("");
    await page.locator("#confirmar-traslado").click();
    await page.locator("#eliminar-grupo-vacio").click();
    await page.getByRole("button",{name:"Sí",exact:true}).click();
    assert.equal(await page.evaluate(() => gruposDeudas.length), 0);
    await page.locator("#boton-reparto").click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
});


test('diseño: navegación y formularios sin desborde en móvil, tableta y escritorio', async t => {
    const { page, errors } = await abrirGastosPrueba(t);
    for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const id of ["boton-reparto", "boton-ahorro", "boton-deudas"]) {
            await page.locator("#" + id).click();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
                "No debe desbordar a " + width + " en " + id);
            const alto = await page.locator("#" + id).evaluate(el => el.getBoundingClientRect().height);
            assert.ok(alto >= 44, "Navegación táctil");
        }
        await page.locator("#boton-reparto").click();
        await page.locator("#abrir-gastos").click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.locator("#volver-gastos").click();
    }
    assert.deepEqual(errors, []);
});

test('diseño: acceso al ingreso, gráfico real y borrado protegido por desplegable', async t => {
    const { page, errors } = await abrirGastosPrueba(t);
    await page.locator("#ir-a-ingreso").click();
    assert.equal(await page.evaluate(() => document.activeElement.id), "referencia-nomina");
    await page.evaluate(() => {
        agregarCategoriaGasto("Comida");
        registrarGastoBasico({ nominaId: "n1", subcategoriaId: categoriasGastos[0].id,
            concepto: "Compra", fecha: "2026-11-22", monto: "100" });
    });
    await page.waitForFunction(() => document.querySelector("#texto-distribucion").textContent.includes("Gastos 5%"));
    assert.match(await page.locator("#barra-distribucion").getAttribute("aria-label"), /Gastos:.*100/);
    assert.equal(await page.locator(".zona-borrado").getAttribute("open"), null);
    assert.equal(await page.locator("#confirmar-borrado").isVisible(), false);
    const ids = await page.evaluate(() => {
        const ids = [...document.querySelectorAll("[id]")].map(e => e.id);
        return ids.length === new Set(ids).size;
    });
    assert.equal(ids, true);
    assert.deepEqual(errors, []);
});

test('diseño: importes largos, historial y teclado sin perder contenido', async t => {
    const { page } = await abrirGastosPrueba(t);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.evaluate(() => {
        nominas[0].referencia = "Una nómina con un nombre especialmente largo para comprobar la lectura en el celular";
        mostrarHistorialNominas();
        mostrarResumenFinanciero();
    });
    await page.locator("#historial-nominas summary").click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator("#boton-reparto").click();
    await page.locator("#resumen-financiero > details").nth(1).locator("summary").click();
    const tabla = page.locator("#resumen-financiero .tabla-scroll");
    await tabla.focus();
    assert.equal(await tabla.getAttribute("tabindex"), "0");
    assert.equal(await tabla.getAttribute("role"), "region");
});

test('móvil: atrás, adelante y enlace directo conservan el borrador', async t => {
    const { page, errors } = await abrir(t);
    await page.locator('#referencia-nomina').fill('Pendiente');
    await page.locator('#boton-ahorro').click();
    await page.locator('#boton-deudas').click();
    await page.goBack();
    assert.equal(await page.locator('#vista-ahorro').isVisible(), true);
    await page.goBack();
    assert.equal(await page.locator('#referencia-nomina').inputValue(), 'Pendiente');
    await page.goForward();
    assert.equal(await page.locator('#vista-ahorro').isVisible(), true);
    await page.reload();
    assert.equal(await page.locator('#vista-ahorro').isVisible(), true);
    assert.equal(await page.locator('#boton-ahorro').getAttribute('aria-current'), 'page');
    assert.equal(await page.evaluate(() => nominas.length), 1);
    assert.deepEqual(errors, []);
});

test('móvil: criterio de teclado distingue zoom, escritorio y cambios pequeños', async t => {
    const { page } = await abrir(t);
    const values = await page.evaluate(() => {
        const base = { tactil: true, editable: true, escala: 1, alturaBase: 850, alturaVisible: 450 };
        return [base, {...base, escala: 2}, {...base, tactil: false},
            {...base, editable: false}, {...base, alturaVisible: 800}].map(tecladoMovilVisible);
    });
    assert.deepEqual(values, [true, false, false, false, false]);
});

test('móvil: pantalla táctil, reducción simulada por teclado y recuperación', async t => {
    const context = await browser.newContext({ viewport: { width: 390, height: 850 }, isMobile: true, hasTouch: true });
    t.after(() => context.close());
    const page = await context.newPage();
    await page.goto(url);
    await page.locator('#referencia-nomina').focus();
    await page.setViewportSize({ width: 390, height: 450 });
    await page.waitForFunction(() => document.body.classList.contains('teclado-visible'));
    assert.equal(await page.locator('.navegacion-vistas').isVisible(), false);
    await page.setViewportSize({ width: 390, height: 850 });
    await page.waitForFunction(() => !document.body.classList.contains('teclado-visible'));
    assert.equal(await page.locator('.navegacion-vistas').isVisible(), true);
    assert.ok(await page.locator('#referencia-nomina').evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16));
});

test('móvil: texto ampliado y orientación horizontal no desbordan', async t => {
    const { page, errors } = await abrirGastosPrueba(t);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    for (const size of [{ width: 320, height: 850 }, { width: 850, height: 390 }]) {
        await page.setViewportSize(size);
        for (const id of ['boton-reparto', 'boton-ahorro', 'boton-deudas']) {
            await page.locator('#' + id).click();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, id + ' a ' + size.width);
        }
    }
    assert.deepEqual(errors, []);
});

test('ingreso: fallo de almacenamiento conserva campos y permite reintento único', async t => {
    const { page } = await abrir(t);
    await page.locator('#referencia-nomina').fill('Ingreso nuevo');
    await page.locator('#neto-nomina').fill('1200');
    await page.locator('#periodo-nomina').selectOption('semanal');
    await page.evaluate(() => {
        window.guardarOriginalPrueba = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new DOMException('Sin espacio', 'QuotaExceededError'); };
    });
    await page.locator('#confirmar-nomina').click();
    assert.equal(await page.evaluate(() => nominas.length), 1);
    assert.equal(await page.locator('#referencia-nomina').inputValue(), 'Ingreso nuevo');
    assert.equal(await page.locator('#neto-nomina').inputValue(), '1200');
    assert.match(await page.locator('#mensaje-nomina').textContent(), /campos se conservan/);
    await page.evaluate(() => { Storage.prototype.setItem = window.guardarOriginalPrueba; });
    await page.locator('#confirmar-nomina').click();
    assert.equal(await page.evaluate(() => nominas.length), 2);
    await page.reload();
    assert.equal(await page.evaluate(() => nominas.filter(n => n.referencia === 'Ingreso nuevo').length), 1);
});

test('avanzadas: corregir fondo distribuido, conservar historial y deshacer la corrección', async t => {
    const { page, errors } = await abrir(t, true);
    assert.deepEqual(await page.evaluate(() => {
        registrarApartadoGrupo('g1', '100'); distribuirFondoGrupo('g1');
        const id = obtenerApartadosNomina()[0].id;
        const plan = prepararCorreccionAvanzada(id, '60');
        const previo = JSON.stringify(construirPaquete());
        const pasos = plan.afectados.length;
        const previewNoMuta = previo === JSON.stringify(construirPaquete());
        const ok = aplicarCorreccionAvanzada(plan, 'Importe capturado de más');
        const fondo = resumirFondoGrupo(gruposDeudas[0]).fondoCentavos;
        const libre = calcularResumenFinanciero().disponible;
        const reserva = calcularReservaDeuda(deudas[0]);
        const historial = historialCorrecciones.length;
        const reversible = deshacerUltimoCambio('Recuperar distribución', ultimaCorreccionDisponible().id);
        return { pasos, previewNoMuta, ok, fondo, libre, reserva, historial, reversible,
            recuperado: calcularReservaDeuda(deudas[0]) };
    }), { pasos: 1, previewNoMuta: true, ok: true, fondo: 6000, libre: 94000, reserva: 0,
        historial: 3, reversible: true, recuperado: 10000 });
    await page.reload();
    assert.equal(await page.evaluate(() => guardadoHabilitado), true);
    assert.deepEqual(errors, []);
});

test('avanzadas: transferencia y cambios posteriores visibles, anulación sin duplicar saldo', async t => {
    const { page } = await abrir(t);
    assert.deepEqual(await page.evaluate(() => {
        registrarApartadoConNomina('deuda', 'd1', '50');
        const id = obtenerApartadosNomina()[0].id;
        cambiarModalidadGrupo('g1', 'grupo');
        const siguiente = capturarEstadoDeudas();
        siguiente.gruposDeudas[0].nombre = 'Nombre posterior';
        guardarAjusteDeudas(siguiente, 'Renombrar después');
        const plan = prepararCorreccionAvanzada(id, '0');
        const ok = aplicarCorreccionAvanzada(plan, 'Anulación solicitada');
        return { pasos: plan.afectados.length, ok, modalidad: gruposDeudas[0].modalidad,
            transferencias: deudas[0].transferencias.length, origenes: obtenerApartadosNomina().length,
            libre: calcularResumenFinanciero().disponible, nombre: gruposDeudas[0].nombre };
    }), { pasos: 2, ok: true, modalidad: 'individual', transferencias: 0, origenes: 0,
        libre: 100000, nombre: 'Grupo de prueba' });
});

test('avanzadas: pago confirmado e historial ausente impiden reconstrucción', async t => {
    const { page } = await abrir(t, true);
    assert.deepEqual(await page.evaluate(() => {
        registrarApartadoGrupo('g1', '100'); distribuirFondoGrupo('g1');
        const id = obtenerApartadosNomina()[0].id;
        const antes = copiar(construirPaquete());
        liquidarDeuda('d1');
        let pago = false;
        try { prepararCorreccionAvanzada(id, '50'); } catch(e) { pago = /pago confirmado/.test(e.message); }
        antes.historialCorrecciones = [];
        aplicarDatos(antes); guardar();
        let antiguo = false;
        try { prepararCorreccionAvanzada(id, '50'); } catch { antiguo = true; }
        return { pago, antiguo };
    }), { pago: true, antiguo: true });
});

test('avanzadas: plan desactualizado y fallo de guardado no alteran registros', async t => {
    const { page } = await abrir(t, true);
    assert.deepEqual(await page.evaluate(() => {
        registrarApartadoGrupo('g1', '100'); distribuirFondoGrupo('g1');
        const id = obtenerApartadosNomina()[0].id;
        const plan = prepararCorreccionAvanzada(id, '50');
        const otro = capturarEstadoDeudas(); otro.gruposDeudas[0].nombre = 'Modificado';
        guardarAjusteDeudas(otro, 'Cambio después de la vista previa');
        const obsoleto = aplicarCorreccionAvanzada(plan, 'No aplicar');
        const nuevo = prepararCorreccionAvanzada(id, '50');
        const antes = JSON.stringify(construirPaquete());
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new Error('Sin espacio'); };
        const fallo = aplicarCorreccionAvanzada(nuevo, 'Prueba');
        Storage.prototype.setItem = set;
        return { obsoleto, fallo, intacto: antes === JSON.stringify(construirPaquete()) };
    }), { obsoleto: false, fallo: false, intacto: true });
});

test('avanzadas: formulario exige vista previa y confirmación de todos los cambios', async t => {
    const { page } = await abrir(t, true);
    await page.evaluate(() => { registrarApartadoGrupo('g1', '100'); distribuirFondoGrupo('g1'); });
    await page.locator('.correccion-avanzada > summary').click();
    const id = await page.evaluate(() => obtenerApartadosNomina()[0].id);
    await page.locator('#apartado-avanzado').selectOption(id);
    await page.locator('#importe-avanzado').fill('75');
    await page.locator('#preparar-avanzada').click();
    assert.equal(await page.locator('#lista-avanzada li').count(), 1);
    await page.locator('#motivo-avanzado').fill('Corregir registro');
    await page.locator('#aceptar-avanzada').check();
    await page.locator('#aplicar-avanzada').click();
    assert.match(await page.locator('#mensaje-avanzada').textContent(), /Reconstrucción guardada/);
    await page.reload();
    assert.equal(await page.evaluate(() => resumirFondoGrupo(gruposDeudas[0]).fondoCentavos), 7500);
});

test('borrado: acceso visible y confirmación obligatoria sin eliminar por accidente', async t => {
    const { page } = await abrir(t);
    await page.locator('#gestionar-datos').click();
    assert.equal(await page.locator('#panel-borrado').getAttribute('open'), '');
    assert.match(await page.locator('#resumen-borrado').textContent(), /1 ingresos, 1 deudas/);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'titulo-borrado');
    const antes = await page.evaluate(() => localStorage.getItem(CLAVE_GUARDADO));
    await page.locator('#formulario-borrado-total button').click();
    await page.getByRole('button', {name:'No',exact:true}).click();
    assert.equal(await page.evaluate(() => localStorage.getItem(CLAVE_GUARDADO)), antes);
    assert.equal(await page.locator('dialog').count(), 0);
});

test('borrado: elimina la clave y la memoria incluso si no permite escribir', async t => {
    const { page } = await abrir(t);
    assert.deepEqual(await page.evaluate(async () => {
        registrarApartadoConNomina('deuda', 'd1', '50');
        localStorage.setItem('otra-aplicacion', 'conservar');
        recargarTrasReinicio = () => {};
        Storage.prototype.setItem = () => { throw new Error('Cuota agotada'); };
        confirmarBorrado = async () => true;
        await restablecerTodosLosDatos(new Event('submit'));
        return { copia: localStorage.getItem(CLAVE_GUARDADO), otra: localStorage.getItem('otra-aplicacion'),
            nominas: nominas.length, deudas: deudas.length, historial: historialCorrecciones.length,
            extras: otrosIngresos.length, ahorro: movimientosAhorros.length, grupos: gruposDeudas.length,
            gastos: gastosBasicos.length, bloqueado: reinicioDetectado };
    }), { copia: null, otra: 'conservar', nominas: 0, deudas: 0, historial: 0, extras: 0,
        ahorro: 0, grupos: 0, gastos: 0, bloqueado: true });
});

test('borrado: una copia corrupta se elimina y los nuevos ingresos sí persisten', async t => {
    const { page } = await abrir(t);
    await page.evaluate(() => localStorage.setItem(CLAVE_GUARDADO, '{copia-dañada'));
    await page.reload();
    assert.equal(await page.evaluate(() => guardadoHabilitado), false);
    await page.locator('#gestionar-datos').click();
    assert.match(await page.locator('#resumen-borrado').textContent(), /no se puede recuperar/);
    await Promise.all([page.waitForEvent('load'), borrarTodoEnPrueba(page)]);
    assert.equal(await page.evaluate(() => guardadoHabilitado), true);
    assert.match(await page.locator('#aviso-datos-borrados').textContent(), /Datos anteriores eliminados/);
    assert.equal(await page.evaluate(() => otrosIngresos.length), 0);
    await page.locator('#referencia-nomina').fill('Mi primer ingreso nuevo');
    await page.locator('#neto-nomina').fill('2500');
    await page.locator('#periodo-nomina').selectOption('semanal');
    await page.locator('#confirmar-nomina').click();
    await page.reload();
    assert.deepEqual(await page.evaluate(() => ({ nombres: nominas.map(n => n.referencia),
        importe: nominas[0].montoCentavos, deudas: deudas.length, historial: historialCorrecciones.length })),
        { nombres: ['Mi primer ingreso nuevo'], importe: 250000, deudas: 0, historial: 0 });
});

test('borrado: un fallo al eliminar conserva los datos y permite reintentar', async t => {
    const { page } = await abrir(t);
    const antes = await page.evaluate(() => localStorage.getItem(CLAVE_GUARDADO));
    await page.evaluate(() => {
        window.removeOriginalPrueba = Storage.prototype.removeItem;
        Storage.prototype.removeItem = () => { throw new Error('Sin permiso'); };
    });
    await page.locator('#gestionar-datos').click();
    await borrarTodoEnPrueba(page);
    assert.match(await page.locator('#mensaje-borrado').textContent(), /No se pudo eliminar/);
    assert.equal(await page.evaluate(() => localStorage.getItem(CLAVE_GUARDADO)), antes);
    assert.equal(await page.evaluate(() => nominas.length), 1);
    assert.equal(await page.evaluate(() => reinicioDetectado), false);
    await page.evaluate(() => { Storage.prototype.removeItem = window.removeOriginalPrueba; });
    await Promise.all([page.waitForEvent('load'), borrarTodoEnPrueba(page)]);
    assert.equal(await page.evaluate(() => nominas.length), 0);
});

test('borrado: eliminación externa bloquea pestañas antiguas sin marca de reinicio', async t => {
    const { page } = await abrir(t);
    await page.evaluate(() => {
        const datos = JSON.parse(localStorage.getItem(CLAVE_GUARDADO));
        delete datos.reinicioId;
        localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(datos));
    });
    await page.reload();
    const otra = await page.context().newPage();
    await otra.goto(url);
    await page.evaluate(() => localStorage.removeItem(CLAVE_GUARDADO));
    await otra.waitForFunction(() => reinicioDetectado);
    assert.equal(await otra.evaluate(() => guardar()), false);
    assert.equal(await otra.evaluate(() => localStorage.getItem(CLAVE_GUARDADO)), null);
});

test('borrado: vaciar almacenamiento desde otra pestaña tampoco restaura datos', async t => {
    const { page } = await abrir(t);
    const otra = await page.context().newPage();
    await otra.goto(url);
    await page.evaluate(() => localStorage.clear());
    await otra.waitForFunction(() => reinicioDetectado);
    assert.equal(await otra.evaluate(() => guardar()), false);
    await otra.reload();
    assert.equal(await otra.evaluate(() => nominas.length + deudas.length), 0);
    assert.equal(await otra.evaluate(() => guardadoHabilitado), true);
});

test('mejoras: copias antiguas no inventan fechas y las nuevas conservan versión 9', async t => {
    const { page } = await abrir(t);
    assert.deepEqual(await page.evaluate(() => {
        const viejo = copiar(construirPaquete()); delete viejo.mejoras;
        const ok = aplicarDatos(viejo) && guardar();
        const sinFecha = movimientosUnificados().find(m => m.tipo === 'ingreso').fecha;
        const invalida = { app: 'finanzas-personal', version: 8, datos: viejo };
        return { ok, sinFecha, metas: mejoras.metas.length, rechazada: !esCopiaValida(invalida),
            copia8: crearCopiaLocal().version };
    }), { ok: true, sinFecha: '', metas: 0, rechazada: true, copia8: 9 });
    await page.reload();
    assert.equal(await page.evaluate(() => guardadoHabilitado), true);
});

test('mejoras: ingreso nuevo con fecha, edición de importe y reparto, anulación conservada', async t => {
    const { page } = await abrir(t);
    const resultado = await page.evaluate(() => {
        editarIngreso('n1', { referencia: 'Corregido', monto: '1500', periodo: 'quincenal', fecha: '2026-11-01',
            reparto: [{ id:'basicos', nombre:'Básicos', porcentaje:60 }, { id:'ahorro', nombre:'Ahorro', porcentaje:40 }] }, 'Error de captura');
        const importe = nominas[0].montoCentavos;
        const fecha = fechaMovimiento('ingreso', 'n1');
        const reparto = nominas[0].reparto.map(c => c.montoCentavos);
        anularIngreso('n1', 'Registro de prueba');
        return { importe, fecha, reparto, activos: nominas.length, anulados: mejoras.ingresosAnulados.length,
            historial: mejoras.cambiosIngresos.length, saldo: calcularResumenFinanciero().ingresos,
            fila: movimientosUnificados().find(m => m.tipo === 'ingreso').estado };
    });
    assert.deepEqual(resultado, { importe:150000, fecha:'2026-11-01', reparto:[90000,60000], activos:0,
        anulados:1, historial:2, saldo:0, fila:'anulado' });
    await page.reload();
    assert.equal(await page.evaluate(() => mejoras.ingresosAnulados.length), 1);
    assert.equal(await page.evaluate(() => guardadoHabilitado), true);
});

test('mejoras: ingreso utilizado protege importes y permite referencia y fecha', async t => {
    const { page } = await abrir(t);
    assert.deepEqual(await page.evaluate(() => {
        registrarApartadoConNomina('deuda', 'd1', '50');
        const campos = { referencia:'Referencia corregida', monto:'1000', periodo:'semanal', fecha:'2026-11-02' };
        editarIngreso('n1', campos, 'Completar datos');
        let importe = false, anular = false;
        try { editarIngreso('n1', {...campos, monto:'2000'}, 'No permitido'); } catch { importe = true; }
        try { anularIngreso('n1', 'No permitido'); } catch { anular = true; }
        return { importe, anular, nombre:nominas[0].referencia, disponible:calcularResumenFinanciero().disponible,
            fecha:fechaMovimiento('ingreso', 'n1') };
    }), { importe:true, anular:true, nombre:'Referencia corregida', disponible:95000, fecha:'2026-11-02' });
});

test('mejoras: fallo de almacenamiento revierte ingreso y datos complementarios completos', async t => {
    const { page } = await abrir(t);
    assert.deepEqual(await page.evaluate(() => {
        const antes = JSON.stringify(construirPaquete());
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new Error('Sin espacio'); };
        let rechazado = false;
        try { editarIngreso('n1', { referencia:'No persistir', monto:'900', periodo:'unico', fecha:'2026-11-01' }, 'Prueba'); }
        catch { rechazado = true; }
        Storage.prototype.setItem = set;
        return { rechazado, intacto:antes === JSON.stringify(construirPaquete()) };
    }), { rechazado:true, intacto:true });
});

test('mejoras: formulario corrige ingreso y rechaza referencias duplicadas', async t => {
    const { page } = await abrir(t);
    await page.locator('#editor-ingresos > summary').click();
    await page.locator('#editar-ingreso-id').selectOption('n1');
    await page.locator('#editar-ingreso-nombre').fill('Mi ingreso corregido');
    await page.locator('#editar-ingreso-importe').fill('1300');
    await page.locator('#editar-ingreso-fecha').fill('2026-11-03');
    await page.locator('#editar-ingreso-motivo').fill('Captura inicial incorrecta');
    await page.locator('#guardar-edicion-ingreso').click();
    assert.match(await page.locator('#mensaje-editar-ingreso').textContent(), /Ingreso corregido/);
    assert.equal(await page.evaluate(() => nominas[0].montoCentavos), 130000);
    assert.equal(await page.evaluate(() => {
        const n = copiar(nominas[0]); n.id = 'n2'; n.referencia = 'Segundo';
        nominas.push(n); guardar();
        try { editarIngreso('n2', {referencia:'Mi ingreso corregido',monto:'1300',periodo:'semanal',fecha:'2026-11-03'}, 'Duplicar'); return false; }
        catch { return true; }
    }), true);
});

test('mejoras: vencimientos no pagan deudas y distinguen hoy, vencida y próxima', async t => {
    const { page } = await abrir(t);
    assert.deepEqual(await page.evaluate(() => {
        guardarVencimiento('d1','2026-11-25');
        const estados = ['2026-11-20','2026-11-23','2026-11-25'].map(f => estadoVencimiento(f,'2026-11-23').clase);
        return { estados, fecha:mejoras.vencimientos[0].fecha, liquidada:deudas[0].liquidada,
            libre:calcularResumenFinanciero().disponible };
    }), { estados:['urgente','urgente','proxima'], fecha:'2026-11-25', liquidada:false, libre:100000 });
    await page.reload();
    assert.equal(await page.evaluate(() => mejoras.vencimientos[0].fecha), '2026-11-25');
});

test('mejoras: metas clasifican ahorro, rechazan retiro excesivo y preservan el total', async t => {
    const { page } = await abrirGastosPrueba(t);
    assert.deepEqual(await page.evaluate(() => {
        guardarMetaAhorro('', 'Emergencia','1000');
        const id = mejoras.metas[0].id;
        const aporte = registrarAhorroVinculado('aportacion','Fondo','200','n1',id,'2026-11-01');
        const retiro = registrarAhorroVinculado('retiro','Uso','50','',id,'2026-11-02');
        const excesivo = registrarAhorroVinculado('retiro','No alcanza','151','',id,'2026-11-03');
        const sinGeneral = registrarAhorroVinculado('retiro','General vacío','1','','','2026-11-03');
        const saldo = saldosMetas().get(id), general = saldosMetas().get('');
        return { aporte,retiro,excesivo,sinGeneral,saldo,general,total:calcularSaldoAhorro(movimientosAhorros),
            disponible:calcularResumenFinanciero().disponible };
    }), { aporte:true,retiro:true,excesivo:false,sinGeneral:false,saldo:15000,general:0,total:15000,disponible:180000 });
    await page.reload();
    assert.equal(await page.evaluate(() => guardadoHabilitado), true);
});

test('mejoras: asignación de ahorro existente no crea dinero y protege retiros históricos', async t => {
    const { page } = await abrirGastosPrueba(t);
    assert.deepEqual(await page.evaluate(() => {
        registrarAhorroVinculado('aportacion','Previo','200','n1');
        guardarMetaAhorro('', 'Viaje','500');
        const id = mejoras.metas[0].id, m = movimientosAhorros[0].id;
        asignarMovimientoMeta(m,id);
        const meta = saldosMetas().get(id), total = calcularSaldoAhorro(movimientosAhorros);
        registrarAhorroVinculado('retiro','Reserva','50','',id);
        let bloqueado = false;
        try { asignarMovimientoMeta(m,''); } catch { bloqueado = true; }
        const anulacion = anularMovimientoAhorro(m,'No debe dejar negativo');
        return { meta,total,bloqueado,anulacion,saldo:saldosMetas().get(id) };
    }), { meta:20000,total:20000,bloqueado:true,anulacion:false,saldo:15000 });
});

test('mejoras: recurrencias mensuales mantienen el día ancla y años bisiestos', async t => {
    const { page } = await abrir(t);
    assert.deepEqual(await page.evaluate(() => {
        const mensual = {inicio:'2024-01-31',frecuencia:'mensual',ocurrencias:[]};
        const anual = {inicio:'2024-02-29',frecuencia:'anual',ocurrencias:[]};
        return [fechaOcurrencia(mensual,1),fechaOcurrencia(mensual,2),fechaOcurrencia(anual,1),fechaOcurrencia(anual,4)];
    }), ['2024-02-29','2024-03-31','2025-02-28','2028-02-29']);
});

test('mejoras: gasto recurrente no descuenta hasta confirmar y rechaza doble pago', async t => {
    const { page } = await abrirGastosPrueba(t);
    assert.deepEqual(await page.evaluate(() => {
        agregarCategoriaGasto('Servicios');
        crearGastoRecurrente({nombre:'Internet',monto:'100',subcategoriaId:categoriasGastos[0].id,inicio:'2026-01-01',frecuencia:'mensual'});
        const id = mejoras.recurrentes[0].id;
        const antes = calcularResumenFinanciero().disponible;
        confirmarRecurrente(id,0,'n1','2026-01-02');
        let doble = false; try { confirmarRecurrente(id,0,'n1','2026-01-02'); } catch { doble = true; }
        confirmarRecurrente(id,1,'','2026-02-01',true);
        return { antes,despues:calcularResumenFinanciero().disponible,doble,gastos:gastosBasicos.length,
            ocurrencias:mejoras.recurrentes[0].ocurrencias.length,proxima:fechaOcurrencia(mejoras.recurrentes[0]) };
    }), { antes:200000,despues:190000,doble:true,gastos:1,ocurrencias:2,proxima:'2026-03-01' });
    await page.reload();
    assert.equal(await page.evaluate(() => guardadoHabilitado), true);
});

test('mejoras: recurrencias bloquean saldo insuficiente, categoría archivada y fallo de guardado', async t => {
    const { page } = await abrirGastosPrueba(t);
    assert.deepEqual(await page.evaluate(() => {
        agregarCategoriaGasto('Renta');
        crearGastoRecurrente({nombre:'Renta',monto:'1200',subcategoriaId:categoriasGastos[0].id,inicio:'2026-01-01',frecuencia:'mensual'});
        const id = mejoras.recurrentes[0].id;
        let sinSaldo = false, archivada = false, fallo = false;
        try { confirmarRecurrente(id,0,'n1','2026-01-01'); } catch { sinSaldo = true; }
        archivarCategoriaGasto(categoriasGastos[0].id,true);
        try { confirmarRecurrente(id,0,'n1','2026-01-01'); } catch { archivada = true; }
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new Error('No guardar'); };
        try { confirmarRecurrente(id,0,'','2026-01-01',true); } catch { fallo = true; }
        Storage.prototype.setItem = original;
        return { sinSaldo,archivada,fallo,gastos:gastosBasicos.length,ocurrencias:mejoras.recurrentes[0].ocurrencias.length };
    }), {sinSaldo:true,archivada:true,fallo:true,gastos:0,ocurrencias:0});
});

test('mejoras: actividad filtra concepto, fecha, categoría, nómina y excluye anulados de resumen', async t => {
    const { page } = await abrirGastosPrueba(t);
    assert.deepEqual(await page.evaluate(() => {
        fijarFechaMovimiento(mejoras,'ingreso','n1','2026-11-01'); guardar();
        agregarCategoriaGasto('Comida');
        registrarGastoBasico({nominaId:'n1',subcategoriaId:categoriasGastos[0].id,concepto:'Café',fecha:'2026-11-02',monto:'100'});
        registrarGastoBasico({nominaId:'n1',subcategoriaId:categoriasGastos[0].id,concepto:'Otro mes',fecha:'2026-10-02',monto:'50'});
        const filas = filtrarActividad(movimientosUnificados(),{buscar:'cafe',desde:'2026-11-01',hasta:'2026-11-30',nominaId:'n1',categoriaId:'basicos'});
        const mes = resumenMes('2026-11');
        anularGastoBasico(gastosBasicos[0].id,'Duplicado');
        return { encontrados:filas.length,ingresos:mes.ingresos,gastos:mes.gastos,
            despues:resumenMes('2026-11').gastos,activos:filtrarActividad(movimientosUnificados(),{tipo:'gasto',estado:'activo'}).length };
    }), {encontrados:1,ingresos:200000,gastos:10000,despues:0,activos:1});
});

test('mejoras: fechas de apartados y pagos no cuentan transferencias como dinero nuevo', async t => {
    const { page } = await abrir(t,true);
    assert.deepEqual(await page.evaluate(() => {
        registrarApartadoGrupo('g1','100'); distribuirFondoGrupo('g1'); liquidarDeuda('d1');
        const filas = movimientosUnificados();
        const mes = resumenMes(fechaLocalGasto().slice(0,7));
        return {apartados:filas.filter(f=>f.tipo==='apartado').length,pagos:filas.filter(f=>f.tipo==='pago').length,
            apartado:mes.apartados,pago:mes.pagos,sinFecha:mes.sinFecha};
    }), {apartados:1,pagos:1,apartado:10000,pago:10000,sinFecha:1});
});

test('mejoras: copias inválidas se rechazan sin borrar metas ni saldos', async t => {
    const { page } = await abrirGastosPrueba(t);
    assert.deepEqual(await page.evaluate(() => {
        guardarMetaAhorro('','Fondo','100');
        const antes = JSON.stringify(construirPaquete());
        const mala = copiar(construirPaquete());
        mala.mejoras.destinosAhorro.push({movimientoId:'inexistente',metaId:mejoras.metas[0].id});
        return {rechazada:!aplicarDatos(mala),intacto:antes===JSON.stringify(construirPaquete())};
    }), {rechazada:true,intacto:true});
});

test('mejoras: borrado total elimina fechas, metas, programaciones y anulaciones', async t => {
    const { page } = await abrirGastosPrueba(t);
    await page.evaluate(() => {
        guardarMetaAhorro('','Borrar','100');
        agregarCategoriaGasto('Servicios');
        crearGastoRecurrente({nombre:'Borrar',monto:'10',subcategoriaId:categoriasGastos[0].id,inicio:'2026-01-01',frecuencia:'mensual'});
        guardarVencimiento('d1','2026-12-01');
        fijarFechaMovimiento(mejoras,'ingreso','n1','2026-11-01'); guardar();
    });
    await page.locator('#gestionar-datos').click();
    await Promise.all([page.waitForEvent('load'),borrarTodoEnPrueba(page)]);
    assert.equal(await page.evaluate(() => JSON.stringify(mejoras)===JSON.stringify(mejorasIniciales())), true);
});

test('mejoras: paneles abiertos son accesibles y no desbordan en móvil', async t => {
    const { page, errors } = await abrirGastosPrueba(t);
    await page.setViewportSize({width:320,height:850});
    await page.locator('#editor-ingresos > summary').click();
    await page.locator('#editar-ingreso-id').selectOption('n1');
    await page.locator('#panel-actividad > summary').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('#boton-ahorro').click();
    await page.locator('#editor-meta > summary').click();
    await page.locator('#meta-nombre').fill('Emergencia');
    await page.locator('#meta-objetivo').fill('1000');
    await page.locator('#formulario-meta button[type=submit]').click();
    assert.equal(await page.locator('#lista-metas article').count(),1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);
});

test('mejoras: interfaz de recurrentes confirma un pago y rechaza una plantilla duplicada', async t => {
    const { page } = await abrirGastosPrueba(t);
    await page.evaluate(() => agregarCategoriaGasto('Servicios'));
    await page.locator('#abrir-gastos').click();
    await page.locator('#editor-recurrente > summary').click();
    await page.locator('#recurrente-nombre').fill('Internet');
    await page.locator('#recurrente-importe').fill('100');
    const categoria = await page.evaluate(() => categoriasGastos[0].id);
    await page.locator('#recurrente-categoria').selectOption(categoria);
    await page.locator('#recurrente-inicio').fill('2026-01-01');
    await page.locator('#formulario-recurrente button').click();
    assert.equal(await page.locator('#lista-recurrentes article').count(),1);
    assert.equal(await page.evaluate(() => gastosBasicos.length),0);
    await page.locator('#lista-recurrentes select').selectOption('n1');
    await page.locator('#lista-recurrentes form button[type=submit]').click();
    assert.match(await page.locator('#mensaje-recurrentes').textContent(), /una sola vez/);
    assert.equal(await page.evaluate(() => gastosBasicos.length),1);
    assert.equal(await page.evaluate(() => {
        try { crearGastoRecurrente({nombre:'Internet',monto:'100',subcategoriaId:categoriasGastos[0].id,
            inicio:'2026-01-01',frecuencia:'mensual'}); return false; } catch { return true; }
    }),true);
});

test('mejoras: resumen mensual y de ingreso se actualizan desde los controles', async t => {
    const { page } = await abrirGastosPrueba(t);
    await page.evaluate(() => { fijarFechaMovimiento(mejoras,'ingreso','n1','2026-11-01'); guardar(); });
    await page.locator('.centro-actividad > details').first().locator('summary').click();
    await page.locator('#resumen-mes').fill('2026-11');
    await page.locator('#resumen-mes').dispatchEvent('change');
    assert.match(await page.locator('#metricas-periodo').textContent(), /2,000/);
    await page.locator('#resumen-modo').selectOption('nomina');
    await page.locator('#periodo-nomina-resumen').selectOption('n1');
    assert.match(await page.locator('#nota-periodo').textContent(), /Uso del ingreso seleccionado/);
    assert.match(await page.locator('#metricas-periodo').textContent(), /Disponible/);
});

test('mejoras: registro recurrente adulterado y movimientos futuros no descuentan dinero', async t => {
    const { page } = await abrirGastosPrueba(t);
    assert.deepEqual(await page.evaluate(() => {
        agregarCategoriaGasto('Servicios');
        crearGastoRecurrente({nombre:'Internet',monto:'100',subcategoriaId:categoriasGastos[0].id,inicio:'2026-01-01',frecuencia:'mensual'});
        confirmarRecurrente(mejoras.recurrentes[0].id,0,'n1','2026-01-01');
        const datos = copiar(construirPaquete());
        datos.mejoras.recurrentes[0].ocurrencias[0].gastoId = 'inexistente';
        const invalido = !aplicarDatos(datos);
        crearGastoRecurrente({nombre:'Futuro',monto:'100',subcategoriaId:categoriasGastos[0].id,inicio:'2099-01-01',frecuencia:'mensual'});
        let futuro = false;
        try { confirmarRecurrente(mejoras.recurrentes[1].id,0,'n1',fechaLocalGasto()); } catch { futuro = true; }
        return {invalido,futuro,gastos:gastosBasicos.length};
    }), {invalido:true,futuro:true,gastos:1});
});

test('local: validación y copia no modifican los datos; no quedan cuentas ni nube', async t => {
    const { page, errors } = await abrir(t);
    assert.equal(await page.locator('#panel-nube').count(), 0);
    assert.equal(await page.locator('script[src*="sincronizacion"]').count(), 0);
    assert.deepEqual(await page.evaluate(() => {
        const antes = JSON.stringify(construirPaquete());
        const copia = crearCopiaLocal();
        return {version:copia.version,fecha:Number.isFinite(Date.parse(copia.creadaEn)),
            valida:aplicarDatos(copia.datos,true),intacta:antes===JSON.stringify(construirPaquete())};
    }), {version:9,fecha:true,valida:true,intacta:true});
    assert.deepEqual(errors,[]);
});

test('offline: preparar, cerrar y reabrir sin red conserva ingresos nuevos', async t => {
    const { page, errors } = await abrir(t);
    await page.waitForFunction(() => document.querySelector('#estado-offline').dataset.listo === 'true');
    await page.context().setOffline(true);
    await page.reload();
    assert.match(await page.locator('#estado-conexion').textContent(), /Sin conexión/);
    await page.locator('#referencia-nomina').fill('Ingreso sin internet');
    await page.locator('#neto-nomina').fill('750');
    await page.locator('#periodo-nomina').selectOption('semanal');
    await page.locator('#confirmar-nomina').click();
    const nueva = await page.context().newPage();
    await page.close();
    await nueva.goto(url);
    assert.equal(await nueva.evaluate(() => nominas.some(n=>n.referencia==='Ingreso sin internet')),true);
    assert.equal(await nueva.evaluate(() => guardadoHabilitado),true);
    assert.deepEqual(errors,[]);
});

test('offline: funciona dentro de una subcarpeta como GitHub Pages', async t => {
    const context = await browser.newContext(); t.after(() => context.close());
    const page = await context.newPage(); await page.goto(url + '/app-prueba/');
    await page.waitForFunction(() => document.querySelector('#estado-offline').dataset.listo === 'true');
    const alcance = await page.evaluate(async()=> (await navigator.serviceWorker.getRegistration()).scope);
    assert.ok(alcance.endsWith('/app-prueba/'));
    await context.setOffline(true); await page.reload();
    assert.equal(await page.locator('#referencia-nomina').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
});

test('offline: caché contiene solo archivos, borrar datos no impide reabrir', async t => {
    const { page } = await abrir(t);
    await page.waitForFunction(() => document.querySelector('#estado-offline').dataset.listo === 'true');
    const urls = await page.evaluate(async()=>{
        const nombre=(await caches.keys()).find(k=>k.startsWith('mis-finanzas-app:'));
        return (await (await caches.open(nombre)).keys()).map(r=>new URL(r.url).pathname);
    });
    assert.ok(urls.some(p=>p.endsWith('/index.html')));
    assert.ok(urls.every(p=>!p.endsWith('.json')&&!p.includes('/api/')));
    await page.context().setOffline(true);
    await page.locator('#gestionar-datos').click();
    await Promise.all([page.waitForEvent('load'),borrarTodoEnPrueba(page)]);
    assert.equal(await page.evaluate(()=>nominas.length+deudas.length),0);
    await page.reload();
    assert.equal(await page.evaluate(()=>guardadoHabilitado),true);
});

test('offline: actualización espera confirmación, conserva datos y cachés ajenas', async t => {
    const { page } = await abrir(t);
    await page.waitForFunction(() => document.querySelector('#estado-offline').dataset.listo === 'true');
    await page.evaluate(async()=>{const c=await caches.open('cache-ajena');await c.put('/prueba-ajena',new Response('Conservar'));});
    versionWorkerPrueba = 1;
    try {
        await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
        await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
        assert.equal(await page.evaluate(()=>nominas.length),1);
        await page.waitForFunction(()=>!document.getElementById('actualizar-app').hidden);
        await Promise.all([page.waitForEvent('load'),page.locator('#actualizar-app').click()]);
        assert.equal(await page.evaluate(()=>nominas.length),1);
        assert.equal(await page.evaluate(async()=> (await caches.keys()).includes('cache-ajena')),true);
        await page.context().setOffline(true);await page.reload();
        assert.equal(await page.evaluate(()=>nominas.length),1);
    } finally {versionWorkerPrueba=0;}
});

test('copias locales: descarga versión 8 y restaura metas sin conexión', async t => {
    const { page } = await abrir(t);
    await page.evaluate(()=>guardarMetaAhorro('','Fondo personal','500'));
    await page.waitForFunction(()=>document.querySelector('#estado-offline').dataset.listo==='true');
    await page.context().setOffline(true);
    const copia=await page.evaluate(()=>crearCopiaLocal());
    const descarga=page.waitForEvent('download');
    await page.locator('#exportar-copia').click();
    assert.match((await descarga).suggestedFilename(), /^mis-finanzas-.*\.json$/);
    copia.datos.nominas[0].referencia='Restaurada desde archivo';
    await page.locator('#archivo-copia').setInputFiles({name:'copia.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(copia))});
    await page.waitForFunction(()=>document.querySelector('#mensaje-copia').textContent.includes('restaurada y guardada'));
    await page.reload();
    assert.equal(await page.evaluate(()=>nominas[0].referencia),'Restaurada desde archivo');
    assert.equal(await page.evaluate(()=>mejoras.metas[0].nombre),'Fondo personal');
});

test('copias locales: archivo corrupto y fallo de guardado conservan datos y memoria', async t => {
    const { page } = await abrir(t);
    const original=await page.evaluate(()=>localStorage.getItem(CLAVE_GUARDADO));
    await page.locator('#archivo-copia').setInputFiles({name:'mala.json',mimeType:'application/json',buffer:Buffer.from('{"app":"otra"}')});
    await page.waitForFunction(()=>document.querySelector('#mensaje-copia').className.includes('error'));
    assert.equal(await page.evaluate(()=>localStorage.getItem(CLAVE_GUARDADO)),original);
    assert.deepEqual(await page.evaluate(()=>{
        const copia=crearCopiaLocal();copia.datos.nominas[0].referencia='No guardar';
        const antes=JSON.stringify(construirPaquete()),set=Storage.prototype.setItem;
        Storage.prototype.setItem=()=>{throw new Error('Sin espacio');};
        let fallo=false;try{restaurarCopiaLocal(copia);}catch{fallo=true;}
        Storage.prototype.setItem=set;
        return {fallo,intacto:antes===JSON.stringify(construirPaquete())};
    }),{fallo:true,intacto:true});
});

test('copias locales: recuperar almacenamiento corrupto y rechazar una pestaña desactualizada', async t => {
    const { page } = await abrir(t);
    const copia=await page.evaluate(()=>crearCopiaLocal());
    await page.evaluate(()=>localStorage.setItem(CLAVE_GUARDADO,'{invalido'));
    await page.reload();
    assert.equal(await page.evaluate(()=>guardadoHabilitado),false);
    await page.evaluate(c=>restaurarCopiaLocal(c),copia);
    assert.equal(await page.evaluate(()=>guardadoHabilitado),true);
    assert.equal(await page.evaluate(()=>nominas.length),1);
    assert.equal(await page.evaluate(c=>{
        localStorage.setItem(CLAVE_GUARDADO,localStorage.getItem(CLAVE_GUARDADO)+' ');
        try{restaurarCopiaLocal(c);return false;}catch{return true;}
    },copia),true);
});

test('instalación: manifiesto e iconos válidos y controles móviles sin desbordamiento', async t => {
    const { page } = await abrir(t);
    const manifest=await page.evaluate(async()=>await(await fetch('./manifest.webmanifest')).json());
    assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'./');
    assert.deepEqual(manifest.icons.map(i=>i.sizes),['192x192','512x512']);
    const dimensiones=await page.evaluate(async()=>{
        const result=[];
        for(const src of ['./icons/icon-192.png','./icons/icon-512.png']){
            const img=new Image();img.src=src;await img.decode();result.push(img.naturalWidth);
        }return result;
    });
    assert.deepEqual(dimensiones,[192,512]);
    await page.setViewportSize({width:320,height:850});
    await page.locator('#panel-dispositivo summary').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
});

test('historial compacto: reduce espacio sin perder estados, motivos ni deshacer', async t => {
    const { page } = await abrir(t);
    const resultado = await page.evaluate(() => {
        for (let i = 0; i < 30; i++) {
            deudas[0].nombre = 'Nombre ' + i;
            if (!guardar()) throw new Error('Fallo al preparar historial');
        }
        const original = construirPaquete();
        const texto = localStorage.getItem(CLAVE_GUARDADO);
        const almacenado = JSON.parse(texto);
        const completo = JSON.stringify(original);
        const copia = crearCopiaLocal();
        window.historialEsperado = JSON.stringify(historialCorrecciones);
        return { reducido: texto.length < completo.length * 0.7,
            entradas: almacenado.historialCorrecciones.length,
            marcador: almacenado.historialCompacto,
            sinAntes: !Object.hasOwn(almacenado.historialCorrecciones[1], 'antes'),
            mismos: JSON.stringify(aplicarDatos(almacenado, "normalizar").historialCorrecciones) === JSON.stringify(original.historialCorrecciones),
            exportacionCompleta: !Object.hasOwn(copia.datos, 'historialCompacto') &&
                copia.datos.historialCorrecciones.every(e => e.antes && e.despues),
            historial: window.historialEsperado };
    });
    assert.equal(resultado.reducido, true);
    assert.equal(resultado.marcador, 1);
    assert.equal(resultado.sinAntes, true);
    assert.equal(resultado.mismos, true);
    assert.equal(resultado.exportacionCompleta, true);
    await page.reload();
    assert.equal(await page.evaluate(()=>JSON.stringify(historialCorrecciones)), resultado.historial);
    assert.equal(await page.evaluate(()=>deshacerUltimoCambio('Volver al nombre anterior',ultimaCorreccionDisponible().id)),true);
    await page.reload();
    assert.equal(await page.evaluate(()=>deudas[0].nombre),'Nombre 28');
});

test('historial compacto: importa copia completa antigua y conserva independencia entre estados', async t => {
    const { page } = await abrir(t);
    const copia = await page.evaluate(() => {
        deudas[0].nombre = 'Segundo nombre'; guardar();
        deudas[0].nombre = 'Tercer nombre'; guardar();
        return crearCopiaLocal();
    });
    await page.evaluate(c => restaurarCopiaLocal(c), copia);
    await page.reload();
    assert.deepEqual(await page.evaluate(()=>crearCopiaLocal().datos.historialCorrecciones), copia.datos.historialCorrecciones);
    assert.equal(await page.evaluate(() => {
        const anterior = historialCorrecciones[0].despues.deudas[0].nombre;
        historialCorrecciones[1].antes.deudas[0].nombre = 'Cambio solo en memoria';
        return historialCorrecciones[0].despues.deudas[0].nombre === anterior;
    }), true);
});

test('historial compacto: rechaza cadenas rotas o versiones desconocidas sin modificar datos', async t => {
    const { page } = await abrir(t);
    const resultado = await page.evaluate(() => {
        deudas[0].nombre = 'Otro nombre'; guardar();
        deudas[0].nombre = 'Nombre final'; guardar();
        const original = JSON.stringify(construirPaquete());
        const compacto = JSON.parse(localStorage.getItem(CLAVE_GUARDADO));
        const casos = [
            { ...compacto, historialCompacto: 2 },
            { ...compacto, historialCorrecciones: [null] },
            { ...compacto, historialCorrecciones: [{...compacto.historialCorrecciones[0],antes:undefined}] },
            { ...compacto, historialCorrecciones: compacto.historialCorrecciones.map((e,i)=>
                i === 1 ? {...e,despues:{deudas:[],gruposDeudas:[]}} : e) }
        ];
        const rechazados = casos.every(c => !aplicarDatos(c, true));
        return { rechazados, intacto: original === JSON.stringify(construirPaquete()) };
    });
    assert.deepEqual(resultado,{rechazados:true,intacto:true});
});

test('historial compacto: error de escritura conserva historial y datos anteriores', async t => {
    const { page } = await abrir(t);
    assert.deepEqual(await page.evaluate(() => {
        deudas[0].nombre = 'Antes del fallo'; guardar();
        const original = localStorage.getItem(CLAVE_GUARDADO);
        const historial = JSON.stringify(historialCorrecciones);
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = () => {throw new DOMException('Sin espacio','QuotaExceededError');};
        deudas[0].nombre = 'Cambio rechazado';
        let resultado;
        try {resultado=guardar();} finally {Storage.prototype.setItem=set;}
        return {resultado,igual:localStorage.getItem(CLAVE_GUARDADO)===original,
            historial:JSON.stringify(historialCorrecciones)===historial,nombre:deudas[0].nombre};
    }),{resultado:false,igual:true,historial:true,nombre:'Antes del fallo'});
    await page.reload();
    assert.equal(await page.evaluate(()=>deudas[0].nombre),'Antes del fallo');
});

test('offline: cancelar la actualización conserva versión, datos y formulario', async t => {
    const { page } = await abrir(t);
    await page.waitForFunction(()=>document.querySelector('#estado-offline').dataset.listo==='true');
    versionWorkerPrueba = 2;
    try {
        await page.evaluate(async()=>await(await navigator.serviceWorker.getRegistration()).update());
        await page.waitForFunction(()=>!document.getElementById('actualizar-app').hidden);
        await page.locator('#referencia-nomina').fill('Borrador pendiente');
        page.removeAllListeners('dialog');
        page.on('dialog',d=>d.dismiss());
        await page.locator('#actualizar-app').click();
        assert.equal(await page.evaluate(()=>actualizacionSolicitada),false);
        assert.equal(await page.locator('#referencia-nomina').inputValue(),'Borrador pendiente');
        assert.equal(await page.evaluate(()=>nominas.length),1);
        assert.equal(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting),true);
    } finally {versionWorkerPrueba=0;}
});

async function borrarTodoEnPrueba(page) {
    await page.locator('#formulario-borrado-total button').click();
    await page.getByRole('button',{name:'Sí',exact:true}).click();
}
async function prepararGestionPrueba(t) {
    const {page}=await abrir(t);
    await page.evaluate(()=>{
        const d=crearDatosIniciales();
        d.nominas=[{version:1,id:'n1',referencia:'Ingreso de prueba',periodo:'catorcenal',montoCentavos:200000,
            reparto:[{id:'basicos',nombre:'Básicos',porcentaje:100,montoCentavos:200000}]}];
        aplicarDatos(d);guardar();mostrarHistorialNominas();
    });return page;
}
test('gestión: gas y efectivo trasladan excedentes una sola vez',async t=>{
    const page=await prepararGestionPrueba(t);
    const r=await page.evaluate(()=>{
        for(const medio of ['tarjeta','efectivo']) {
            crearApartado('Gas '+medio,medio,'150',12);const id=gestion.apartados.at(-1).id;
            aportarBasico(id,'n1','150','2026-11');aportarBasico(id,'n1','150','2026-11');
            gastarApartado(id,'Gas','200','2026-11-15');cerrarMesApartado(id,'2026-11');
        }
        let doble=false;try{cerrarMesApartado(gestion.apartados[0].id,'2026-11');}catch{doble=true;}
        return {saldos:saldosApartados(),doble,disponible:calcularResumenFinanciero().disponible};
    });
    assert.deepEqual(r,{saldos:{emergencia:10000,efectivo:10000,reservado:0},doble:true,disponible:140000});
    await page.reload();assert.equal(await page.evaluate(()=>saldosApartados().emergencia),10000);
});
test('gestión: cuotas exactas, abonos parciales, atrasos y liquidación',async t=>{
    const page=await prepararGestionPrueba(t);
    assert.deepEqual(await page.evaluate(()=>{
        crearTarjeta('Tarjeta');const t=gestion.tarjetas[0].id;crearCompra(t,'Compra','1000',3,'2026-11');const id=gestion.tarjetas[0].compras[0].id;
        pagarCompra(t,id,'100','n1','basicos','2026-11-10');
        const parcial=resumenCompra(gestion.tarjetas[0].compras[0],'2026-11');
        const atraso=resumenCompra(gestion.tarjetas[0].compras[0],'2026-12').pendienteMes;
        pagarCompra(t,id,'900','n1','basicos','2026-12-01');
        const final=resumenCompra(gestion.tarjetas[0].compras[0],'2026-12');
        return {cuotas:[0,1,2].map(i=>cuotaCompra(gestion.tarjetas[0].compras[0],i)),parcial:parcial.pendienteMes,atraso,saldo:final.saldo,faltan:final.faltan,disponible:calcularResumenFinanciero().disponible};
    }),{cuotas:[33333,33333,33334],parcial:23333,atraso:56666,saldo:0,faltan:0,disponible:100000});
});
test('gestión: bloquea sobrepagos, sobregastos y doble uso de ingresos',async t=>{
    const page=await prepararGestionPrueba(t);
    assert.equal(await page.evaluate(()=>{
        crearTarjeta('Tarjeta');const t=gestion.tarjetas[0].id;crearCompra(t,'Compra','100',1,'2026-11');const c=gestion.tarjetas[0].compras[0].id;
        crearApartado('Renta','efectivo','1950',0);const a=gestion.apartados[0].id;aportarBasico(a,'n1','1950','2026-11');
        const antes=localStorage.getItem(CLAVE_GUARDADO);let rechazadas=0;
        for(const fn of [()=>pagarCompra(t,c,'101','n1','basicos','2026-11-01'),()=>pagarCompra(t,c,'60','n1','basicos','2026-11-01'),()=>gastarApartado(a,'Renta','2000','2026-11-02')])try{fn();}catch{rechazadas++;}
        return rechazadas===3&&localStorage.getItem(CLAVE_GUARDADO)===antes;
    }),true);
});
test('gestión: proyección instantánea no cambia el saldo real',async t=>{
    const page=await prepararGestionPrueba(t);
    assert.deepEqual(await page.evaluate(()=>{
        crearApartado('Fondo','tarjeta','100',12);const a=gestion.apartados[0].id;aportarBasico(a,'n1','100','2026-11');
        const antes=calcularResumenFinanciero().disponible;cambiarTasaApartado(a,24);
        return {doce:proyectarApartado(10000,12),veinticuatro:proyectarApartado(10000,24),cero:proyectarApartado(10000,0),igual:antes===calcularResumenFinanciero().disponible};
    }),{doce:11200,veinticuatro:12400,cero:10000,igual:true});
});
test('gestión: copia versión 9, recuperación y borrado total',async t=>{
    const page=await prepararGestionPrueba(t);
    const copia=await page.evaluate(()=>{
        crearTarjeta('Principal');crearApartado('Gas','tarjeta','150',12);aportarBasico(gestion.apartados[0].id,'n1','150','2026-11');
        return crearCopiaLocal();
    });
    assert.equal(copia.version,9);
    await page.evaluate(c=>restaurarCopiaLocal(c),copia);await page.reload();
    assert.deepEqual(await page.evaluate(()=>gestion),copia.datos.gestion);
    await page.locator('#gestionar-datos').click();
    await Promise.all([page.waitForEvent('load'),borrarTodoEnPrueba(page)]);
    assert.deepEqual(await page.evaluate(()=>gestion),{version:1,tarjetas:[],apartados:[]});
});
test('gestión: borrado Sí/No conserva o libera el saldo sin escribir',async t=>{
    const page=await prepararGestionPrueba(t);
    await page.evaluate(()=>{crearApartado('Gas','tarjeta','150',0);aportarBasico(gestion.apartados[0].id,'n1','150','2026-11');});
    await page.locator('#apartados-basicos').getByRole('button',{name:'Eliminar apartado',exact:true}).click();
    await page.getByRole('button',{name:'No',exact:true}).click();
    assert.equal(await page.evaluate(()=>gestion.apartados.length),1);
    await page.locator('#apartados-basicos').getByRole('button',{name:'Eliminar apartado',exact:true}).click();
    await page.getByRole('button',{name:'Sí',exact:true}).click();
    await page.waitForFunction(()=>gestion.apartados.length===0);
    assert.equal(await page.evaluate(()=>calcularResumenFinanciero().disponible),200000);
});
test('gestión: fallo de escritura y copia manipulada no pierden datos',async t=>{
    const page=await prepararGestionPrueba(t);
    assert.equal(await page.evaluate(()=>{
        const antes=localStorage.getItem(CLAVE_GUARDADO);const set=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('Sin espacio');};
        let fallo=false;try{crearTarjeta('Fallida');}catch{fallo=true;}finally{Storage.prototype.setItem=set;}
        const copia=crearCopiaLocal();copia.datos.gestion.apartados=[{id:'dañado'}];
        return fallo&&gestion.tarjetas.length===0&&antes===localStorage.getItem(CLAVE_GUARDADO)&&!aplicarDatos(copia.datos,true);
    }),true);
});
test('gestión: formulario completo de tarjeta y compra',async t=>{
    const page=await prepararGestionPrueba(t);await page.locator('#boton-deudas').click();
    await page.locator('#tarjetas-credito').getByText('＋ Agregar tarjeta',{exact:true}).click();
    await page.locator('#nueva-tarjeta [name=nombre]').fill('Mi tarjeta');
    await page.locator('#nueva-tarjeta button').click();
    await page.locator('#tarjetas-credito').getByText('＋ Compra o saldo',{exact:true}).click();
    const f=page.locator('#tarjetas-credito form[id^=compra-]');
    await f.locator('[name=nombre]').fill('Computadora');await f.locator('[name=total]').fill('1200');await f.locator('[name=meses]').fill('12');
    await f.locator('button').click();
    assert.equal(await page.evaluate(()=>gestion.tarjetas[0].compras[0].totalCentavos),120000);
    await page.setViewportSize({width:320,height:850});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});

test('offline: primera instalación no anuncia actualización ficticia',async t=>{
    const {page}=await abrir(t);
    await page.waitForFunction(()=>document.querySelector('#estado-offline').dataset.listo==='true');
    assert.equal(await page.evaluate(()=>document.getElementById('actualizar-app').hidden),true);
});
test('gestión: migración conserva importes y permite reasignarlos',async t=>{
    const page=await prepararGestionPrueba(t);
    assert.deepEqual(await page.evaluate(()=>{
        const d=crearDatosIniciales();
        const antiguo="inver"+"siones";
        d.categorias=[{id:'basicos',nombre:'Básicos',porcentaje:80},{id:antiguo,nombre:'Categoría anterior',porcentaje:20}];
        d.nominas=[{version:1,id:'n1',referencia:'Anterior',periodo:'mensual',montoCentavos:100000,reparto:[
            {id:'basicos',nombre:'Básicos',porcentaje:80,montoCentavos:80000},{id:antiguo,nombre:'Categoría anterior',porcentaje:20,montoCentavos:20000}]}];
        const ok=aplicarDatos(d)&&guardar();
        const pendiente=nominas[0].reparto.find(c=>c.id==='pendiente').montoCentavos;
        const plantilla=categorias.reduce((s,c)=>s+c.porcentaje,0);
        reasignarPendiente('n1','basicos');
        return {ok,pendiente,plantilla,reparto:nominas[0].reparto.map(c=>c.montoCentavos),total:calcularResumenFinanciero().disponible};
    }),{ok:true,pendiente:20000,plantilla:80,reparto:[100000],total:100000});
});
