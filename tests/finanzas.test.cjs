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
