//Actividad derivada: no registra dinero ni vuelve a sumar transferencias
function movimientosUnificados() {
    const filas = [];
    const agregar = fila => filas.push({ nominaId: "", categoriaId: "", acreedor: "", estado: "activo", ...fila });
    for (const n of nominas) agregar({ id: "ingreso:" + n.id, tipo: "ingreso", referenciaId: n.id,
        fecha: fechaMovimiento("ingreso", n.id), nombre: n.referencia, monto: n.montoCentavos, nominaId: n.id, fechaTipo: "ingreso" });
    for (const a of mejoras.ingresosAnulados) agregar({ id: "ingreso-anulado:" + a.nomina.id, tipo: "ingreso",
        fecha: fechaMovimiento("ingreso", a.nomina.id), nombre: a.nomina.referencia + " · " + a.motivo,
        monto: a.nomina.montoCentavos, estado: "anulado" });
    for (const g of gastosBasicos) agregar({ id: "gasto:" + g.id, tipo: "gasto", fecha: g.fecha,
        nombre: g.concepto, monto: g.montoCentavos, nominaId: g.nominaId, categoriaId: g.categoriaId,
        detalle: categoriasGastos.find(c => c.id === g.subcategoriaId)?.nombre ?? "", estado: g.anulacion ? "anulado" : "activo" });
    movimientosAhorros.forEach((m, i) => {
        const meta = mejoras.destinosAhorro.find(d => d.movimientoId === m.id)?.metaId;
        agregar({ id: "ahorro:" + (m.id ?? "anterior-" + i), tipo: m.tipo === "aportacion" ? "ahorro" : "retiro",
            fecha: m.id ? fechaMovimiento("ahorro", m.id) : "", nombre: m.concepto, monto: m.montoCentavos,
            referenciaId: m.id, fechaTipo: m.id ? "ahorro" : "", nominaId: m.origenNomina?.nominaId ?? "",
            categoriaId: "ahorro", detalle: mejoras.metas.find(g => g.id === meta)?.nombre ?? "Ahorro general",
            estado: m.anulacion ? "anulado" : "activo" });
    });
    const agregarApartado = (m, nombre) => agregar({ id: "apartado:" + m.id, tipo: "apartado",
        referenciaId: m.id, fechaTipo: "apartado", fecha: fechaMovimiento("apartado", m.id),
        nombre: "Apartado para " + nombre, acreedor: nombre, monto: m.montoCentavos,
        nominaId: m.nominaId, categoriaId: m.categoriaId });
    for (const d of deudas) {
        for (const m of d.aportacionesNomina ?? []) agregarApartado(m, d.nombre);
        if (d.liquidada) agregar({ id: "pago:" + d.id, tipo: "pago", referenciaId: d.id, fechaTipo: "pago",
            fecha: fechaMovimiento("pago", d.id), nombre: "Pago a " + d.nombre, acreedor: d.nombre,
            monto: d.objetivoCentavos, categoriaId: "deudas" });
    }
    for (const g of gruposDeudas) for (const m of g.movimientosFondo ?? []) {
        if (m.tipo === "apartado" && m.origenNomina) agregarApartado({ ...m.origenNomina, montoCentavos: m.montoCentavos }, g.nombre);
    }
    for (const c of mejoras.cambiosIngresos) agregar({ id: "ajuste-ingreso:" + c.id, tipo: "ajuste",
        fecha: c.fecha, nombre: (c.despues ? "Corrección de ingreso: " : "Anulación de ingreso: ") + c.antes.referencia,
        detalle: c.motivo, monto: null });
    for (const c of historialCorrecciones) agregar({ id: "ajuste-deuda:" + c.id, tipo: "ajuste",
        fecha: (() => { const f = new Date(c.fecha); return [f.getFullYear(), String(f.getMonth()+1).padStart(2,"0"), String(f.getDate()).padStart(2,"0")].join("-"); })(), nombre: c.revierteId ? "Corrección de deudas" : describirCambio(c.antes, c.despues),
        detalle: c.motivo, monto: null });
    return filas.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || a.id.localeCompare(b.id));
}
function textoBusqueda(valor) { return String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function filtrarActividad(filas, filtros = {}) {
    const buscar = textoBusqueda(filtros.buscar ?? "").trim();
    return filas.filter(f => (!filtros.tipo || f.tipo === filtros.tipo) &&
        (!filtros.nominaId || f.nominaId === filtros.nominaId) &&
        (!filtros.categoriaId || f.categoriaId === filtros.categoriaId) &&
        (!filtros.estado || f.estado === filtros.estado) &&
        (!filtros.desde || (f.fecha && f.fecha >= filtros.desde)) &&
        (!filtros.hasta || (f.fecha && f.fecha <= filtros.hasta)) &&
        (!buscar || textoBusqueda([f.nombre, f.detalle, f.acreedor,
            nominas.find(n => n.id === f.nominaId)?.referencia ?? ""].join(" ")).includes(buscar)));
}
function resumenMes(mes, filas = movimientosUnificados()) {
    if (!/^\d{4}-\d{2}$/.test(mes) || !fechaGastoValida(mes + "-01")) throw new Error("Selecciona un mes válido.");
    const activas = filas.filter(f => f.estado === "activo" && f.fecha?.slice(0, 7) === mes);
    const sumar = tipo => sumarCentavosResumen(activas.filter(f => f.tipo === tipo).map(f => f.monto));
    return { ingresos: sumar("ingreso"), gastos: sumar("gasto"), ahorro: sumar("ahorro"),
        retiros: sumar("retiro"), apartados: sumar("apartado"), pagos: sumar("pago"),
        sinFecha: filas.filter(f => !f.fecha && f.estado === "activo" && f.tipo !== "ajuste").length };
}
function corregirFechaActividad(tipo, id, fecha) {
    if (!movimientosUnificados().some(f => f.fechaTipo === tipo && f.referenciaId === id)) throw new Error("Movimiento no encontrado.");
    return guardarOperacionMejora(datos => fijarFechaMovimiento(datos.mejoras, tipo, id, fecha));
}
