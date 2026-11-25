//Edición de ingresos sin alterar dinero utilizado
function dependenciasIngreso(id, datos = construirPaquete()) {
    const tipos = [];
    if (compromisosGestion(datos.gestion).some(x => x.nominaId === id)) tipos.push("tarjetas o apartados básicos");
    if (datos.gastosBasicos.some(g => g.nominaId === id)) tipos.push("gastos (incluidas anulaciones)");
    if (datos.movimientosAhorros.some(m => m.origenNomina?.nominaId === id)) tipos.push("ahorro");
    if (obtenerApartadosNomina(datos.deudas, datos.gruposDeudas).some(a => a.nominaId === id)) tipos.push("apartados de deudas");
    if (datos.historialCorrecciones.some(e => [e.antes, e.despues].some(s =>
        obtenerApartadosNomina(s.deudas, s.gruposDeudas).some(a => a.nominaId === id)))) tipos.push("historial de deudas");
    return tipos;
}
function editarIngreso(id, campos, motivo, baseEsperada) {
    return guardarOperacionMejora(datos => {
        const n = datos.nominas.find(n => n.id === id);
        if (!n || !motivoAjusteValido(motivo) || !textoMejora(campos.referencia, 80) ||
            !fechaGastoValida(campos.fecha) || !Object.hasOwn(PERIODOS_NOMINA, campos.periodo)) throw new Error("Revisa los datos y el motivo.");
        if (baseEsperada && JSON.stringify(n) !== baseEsperada) throw new Error("El ingreso cambió. Vuelve a seleccionarlo.");
        const monto = convertirPesosACentavos(campos.monto);
        if (monto === null) throw new Error("El importe debe ser positivo.");
        const reparto = repartirNomina(monto, campos.reparto ?? n.reparto);
        const cambiaDinero = monto !== n.montoCentavos || !estadosIguales(reparto, n.reparto);
        const dependencias = dependenciasIngreso(id, datos);
        if (cambiaDinero && dependencias.length) throw new Error("Este ingreso tiene " + dependencias.join(", ") +
            ". Solo puedes corregir nombre, fecha y periodo. Su importe y reparto permanecen protegidos.");
        const antes = copiar(n);
        Object.assign(n, { referencia: campos.referencia.trim(), periodo: campos.periodo, montoCentavos: monto, reparto });
        fijarFechaMovimiento(datos.mejoras, "ingreso", id, campos.fecha);
        datos.mejoras.cambiosIngresos.push({ id: generarId(datos.mejoras.cambiosIngresos.map(c => c.id)),
            fecha: fechaLocalGasto(), motivo: motivo.trim(), antes, despues: copiar(n) });
    });
}
function anularIngreso(id, motivo, baseEsperada) {
    return guardarOperacionMejora(datos => {
        const n = datos.nominas.find(n => n.id === id);
        if (!n || !motivoAjusteValido(motivo)) throw new Error("Selecciona un ingreso y explica el motivo.");
        if (baseEsperada && JSON.stringify(n) !== baseEsperada) throw new Error("El ingreso cambió. Vuelve a seleccionarlo.");
        const dependencias = dependenciasIngreso(id, datos);
        if (dependencias.length) throw new Error("No se puede anular: tiene " + dependencias.join(", ") + ". Se conservan sus referencias.");
        datos.mejoras.ingresosAnulados.push({ nomina: copiar(n), fecha: fechaLocalGasto(), motivo: motivo.trim() });
        datos.mejoras.cambiosIngresos.push({ id: generarId(datos.mejoras.cambiosIngresos.map(c => c.id)),
            fecha: fechaLocalGasto(), motivo: motivo.trim(), antes: copiar(n), despues: null });
        datos.nominas = datos.nominas.filter(n => n.id !== id);
    });
}
