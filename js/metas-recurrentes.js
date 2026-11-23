//Metas: una clasificación del mismo ahorro personal
function guardarMetaAhorro(id, nombre, importe) {
    const objetivo = convertirPesosACentavos(importe);
    if (!textoMejora(nombre, 60) || objetivo === null) throw new Error("Escribe un nombre y un objetivo positivo.");
    return guardarOperacionMejora(datos => {
        const meta = id ? datos.mejoras.metas.find(m => m.id === id) : null;
        if (id && !meta) throw new Error("La meta ya no existe.");
        if (meta) Object.assign(meta, { nombre: nombre.trim(), objetivoCentavos: objetivo });
        else datos.mejoras.metas.push({ id: generarId(datos.mejoras.metas.map(m => m.id)),
            nombre: nombre.trim(), objetivoCentavos: objetivo, archivada: false });
    });
}
function archivarMetaAhorro(id, archivada) {
    return guardarOperacionMejora(datos => {
        const meta = datos.mejoras.metas.find(m => m.id === id);
        if (!meta) throw new Error("La meta no existe.");
        if (archivada && saldosMetas(datos.mejoras, datos.movimientosAhorros).get(id) !== 0) {
            throw new Error("Una meta con saldo no se archiva. Reasigna sus movimientos o retira su ahorro primero.");
        }
        meta.archivada = archivada;
    });
}
function asignarMovimientoMeta(movimientoId, metaId) {
    return guardarOperacionMejora(datos => {
        if (!datos.movimientosAhorros.some(m => m.id === movimientoId && !m.anulacion)) throw new Error("El movimiento no está activo.");
        if (metaId && !datos.mejoras.metas.some(m => m.id === metaId && !m.archivada)) throw new Error("La meta no está activa.");
        datos.mejoras.destinosAhorro = datos.mejoras.destinosAhorro.filter(a => a.movimientoId !== movimientoId);
        if (metaId) datos.mejoras.destinosAhorro.push({ movimientoId, metaId });
        saldosMetas(datos.mejoras, datos.movimientosAhorros);
    });
}
function fechaOcurrencia(r, indice = r.ocurrencias.length) {
    const [anio, mes, dia] = r.inicio.split("-").map(Number);
    const fecha = new Date(r.inicio + "T12:00:00Z");
    if (r.frecuencia === "semanal" || r.frecuencia === "catorcenal") {
        fecha.setUTCDate(fecha.getUTCDate() + indice * (r.frecuencia === "semanal" ? 7 : 14));
    } else {
        const meses = (mes - 1) + indice * (r.frecuencia === "mensual" ? 1 : 12);
        const ultimo = new Date(Date.UTC(anio, meses + 1, 0, 12)).getUTCDate();
        fecha.setUTCFullYear(anio, meses, Math.min(dia, ultimo));
    }
    const resultado = fecha.toISOString().slice(0, 10);
    if (!fechaGastoValida(resultado)) throw new Error("Fecha fuera del calendario admitido.");
    return resultado;
}
function crearGastoRecurrente(campos) {
    const monto = convertirPesosACentavos(campos.monto);
    if (monto === null || !textoMejora(campos.nombre) || !fechaGastoValida(campos.inicio)) throw new Error("Revisa el nombre, importe y fecha.");
    return guardarOperacionMejora(datos => {
        const c = datos.categoriasGastos.find(c => c.id === campos.subcategoriaId && !c.archivada);
        if (!c) throw new Error("Crea o reactiva una categoría de gastos primero.");
        if (datos.mejoras.recurrentes.some(r => !r.pausada && r.nombre.toLocaleLowerCase("es") === campos.nombre.trim().toLocaleLowerCase("es") &&
            r.inicio === campos.inicio && r.frecuencia === campos.frecuencia && r.subcategoriaId === c.id && r.montoCentavos === monto)) {
            throw new Error("Ya existe esta programación activa. Revisa sus pagos pendientes.");
        }
        datos.mejoras.recurrentes.push({ id: generarId(datos.mejoras.recurrentes.map(r => r.id)),
            nombre: campos.nombre.trim(), montoCentavos: monto, categoriaId: c.categoriaId, subcategoriaId: c.id,
            inicio: campos.inicio, frecuencia: campos.frecuencia, pausada: false, ocurrencias: [] });
    });
}
function pausarRecurrente(id, pausada) {
    return guardarOperacionMejora(datos => {
        const r = datos.mejoras.recurrentes.find(r => r.id === id);
        if (!r) throw new Error("El gasto recurrente no existe.");
        r.pausada = pausada;
    });
}
function confirmarRecurrente(id, indiceEsperado, nominaId, fecha, omitir = false) {
    return guardarOperacionMejora(datos => {
        const r = datos.mejoras.recurrentes.find(r => r.id === id);
        if (!r || r.pausada || r.ocurrencias.length !== indiceEsperado) throw new Error("Esta ocurrencia ya cambió o está pausada.");
        const programada = fechaOcurrencia(r);
        if (programada > fechaLocalGasto()) throw new Error("Todavía no llega la fecha de este gasto.");
        if (!fechaGastoValida(fecha) || fecha > fechaLocalGasto()) throw new Error("La fecha de pago no puede estar en el futuro.");
        if (omitir) {
            r.ocurrencias.push({ indice: indiceEsperado, estado: "omitido", fecha: programada, gastoId: null });
            return;
        }
        const c = datos.categoriasGastos.find(c => c.id === r.subcategoriaId && !c.archivada);
        if (!c) throw new Error("Reactiva la categoría antes de registrar el pago.");
        const idGasto = generarId([...datos.gastosBasicos.map(g => g.id),
            ...obtenerCompromisosNomina().map(m => m.id)]);
        datos.gastosBasicos.push({ id: idGasto, nominaId, categoriaId: r.categoriaId, subcategoriaId: r.subcategoriaId,
            concepto: r.nombre, fecha, montoCentavos: r.montoCentavos, anulacion: null });
        r.ocurrencias.push({ indice: indiceEsperado, estado: "pagado", fecha, gastoId: idGasto });
    });
}
function guardarVencimiento(deudaId, fecha) {
    if (fecha && !fechaGastoValida(fecha)) throw new Error("Fecha no válida.");
    return guardarOperacionMejora(datos => {
        if (!datos.deudas.some(d => d.id === deudaId && !d.liquidada)) throw new Error("Selecciona una deuda pendiente.");
        datos.mejoras.vencimientos = datos.mejoras.vencimientos.filter(v => v.deudaId !== deudaId);
        if (fecha) datos.mejoras.vencimientos.push({ deudaId, fecha });
    });
}
function estadoVencimiento(fecha, hoy = fechaLocalGasto()) {
    if (!fecha) return { texto: "Sin vencimiento", clase: "neutral" };
    const dias = Math.round((Date.parse(fecha + "T12:00:00Z") - Date.parse(hoy + "T12:00:00Z")) / 86400000);
    return dias < 0 ? { texto: "Vencida hace " + Math.abs(dias) + " días", clase: "urgente" } :
        dias === 0 ? { texto: "Vence hoy", clase: "urgente" } :
        { texto: "Vence en " + dias + " días", clase: dias <= 7 ? "proxima" : "neutral" };
}
