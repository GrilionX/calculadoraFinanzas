//Datos del fondo

function limpiarDatosFondo(grupo) {
    const modalidad = grupo.modalidad === undefined
        ? "individual"
        : grupo.modalidad;

    const originales = grupo.movimientosFondo === undefined
        ? []
        : grupo.movimientosFondo;

    if (
        !["individual", "grupo"].includes(modalidad) ||
        !Array.isArray(originales)
    ) {
        return null;
    }

    const movimientosFondo = [];
    const ids = new Set();
    let saldo = 0;

    for (const movimiento of originales) {
        if (
            !movimiento ||
            typeof movimiento !== "object" ||
            Array.isArray(movimiento) ||
            !["apartado", "asignacion", "transferencia"].includes(
                movimiento.tipo
            ) ||
            !Number.isSafeInteger(movimiento.montoCentavos)
        ) {
            return null;
        }

        const transferencia = movimiento.tipo === "transferencia";

        if (
            transferencia
                ? movimiento.montoCentavos === 0
                : movimiento.montoCentavos <= 0
        ) {
            return null;
        }

        const usaDeuda = movimiento.tipo !== "apartado";

        if (
            usaDeuda &&
            (
                typeof movimiento.deudaId !== "string" ||
                movimiento.deudaId.trim() === ""
            )
        ) {
            return null;
        }

        if (
            transferencia &&
            (
                typeof movimiento.id !== "string" ||
                movimiento.id.trim() === "" ||
                ids.has(movimiento.id)
            )
        ) {
            return null;
        }

        saldo += variacionFondo(movimiento);

        if (!Number.isSafeInteger(saldo) || saldo < 0) {
            return null;
        }

        const limpio = {
            tipo: movimiento.tipo,
            montoCentavos: movimiento.montoCentavos,
            deudaId: usaDeuda ? movimiento.deudaId : null
        };

        if (transferencia) {
            ids.add(movimiento.id);
            limpio.id = movimiento.id;
        }

        if (movimiento.origenNomina !== undefined) {
            if (
                movimiento.tipo !== "apartado" ||
                !movimiento.origenNomina ||
                typeof movimiento.origenNomina !== "object" ||
                Array.isArray(movimiento.origenNomina)
            ) {
                return null;
            }

            const origen = movimiento.origenNomina;

            const revisados = limpiarAportacionesNomina([{
                id: origen.id,
                nominaId: origen.nominaId,
                categoriaId: origen.categoriaId,
                montoCentavos: movimiento.montoCentavos
            }]);

            if (revisados === null) {
                return null;
            }

            limpio.origenNomina = {
                id: origen.id,
                nominaId: origen.nominaId,
                categoriaId: origen.categoriaId
            };
        }

        movimientosFondo.push(limpio);
    }

    if (modalidad === "individual" && saldo !== 0) {
        return null;
    }

    return {
        modalidad: modalidad,
        movimientosFondo: movimientosFondo
    };
}

function variacionFondo(movimiento) {
    return movimiento.tipo === "asignacion"
        ? -movimiento.montoCentavos
        : movimiento.montoCentavos;
}

function obtenerGrupoDeuda(deuda) {
    return gruposDeudas.find(function (grupo) {
        return grupo.id === deuda.grupoId;
    });
}

function usaFondoGrupo(deuda) {
    return obtenerGrupoDeuda(deuda)?.modalidad === "grupo";
}

function resumirFondoGrupo(grupo, lista = deudas) {
    const integrantes = lista.filter(function (deuda) {
        return deuda.grupoId === grupo.id;
    });

    const base = resumirGrupoDeudas(integrantes);
    const datos = limpiarDatosFondo(grupo);

    if (base === null || datos === null) {
        return null;
    }

    let fondoCentavos = 0;

    for (const movimiento of datos.movimientosFondo) {
        fondoCentavos += variacionFondo(movimiento);
    }

    const disponible = base.apartadoCentavos + fondoCentavos;

    if (
        !Number.isSafeInteger(disponible) ||
        disponible > base.pendienteCentavos
    ) {
        return null;
    }

    return {
        pendientes: base.pendientes,
        pendienteCentavos: base.pendienteCentavos,
        asignadoCentavos: base.apartadoCentavos,
        fondoCentavos: fondoCentavos,
        apartadoCentavos: disponible,
        faltaCentavos: base.pendienteCentavos - disponible
    };
}

function transferenciasCoinciden(grupos, lista) {
    const pendientes = new Map();

    for (const deuda of lista) {
        for (const movimiento of deuda.transferencias ?? []) {
            if (pendientes.has(movimiento.id)) {
                return false;
            }

            pendientes.set(movimiento.id, {
                deudaId: deuda.id,
                grupoId: movimiento.grupoId,
                montoCentavos: movimiento.montoCentavos
            });
        }
    }

    for (const grupo of grupos) {
        for (const movimiento of grupo.movimientosFondo ?? []) {
            if (movimiento.tipo !== "transferencia") {
                continue;
            }

            const pareja = pendientes.get(movimiento.id);

            if (
                !pareja ||
                pareja.deudaId !== movimiento.deudaId ||
                pareja.grupoId !== grupo.id ||
                pareja.montoCentavos !== -movimiento.montoCentavos
            ) {
                return false;
            }

            pendientes.delete(movimiento.id);
        }
    }

    return pendientes.size === 0;
}

function validarFondosGrupos(grupos, lista) {
    if (!transferenciasCoinciden(grupos, lista)) {
        return false;
    }

    const idsDeudas = new Set(lista.map(deuda => deuda.id));

    return grupos.every(function (grupo) {
        const datos = limpiarDatosFondo(grupo);
        const resumen = resumirFondoGrupo(grupo, lista);

        if (datos === null || resumen === null) {
            return false;
        }

        if (
            datos.modalidad === "grupo" &&
            resumen.asignadoCentavos > 0 &&
            (
                resumen.faltaCentavos !== 0 ||
                resumen.fondoCentavos !== 0
            )
        ) {
            return false;
        }

        return datos.movimientosFondo.every(function (movimiento) {
            return movimiento.tipo === "apartado" ||
                idsDeudas.has(movimiento.deudaId);
        });
    });
}

//Operaciones

function cambiarModalidadGrupo(id, modalidad) {
    if (!puedeModificarDeudas()) {
        return;
    }

    const grupo = gruposDeudas.find(
        elemento => elemento.id === id
    );

    if (!grupo || !["individual", "grupo"].includes(modalidad)) {
        return;
    }

    if ((grupo.modalidad ?? "individual") === modalidad) {
        return;
    }

    const resumen = resumirFondoGrupo(grupo);

    if (resumen === null) {
        informarDeudas(
            "Revisa los importes del grupo antes de cambiar.",
            true
        );
        return;
    }

    const pendientes = ordenarDeudas(deudas).filter(
        function (deuda) {
            return deuda.grupoId === id && !deuda.liquidada;
        }
    );

    const plan = [];
    let porAsignar = resumen.fondoCentavos;

    for (const deuda of pendientes) {
        const detalle = resumirDeuda(deuda);

        const monto = modalidad === "grupo"
            ? -detalle.reunidoCentavos
            : Math.min(porAsignar, detalle.faltaCentavos);

        if (modalidad === "individual") {
            porAsignar -= monto;
        }

        if (monto !== 0) {
            plan.push({
                deudaId: deuda.id,
                nombre: deuda.nombre,
                monto: monto
            });
        }
    }

    if (modalidad === "individual" && porAsignar !== 0) {
        informarDeudas(
            "No se pudo distribuir todo el fondo.",
            true
        );
        return;
    }

    const lineas = plan.map(function (fila) {
        const importe = formatoMoneda.format(
            Math.abs(fila.monto) / 100
        );

        return fila.monto > 0
            ? "Fondo → " + fila.nombre + ": " + importe
            : fila.nombre + " → Fondo: " + importe;
    });

    const aviso = [
        modalidad === "grupo"
            ? "Cambiar a fondo compartido."
            : "Cambiar a apartados individuales, siguiendo las prioridades actuales.",
        ...lineas,
        plan.length === 0 ? "No hay dinero que trasladar." : "",
        "Reservas totales: " +
        formatoMoneda.format(resumen.apartadoCentavos / 100),
        "El total se conserva. No se registrará ningún pago. ¿Continuar?"
    ].filter(Boolean).join("\n");

    if (!confirm(aviso)) {
        return;
    }

    const siguientesDeudas = copiar(deudas);
    const siguientesGrupos = copiar(gruposDeudas);

    const siguienteGrupo = siguientesGrupos.find(
        elemento => elemento.id === id
    );

    siguienteGrupo.movimientosFondo ??= [];

    const usados = siguientesGrupos.flatMap(function (elemento) {
        return (elemento.movimientosFondo ?? [])
            .filter(movimiento => movimiento.tipo === "transferencia")
            .map(movimiento => movimiento.id);
    });

    for (const fila of plan) {
        const transferenciaId = generarId(usados);
        usados.push(transferenciaId);

        const deuda = siguientesDeudas.find(
            elemento => elemento.id === fila.deudaId
        );

        deuda.transferencias ??= [];

        deuda.transferencias.push({
            id: transferenciaId,
            grupoId: id,
            montoCentavos: fila.monto
        });

        siguienteGrupo.movimientosFondo.push({
            id: transferenciaId,
            tipo: "transferencia",
            deudaId: fila.deudaId,
            montoCentavos: -fila.monto
        });
    }

    siguienteGrupo.modalidad = modalidad;

    const limpias = limpiarDeudas(siguientesDeudas);
    const gruposLimpios = limpiarGruposDeudas(siguientesGrupos);

    if (
        limpias === null ||
        gruposLimpios === null ||
        !validarFondosGrupos(gruposLimpios, limpias)
    ) {
        informarDeudas(
            "La transferencia no pasó la comprobación. No se aplicó.",
            true
        );
        return;
    }

    const nuevoResumen = resumirFondoGrupo(
        gruposLimpios.find(elemento => elemento.id === id),
        limpias
    );

    if (
        nuevoResumen === null ||
        nuevoResumen.apartadoCentavos !== resumen.apartadoCentavos
    ) {
        informarDeudas(
            "La transferencia alteraría el total reservado. No se aplicó.",
            true
        );
        return;
    }

    const anterioresDeudas = deudas;
    const anterioresGrupos = gruposDeudas;

    deudas = limpias;
    gruposDeudas = gruposLimpios;

    if (!guardar()) {
        deudas = anterioresDeudas;
        gruposDeudas = anterioresGrupos;

        informarDeudas(
            "No se pudo guardar el cambio. Se conservó la modalidad anterior.",
            true
        );
        return;
    }

    cerrarEditorDeuda();
    mostrarDeudas();
    invalidarProyeccionDeudas();

    informarDeudas(
        "Modalidad actualizada. Se conservó el dinero y su historial.",
        false
    );
}

function registrarApartadoGrupo(id, textoMonto) {
    return registrarApartadoNomina(
        "grupo",
        id,
        textoMonto
    );
}

function distribuirFondoGrupo(id) {
    if (!puedeModificarDeudas()) {
        return;
    }

    const grupo = gruposDeudas.find(elemento => elemento.id === id);

    if (!grupo || grupo.modalidad !== "grupo") {
        return;
    }

    const resumen = resumirFondoGrupo(grupo);

    if (
        resumen === null ||
        resumen.faltaCentavos !== 0 ||
        resumen.fondoCentavos === 0
    ) {
        informarDeudas(
            "Primero reune el importe completo del grupo",
            true
        );
        return;
    }

    const plan = deudas
        .filter(deuda => deuda.grupoId === id && !deuda.liquidada)
        .map(function (deuda) {
            return {
                deuda: deuda,
                monto: resumirDeuda(deuda).faltaCentavos
            };
        })
        .filter(fila => fila.monto > 0);

    const total = plan.reduce(function (suma, fila) {
        return suma + fila.monto;
    }, 0);

    if (
        !Number.isSafeInteger(total) ||
        total !== resumen.fondoCentavos
    ) {
        informarDeudas(
            "Los importes del fondo no coinciden con las deudas",
            true
        );
        return;
    }

    const confirmado = confirm(
        "Asignar" + formatoMoneda.format(total / 100) +
        "del fondo a las deudas pendientes " +
        "Esta operacion prepara los importes; no confirma ningun pago"
    );

    if (!confirmado) {
        return;
    }

    const movimientos = [...(grupo.movimientosFondo ?? [])];

    for (const fila of plan) {
        fila.deuda.aportaciones.push(fila.monto);

        movimientos.push({
            tipo: "asignacion",
            montoCentavos: fila.monto,
            deudaId: fila.deuda.id
        });
    }

    grupo.movimientosFondo = movimientos;

    completarCambioDeudas(
        "Importes asignados"
    );
}

function grupoConReservas(id) {
    const grupo = gruposDeudas.find(elemento => elemento.id === id);

    if (!grupo || grupo.modalidad !== "grupo") {
        return false;
    }

    const resumen = resumirFondoGrupo(grupo);

    return resumen === null || resumen.apartadoCentavos > 0;
}

//Controles
function crearControlesFondo(grupo) {
    const panel = document.createElement("div");
    panel.className = "fondo-grupo";

    const modalidad = grupo.modalidad ?? "individual";
    const resumen = resumirFondoGrupo(grupo);

    const formularioModo = document.createElement("form");

    const etiqueta = document.createElement("label");
    etiqueta.textContent = "Cómo quieres reunir el dinero";

    const selector = document.createElement("select");

    for (const [valor, texto] of [
        ["individual", "Por deuda individual"],
        ["grupo", "En un fondo para todo el grupo"]
    ]) {
        const opcion = document.createElement("option");
        opcion.value = valor;
        opcion.textContent = texto;
        selector.appendChild(opcion);
    }

    selector.value = modalidad;
    etiqueta.appendChild(selector);

    const cambiar = document.createElement("button");
    cambiar.type = "submit";
    cambiar.textContent = "Aplicar modalidad";

    formularioModo.append(etiqueta, cambiar);

    formularioModo.addEventListener("submit", function (evento) {
        evento.preventDefault();
        cambiarModalidadGrupo(grupo.id, selector.value);
        selector.value = grupo.modalidad ?? "individual";
    });

    panel.appendChild(formularioModo);

    const ayuda = document.createElement("p");
    ayuda.className = "ayuda";
    ayuda.textContent = modalidad === "individual"
        ? "Aparta dinero para cada deuda desde el formulario habitual."
        : "El dinero del fondo todavía no pertenece a una deuda concreta. " +
        "Al reunir el total podrás asignarlo y después registrar cada pago.";

    panel.appendChild(ayuda);

    if (modalidad === "grupo" && resumen !== null) {
        const saldo = document.createElement("p");
        saldo.textContent =
            "Fondo sin asignar: " +
            formatoMoneda.format(resumen.fondoCentavos / 100) +
            " · Ya asignado a deudas pendientes: " +
            formatoMoneda.format(resumen.asignadoCentavos / 100);

        panel.appendChild(saldo);

        const formulario = document.createElement("form");

        const etiquetaMonto = document.createElement("label");
        etiquetaMonto.textContent =
            "Cantidad que ya apartaste para este grupo";

        const monto = document.createElement("input");
        monto.type = "number";
        monto.min = "0.01";
        monto.step = "0.01";
        monto.inputMode = "decimal";
        monto.required = true;

        etiquetaMonto.appendChild(monto);

        const agregar = document.createElement("button");
        agregar.type = "submit";
        agregar.textContent = "Registrar apartado del grupo";
        agregar.disabled = resumen.faltaCentavos === 0;
        monto.disabled = agregar.disabled;

        const avisoOrigen = document.createElement("p");
        avisoOrigen.className = "ayuda origen-apartado-actual";

        formulario.append(
            avisoOrigen,
            etiquetaMonto,
            agregar
        );

        formulario.addEventListener("submit", function (evento) {
            evento.preventDefault();
            registrarApartadoGrupo(grupo.id, monto.value);
        });

        const distribuir = document.createElement("button");
        distribuir.type = "button";
        distribuir.textContent = "Asignar el fondo completo a las deudas";
        distribuir.disabled =
            resumen.faltaCentavos !== 0 ||
            resumen.fondoCentavos === 0;

        distribuir.addEventListener("click", function () {
            distribuirFondoGrupo(grupo.id);
        });

        panel.append(formulario, distribuir);
    }

    const historial = document.createElement("details");
    const titulo = document.createElement("summary");
    titulo.textContent = "Historial del fondo";

    const lista = document.createElement("ol");

    for (const movimiento of grupo.movimientosFondo ?? []) {
        const fila = document.createElement("li");

        const deuda = deudas.find(function (elemento) {
            return elemento.id === movimiento.deudaId;
        });

        if (movimiento.tipo === "transferencia") {
            fila.textContent =
                (
                    movimiento.montoCentavos > 0
                        ? "Recibido de "
                        : "Enviado a "
                ) +
                (deuda?.nombre ?? "deuda registrada") +
                ": ";
        } else {
            fila.textContent = movimiento.tipo === "apartado"
                ? "Entrada al fondo: "
                : "Asignación a " +
                (deuda?.nombre ?? "deuda registrada") +
                ": ";
        }

        fila.textContent += formatoMoneda.format(
            Math.abs(movimiento.montoCentavos) / 100
        );

        if (
            limpias === null ||
            gruposLimpios === null ||
            !validarFondosGrupos(gruposLimpios, limpias) ||
            !validarOrigenesNomina(nominas, limpias, gruposLimpios)
        ) {
            informarDeudas(
                "La transferencia no pasó la comprobación. No se aplicó.",
                true
            );
            return;
        }

        lista.appendChild(fila);
    }

    historial.append(titulo, lista);
    panel.appendChild(historial);

    return panel;
}