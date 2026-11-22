//Gastos básicos
let categoriasGastos = [];
let gastosBasicos = [];

function limpiarCategoriasGastos(lista = []) {
    if (!Array.isArray(lista)) return null;
    const ids = new Set(), nombres = new Set(), resultado = [];
    for (const c of lista) {
        if (!c || typeof c.id !== "string" || !c.id.trim() ||
            typeof c.nombre !== "string") return null;
        const nombre = c.nombre.trim().replace(/\s+/g, " ");
        const clave = nombre.toLocaleLowerCase("es");
        if (!nombre || nombre.length > 60 || ids.has(c.id) || nombres.has(clave)) return null;
        ids.add(c.id); nombres.add(clave);
        resultado.push({ id: c.id, nombre });
    }
    return resultado;
}

function fechaGastoValida(fecha) {
    if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
    const fechaUTC = new Date(fecha + "T12:00:00Z");
    return Number.isFinite(fechaUTC.getTime()) && fechaUTC.toISOString().slice(0, 10) === fecha;
}

function limpiarGastosBasicos(lista = [], subcategorias, pagos) {
    if (!Array.isArray(lista)) return null;
    const ids = new Set(), resultado = [];
    for (const g of lista) {
        if (!g || typeof g.id !== "string" || !g.id.trim() || ids.has(g.id) ||
            g.categoriaId !== "basicos" || !fechaGastoValida(g.fecha) ||
            typeof g.concepto !== "string" || !g.concepto.trim() || g.concepto.trim().length > 120 ||
            !Number.isSafeInteger(g.montoCentavos) || g.montoCentavos <= 0 ||
            !subcategorias.some(c => c.id === g.subcategoriaId) ||
            !pagos.some(n => n.id === g.nominaId && n.reparto.some(c => c.id === "basicos"))) return null;
        let anulacion = null;
        if (g.anulacion !== null) {
            const a = g.anulacion;
            if (!a || typeof a.motivo !== "string" || !a.motivo.trim() || a.motivo.trim().length > 240 ||
                typeof a.fecha !== "string" || !Number.isFinite(Date.parse(a.fecha))) return null;
            anulacion = { motivo: a.motivo.trim(), fecha: a.fecha };
        }
        ids.add(g.id);
        resultado.push({ id: g.id, nominaId: g.nominaId, categoriaId: "basicos",
            subcategoriaId: g.subcategoriaId, concepto: g.concepto.trim(), fecha: g.fecha,
            montoCentavos: g.montoCentavos, anulacion });
    }
    return resultado;
}

function obtenerCompromisosNomina(ds = deudas, gs = gruposDeudas, gastos = gastosBasicos) {
    return [...obtenerApartadosNomina(ds, gs), ...gastos.filter(g => !g.anulacion)];
}

function validarDisponibilidadCompleta(pagos, ds, gs, gastos) {
    const movimientos = obtenerCompromisosNomina(ds, gs, gastos);
    if (limpiarAportacionesNomina(movimientos) === null) return false;
    try {
        for (const m of movimientos) {
            calcularDisponibleCategoria(pagos.find(n => n.id === m.nominaId), m.categoriaId, movimientos);
        }
        return true;
    } catch { return false; }
}

function resumenGastosNomina(id) {
    const pago = nominas.find(n => n.id === id);
    if (!pago || !pago.reparto.some(c => c.id === "basicos")) return null;
    const resumen = calcularDisponibleCategoria(pago, "basicos", obtenerCompromisosNomina());
    const gastado = gastosBasicos.filter(g => g.nominaId === id && !g.anulacion)
        .reduce((s, g) => s + g.montoCentavos, 0);
    return { ...resumen, gastadoCentavos: gastado,
        reservadoCentavos: resumen.utilizadoCentavos - gastado };
}

//Guardado de gastos
function guardarCambioGastos(siguientesCategorias, siguientesGastos) {
    if (!guardadoHabilitado || reinicioDetectado) return false;
    const cats = limpiarCategoriasGastos(siguientesCategorias);
    const gastos = cats && limpiarGastosBasicos(siguientesGastos, cats, nominas);
    if (!cats || !gastos || !validarDisponibilidadCompleta(nominas, deudas, gruposDeudas, gastos)) return false;
    const anterioresCategorias = categoriasGastos, anterioresGastos = gastosBasicos;
    categoriasGastos = cats;
    gastosBasicos = gastos;
    if (!guardar()) {
        categoriasGastos = anterioresCategorias;
        gastosBasicos = anterioresGastos;
        mostrarGastos();
        return false;
    }
    mostrarHistorialNominas();
    mostrarDisponibleOrigen();
    return true;
}

function agregarCategoriaGasto(nombre) {
    if (typeof nombre !== "string") return false;
    return guardarCambioGastos([...categoriasGastos, {
        id: generarId(categoriasGastos.map(c => c.id)), nombre
    }], gastosBasicos);
}

function registrarGastoBasico(datos) {
    const movimientos = obtenerCompromisosNomina();
    const monto = convertirPesosACentavos(datos.monto);
    if (monto === null) return false;
    const gasto = { id: generarId([...movimientos.map(m => m.id), ...gastosBasicos.map(g => g.id)]),
        nominaId: datos.nominaId, categoriaId: "basicos", subcategoriaId: datos.subcategoriaId,
        concepto: datos.concepto, fecha: datos.fecha, montoCentavos: monto, anulacion: null };
    return guardarCambioGastos(categoriasGastos, [...gastosBasicos, gasto]);
}

function anularGastoBasico(id, motivo) {
    const gasto = gastosBasicos.find(g => g.id === id);
    if (!gasto || gasto.anulacion || typeof motivo !== "string" || !motivo.trim() || motivo.trim().length > 240) return false;
    return guardarCambioGastos(categoriasGastos, gastosBasicos.map(g => g.id === id
        ? { ...g, anulacion: { motivo: motivo.trim(), fecha: new Date().toISOString() } } : g));
}

//Pantalla de gastos
function fechaLocalGasto() {
    const hoy = new Date();
    return [hoy.getFullYear(), String(hoy.getMonth() + 1).padStart(2, "0"), String(hoy.getDate()).padStart(2, "0")].join("-");
}

function abrirGastos() {
    cambiarVista("reparto");
    document.getElementById("vista-reparto").hidden = true;
    document.getElementById("vista-gastos").hidden = false;
    mostrarGastos();
    document.getElementById("titulo-gastos").focus();
}

function mostrarGastos() {
    const pago = document.getElementById("gasto-nomina");
    const anterior = pago.value;
    pago.replaceChildren(new Option("Selecciona una nómina", ""));
    for (const n of [...nominas].reverse()) pago.add(new Option(n.referencia, n.id));
    pago.value = nominas.some(n => n.id === anterior) ? anterior : (nominas.at(-1)?.id ?? "");

    const categoria = document.getElementById("gasto-categoria");
    const anteriorCategoria = categoria.value;
    categoria.replaceChildren(new Option("Selecciona una categoría", ""));
    for (const c of categoriasGastos) categoria.add(new Option(c.nombre, c.id));
    categoria.value = categoriasGastos.some(c => c.id === anteriorCategoria) ? anteriorCategoria : "";

    const resumen = resumenGastosNomina(pago.value);
    const n = nominas.find(n => n.id === pago.value);
    const porcentaje = n?.reparto.find(c => c.id === "basicos")?.porcentaje;
    document.getElementById("gastos-contexto").textContent = resumen
        ? n.referencia + " · " + porcentaje + "% de este pago para gastos básicos."
        : n ? "Esta nómina no tiene la categoría Gastos básicos. Selecciona otra nómina."
        : "Primero registra una nómina en Reparto. El simulador no crea dinero disponible.";
    for (const [id, valor] of [["gastos-asignado", resumen?.asignadoCentavos],
        ["gastos-total", resumen?.gastadoCentavos], ["gastos-reservado", resumen?.reservadoCentavos],
        ["gastos-disponible", resumen?.disponibleCentavos]]) {
        document.getElementById(id).textContent = formatoMoneda.format((valor ?? 0) / 100);
    }
    const lista = document.getElementById("gastos-por-categoria");
    lista.replaceChildren();
    const delPago = gastosBasicos.filter(g => g.nominaId === pago.value);
    for (const c of categoriasGastos) {
        const fila = document.createElement("li");
        const total = delPago.filter(g => g.subcategoriaId === c.id && !g.anulacion)
            .reduce((s, g) => s + g.montoCentavos, 0);
        fila.textContent = c.nombre + " · " + formatoMoneda.format(total / 100);
        lista.appendChild(fila);
    }
    document.getElementById("categorias-gastos-vacias").hidden = categoriasGastos.length > 0;
    const historial = document.getElementById("historial-gastos");
    historial.replaceChildren();
    document.getElementById("gastos-vacios").hidden = delPago.length > 0;
    for (const g of [...delPago].reverse()) {
        const fila = document.createElement("li");
        const detalle = document.createElement("p");
        detalle.textContent = g.fecha + " · " + g.concepto + " · " +
            categoriasGastos.find(c => c.id === g.subcategoriaId).nombre + " · " +
            formatoMoneda.format(g.montoCentavos / 100);
        fila.appendChild(detalle);
        if (g.anulacion) {
            const aviso = document.createElement("p");
            aviso.textContent = "Anulado: " + g.anulacion.motivo;
            fila.appendChild(aviso);
        } else {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "boton-secundario";
            boton.textContent = "Anular gasto";
            boton.setAttribute("aria-label", "Anular gasto: " + g.concepto);
            boton.addEventListener("click", () => {
                const motivo = prompt("Motivo de la anulación (hasta 240 caracteres). El registro se conservará.");
                if (motivo === null) return;
                const ok = anularGastoBasico(g.id, motivo);
                mensajeGasto(ok ? "Gasto anulado. Su importe vuelve a estar disponible." : "No se pudo anular. Revisa el motivo y el aviso de guardado.", !ok);
            });
            fila.appendChild(boton);
        }
        historial.appendChild(fila);
    }
    const fecha = document.getElementById("gasto-fecha");
    if (!fecha.value) fecha.value = fechaLocalGasto();
    actualizarPreviaGasto();
}

function actualizarPreviaGasto() {
    const resumen = resumenGastosNomina(document.getElementById("gasto-nomina").value);
    const monto = convertirPesosACentavos(document.getElementById("gasto-monto").value);
    const cabe = resumen && monto !== null && monto <= resumen.disponibleCentavos;
    document.getElementById("gasto-registrar").disabled = !cabe || !guardadoHabilitado || reinicioDetectado;
    const previa = document.getElementById("gasto-previa");
    previa.textContent = monto === null ? "Escribe el importe para ver cuánto quedará."
        : !resumen ? "Selecciona una nómina con gastos básicos."
        : !cabe ? "El gasto supera el disponible. No se puede registrar."
        : "Después de registrarlo quedarán " + formatoMoneda.format((resumen.disponibleCentavos - monto) / 100) + ".";
    previa.className = monto !== null && !cabe ? "aviso error" : "ayuda";
}

function mensajeGasto(texto, error = false) {
    const mensaje = document.getElementById("mensaje-gasto");
    mensaje.textContent = texto;
    mensaje.className = error ? "aviso error" : "aviso ok";
}

document.getElementById("abrir-gastos").addEventListener("click", abrirGastos);
document.getElementById("volver-gastos").addEventListener("click", () => {
    cambiarVista("reparto");
    document.getElementById("abrir-gastos").focus();
});
document.getElementById("gasto-nomina").addEventListener("change", mostrarGastos);
document.getElementById("gasto-monto").addEventListener("input", actualizarPreviaGasto);
document.getElementById("formulario-categoria-gasto").addEventListener("submit", evento => {
    evento.preventDefault();
    const campo = document.getElementById("nombre-categoria-gasto");
    const ok = agregarCategoriaGasto(campo.value);
    mensajeGasto(ok ? "Categoría creada. Ya puedes seleccionarla al registrar un gasto."
        : "No se pudo crear. Usa un nombre único de hasta 60 caracteres y revisa el guardado.", !ok);
    if (ok) {
        campo.value = "";
        document.getElementById("gasto-categoria").value = categoriasGastos.at(-1).id;
    }
});
document.getElementById("formulario-gasto").addEventListener("submit", evento => {
    evento.preventDefault();
    const ok = registrarGastoBasico({
        nominaId: document.getElementById("gasto-nomina").value,
        subcategoriaId: document.getElementById("gasto-categoria").value,
        concepto: document.getElementById("gasto-concepto").value,
        fecha: document.getElementById("gasto-fecha").value,
        monto: document.getElementById("gasto-monto").value
    });
    mensajeGasto(ok ? "Gasto registrado. Los totales ya están actualizados."
        : "No se registró el gasto. Revisa los campos, el disponible y el aviso de guardado.", !ok);
    if (ok) {
        document.getElementById("gasto-concepto").value = "";
        document.getElementById("gasto-monto").value = "";
        actualizarPreviaGasto();
    }
});
