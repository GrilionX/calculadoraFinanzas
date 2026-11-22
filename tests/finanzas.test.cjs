const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
let server, browser, url;

before(async () => {
    const root = path.resolve(__dirname, '..');
    server = http.createServer((req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        fs.readFile(file, (error, data) => {
            if (error) { res.writeHead(404).end(); return; }
            res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' :
                file.endsWith('.css') ? 'text/css' : 'text/html');
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
    await page.locator('#confirmar-borrado').fill('BORRAR');
    await Promise.all([page.waitForEvent('load'), page.locator('#formulario-borrado-total button').click()]);
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
