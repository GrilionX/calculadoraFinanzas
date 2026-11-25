//Componentes compartidos de los nuevos paneles
const uiMejora = id => document.getElementById(id);
let baseEditorIngreso = "";
let limiteActividad = 40;
function elementoMejora(etiqueta, texto, clase = "") {
    const e = document.createElement(etiqueta);
    if (texto !== undefined) e.textContent = texto;
    if (clase) e.className = clase;
    return e;
}
function opcionesMejora(id, items, inicial) {
    const select = uiMejora(id), anterior = select.value;
    select.replaceChildren(new Option(inicial, ""));
    for (const [valor, texto] of items) select.add(new Option(texto, valor));
    if (items.some(([valor]) => valor === anterior)) select.value = anterior;
}
function informarMejora(id, accion, exito) {
    const aviso = uiMejora(id);
    try {
        accion();
        aviso.textContent = exito;
        aviso.className = "aviso ok";
    } catch (error) {
        aviso.textContent = error.message;
        aviso.className = "aviso error";
    }
}
function cargarEditorIngreso() {
    const n = nominas.find(n => n.id === uiMejora("editar-ingreso-id").value);
    baseEditorIngreso = n ? JSON.stringify(n) : "";
    const lista = uiMejora("editar-ingreso-reparto");
    lista.replaceChildren();
    uiMejora("guardar-edicion-ingreso").disabled = !n;
    uiMejora("anular-ingreso").disabled = !n;
    if (!n) { uiMejora("ayuda-editar-ingreso").textContent = "Selecciona el ingreso que quieres corregir."; return; }
    uiMejora("editar-ingreso-nombre").value = n.referencia;
    uiMejora("editar-ingreso-importe").value = (n.montoCentavos / 100).toFixed(2);
    uiMejora("editar-ingreso-periodo").value = n.periodo;
    uiMejora("editar-ingreso-fecha").value = fechaMovimiento("ingreso", n.id);
    const deps = dependenciasIngreso(n.id);
    uiMejora("editar-ingreso-importe").readOnly = deps.length > 0;
    uiMejora("anular-ingreso").disabled = deps.length > 0;
    uiMejora("ayuda-editar-ingreso").textContent = deps.length
        ? "Vinculado a " + deps.join(", ") + ". Puedes cambiar referencia, fecha y periodo; importe, reparto y anulación están protegidos."
        : "Sin movimientos relacionados. Puedes corregir importe y porcentajes o anularlo con motivo.";
    for (const c of n.reparto) {
        const fila = elementoMejora("div", undefined, "porcentaje-nomina");
        const label = elementoMejora("label", c.nombre);
        const input = document.createElement("input");
        input.id = "editar-porcentaje-" + c.id; input.type = "number"; input.min = "0"; input.max = "100";
        input.step = ".01"; input.required = true; input.value = c.porcentaje; input.readOnly = deps.length > 0;
        input.dataset.categoria = c.id; label.htmlFor = input.id;
        fila.append(label, input); lista.append(fila);
    }
}
function mostrarActividad(todos = movimientosUnificados()) {
    const desde = uiMejora("actividad-desde").value, hasta = uiMejora("actividad-hasta").value;
    const lista = uiMejora("lista-actividad"); lista.replaceChildren();
    if (desde && hasta && desde > hasta) { uiMejora("conteo-actividad").textContent = "La fecha inicial debe ser anterior a la final."; return; }
    const filas = filtrarActividad(todos, { buscar: uiMejora("actividad-buscar").value,
        tipo: uiMejora("actividad-tipo").value, desde, hasta, nominaId: uiMejora("actividad-nomina").value,
        categoriaId: uiMejora("actividad-categoria").value, estado: uiMejora("actividad-estado").value });
    uiMejora("conteo-actividad").textContent = filas.length + " movimientos encontrados." +
        ((desde || hasta) ? " Los movimientos sin fecha no se incluyen en este intervalo." : "");
    const nombres = { ingreso: "Ingreso", gasto: "Gasto", ahorro: "Aportación", retiro: "Retiro",
        apartado: "Apartado", pago: "Pago de deuda", ajuste: "Cambio registrado" };
    for (const f of filas.slice(0, limiteActividad)) {
        const li = elementoMejora("li", undefined, "movimiento-unificado");
        const cabecera = elementoMejora("div", undefined, "actividad-cabecera");
        const titulo = elementoMejora("strong", f.nombre);
        const importe = elementoMejora("span", f.monto === null ? "Sin cargo" : formatoMoneda.format(f.monto / 100), "actividad-importe");
        cabecera.append(titulo, importe);
        const etiqueta = elementoMejora("span", nombres[f.tipo] + (f.estado === "anulado" ? " · Anulado" : ""), "etiqueta-movimiento");
        li.append(etiqueta, cabecera, elementoMejora("p", nombreFecha(f.fecha) +
            (f.detalle ? " · " + f.detalle : "") +
            (f.nominaId ? " · " + (nominas.find(n => n.id === f.nominaId)?.referencia ?? "") : ""), "ayuda"));
        if (f.fechaTipo && f.referenciaId) {
            const details = document.createElement("details");
            details.append(elementoMejora("summary", f.fecha ? "Corregir fecha" : "Añadir fecha"));
            const form = document.createElement("form"), label = elementoMejora("label", "Fecha de la operación");
            const campo = document.createElement("input");
            campo.id = "fecha-actividad-" + f.id; campo.type = "date"; campo.required = true; campo.value = f.fecha;
            label.htmlFor = campo.id;
            const boton = elementoMejora("button", "Guardar fecha"); boton.type = "submit";
            form.append(label, campo, boton); details.append(form); li.append(details);
            form.addEventListener("submit", e => {
                e.preventDefault(); informarMejora("mensaje-actividad",
                    () => corregirFechaActividad(f.fechaTipo, f.referenciaId, campo.value), "Fecha actualizada.");
            });
        }
        lista.append(li);
    }
    if (!filas.length) lista.append(elementoMejora("li", "No hay movimientos que coincidan. Prueba otros filtros.", "estado-vacio"));
    uiMejora("actividad-mas").hidden = filas.length <= limiteActividad;
}
function mostrarResumenPeriodos(filas = movimientosUnificados()) {
    const caja = uiMejora("metricas-periodo"); caja.replaceChildren();
    try {
        const porNomina = uiMejora("resumen-modo").value === "nomina";
        uiMejora("campo-mes-resumen").hidden = porNomina;
        uiMejora("campo-nomina-resumen").hidden = !porNomina;
        let valores;
        if (porNomina) {
            const id = uiMejora("periodo-nomina-resumen").value;
            if (!id) { uiMejora("nota-periodo").textContent = "Selecciona un ingreso para ver el reparto de ese pago y su uso actual."; return; }
            const r = calcularResumenFinanciero(id);
            valores = [["Recibido", r.ingresos], ["Gastos", r.gastos], ["Destinado a ahorro", r.ahorroDestinado],
                ["Destinado a deudas", r.destinadoDeudas], ["Apartados básicos", r.destinadoBasicos], ["Disponible", r.disponible]];
            uiMejora("nota-periodo").textContent = "Uso del ingreso seleccionado.";
        } else {
            const r = resumenMes(uiMejora("resumen-mes").value, filas);
            valores = [["Ingresos", r.ingresos], ["Gastos", r.gastos], ["Aportado a ahorro", r.ahorro],
                ["Retirado de ahorro", r.retiros], ["Apartados", r.apartados], ["Pagos de deuda", r.pagos]];
            uiMejora("nota-periodo").textContent = "Movimientos del mes. " +
                r.sinFecha + " movimientos sin fecha quedan fuera.";
        }
        for (const [nombre, valor] of valores) {
            const tarjeta = elementoMejora("div");
            tarjeta.append(elementoMejora("span", nombre), elementoMejora("strong", formatoMoneda.format(valor / 100)));
            caja.append(tarjeta);
        }
    } catch (error) { uiMejora("nota-periodo").textContent = error.message; }
}
function mostrarMetasAhorro() {
    const saldos = saldosMetas();
    uiMejora("saldo-ahorro-general").textContent = formatoMoneda.format(saldos.get("") / 100);
    const activas = mejoras.metas.filter(m => !m.archivada).map(m => [m.id, m.nombre]);
    opcionesMejora("ahorro-meta", activas, "Ahorro general");
    opcionesMejora("asignar-meta", activas, "Ahorro general");
    opcionesMejora("asignar-movimiento", movimientosAhorros.filter(m => m.id && !m.anulacion)
        .map(m => [m.id, m.concepto + " · " + formatoMoneda.format(m.montoCentavos / 100)]), "Selecciona un movimiento");
    mostrarSaldoMetaSeleccionada();
    const lista = uiMejora("lista-metas"); lista.replaceChildren();
    for (const m of mejoras.metas) {
        const tarjeta = elementoMejora("article", undefined, "meta-tarjeta");
        const saldo = saldos.get(m.id);
        const progreso = document.createElement("progress"); progreso.max = m.objetivoCentavos;
        progreso.value = Math.min(saldo, m.objetivoCentavos); progreso.setAttribute("aria-label", "Avance de " + m.nombre);
        tarjeta.append(elementoMejora("h4", m.nombre + (m.archivada ? " · Archivada" : "")),
            elementoMejora("p", formatoMoneda.format(saldo / 100) + " de " + formatoMoneda.format(m.objetivoCentavos / 100)), progreso,
            elementoMejora("p", saldo >= m.objetivoCentavos ? "Objetivo reunido" : "Faltan " + formatoMoneda.format((m.objetivoCentavos - saldo) / 100), "ayuda"));
        const editar = elementoMejora("button", "Editar meta"); editar.type = "button";
        editar.addEventListener("click", () => {
            uiMejora("editor-meta").open = true; uiMejora("meta-id").value = m.id;
            uiMejora("meta-nombre").value = m.nombre; uiMejora("meta-objetivo").value = (m.objetivoCentavos / 100).toFixed(2);
            uiMejora("meta-nombre").focus();
        });
        const archivar = elementoMejora("button", m.archivada ? "Reactivar" : "Archivar"); archivar.type = "button";
        archivar.addEventListener("click", () => informarMejora("mensaje-metas",
            () => archivarMetaAhorro(m.id, !m.archivada), "Meta actualizada."));
        tarjeta.append(editar, archivar); lista.append(tarjeta);
    }
    if (!mejoras.metas.length) lista.append(elementoMejora("p", "Crea tu primera meta. Tu ahorro actual permanece en Ahorro general.", "estado-vacio"));
}
function mostrarSaldoMetaSeleccionada() {
    const saldo = saldosMetas().get(uiMejora("ahorro-meta").value || "") ?? 0;
    uiMejora("saldo-meta-seleccionada").textContent = "Saldo de este destino: " + formatoMoneda.format(saldo / 100) +
        ". Una aportación consume la nómina; un retiro consume únicamente este ahorro.";
}
function mostrarVencimientos() {
    opcionesMejora("vencimiento-deuda", deudas.filter(d => !d.liquidada).map(d => [d.id, d.nombre]), "Selecciona una deuda");
    const lista = uiMejora("lista-vencimientos"); lista.replaceChildren();
    const pendientes = deudas.filter(d => !d.liquidada).map(d => ({ deuda: d,
        fecha: mejoras.vencimientos.find(v => v.deudaId === d.id)?.fecha ?? "" }))
        .sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999") || a.deuda.prioridad - b.deuda.prioridad);
    for (const { deuda, fecha } of pendientes) {
        const estado = estadoVencimiento(fecha);
        const li = elementoMejora("li", undefined, "vencimiento-fila");
        li.append(elementoMejora("strong", deuda.nombre), elementoMejora("span", estado.texto, "estado-fecha " + estado.clase),
            elementoMejora("p", nombreFecha(fecha) + " · Deuda: " + formatoMoneda.format(deuda.objetivoCentavos / 100), "ayuda"));
        const boton = elementoMejora("button", fecha ? "Cambiar fecha" : "Asignar vencimiento"); boton.type = "button";
        boton.addEventListener("click", () => {
            uiMejora("editor-vencimiento").open = true;
            uiMejora("vencimiento-deuda").value = deuda.id; uiMejora("vencimiento-fecha").value = fecha;
            uiMejora("vencimiento-fecha").focus();
        });
        li.append(boton); lista.append(li);
    }
    if (!pendientes.length) lista.append(elementoMejora("li", "No tienes deudas pendientes.", "estado-vacio"));
}
function mostrarRecurrentes() {
    opcionesMejora("recurrente-categoria", categoriasGastos.filter(c => !c.archivada)
        .map(c => [c.id, c.nombre + " · " + (nominas.flatMap(n => n.reparto).find(p => p.id === c.categoriaId)?.nombre ?? c.categoriaId)]), "Selecciona una categoría de gastos");
    const lista = uiMejora("lista-recurrentes"); lista.replaceChildren();
    for (const r of mejoras.recurrentes) {
        const tarjeta = elementoMejora("article", undefined, "recurrente-tarjeta");
        const programada = fechaOcurrencia(r), indice = r.ocurrencias.length;
        tarjeta.append(elementoMejora("h4", r.nombre),
            elementoMejora("p", formatoMoneda.format(r.montoCentavos / 100) + " · " + r.frecuencia),
            elementoMejora("p", (r.pausada ? "Pausado · " : "Próximo pendiente · ") + nombreFecha(programada), "ayuda"));
        const pausa = elementoMejora("button", r.pausada ? "Reanudar" : "Pausar"); pausa.type = "button";
        pausa.addEventListener("click", () => informarMejora("mensaje-recurrentes",
            () => pausarRecurrente(r.id, !r.pausada), "Programación actualizada."));
        tarjeta.append(pausa);
        if (!r.pausada) {
            const form = document.createElement("form");
            const label = elementoMejora("label", "Ingreso que pagará este gasto");
            const select = document.createElement("select"); select.id = "pago-recurrente-" + r.id;
            label.htmlFor = select.id; select.required = true; select.add(new Option("Selecciona un ingreso", ""));
            for (const n of nominas.filter(n => n.reparto.some(c => c.id === r.categoriaId))) {
                const saldo = calcularDisponibleCategoria(n, r.categoriaId, obtenerCompromisosNomina());
                select.add(new Option(n.referencia + " · Disponible " + formatoMoneda.format(saldo.disponibleCentavos / 100), n.id));
            }
            const fecha = document.createElement("input"); fecha.id = "fecha-recurrente-" + r.id;
            fecha.type = "date"; fecha.required = true; fecha.value = fechaLocalGasto(); fecha.max = fechaLocalGasto();
            const labelFecha = elementoMejora("label", "Fecha en que lo pagaste"); labelFecha.htmlFor = fecha.id;
            const pagar = elementoMejora("button", "Confirmar pago"); pagar.type = "submit"; pagar.disabled = programada > fechaLocalGasto();
            const omitir = elementoMejora("button", "Omitir esta vez"); omitir.type = "button"; omitir.disabled = pagar.disabled;
            form.append(label, select, labelFecha, fecha, pagar, omitir); tarjeta.append(form);
            form.addEventListener("submit", e => {
                e.preventDefault();
                if (!confirm("¿Registrar este pago de " + formatoMoneda.format(r.montoCentavos / 100) + "? Se descontará del ingreso seleccionado.")) return;
                informarMejora("mensaje-recurrentes", () => confirmarRecurrente(r.id, indice, select.value, fecha.value),
                    "Pago registrado una sola vez. Ya aparece en tus gastos.");
            });
            omitir.addEventListener("click", () => {
                if (!confirm("¿Omitir esta ocurrencia sin descontar dinero?")) return;
                informarMejora("mensaje-recurrentes", () => confirmarRecurrente(r.id, indice, "", fechaLocalGasto(), true),
                    "Ocurrencia omitida sin registrar un gasto.");
            });
        }
        const historial = document.createElement("details"); historial.append(elementoMejora("summary", "Ver confirmaciones (" + r.ocurrencias.length + ")"));
        const ol = document.createElement("ol");
        for (const o of [...r.ocurrencias].reverse().slice(0, 12)) {
            const anulado = gastosBasicos.find(g => g.id === o.gastoId)?.anulacion;
            ol.append(elementoMejora("li", nombreFecha(o.fecha) + " · " + (anulado ? "Gasto anulado" : o.estado)));
        }
        historial.append(ol); tarjeta.append(historial); lista.append(tarjeta);
    }
    if (!mejoras.recurrentes.length) lista.append(elementoMejora("p", "Programa renta, servicios o suscripciones. Nada se descontará sin tu confirmación.", "estado-vacio"));
}
function mostrarPanelesMejoras() {
    const ingresos = nominas.map(n => [n.id, n.referencia]);
    opcionesMejora("editar-ingreso-id", ingresos, "Selecciona un ingreso");
    opcionesMejora("actividad-nomina", ingresos, "Todos los ingresos");
    opcionesMejora("periodo-nomina-resumen", ingresos, "Selecciona un ingreso");
    const cats = new Map(nominas.flatMap(n => n.reparto.map(c => [c.id, c.nombre])));
    opcionesMejora("actividad-categoria", [...cats], "Todas las categorías");
    const filas = movimientosUnificados();
    mostrarResumenPeriodos(filas); mostrarActividad(filas); mostrarMetasAhorro(); mostrarVencimientos(); mostrarRecurrentes();
}

//Eventos de los paneles
uiMejora("editar-ingreso-id").addEventListener("change", cargarEditorIngreso);
uiMejora("formulario-editar-ingreso").addEventListener("submit", e => {
    e.preventDefault();
    const id = uiMejora("editar-ingreso-id").value, n = nominas.find(n => n.id === id);
    if (!n || !confirm("¿Guardar esta corrección del ingreso? Se conservará el motivo y el estado anterior.")) return;
    informarMejora("mensaje-editar-ingreso", () => {
        const reparto = n.reparto.map(c => ({ ...c, porcentaje: Number(uiMejora("editar-porcentaje-" + c.id).value) }));
        editarIngreso(id, { referencia: uiMejora("editar-ingreso-nombre").value, monto: uiMejora("editar-ingreso-importe").value,
            periodo: uiMejora("editar-ingreso-periodo").value, fecha: uiMejora("editar-ingreso-fecha").value, reparto },
            uiMejora("editar-ingreso-motivo").value, baseEditorIngreso);
        cargarEditorIngreso();
    }, "Ingreso corregido y guardado.");
});
uiMejora("anular-ingreso").addEventListener("click", async () => {
    if (!await confirmarBorrado("¿Eliminar este ingreso?")) return;
    informarMejora("mensaje-editar-ingreso", () => {
        anularIngreso(uiMejora("editar-ingreso-id").value, "Eliminado por el usuario", baseEditorIngreso);
        cargarEditorIngreso();
    }, "Ingreso anulado. Su registro se conserva en la actividad.");
});
for (const id of ["actividad-buscar", "actividad-tipo", "actividad-desde", "actividad-hasta", "actividad-nomina", "actividad-categoria", "actividad-estado"]) {
    uiMejora(id).addEventListener(id === "actividad-buscar" ? "input" : "change", () => { limiteActividad = 40; mostrarActividad(); });
}
uiMejora("actividad-limpiar").addEventListener("click", () => {
    for (const id of ["actividad-buscar", "actividad-tipo", "actividad-desde", "actividad-hasta", "actividad-nomina", "actividad-categoria", "actividad-estado"]) uiMejora(id).value = "";
    limiteActividad = 40; mostrarActividad();
});
uiMejora("actividad-mas").addEventListener("click", () => { limiteActividad += 40; mostrarActividad(); });
for (const id of ["resumen-modo", "resumen-mes", "periodo-nomina-resumen"]) uiMejora(id).addEventListener("change", () => mostrarResumenPeriodos());
uiMejora("formulario-meta").addEventListener("submit", e => {
    e.preventDefault(); informarMejora("mensaje-metas", () => {
        guardarMetaAhorro(uiMejora("meta-id").value, uiMejora("meta-nombre").value, uiMejora("meta-objetivo").value);
        uiMejora("formulario-meta").reset();
    }, "Meta guardada. El ahorro total no cambió.");
});
uiMejora("meta-nueva").addEventListener("click", () => uiMejora("formulario-meta").reset());
uiMejora("formulario-asignar-meta").addEventListener("submit", e => {
    e.preventDefault(); informarMejora("mensaje-metas", () => asignarMovimientoMeta(uiMejora("asignar-movimiento").value,
        uiMejora("asignar-meta").value), "Destino actualizado sin duplicar el ahorro.");
});
uiMejora("ahorro-meta").addEventListener("change", mostrarSaldoMetaSeleccionada);
uiMejora("vencimiento-deuda").addEventListener("change", () => {
    uiMejora("vencimiento-fecha").value = mejoras.vencimientos.find(v => v.deudaId === uiMejora("vencimiento-deuda").value)?.fecha ?? "";
});
uiMejora("formulario-vencimiento").addEventListener("submit", e => {
    e.preventDefault(); informarMejora("mensaje-vencimientos", () => guardarVencimiento(uiMejora("vencimiento-deuda").value,
        uiMejora("vencimiento-fecha").value), "Vencimiento actualizado. No se registró ningún pago.");
});
uiMejora("formulario-recurrente").addEventListener("submit", e => {
    e.preventDefault(); informarMejora("mensaje-recurrentes", () => {
        crearGastoRecurrente({ nombre: uiMejora("recurrente-nombre").value, monto: uiMejora("recurrente-importe").value,
            inicio: uiMejora("recurrente-inicio").value, frecuencia: uiMejora("recurrente-frecuencia").value,
            subcategoriaId: uiMejora("recurrente-categoria").value });
        uiMejora("formulario-recurrente").reset(); uiMejora("recurrente-inicio").value = fechaLocalGasto();
    }, "Gasto programado. El dinero se descontará cuando confirmes el pago.");
});
for (const id of ["fecha-nomina", "fecha-ahorro", "fecha-apartado", "recurrente-inicio"]) {
    uiMejora(id).value = fechaLocalGasto();
    uiMejora(id).defaultValue = fechaLocalGasto();
}
uiMejora("resumen-mes").value = fechaLocalGasto().slice(0, 7);
mostrarPanelesMejoras();
