//Resumen de dinero registrado
function sumarCentavosResumen(valores) {
    let total = 0;
    for (const valor of valores) {
        if (!Number.isSafeInteger(valor)) throw new Error("Hay un importe inválido.");
        total += valor;
        if (!Number.isSafeInteger(total)) throw new Error("El total supera el límite de cálculo seguro.");
    }
    return total;
}

function calcularResumenFinanciero(nominaId = "") {
    const pagos = nominaId ? nominas.filter(n => n.id === nominaId) : nominas;
    if (nominaId && !pagos.length) throw new Error("La nómina seleccionada no existe.");
    const ids = new Set(pagos.map(n => n.id));
    const sumar = sumarCentavosResumen;
    const ingresos = sumar(pagos.map(n => n.montoCentavos));
    const pagosTarjeta = gestion.tarjetas.flatMap(t => t.compras.flatMap(c => c.pagos)).filter(p => ids.has(p.nominaId));
    const gastos = sumar([...gastosBasicos.filter(g => !g.anulacion && ids.has(g.nominaId)).map(g => g.montoCentavos), ...pagosTarjeta.map(p => p.montoCentavos)]);
    const destinadoBasicos = sumar(gestion.apartados.flatMap(a => a.aportes).filter(p => ids.has(p.nominaId)).map(p => p.montoCentavos));
    const ahorroDestinado = sumar(compromisosAhorro().filter(m => ids.has(m.nominaId)).map(m => m.montoCentavos));
    const destinadoDeudas = sumar(obtenerApartadosNomina().filter(m => ids.has(m.nominaId)).map(m => m.montoCentavos));
    const filas = [];
    const compromisos = obtenerCompromisosNomina();
    for (const pago of pagos) {
        for (const categoria of pago.reparto) {
            const saldo = calcularDisponibleCategoria(pago, categoria.id, compromisos);
            filas.push({ nomina: pago.referencia, categoria: categoria.nombre, ...saldo });
        }
    }
    const disponible = sumar(filas.map(f => f.disponibleCentavos));
    if (sumar([gastos, ahorroDestinado, destinadoDeudas, destinadoBasicos, disponible]) !== ingresos) {
        throw new Error("El reparto no coincide con las nóminas registradas.");
    }
    //Los saldos actuales incluyen datos anteriores sin nómina vinculada.
    const fondosBasicos = saldosApartados();
    const ahorroActual = sumar([calcularSaldoAhorro(movimientosAhorros), fondosBasicos.emergencia, fondosBasicos.efectivo]);
    if (!Number.isSafeInteger(ahorroActual) || ahorroActual < 0) throw new Error("El ahorro no es válido.");
    const reservasIndividuales = deudas.filter(d => !d.liquidada).map(d => {
        const reserva = calcularReservaDeuda(d);
        if (reserva === null) throw new Error("Una reserva no es válida.");
        return reserva;
    });
    const fondos = gruposDeudas.map(g => {
        const resumen = resumirFondoGrupo(g);
        if (!resumen) throw new Error("Un fondo no es válido.");
        return resumen.fondoCentavos;
    });
    const reservasActuales = sumar([...reservasIndividuales, ...fondos]);
    const deudaPendiente = sumar(deudas.filter(d => !d.liquidada).map(d => d.objetivoCentavos));
    const pagadoDeudas = sumar(deudas.filter(d => d.liquidada).map(d => d.objetivoCentavos));
    return { ingresos, gastos, destinadoBasicos, ahorroDestinado, destinadoDeudas, disponible, filas,
        ahorroActual, reservasActuales, deudaPendiente, pagadoDeudas,
        faltaReunir: deudaPendiente - reservasActuales,
        retirosAhorro: sumar(movimientosAhorros.filter(m => m.tipo === "retiro" && !m.anulacion).map(m => m.montoCentavos)) };
}

function mostrarResumenFinanciero() {
    const selector = document.getElementById("resumen-nomina");
    const anterior = selector.value;
    selector.replaceChildren(new Option("Todas mis nóminas", ""));
    for (const n of [...nominas].reverse()) selector.add(new Option(n.referencia, n.id));
    selector.value = nominas.some(n => n.id === anterior) ? anterior : "";
    const mensaje = document.getElementById("mensaje-resumen-financiero");
    const cuerpo = document.getElementById("filas-resumen-financiero");
    cuerpo.replaceChildren();
    try {
        const r = calcularResumenFinanciero(selector.value);
        for (const clave of ["ingresos", "gastos", "destinadoBasicos", "ahorroDestinado", "destinadoDeudas", "disponible",
            "ahorroActual", "reservasActuales", "deudaPendiente", "pagadoDeudas", "faltaReunir", "retirosAhorro"]) {
            document.getElementById("resumen-" + clave).textContent = formatoMoneda.format(r[clave] / 100);
        }
        for (const fila of r.filas) {
            const tr = document.createElement("tr");
            for (const valor of [fila.nomina, fila.categoria, formatoMoneda.format(fila.asignadoCentavos / 100),
                formatoMoneda.format(fila.utilizadoCentavos / 100), formatoMoneda.format(fila.disponibleCentavos / 100)]) {
                const td = document.createElement("td"); td.textContent = valor; tr.appendChild(td);
            }
            cuerpo.appendChild(tr);
        }
        mensaje.textContent = r.filas.length ? "Totales actualizados con movimientos registrados." :
            "Registra tu primera nómina para ver su reparto. El simulador no añade ingresos a este resumen.";
        mensaje.className = "ayuda";
    } catch (error) {
        for (const tarjeta of document.querySelectorAll("#resumen-financiero strong")) tarjeta.textContent = "—";
        mensaje.textContent = "No se pudo calcular el resumen: " + error.message;
        mensaje.className = "aviso error";
    }
}
document.getElementById("resumen-nomina").addEventListener("change", mostrarResumenFinanciero);
