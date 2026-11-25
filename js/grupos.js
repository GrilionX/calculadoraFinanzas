//Administrar grupos
function motivoImpedimentoTraslado(id, destinoId) {
    const deuda = deudas.find(d => d.id === id);
    const destino = gruposDeudas.find(g => g.id === destinoId);
    if (!deuda || deuda.liquidada) return "Solo puedes mover deudas pendientes.";
    if (destinoId !== null && !destino) return "El grupo de destino no existe.";
    if ((deuda.grupoId ?? null) === destinoId) return "La deuda ya pertenece a ese grupo.";
    if ((deuda.transferencias ?? []).length ||
        gruposDeudas.some(g => (g.movimientosFondo ?? []).some(m => m.deudaId === id))) {
        return "Esta deuda tiene transferencias o asignaciones de fondo. Conserva su grupo para mantener el historial.";
    }
    if (grupoConReservas(deuda.grupoId) || grupoConReservas(destinoId)) {
        return "No se pueden cambiar integrantes de un fondo compartido con reservas.";
    }
    if (destino?.modalidad === "grupo" && calcularReservaDeuda(deuda) > 0) {
        return "Una deuda con apartados individuales no puede entrar en un fondo compartido.";
    }
    return "";
}

function renombrarGrupoDeudas(id, nombre) {
    if (typeof nombre !== "string") return false;
    const estado = capturarEstadoDeudas();
    const grupo = estado.gruposDeudas.find(g => g.id === id);
    if (!grupo) return false;
    const anterior = grupo.nombre;
    grupo.nombre = nombre.trim().replace(/\s+/g, " ");
    return guardarAjusteDeudas(estado, "Renombrar grupo: " + anterior + " → " + grupo.nombre);
}

function trasladarDeudaGrupo(id, destinoId) {
    if (motivoImpedimentoTraslado(id, destinoId)) return false;
    const estado = capturarEstadoDeudas();
    const deuda = estado.deudas.find(d => d.id === id);
    const anterior = gruposDeudas.find(g => g.id === deuda.grupoId)?.nombre ?? "Sin grupo";
    const destino = gruposDeudas.find(g => g.id === destinoId)?.nombre ?? "Sin grupo";
    deuda.grupoId = destinoId;
    return guardarAjusteDeudas(estado, "Mover deuda de " + anterior + " a " + destino);
}

function motivoImpedimentoEliminarGrupo(id) {
    const grupo = gruposDeudas.find(g => g.id === id);
    if (!grupo) return "El grupo ya no existe.";
    if (deudas.some(d => d.grupoId === id)) return "El grupo aún contiene deudas, incluidas las liquidadas.";
    if ((grupo.movimientosFondo ?? []).length || deudas.some(d =>
        (d.transferencias ?? []).some(m => m.grupoId === id))) {
        return "El grupo conserva movimientos de fondo o referencias históricas.";
    }
    return "";
}

function eliminarGrupoVacio(id) {
    if (motivoImpedimentoEliminarGrupo(id)) return false;
    const estado = capturarEstadoDeudas();
    const grupo = estado.gruposDeudas.find(g => g.id === id);
    estado.gruposDeudas = estado.gruposDeudas.filter(g => g.id !== id);
    return guardarAjusteDeudas(estado, "Eliminar grupo vacío: " + grupo.nombre);
}

function mostrarAdministradorGrupos() {
    const grupo = document.getElementById("administrar-grupo");
    const anterior = grupo.value;
    grupo.replaceChildren(new Option("Selecciona un grupo", ""));
    for (const g of gruposDeudas) grupo.add(new Option(g.nombre, g.id));
    grupo.value = gruposDeudas.some(g => g.id === anterior) ? anterior : "";
    const deuda = document.getElementById("trasladar-deuda");
    const anteriorDeuda = deuda.value;
    deuda.replaceChildren(new Option("Selecciona una deuda pendiente", ""));
    for (const d of deudas.filter(d => !d.liquidada)) {
        const nombre = gruposDeudas.find(g => g.id === d.grupoId)?.nombre ?? "Sin grupo";
        deuda.add(new Option(d.nombre + " · " + nombre, d.id));
    }
    deuda.value = deudas.some(d => !d.liquidada && d.id === anteriorDeuda) ? anteriorDeuda : "";
    const destino = document.getElementById("trasladar-destino");
    const anteriorDestino = destino.value;
    destino.replaceChildren(new Option("Sin grupo", ""));
    for (const g of gruposDeudas) destino.add(new Option(g.nombre, g.id));
    destino.value = gruposDeudas.some(g => g.id === anteriorDestino) ? anteriorDestino : "";
    actualizarPreviaGrupo();
}

function actualizarPreviaGrupo() {
    const id = document.getElementById("administrar-grupo").value;
    const grupo = gruposDeudas.find(g => g.id === id);
    document.getElementById("administrar-nombre").value = grupo?.nombre ?? "";
    const bloqueo = motivoImpedimentoEliminarGrupo(id);
    document.getElementById("eliminar-grupo-vacio").disabled = Boolean(bloqueo) || !guardadoHabilitado;
    document.getElementById("estado-administrar-grupo").textContent = grupo ?
        deudas.filter(d => d.grupoId === id).length + " deudas. " + (bloqueo || "Grupo vacío sin movimientos: puedes eliminarlo.") :
        "Selecciona un grupo para cambiar su nombre o revisar si se puede eliminar.";
    actualizarPreviaTraslado();
}

function actualizarPreviaTraslado() {
    const id = document.getElementById("trasladar-deuda").value;
    const destino = document.getElementById("trasladar-destino").value || null;
    const bloqueo = motivoImpedimentoTraslado(id, destino);
    document.getElementById("confirmar-traslado").disabled = Boolean(bloqueo) || !guardadoHabilitado;
    document.getElementById("previa-traslado").textContent = bloqueo ||
        "Se conservarán el objetivo, los apartados individuales y su nómina de origen. No se trasladará dinero de fondos compartidos.";
}

function informarGestionGrupo(ok) {
    const aviso = document.getElementById("mensaje-grupos");
    aviso.textContent = ok ? "Grupo actualizado. Se conservó el historial." :
        "No se aplicó el cambio. Revisa el nombre, las restricciones y el aviso de guardado.";
    aviso.className = ok ? "aviso ok" : "aviso error";
}

document.getElementById("administrar-grupo").addEventListener("change", actualizarPreviaGrupo);
document.getElementById("trasladar-deuda").addEventListener("change", actualizarPreviaTraslado);
document.getElementById("trasladar-destino").addEventListener("change", actualizarPreviaTraslado);
document.getElementById("formulario-renombrar-grupo").addEventListener("submit", e => {
    e.preventDefault();
    informarGestionGrupo(renombrarGrupoDeudas(document.getElementById("administrar-grupo").value,
        document.getElementById("administrar-nombre").value));
});
document.getElementById("eliminar-grupo-vacio").addEventListener("click", async () => {
    const id = document.getElementById("administrar-grupo").value;
    const grupo = gruposDeudas.find(g => g.id === id);
    if (!grupo || !await confirmarBorrado("¿Eliminar el grupo " + grupo.nombre + "?")) return;
    informarGestionGrupo(eliminarGrupoVacio(id));
});
document.getElementById("formulario-trasladar-deuda").addEventListener("submit", e => {
    e.preventDefault();
    if (!confirm("¿Cambiar la deuda al grupo seleccionado? Se conservarán sus importes.")) return;
    informarGestionGrupo(trasladarDeudaGrupo(document.getElementById("trasladar-deuda").value,
        document.getElementById("trasladar-destino").value || null));
});
