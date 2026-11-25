//Gastos por categoría de nómina
let categoriasGastos = [];
let gastosBasicos = [];

function limpiarCategoriasGastos(lista = []) {
    if (!Array.isArray(lista)) return null;
    const ids = new Set(), nombres = new Set(), resultado = [];
    for (const c of lista) {
        if (!c || typeof c.id !== "string" || !c.id.trim() ||
            typeof c.nombre !== "string") return null;
        const nombre = c.nombre.trim().replace(/\s+/g, " ");
        const categoriaId = c.categoriaId === undefined ? "basicos" : c.categoriaId;
        const archivada = c.archivada === undefined ? false : c.archivada;
        if (!esCategoriaDeGasto(categoriaId) || typeof archivada !== "boolean") return null;
        const clave = JSON.stringify([categoriaId, nombre.toLocaleLowerCase("es")]);
        if (!nombre || nombre.length > 60 || ids.has(c.id) || nombres.has(clave)) return null;
        ids.add(c.id); nombres.add(clave);
        resultado.push({ id: c.id, nombre, categoriaId, archivada });
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
            !esCategoriaDeGasto(g.categoriaId) || !fechaGastoValida(g.fecha) ||
            typeof g.concepto !== "string" || !g.concepto.trim() || g.concepto.trim().length > 120 ||
            !Number.isSafeInteger(g.montoCentavos) || g.montoCentavos <= 0 ||
            !subcategorias.some(c => c.id === g.subcategoriaId && c.categoriaId === g.categoriaId) ||
            !pagos.some(n => n.id === g.nominaId && n.reparto.some(c => c.id === g.categoriaId))) return null;
        let anulacion = null;
        if (g.anulacion !== null) {
            const a = g.anulacion;
            if (!a || typeof a.motivo !== "string" || !a.motivo.trim() || a.motivo.trim().length > 240 ||
                typeof a.fecha !== "string" || !Number.isFinite(Date.parse(a.fecha))) return null;
            anulacion = { motivo: a.motivo.trim(), fecha: a.fecha };
        }
        ids.add(g.id);
        resultado.push({ id: g.id, nominaId: g.nominaId, categoriaId: g.categoriaId,
            subcategoriaId: g.subcategoriaId, concepto: g.concepto.trim(), fecha: g.fecha,
            montoCentavos: g.montoCentavos, anulacion });
    }
    return resultado;
}

function obtenerCompromisosNomina(ds = deudas, gs = gruposDeudas, gastos = gastosBasicos, ahorro = movimientosAhorros, complemento = gestion) {
    return [...obtenerApartadosNomina(ds, gs), ...gastos.filter(g => !g.anulacion), ...compromisosAhorro(ahorro), ...compromisosGestion(complemento)];
}

function validarDisponibilidadCompleta(pagos, ds, gs, gastos, ahorro = movimientosAhorros, complemento = gestion) {
    const movimientos = obtenerCompromisosNomina(ds, gs, gastos, ahorro, complemento);
    if (limpiarAportacionesNomina(movimientos) === null) return false;
    try {
        for (const m of movimientos) {
            calcularDisponibleCategoria(pagos.find(n => n.id === m.nominaId), m.categoriaId, movimientos);
        }
        return true;
    } catch { return false; }
}

function resumenGastosNomina(id, categoriaId = "basicos") {
    const pago = nominas.find(n => n.id === id);
    if (!esCategoriaDeGasto(categoriaId) || !pago || !pago.reparto.some(c => c.id === categoriaId)) return null;
    const resumen = calcularDisponibleCategoria(pago, categoriaId, obtenerCompromisosNomina());
    const gastado = gastosBasicos.filter(g => g.nominaId === id && g.categoriaId === categoriaId && !g.anulacion)
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

function agregarCategoriaGasto(nombre, categoriaId = "basicos") {
    if (typeof nombre !== "string") return false;
    return guardarCambioGastos([...categoriasGastos, {
        id: generarId(categoriasGastos.map(c => c.id)), nombre, categoriaId, archivada: false
    }], gastosBasicos);
}

function registrarGastoBasico(datos) {
    const categoriaId = datos.categoriaId ?? "basicos";
    const subcategoria = categoriasGastos.find(c => c.id === datos.subcategoriaId);
    if (!subcategoria || subcategoria.archivada || subcategoria.categoriaId !== categoriaId) return false;
    const movimientos = obtenerCompromisosNomina();
    const monto = convertirPesosACentavos(datos.monto);
    if (monto === null) return false;
    const gasto = { id: generarId([...movimientos.map(m => m.id), ...gastosBasicos.map(g => g.id)]),
        nominaId: datos.nominaId, categoriaId, subcategoriaId: datos.subcategoriaId,
        concepto: datos.concepto, fecha: datos.fecha, montoCentavos: monto, anulacion: null };
    return guardarCambioGastos(categoriasGastos, [...gastosBasicos, gasto]);
}

function anularGastoBasico(id, motivo) {
    const gasto = gastosBasicos.find(g => g.id === id);
    if (!gasto || gasto.anulacion || typeof motivo !== "string" || !motivo.trim() || motivo.trim().length > 240) return false;
    return guardarCambioGastos(categoriasGastos, gastosBasicos.map(g => g.id === id
        ? { ...g, anulacion: { motivo: motivo.trim(), fecha: new Date().toISOString() } } : g));
}

//Administración de categorías
function esCategoriaDeGasto(id) {
    return typeof id === "string" && id.trim() !== "" &&
        !["ahorro", "deudas"].includes(id);
}

function renombrarCategoriaGasto(id, nombre) {
    if (typeof nombre !== "string" || !categoriasGastos.some(c => c.id === id)) return false;
    return guardarCambioGastos(categoriasGastos.map(c => c.id === id ? { ...c, nombre } : c), gastosBasicos);
}

function archivarCategoriaGasto(id, archivada) {
    if (typeof archivada !== "boolean" || !categoriasGastos.some(c => c.id === id)) return false;
    return guardarCambioGastos(categoriasGastos.map(c => c.id === id ? { ...c, archivada } : c), gastosBasicos);
}

function categoriaOrigenGasto() {
    return document.getElementById("gasto-origen").value;
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

    const origen = document.getElementById("gasto-origen");
    const origenAnterior = origen.value;
    const n = nominas.find(n => n.id === pago.value);
    const disponibles = (n?.reparto ?? []).filter(c => esCategoriaDeGasto(c.id));
    origen.replaceChildren(new Option("Selecciona el presupuesto", ""));
    for (const c of disponibles) origen.add(new Option(c.nombre + " · " + c.porcentaje + "%", c.id));
    origen.value = disponibles.some(c => c.id === origenAnterior) ? origenAnterior :
        (disponibles.find(c => c.id === "basicos")?.id ?? disponibles[0]?.id ?? "");
    const origenId = origen.value;
    const propias = categoriasGastos.filter(c => c.categoriaId === origenId);
    const activas = propias.filter(c => !c.archivada);
    document.getElementById("crear-categoria-gasto").disabled = !origenId || !guardadoHabilitado || reinicioDetectado;
    const categoria = document.getElementById("gasto-categoria");
    const anteriorCategoria = categoria.value;
    categoria.replaceChildren(new Option("Selecciona una categoría", ""));
    for (const c of activas) categoria.add(new Option(c.nombre, c.id));
    categoria.value = activas.some(c => c.id === anteriorCategoria) ? anteriorCategoria : "";

    const resumen = resumenGastosNomina(pago.value, origenId);
    const presupuesto = n?.reparto.find(c => c.id === origenId);
    document.getElementById("gastos-contexto").textContent = resumen
        ? n.referencia + " · " + presupuesto.porcentaje + "% de este pago para " + presupuesto.nombre + "."
        : n ? "Esta nómina no tiene categorías para gastos. Ahorro y deudas se gestionan por separado."
        : "Primero registra una nómina en Reparto. El simulador no crea dinero disponible.";
    for (const [id, valor] of [["gastos-asignado", resumen?.asignadoCentavos],
        ["gastos-total", resumen?.gastadoCentavos], ["gastos-reservado", resumen?.reservadoCentavos],
        ["gastos-disponible", resumen?.disponibleCentavos]]) {
        document.getElementById(id).textContent = formatoMoneda.format((valor ?? 0) / 100);
    }
    const lista = document.getElementById("gastos-por-categoria");
    lista.replaceChildren();
    const delPago = gastosBasicos.filter(g => g.nominaId === pago.value && g.categoriaId === origenId);
    for (const c of propias) {
        const fila = document.createElement("li");
        const total = delPago.filter(g => g.subcategoriaId === c.id && !g.anulacion)
            .reduce((s, g) => s + g.montoCentavos, 0);
        const nombre = document.createElement("p");
        nombre.textContent = c.nombre + (c.archivada ? " · Archivada" : "") + " · " + formatoMoneda.format(total / 100);
        const editar = document.createElement("details");
        const titulo = document.createElement("summary");
        titulo.textContent = "Cambiar nombre";
        const formulario = document.createElement("form");
        const etiqueta = document.createElement("label");
        const campo = document.createElement("input");
        campo.id = "renombrar-gasto-" + c.id;
        etiqueta.htmlFor = campo.id;
        etiqueta.textContent = "Nuevo nombre";
        campo.value = c.nombre;
        campo.maxLength = 60;
        campo.required = true;
        const guardarNombre = document.createElement("button");
        guardarNombre.type = "submit";
        guardarNombre.textContent = "Guardar nombre";
        formulario.append(etiqueta, campo, guardarNombre);
        formulario.addEventListener("submit", evento => {
            evento.preventDefault();
            const ok = renombrarCategoriaGasto(c.id, campo.value);
            mensajeGasto(ok ? "Nombre actualizado. Los gastos y sus importes se conservan." :
                "No se pudo cambiar el nombre. Evita nombres vacíos o repetidos dentro del mismo presupuesto.", !ok);
        });
        editar.append(titulo, formulario);
        const archivar = document.createElement("button");
        archivar.type = "button";
        archivar.className = "boton-secundario";
        archivar.textContent = c.archivada ? "Reactivar categoría" : "Archivar categoría";
        archivar.setAttribute("aria-label", archivar.textContent + ": " + c.nombre);
        archivar.addEventListener("click", () => {
            if (!c.archivada && !confirm("¿Archivar " + c.nombre + "? Sus gastos seguirán contando y podrás reactivarla.")) return;
            const ok = archivarCategoriaGasto(c.id, !c.archivada);
            mensajeGasto(ok ? (c.archivada ? "Categoría reactivada." : "Categoría archivada. Sus gastos se conservan.") :
                "No se pudo cambiar la categoría. Revisa el guardado.", !ok);
        });
        fila.append(nombre, editar, archivar);
        lista.appendChild(fila);
    }
    document.getElementById("categorias-gastos-vacias").hidden = propias.length > 0;
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
            boton.addEventListener("click", async () => {
                if (!await confirmarBorrado("¿Eliminar este movimiento?")) return;
                const motivo = "Eliminado por el usuario";
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
    const resumen = resumenGastosNomina(document.getElementById("gasto-nomina").value, categoriaOrigenGasto());
    const monto = convertirPesosACentavos(document.getElementById("gasto-monto").value);
    const cabe = resumen && monto !== null && monto <= resumen.disponibleCentavos;
    document.getElementById("gasto-registrar").disabled = !cabe || !guardadoHabilitado || reinicioDetectado ||
        !categoriasGastos.some(c => c.id === document.getElementById("gasto-categoria").value &&
            c.categoriaId === categoriaOrigenGasto() && !c.archivada);
    const previa = document.getElementById("gasto-previa");
    previa.textContent = monto === null ? "Escribe el importe para ver cuánto quedará."
        : !resumen ? "Selecciona una nómina y su presupuesto de gastos."
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
document.getElementById("gasto-origen").addEventListener("change", mostrarGastos);
document.getElementById("gasto-categoria").addEventListener("change", actualizarPreviaGasto);
document.getElementById("gasto-monto").addEventListener("input", actualizarPreviaGasto);
document.getElementById("formulario-categoria-gasto").addEventListener("submit", evento => {
    evento.preventDefault();
    const campo = document.getElementById("nombre-categoria-gasto");
    const ok = agregarCategoriaGasto(campo.value, categoriaOrigenGasto());
    mensajeGasto(ok ? "Categoría creada. Ya puedes seleccionarla al registrar un gasto."
        : "No se pudo crear. Usa un nombre único de hasta 60 caracteres y revisa el guardado.", !ok);
    if (ok) {
        campo.value = "";
        document.getElementById("gasto-categoria").value = categoriasGastos.at(-1).id;
        actualizarPreviaGasto();
    }
});
document.getElementById("formulario-gasto").addEventListener("submit", evento => {
    evento.preventDefault();
    const ok = registrarGastoBasico({
        nominaId: document.getElementById("gasto-nomina").value,
        categoriaId: categoriaOrigenGasto(),
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
