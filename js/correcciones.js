//Historial de cambios
let historialCorrecciones = [];
let estadoDeudasGuardado = { deudas: [], gruposDeudas: [] };
let correccionPendiente = null;

function capturarEstadoDeudas() {
    return copiar({ deudas, gruposDeudas });
}

function estadosIguales(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function validarEstadoCorreccion(estado, pagos) {
    if (!estado || !Array.isArray(estado.deudas) ||
        !Array.isArray(estado.gruposDeudas)) return null;
    const ds = limpiarDeudas(estado.deudas);
    const gs = limpiarGruposDeudas(estado.gruposDeudas);
    if (!ds || !gs || ds.some(d => d.grupoId !== null &&
        !gs.some(g => g.id === d.grupoId)) ||
        !validarFondosGrupos(gs, ds) ||
        !validarOrigenesNomina(pagos, ds, gs)) return null;
    return { deudas: ds, gruposDeudas: gs };
}

function cambioIncluyePago(antes, despues) {
    const pagadas = estado => estado.deudas.filter(d => d.liquidada);
    return !estadosIguales(pagadas(antes), pagadas(despues));
}

function describirCambio(antes, despues) {
    if (cambioIncluyePago(antes, despues)) return "Pago confirmado";
    if (antes.deudas.length !== despues.deudas.length ||
        antes.gruposDeudas.length !== despues.gruposDeudas.length) return "Registro de deuda o grupo";
    if (antes.gruposDeudas.some(g => despues.gruposDeudas.some(n =>
        n.id === g.id && n.modalidad !== g.modalidad))) return "Cambio de modalidad";
    if (despues.gruposDeudas.some(g =>
        g.movimientosFondo.filter(m => m.tipo === "asignacion").length >
        (antes.gruposDeudas.find(n => n.id === g.id)?.movimientosFondo ?? [])
            .filter(m => m.tipo === "asignacion").length)) return "Distribución del fondo";
    if (!estadosIguales(obtenerApartadosNomina(antes.deudas, antes.gruposDeudas),
        obtenerApartadosNomina(despues.deudas, despues.gruposDeudas))) return "Apartado de nómina";
    return "Edición de deuda o grupo";
}

function ultimaCorreccionDisponible(lista = historialCorrecciones) {
    const revertidos = new Set(lista.filter(e => e.revierteId).map(e => e.revierteId));
    return [...lista].reverse().find(e => !e.revierteId && !revertidos.has(e.id)) ?? null;
}

function limpiarHistorialCorrecciones(lista, pagos, estadoActual) {
    if (lista === undefined) return [];
    if (!Array.isArray(lista)) return null;
    const limpios = [];
    const ids = new Set();
    for (const entrada of lista) {
        if (!entrada || typeof entrada.id !== "string" || !entrada.id.trim() ||
            ids.has(entrada.id) || typeof entrada.fecha !== "string" ||
            !Number.isFinite(Date.parse(entrada.fecha)) ||
            typeof entrada.motivo !== "string" || entrada.motivo.length > 240 ||
            !(entrada.revierteId === null || typeof entrada.revierteId === "string")) return null;
        const antes = validarEstadoCorreccion(entrada.antes, pagos);
        const despues = validarEstadoCorreccion(entrada.despues, pagos);
        if (!antes || !despues || estadosIguales(antes, despues) ||
            (limpios.length && !estadosIguales(limpios.at(-1).despues, antes))) return null;
        if (entrada.revierteId !== null) {
            const original = ultimaCorreccionDisponible(limpios);
            if (!entrada.motivo.trim() || !original || original.id !== entrada.revierteId ||
                cambioIncluyePago(original.antes, original.despues) ||
                !estadosIguales(antes, original.despues) ||
                !estadosIguales(despues, original.antes)) return null;
        }
        ids.add(entrada.id);
        limpios.push({ id: entrada.id, fecha: entrada.fecha, motivo: entrada.motivo,
            revierteId: entrada.revierteId, antes, despues });
    }
    if (limpios.length && !estadosIguales(limpios.at(-1).despues, estadoActual)) return null;
    return limpios;
}

function prepararHistorialGuardado() {
    const despues = validarEstadoCorreccion(capturarEstadoDeudas(), nominas);
    if (!despues) throw new Error("Las deudas no superaron la validación.");
    if (estadosIguales(estadoDeudasGuardado, despues)) return historialCorrecciones;
    return [...historialCorrecciones, {
        id: generarId(historialCorrecciones.map(e => e.id)),
        fecha: new Date().toISOString(),
        motivo: correccionPendiente?.motivo ?? "",
        revierteId: correccionPendiente?.id ?? null,
        antes: copiar(estadoDeudasGuardado), despues
    }];
}

//Corrección con motivo
function deshacerUltimoCambio(motivo, idEsperado) {
    const entrada = ultimaCorreccionDisponible();
    if (!puedeModificarDeudas() || !entrada || entrada.id !== idEsperado ||
        cambioIncluyePago(entrada.antes, entrada.despues) ||
        !estadosIguales(capturarEstadoDeudas(), entrada.despues)) return false;
    if (typeof motivo !== "string" || !motivo.trim() || motivo.trim().length > 240) return false;
    const anterior = validarEstadoCorreccion(entrada.antes, nominas);
    if (!anterior) return false;
    deudas = anterior.deudas;
    gruposDeudas = anterior.gruposDeudas;
    correccionPendiente = { id: entrada.id, motivo: motivo.trim() };
    let resultado;
    try { resultado = guardar(); }
    finally { correccionPendiente = null; }
    cerrarEditorDeuda();
    mostrarDeudas();
    mostrarHistorialNominas();
    invalidarProyeccionDeudas();
    return resultado;
}

function resumenEstadoCorreccion(estado) {
    const objetivos = construirObjetivosHorizonte(estado.deudas, estado.gruposDeudas);
    return objetivos.reduce((suma, o) => suma + o.apartadoCentavos, 0);
}

function origenComprometido(estado) {
    return obtenerApartadosNomina(estado.deudas, estado.gruposDeudas)
        .reduce((suma, movimiento) => suma + movimiento.montoCentavos, 0);
}

function mostrarHistorialCorrecciones() {
    const lista = document.getElementById("lista-correcciones");
    if (!lista) return;
    lista.replaceChildren();
    for (const entrada of [...historialCorrecciones].reverse().slice(0, 30)) {
        const fila = document.createElement("li");
        fila.textContent = new Date(entrada.fecha).toLocaleString("es-MX") + " · " +
            (entrada.revierteId ? "Corrección: " + entrada.motivo :
                describirCambio(entrada.antes, entrada.despues));
        lista.appendChild(fila);
    }
    const entrada = ultimaCorreccionDisponible();
    const permitido = entrada && !cambioIncluyePago(entrada.antes, entrada.despues) &&
        estadosIguales(capturarEstadoDeudas(), entrada.despues);
    const boton = document.getElementById("deshacer-cambio");
    boton.disabled = !permitido || !guardadoHabilitado;
    boton.dataset.entradaId = permitido ? entrada.id : "";
    document.getElementById("vista-previa-correccion").textContent = !entrada
        ? "Los nuevos cambios aparecerán aquí. Los movimientos anteriores a esta versión se conservan, pero no se pueden deshacer desde este panel."
        : !permitido ? "El último cambio incluye un pago confirmado o no coincide con los datos actuales. No se puede deshacer."
        : "Deshacer: " + describirCambio(entrada.antes, entrada.despues) +
          ". Reserva para deudas: " + formatoMoneda.format(resumenEstadoCorreccion(entrada.despues) / 100) +
          " → " + formatoMoneda.format(resumenEstadoCorreccion(entrada.antes) / 100) +
          ". Disponibilidad que vuelve a las nóminas: " +
          formatoMoneda.format((origenComprometido(entrada.despues) - origenComprometido(entrada.antes)) / 100) +
          ". Se restauran los importes, nombres y modalidad anteriores. El ahorro personal no cambia.";
}

document.getElementById("formulario-correccion").addEventListener("submit", function (evento) {
    evento.preventDefault();
    const motivo = document.getElementById("motivo-correccion");
    const id = document.getElementById("deshacer-cambio").dataset.entradaId;
    if (!motivo.value.trim() || !confirm("¿Deshacer el cambio mostrado? El motivo quedará en el historial.")) return;
    const correcto = deshacerUltimoCambio(motivo.value, id);
    document.getElementById("mensaje-correccion").textContent = correcto
        ? "Corrección guardada. Se conservó la operación original en el historial."
        : "No se pudo aplicar la corrección. Revisa el estado del guardado.";
    if (correcto) motivo.value = "";
});
