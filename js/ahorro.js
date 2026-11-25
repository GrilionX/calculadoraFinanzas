//Origen y correcciones del ahorro
function limpiarRegistroAhorro(lista = []) {
    if (!Array.isArray(lista)) return null;
    let saldo = 0;
    const ids = new Set(), resultado = [];
    for (const m of lista) {
        if (!m || !["aportacion", "retiro"].includes(m.tipo) ||
            typeof m.concepto !== "string" || !m.concepto.trim() || m.concepto.trim().length > 80 ||
            !Number.isSafeInteger(m.montoCentavos) || m.montoCentavos <= 0) return null;
        const limpio = { tipo: m.tipo, concepto: m.concepto.trim(), montoCentavos: m.montoCentavos };
        if (m.id !== undefined) {
            if (typeof m.id !== "string" || !m.id.trim() || ids.has(m.id)) return null;
            ids.add(m.id); limpio.id = m.id;
        }
        if (m.origenNomina !== undefined) {
            const o = m.origenNomina;
            if (m.tipo !== "aportacion" || !m.id || !o || typeof o.nominaId !== "string" ||
                !o.nominaId.trim() || o.categoriaId !== "ahorro") return null;
            limpio.origenNomina = { nominaId: o.nominaId, categoriaId: "ahorro" };
        }
        if (m.anulacion !== undefined) {
            const a = m.anulacion;
            if (!m.id || !a || typeof a.motivo !== "string" || !a.motivo.trim() ||
                a.motivo.trim().length > 240 || typeof a.fecha !== "string" ||
                !Number.isFinite(Date.parse(a.fecha))) return null;
            limpio.anulacion = { motivo: a.motivo.trim(), fecha: a.fecha };
        }
        if (!limpio.anulacion) saldo += m.tipo === "aportacion" ? m.montoCentavos : -m.montoCentavos;
        if (!Number.isSafeInteger(saldo) || saldo < 0) return null;
        resultado.push(limpio);
    }
    return resultado;
}

function compromisosAhorro(lista = movimientosAhorros) {
    return lista.filter(m => m.origenNomina && !m.anulacion).map(m => ({
        id: m.id, ...m.origenNomina, montoCentavos: m.montoCentavos
    }));
}

function validarOrigenAhorro(lista, pagos) {
    return lista.every(m => !m.origenNomina || pagos.some(n => n.id === m.origenNomina.nominaId &&
        n.reparto.some(c => c.id === m.origenNomina.categoriaId)));
}

function guardarCambioAhorro(lista) {
    if (!guardadoHabilitado || reinicioDetectado) return false;
    const limpia = limpiarRegistroAhorro(lista);
    if (!limpia || !validarOrigenAhorro(limpia, nominas) ||
        !validarDisponibilidadCompleta(nominas, deudas, gruposDeudas, gastosBasicos, limpia)) return false;
    const anterior = movimientosAhorros;
    movimientosAhorros = limpia;
    if (!guardar()) { movimientosAhorros = anterior; mostrarAhorro(); actualizarOrigenAhorro(); return false; }
    mostrarAhorro(); mostrarHistorialNominas(); mostrarDisponibleOrigen();
    return true;
}

function registrarAhorroVinculado(tipo, concepto, monto, nominaId, metaId = "", fecha = fechaLocalGasto()) {
    const centavos = convertirPesosACentavos(monto);
    if (centavos === null || !["aportacion", "retiro"].includes(tipo) || !fechaGastoValida(fecha)) return false;
    const movimiento = { id: generarId([...obtenerCompromisosNomina().map(m => m.id),
        ...movimientosAhorros.map(m => m.id).filter(Boolean)]), tipo, concepto, montoCentavos: centavos };
    if (tipo === "aportacion") movimiento.origenNomina = { nominaId, categoriaId: "ahorro" };
    try {
        return guardarOperacionMejora(datos => {
            if (metaId && !datos.mejoras.metas.some(m => m.id === metaId && !m.archivada)) throw new Error("Meta no disponible.");
            datos.movimientosAhorros.push(movimiento);
            if (metaId) datos.mejoras.destinosAhorro.push({ movimientoId: movimiento.id, metaId });
            fijarFechaMovimiento(datos.mejoras, "ahorro", movimiento.id, fecha);
        });
    } catch { return false; }
}

function anularMovimientoAhorro(id, motivo) {
    const m = movimientosAhorros.find(m => m.id === id);
    if (!m || m.anulacion || typeof motivo !== "string" || !motivo.trim() || motivo.trim().length > 240) return false;
    return guardarCambioAhorro(movimientosAhorros.map(m => m.id === id ?
        { ...m, anulacion: { motivo: motivo.trim(), fecha: new Date().toISOString() } } : m));
}

function actualizarOrigenAhorro() {
    const selector = document.getElementById("ahorro-nomina");
    const anterior = selector.value;
    selector.replaceChildren(new Option("Selecciona una nómina", ""));
    const pagos = nominas.filter(n => n.reparto.some(c => c.id === "ahorro"));
    for (const n of [...pagos].reverse()) selector.add(new Option(n.referencia, n.id));
    selector.value = pagos.some(n => n.id === anterior) ? anterior : "";
    const retiro = campoTipoAhorro.value === "retiro";
    selector.disabled = retiro;
    selector.required = !retiro;
    const n = nominas.find(n => n.id === selector.value);
    let texto = retiro ? "El retiro sale del ahorro personal. No devuelve dinero al disponible de la nómina." :
        "Selecciona la nómina cuya categoría Ahorro financiará esta aportación.";
    if (!retiro && n) {
        const saldo = calcularDisponibleCategoria(n, "ahorro", obtenerCompromisosNomina());
        texto = "Disponible para ahorrar: " + formatoMoneda.format(saldo.disponibleCentavos / 100);
    }
    document.getElementById("ahorro-origen-disponible").textContent = texto;
}

function detalleOrigenAhorro(movimiento, elemento) {
    const nota = document.createElement("p");
    nota.textContent = movimiento.origenNomina ? "Origen: " + describirOrigenNomina(movimiento.origenNomina) :
        movimiento.tipo === "aportacion" ? "Ahorro anterior sin nómina vinculada." : "Retiro de ahorro personal.";
    elemento.appendChild(nota);
    if (movimiento.anulacion) {
        nota.textContent += " · Anulado: " + movimiento.anulacion.motivo;
    } else if (movimiento.id) {
        const boton = document.createElement("button");
        boton.type = "button"; boton.textContent = "Anular movimiento";
        boton.addEventListener("click", async () => {
                if (!await confirmarBorrado("¿Eliminar este movimiento?")) return;
                const motivo = "Eliminado por el usuario";
            const ok = anularMovimientoAhorro(movimiento.id, motivo);
            mensajeAhorro.textContent = ok ? "Movimiento anulado y saldos actualizados." :
                "No se pudo anular: revisa el motivo, los retiros posteriores y el guardado.";
            mensajeAhorro.className = ok ? "aviso ok" : "aviso error";
        });
        elemento.appendChild(boton);
    }
}

document.getElementById("ahorro-nomina").addEventListener("change", actualizarOrigenAhorro);
document.getElementById("tipo-movimiento-ahorro").addEventListener("change", actualizarOrigenAhorro);
