//Datos complementarios y operaciones completas
let mejoras = mejorasIniciales();
let baseFechasMejoras = { nominas: [], movimientosAhorros: [], deudas: [], gruposDeudas: [] };

function mejorasIniciales() {
    return { version: 1, fechas: [], vencimientos: [], metas: [], destinosAhorro: [],
        recurrentes: [], ingresosAnulados: [], cambiosIngresos: [] };
}
function textoMejora(valor, maximo = 120) {
    return typeof valor === "string" && valor.trim().length > 0 && valor.trim().length <= maximo;
}
function idMejora(id) { return textoMejora(id, 160); }
function fechaMovimiento(tipo, id, datos = mejoras) {
    return datos.fechas.find(f => f.tipo === tipo && f.id === id)?.fecha ?? "";
}
function fijarFechaMovimiento(datos, tipo, id, fecha) {
    if (!fechaGastoValida(fecha)) throw new Error("Selecciona una fecha válida.");
    datos.fechas = datos.fechas.filter(f => f.tipo !== tipo || f.id !== id);
    datos.fechas.push({ tipo, id, fecha });
}
function nombreFecha(fecha) {
    return fecha ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "UTC" })
        .format(new Date(fecha + "T12:00:00Z")) : "Sin fecha";
}
function sumarSeguroMejora(a, b) {
    const total = a + b;
    if (!Number.isSafeInteger(total)) throw new Error("Importe fuera del límite seguro.");
    return total;
}
function saldosMetas(datos = mejoras, movimientos = movimientosAhorros) {
    const saldos = new Map([["", 0], ...datos.metas.map(m => [m.id, 0])]);
    const destino = new Map(datos.destinosAhorro.map(d => [d.movimientoId, d.metaId]));
    for (const m of movimientos) {
        if (m.anulacion) continue;
        const meta = destino.get(m.id) ?? "";
        if (!saldos.has(meta)) throw new Error("No existe la meta de este movimiento.");
        const saldo = sumarSeguroMejora(saldos.get(meta), m.tipo === "aportacion" ? m.montoCentavos : -m.montoCentavos);
        if (saldo < 0) throw new Error("El retiro o la corrección dejaría una meta o el ahorro general sin saldo.");
        saldos.set(meta, saldo);
    }
    return saldos;
}
function limpiarMejoras(valor, paquete) {
    if (valor === undefined) return mejorasIniciales();
    if (!valor || valor.version !== 1) return null;
    const campos = ["fechas", "vencimientos", "metas", "destinosAhorro", "recurrentes", "ingresosAnulados", "cambiosIngresos"];
    if (campos.some(c => !Array.isArray(valor[c]))) return null;
    const d = copiar(valor);
    const unicos = (lista, clave) => new Set(lista.map(clave)).size === lista.length;
    try {
        if (d.fechas.some(f => !f || !["ingreso", "ahorro", "apartado", "pago"].includes(f.tipo) ||
            !idMejora(f.id) || !fechaGastoValida(f.fecha)) || !unicos(d.fechas, f => f.tipo + ":" + f.id)) return null;
        if (d.vencimientos.some(v => !v || !idMejora(v.deudaId) || !fechaGastoValida(v.fecha)) ||
            !unicos(d.vencimientos, v => v.deudaId)) return null;
        if (d.metas.some(m => !m || !idMejora(m.id) || !textoMejora(m.nombre, 60) ||
            !Number.isSafeInteger(m.objetivoCentavos) || m.objetivoCentavos <= 0 || typeof m.archivada !== "boolean") ||
            !unicos(d.metas, m => m.id) || !unicos(d.metas, m => m.nombre.trim().toLocaleLowerCase("es"))) return null;
        if (d.destinosAhorro.some(a => !a || !paquete.movimientosAhorros.some(m => m.id === a.movimientoId) ||
            !d.metas.some(m => m.id === a.metaId)) || !unicos(d.destinosAhorro, a => a.movimientoId)) return null;
        saldosMetas(d, paquete.movimientosAhorros);
        const gastosIds = new Set(paquete.gastosBasicos.map(g => g.id));
        const confirmados = new Set();
        for (const r of d.recurrentes) {
            if (!r || !idMejora(r.id) || !textoMejora(r.nombre) || !fechaGastoValida(r.inicio) ||
                !["semanal", "catorcenal", "mensual", "anual"].includes(r.frecuencia) ||
                !Number.isSafeInteger(r.montoCentavos) || r.montoCentavos <= 0 || typeof r.pausada !== "boolean" ||
                !paquete.categoriasGastos.some(c => c.id === r.subcategoriaId && c.categoriaId === r.categoriaId) ||
                !Array.isArray(r.ocurrencias)) return null;
            for (let i = 0; i < r.ocurrencias.length; i++) {
                const o = r.ocurrencias[i];
                if (!o || o.indice !== i || !fechaGastoValida(o.fecha) ||
                    !["pagado", "omitido"].includes(o.estado)) return null;
                if (o.estado === "pagado") {
                    const gasto = paquete.gastosBasicos.find(g => g.id === o.gastoId);
                    if (!gastosIds.has(o.gastoId) || confirmados.has(o.gastoId) || gasto.fecha !== o.fecha ||
                        gasto.categoriaId !== r.categoriaId || gasto.subcategoriaId !== r.subcategoriaId ||
                        gasto.montoCentavos !== r.montoCentavos) return null;
                    confirmados.add(o.gastoId);
                } else if (o.gastoId !== null) return null;
            }
        }
        if (!unicos(d.recurrentes, r => r.id)) return null;
        for (const r of d.recurrentes) if (!fechaGastoValida(fechaOcurrencia(r))) return null;
        if (!unicos(d.ingresosAnulados, a => a.nomina?.id)) return null;
        for (const a of d.ingresosAnulados) {
            if (!a || !textoMejora(a.motivo, 240) || !fechaGastoValida(a.fecha) ||
                !limpiarNominas([a.nomina]) || paquete.nominas.some(n => n.id === a.nomina.id)) return null;
        }
        if (d.cambiosIngresos.some(c => !c || !idMejora(c.id) || !fechaGastoValida(c.fecha) ||
            !textoMejora(c.motivo, 240) || !limpiarNominas([c.antes]) ||
            (c.despues !== null && (!limpiarNominas([c.despues]) || c.despues.id !== c.antes.id))) ||
            !unicos(d.cambiosIngresos, c => c.id)) return null;
        return d;
    } catch { return null; }
}
function prepararFechasNuevas(paquete, anterior) {
    const datos = copiar(paquete.mejoras);
    const hoy = fechaLocalGasto();
    const agregar = (tipo, nuevos, viejos, fecha) => {
        const ids = new Set(viejos.map(n => n.id));
        for (const n of nuevos) if (n.id && !ids.has(n.id) && !fechaMovimiento(tipo, n.id, datos)) {
            fijarFechaMovimiento(datos, tipo, n.id, fecha || hoy);
        }
    };
    agregar("ingreso", paquete.nominas, anterior.nominas ?? [], document.getElementById("fecha-nomina")?.value);
    agregar("ahorro", paquete.movimientosAhorros, anterior.movimientosAhorros ?? [], document.getElementById("fecha-ahorro")?.value);
    agregar("apartado", obtenerApartadosNomina(paquete.deudas, paquete.gruposDeudas),
        obtenerApartadosNomina(anterior.deudas ?? [], anterior.gruposDeudas ?? []), document.getElementById("fecha-apartado")?.value);
    agregar("pago", paquete.deudas.filter(d => d.liquidada), (anterior.deudas ?? []).filter(d => d.liquidada), hoy);
    return datos;
}
function guardarOperacionMejora(modificar) {
    if (!guardadoHabilitado || reinicioDetectado) throw new Error("Recupera el guardado antes de continuar.");
    const anterior = copiar(construirPaquete());
    const siguiente = copiar(anterior);
    modificar(siguiente);
    if (!aplicarDatos(siguiente, true)) throw new Error("El cambio no es compatible con los saldos o movimientos relacionados.");
    aplicarDatos(siguiente);
    if (!guardar()) {
        aplicarDatos(anterior);
        refrescarPantallasMejoras();
        throw new Error("No se pudo guardar. Se conserva el estado anterior.");
    }
    refrescarPantallasMejoras();
    return true;
}
function refrescarPantallasMejoras() {
    mostrarHistorialNominas(); mostrarDeudas(); mostrarAhorro(); mostrarDisponibleOrigen();
    if (typeof mostrarPanelesMejoras === "function") mostrarPanelesMejoras();
}
