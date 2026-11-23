//Ajustes con historial
function motivoAjusteValido(motivo) {
    return typeof motivo === "string" && motivo.trim().length > 0 && motivo.trim().length <= 240;
}

function guardarAjusteDeudas(estado, motivo) {
    if (!puedeModificarDeudas() || !motivoAjusteValido(motivo)) return false;
    const limpio = validarEstadoCorreccion(estado, nominas);
    if (!limpio || !validarDisponibilidadCompleta(nominas, limpio.deudas, limpio.gruposDeudas, gastosBasicos) ||
        cambioIncluyePago(capturarEstadoDeudas(), limpio) || estadosIguales(capturarEstadoDeudas(), limpio)) return false;
    const anterior = capturarEstadoDeudas();
    deudas = limpio.deudas; gruposDeudas = limpio.gruposDeudas;
    correccionPendiente = { id: null, motivo: motivo.trim() };
    let ok;
    try { ok = guardar(); } finally { correccionPendiente = null; }
    if (!ok) { deudas = anterior.deudas; gruposDeudas = anterior.gruposDeudas; }
    cerrarEditorDeuda(); mostrarDeudas(); mostrarHistorialNominas(); invalidarProyeccionDeudas();
    return ok;
}

function ajustarObjetivoDeuda(id, monto, motivo) {
    const objetivo = convertirPesosACentavos(monto);
    const estado = capturarEstadoDeudas();
    const deuda = estado.deudas.find(d => d.id === id);
    if (!deuda || deuda.liquidada || objetivo === null) return false;
    deuda.objetivoCentavos = objetivo;
    return guardarAjusteDeudas(estado, motivo);
}

function apartadosCorregibles(estado = { deudas, gruposDeudas }) {
    const filas = [];
    for (const d of estado.deudas) {
        if (d.liquidada || (d.transferencias ?? []).length) continue;
        for (const m of d.aportacionesNomina ?? []) {
            filas.push({ id: m.id, tipo: "deuda", destinoId: d.id, nombre: d.nombre, montoCentavos: m.montoCentavos });
        }
    }
    for (const g of estado.gruposDeudas) {
        if ((g.movimientosFondo ?? []).some(m => m.tipo !== "apartado") ||
            estado.deudas.some(d => d.grupoId === g.id && d.liquidada)) continue;
        for (const m of g.movimientosFondo ?? []) {
            if (m.origenNomina) filas.push({ id: m.origenNomina.id, tipo: "grupo", destinoId: g.id,
                nombre: g.nombre, montoCentavos: m.montoCentavos });
        }
    }
    return filas;
}

function corregirApartadoConcreto(id, monto, motivo) {
    const fila = apartadosCorregibles().find(m => m.id === id);
    const centavos = /^0(?:\.0{1,2})?$/.test(String(monto).trim()) ? 0 : convertirPesosACentavos(monto);
    if (!fila || centavos === null || !motivoAjusteValido(motivo)) return false;
    const estado = capturarEstadoDeudas();
    if (fila.tipo === "deuda") {
        const d = estado.deudas.find(d => d.id === fila.destinoId);
        d.aportacionesNomina = d.aportacionesNomina.flatMap(m => m.id !== id ? [m] :
            centavos === 0 ? [] : [{ ...m, montoCentavos: centavos }]);
    } else {
        const g = estado.gruposDeudas.find(g => g.id === fila.destinoId);
        g.movimientosFondo = g.movimientosFondo.flatMap(m => m.origenNomina?.id !== id ? [m] :
            centavos === 0 ? [] : [{ ...m, montoCentavos: centavos }]);
    }
    return guardarAjusteDeudas(estado, motivo);
}

function mostrarAjustesFinancieros() {
    const deudaselect = document.getElementById("ajuste-deuda");
    const anterior = deudaselect.value;
    deudaselect.replaceChildren(new Option("Selecciona una deuda pendiente", ""));
    for (const d of deudas.filter(d => !d.liquidada)) {
        deudaselect.add(new Option(d.nombre + " · Objetivo: " + formatoMoneda.format(d.objetivoCentavos / 100), d.id));
    }
    deudaselect.value = deudas.some(d => !d.liquidada && d.id === anterior) ? anterior : "";
    const apartado = document.getElementById("ajuste-apartado");
    const previo = apartado.value;
    const filas = apartadosCorregibles();
    apartado.replaceChildren(new Option("Selecciona un apartado sin transferir", ""));
    for (const m of filas) apartado.add(new Option(m.nombre + " · " + formatoMoneda.format(m.montoCentavos / 100), m.id));
    apartado.value = filas.some(m => m.id === previo) ? previo : "";
    actualizarPreviaAjuste();
}

function actualizarPreviaAjuste() {
    const d = deudas.find(d => d.id === document.getElementById("ajuste-deuda").value);
    const objetivo = convertirPesosACentavos(document.getElementById("ajuste-objetivo").value);
    document.getElementById("previa-objetivo").textContent = d ?
        "Objetivo actual: " + formatoMoneda.format(d.objetivoCentavos / 100) +
        ". Apartado individual: " + formatoMoneda.format(calcularReservaDeuda(d) / 100) +
        (objetivo ? ". Nuevo objetivo: " + formatoMoneda.format(objetivo / 100) : "") +
        ". Se comprobarán también las reservas y asignaciones del grupo." : "Selecciona una deuda.";
    const m = apartadosCorregibles().find(m => m.id === document.getElementById("ajuste-apartado").value);
    document.getElementById("previa-apartado").textContent = m ?
        "Importe actual: " + formatoMoneda.format(m.montoCentavos / 100) +
        ". El nuevo importe sustituirá al actual; escribe 0 para anularlo. La diferencia ajustará la disponibilidad del origen." :
        "Solo aparecen apartados vinculados a nóminas que todavía se pueden corregir sin deshacer transferencias.";
}

function informarAjuste(ok) {
    const aviso = document.getElementById("mensaje-ajustes");
    aviso.textContent = ok ? "Ajuste guardado con motivo e historial." :
        "No se aplicó. Revisa el motivo, el importe y el guardado. El ajuste no puede exceder el disponible, dejar reservas sin cubrir ni alterar pagos confirmados.";
    aviso.className = ok ? "aviso ok" : "aviso error";
}

document.getElementById("ajuste-deuda").addEventListener("change", actualizarPreviaAjuste);
document.getElementById("ajuste-objetivo").addEventListener("input", actualizarPreviaAjuste);
document.getElementById("ajuste-apartado").addEventListener("change", actualizarPreviaAjuste);
document.getElementById("formulario-ajuste-objetivo").addEventListener("submit", e => {
    e.preventDefault();
    if (!confirm("¿Aplicar el nuevo objetivo? El motivo y los importes anteriores quedarán en el historial.")) return;
    informarAjuste(ajustarObjetivoDeuda(document.getElementById("ajuste-deuda").value,
        document.getElementById("ajuste-objetivo").value, document.getElementById("motivo-objetivo").value));
});
document.getElementById("formulario-ajuste-apartado").addEventListener("submit", e => {
    e.preventDefault();
    if (!confirm("¿Corregir este apartado? Se conservará el estado anterior en el historial.")) return;
    informarAjuste(corregirApartadoConcreto(document.getElementById("ajuste-apartado").value,
        document.getElementById("ajuste-importe").value, document.getElementById("motivo-apartado").value));
});
