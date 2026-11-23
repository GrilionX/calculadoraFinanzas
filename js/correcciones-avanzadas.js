//Reconstrucción de apartados con movimientos posteriores
let planApartadoAvanzado = null;

function apartadosConDependencias() {
    const simples = new Set(apartadosCorregibles().map(m => m.id));
    const filas = [];
    for (const d of deudas) {
        if (d.liquidada) continue;
        for (const m of d.aportacionesNomina ?? []) {
            if (!simples.has(m.id)) filas.push({ ...m, nombre: d.nombre });
        }
    }
    for (const g of gruposDeudas) {
        for (const m of g.movimientosFondo ?? []) {
            if (m.tipo === "apartado" && m.origenNomina && !simples.has(m.origenNomina.id)) {
                filas.push({ ...m.origenNomina, montoCentavos: m.montoCentavos, nombre: g.nombre });
            }
        }
    }
    return filas;
}

function prepararCorreccionAvanzada(id, importe) {
    if (!guardadoHabilitado || reinicioDetectado) throw new Error("Recupera el guardado antes de corregir.");
    const fila = apartadosConDependencias().find(m => m.id === id);
    const centavos = /^0(?:\.0{1,2})?$/.test(String(importe).trim()) ? 0 : convertirPesosACentavos(importe);
    if (!fila || centavos === null) throw new Error("Selecciona un apartado y escribe un importe válido.");
    let estado = capturarEstadoDeudas();
    const afectados = [];
    let encontrada = null;
    for (let i = historialCorrecciones.length - 1; i >= 0; i--) {
        const entrada = historialCorrecciones[i];
        if (!estadosIguales(estado, entrada.despues)) throw new Error("El historial no coincide con los datos actuales.");
        if (cambioIncluyePago(entrada.antes, entrada.despues)) {
            throw new Error("Hay un pago confirmado entre el apartado y el estado actual. No se puede reconstruir desde aquí.");
        }
        afectados.push({ id: entrada.id, fecha: entrada.fecha,
            descripcion: entrada.revierteId ? "Corrección: " + entrada.motivo :
                describirCambio(entrada.antes, entrada.despues),
            deudas: [...new Set([...entrada.antes.deudas, ...entrada.despues.deudas]
                .filter(d => !estadosIguales(entrada.antes.deudas.find(a => a.id === d.id),
                    entrada.despues.deudas.find(a => a.id === d.id))).map(d => d.nombre))] });
        estado = copiar(entrada.antes);
        encontrada = apartadosCorregibles(estado).find(m => m.id === id);
        if (encontrada) break;
    }
    if (!encontrada) throw new Error("No hay un estado anterior seguro para este apartado. Conserva tu copia y revisa el historial.");
    if (encontrada.tipo === "deuda") {
        const d = estado.deudas.find(d => d.id === encontrada.destinoId);
        d.aportacionesNomina = d.aportacionesNomina.flatMap(m => m.id !== id ? [m] :
            centavos === 0 ? [] : [{ ...m, montoCentavos: centavos }]);
    } else {
        const g = estado.gruposDeudas.find(g => g.id === encontrada.destinoId);
        g.movimientosFondo = g.movimientosFondo.flatMap(m => m.origenNomina?.id !== id ? [m] :
            centavos === 0 ? [] : [{ ...m, montoCentavos: centavos }]);
    }
    const limpio = validarEstadoCorreccion(estado, nominas);
    if (!limpio || !validarDisponibilidadCompleta(nominas, limpio.deudas, limpio.gruposDeudas, gastosBasicos) ||
        cambioIncluyePago(capturarEstadoDeudas(), limpio)) {
        throw new Error("El resultado no respeta los objetivos o el saldo disponible. Prueba otro importe.");
    }
    return { id, importe: String(importe), nombre: fila.nombre, anterior: fila.montoCentavos,
        centavos, afectados, estado: limpio, base: JSON.stringify(construirPaquete()),
        disponible: origenComprometido(capturarEstadoDeudas()) - origenComprometido(limpio) };
}

function aplicarCorreccionAvanzada(plan, motivo) {
    if (!plan || !motivoAjusteValido(motivo) || plan.base !== JSON.stringify(construirPaquete())) return false;
    try {
        const nuevo = prepararCorreccionAvanzada(plan.id, plan.importe);
        if (!estadosIguales(plan, nuevo)) return false;
        return guardarAjusteDeudas(nuevo.estado, "Reconstrucción de apartado: " + motivo.trim());
    } catch { return false; }
}

function mostrarApartadosAvanzados() {
    const select = document.getElementById("apartado-avanzado");
    const previo = select.value;
    const filas = apartadosConDependencias();
    select.replaceChildren(new Option("Selecciona un apartado transferido o distribuido", ""));
    for (const m of filas) select.add(new Option(m.nombre + " · " + formatoMoneda.format(m.montoCentavos / 100), m.id));
    if (filas.some(m => m.id === previo)) select.value = previo;
    planApartadoAvanzado = null;
    document.getElementById("aplicar-avanzada").disabled = true;
    document.getElementById("aceptar-avanzada").checked = false;
    document.getElementById("lista-avanzada").replaceChildren();
    document.getElementById("previa-avanzada").textContent = filas.length
        ? "Prepara una vista previa antes de confirmar." : "No hay apartados con transferencias o distribuciones que revisar.";
}

function invalidarPlanAvanzado() {
    planApartadoAvanzado = null;
    document.getElementById("aplicar-avanzada").disabled = true;
    document.getElementById("aceptar-avanzada").checked = false;
    document.getElementById("previa-avanzada").textContent = "Prepara de nuevo la vista previa.";
    document.getElementById("lista-avanzada").replaceChildren();
}
document.getElementById("apartado-avanzado").addEventListener("change", invalidarPlanAvanzado);
document.getElementById("importe-avanzado").addEventListener("input", invalidarPlanAvanzado);
document.getElementById("preparar-avanzada").addEventListener("click", () => {
    invalidarPlanAvanzado();
    try {
        const plan = prepararCorreccionAvanzada(document.getElementById("apartado-avanzado").value,
            document.getElementById("importe-avanzado").value);
        planApartadoAvanzado = plan;
        document.getElementById("previa-avanzada").textContent = plan.nombre + ": " +
            formatoMoneda.format(plan.anterior / 100) + " → " + formatoMoneda.format(plan.centavos / 100) +
            ". Variación del disponible de nóminas: " + formatoMoneda.format(plan.disponible / 100) +
            ". Se revierten los siguientes " + plan.afectados.length + " cambios posteriores, incluidos los independientes:";
        const lista = document.getElementById("lista-avanzada");
        for (const paso of plan.afectados) {
            const li = document.createElement("li");
            li.textContent = new Date(paso.fecha).toLocaleString("es-MX") + " · " + paso.descripcion +
                (paso.deudas.length ? " · " + paso.deudas.join(", ") : "");
            lista.append(li);
        }
        document.getElementById("aplicar-avanzada").disabled = false;
    } catch (error) { document.getElementById("previa-avanzada").textContent = error.message; }
});
document.getElementById("formulario-avanzada").addEventListener("submit", evento => {
    evento.preventDefault();
    if (!document.getElementById("aceptar-avanzada").checked || !planApartadoAvanzado) return;
    if (!confirm("¿Aplicar el apartado corregido y revertir TODOS los cambios mostrados? El historial se conserva y el ahorro no cambia.")) return;
    const ok = aplicarCorreccionAvanzada(planApartadoAvanzado, document.getElementById("motivo-avanzado").value);
    document.getElementById("mensaje-avanzada").textContent = ok
        ? "Reconstrucción guardada. Revisa las reservas antes de volver a distribuir o cambiar la modalidad."
        : "No se aplicó. Los datos pueden haber cambiado; prepara otra vista previa y revisa el motivo.";
    if (ok) mostrarApartadosAvanzados();
});
mostrarApartadosAvanzados();
