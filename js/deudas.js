//Datos
let deudas = [];
let gruposDeudas = [];
let deudaEnEdicionId = null;

//Elementos
const formularioDeuda = document.getElementById("formulario-deuda");
const campoNombreDeuda = document.getElementById("nombre-deuda");
const campoObjetivoDeuda = document.getElementById("objetivo-deuda");
const campoPrioridadDeuda = document.getElementById("prioridad-deuda");
const formularioApartado = document.getElementById("formulario-apartado");
const campoDestinoApartado = document.getElementById("destino-apartado");
const campoMontoApartado = document.getElementById("monto-apartado");
const botonRegistrarApartado = document.getElementById("registrar-apartado");
const listaDeudas = document.getElementById("lista-deudas");
const resumenDeudas = document.getElementById("resumen-deudas");
const mensajeDeudas = document.getElementById("mensaje-deudas");
const deudasVacias = document.getElementById("deudas-vacias");
const editorDeuda = document.getElementById("editor-deuda");
const formularioEditarDeuda = document.getElementById("formulario-editar-deuda");
const campoEditarNombre = document.getElementById("editar-nombre-deuda");
const campoEditarObjetivo = document.getElementById("editar-objetivo-deuda");
const campoEditarPrioridad = document.getElementById("editar-prioridad-deuda");
const ayudaEditarDeuda = document.getElementById("ayuda-editar-deuda");
const botonCancelarEdicion = document.getElementById("cancelar-edicion-deuda");
const campoFiltroDeudas = document.getElementById("filtro-deudas");
const sinResultadosDeudas = document.getElementById("sin-resultados-deudas");
const formularioProyeccion = document.getElementById("formulario-proyeccion");
const campoPresupuestoApartados = document.getElementById("presupuesto-apartados");
const mensajeProyeccion = document.getElementById("mensaje-proyeccion");
const resultadoProyeccion = document.getElementById("resultado-proyeccion");
const formularioGrupoDeuda =
    document.getElementById("formulario-grupo-deuda");
const campoNombreGrupoDeuda =
    document.getElementById("nombre-grupo-deuda");
const campoGrupoDeuda =
    document.getElementById("grupo-deuda");
const campoEditarGrupoDeuda =
    document.getElementById("editar-grupo-deuda");

//Mensajes
function informarDeudas(texto, esError) {
    mensajeDeudas.textContent = texto;
    mensajeDeudas.className = esError ? "aviso error" : "aviso ok";
}

function puedeModificarDeudas() {
    if (!guardadoHabilitado) {
        informarDeudas(
            "Recupera una copia válida antes de modificar las deudas.",
            true
        );
        return false;
    }
    return true;
}

function completarCambioDeudas(texto) {
    mostrarDeudas();
    invalidarProyeccionDeudas();

    const guardadoCorrecto = guardar();

    informarDeudas(
        guardadoCorrecto
            ? texto
            : texto + " No se pudo guardar: descarga una copia.",
        !guardadoCorrecto
    );
}

function normalizarNombreGrupo(nombre) {
    return nombre.trim().replace(/\s+/g, " ").toLocaleLowerCase("es")
}

function existeGrupoDeuda(id) {
    return gruposDeudas.some(function (grupo) {
        return grupo.id === id;
    });
}

function registrarGrupoDeuda(evento) {
    evento.preventDefault();

    if (!puedeModificarDeudas()) {
        return;
    }

    const nombre = campoNombreGrupoDeuda.value
        .trim()
        .replace(/\s+/g, " ");
    if (nombre === "" || nombre.length > 60) {
        informarDeudas(
            "Escribe un nombre de grupo de hasta 60 caracteres",
            true
        );
        return;
    }

    const repetido = gruposDeudas.some(function (grupo) {
        return normalizarNombreGrupo(grupo.nombre) ===
            normalizarNombreGrupo(nombre);
    });
    if (repetido) {
        informarDeudas("Ya existe un grupo con ese nombre", true);
        return;
    }

    const usados = gruposDeudas.map(function (grupo) {
        return grupo.id;
    });

    const nuevoGrupo = {
        id: generarId(usados),
        nombre: nombre
    };

    gruposDeudas.push(nuevoGrupo);
    formularioGrupoDeuda.reset();

    completarCambioDeudas("Grupo creado. Ya puedes asignarle deudas.");

    campoGrupoDeuda.value = nuevoGrupo.id;
}

function actualizarSelectoresGrupos() {
    const campos = [campoGrupoDeuda, campoEditarGrupoDeuda];

    for (const campo of campos) {
        const seleccionAnterior = campo.value;

        campo.replaceChildren();

        const opcionSinGrupo = document.createElement("option");
        opcionSinGrupo.value = "";
        opcionSinGrupo.textContent = "Sin grupo";
        campo.appendChild(opcionSinGrupo);

        for (const grupo of gruposDeudas) {
            const opcion = document.createElement("option");
            opcion.value = grupo.id;
            opcion.textContent = grupo.nombre;
            campo.appendChild(opcion);
        }

        campo.value = existeGrupoDeuda(seleccionAnterior)
            ? seleccionAnterior
            : "";
    }
}

function limpiarGruposDeudas(lista) {
    if (lista === undefined) {
        return [];
    }

    if (!Array.isArray(lista)) {
        return null;
    }

    const limpios = [];
    const ids = new Set();
    const nombres = new Set();

    for (const grupo of lista) {
        if (
            !grupo ||
            typeof grupo !== "object" ||
            Array.isArray(grupo) ||
            typeof grupo.id !== "string" ||
            grupo.id.trim() === "" ||
            ids.has(grupo.id) ||
            typeof grupo.nombre !== "string"
        ) {
            return null;
        }

        const nombre = grupo.nombre.trim().replace(/\s+/g, " ");
        const nombreComparable = normalizarNombreGrupo(nombre);

        if (
            nombre === "" ||
            nombre.length > 60 ||
            nombres.has(nombreComparable)
        ) {
            return null;
        }

        ids.add(grupo.id);
        nombres.add(nombreComparable);

        const datosFondo = limpiarDatosFondo(grupo);

        if (datosFondo === null) {
            return null;
        }

        limpios.push({
            id: grupo.id,
            nombre: nombre,
            modalidad: datosFondo.modalidad,
            movimientosFondo: datosFondo.movimientosFondo
        });
    }

    return limpios;
}

function resumirGrupoDeudas(lista) {
    let pendienteCentavos = 0;
    let apartadoCentavos = 0;
    let pendientes = 0;

    for (const deuda of lista) {
        if (deuda.liquidada) {
            continue;
        }

        pendientes++;
        pendienteCentavos += deuda.objetivoCentavos;

        const reserva = calcularReservaDeuda(deuda);

        if (reserva === null) {
            return null;
        }

        apartadoCentavos += reserva;

        if (
            !Number.isSafeInteger(pendienteCentavos) ||
            !Number.isSafeInteger(apartadoCentavos)
        ) {
            return null;
        }
    }

    return {
        pendientes: pendientes,
        pendienteCentavos: pendienteCentavos,
        apartadoCentavos: apartadoCentavos,
        faltaCentavos: pendienteCentavos - apartadoCentavos
    };
}


//Registro
function registrarDeuda(evento) {
    evento.preventDefault();

    if (!puedeModificarDeudas()) {
        return;
    }

    const nombre = campoNombreDeuda.value.trim();
    const objetivo = convertirPesosACentavos(campoObjetivoDeuda.value);
    const prioridad = Number(campoPrioridadDeuda.value);
    const grupoId = campoGrupoDeuda.value || null;

    if (grupoId !== null && !existeGrupoDeuda(grupoId)) {
        informarDeudas("El grupo seleccionado ya no esta disponible", true);
        return;
    }

    if (nombre === "" || nombre.length > 80) {
        informarDeudas("Escribe un nombre de hasta 80 caracteres.", true);
        return;
    }

    if (objetivo === null) {
        informarDeudas(
            "Escribe un saldo positivo con un máximo de dos decimales.",
            true
        );
        return;
    }

    if (
        !Number.isInteger(prioridad) ||
        prioridad < 1 ||
        prioridad > 999
    ) {
        informarDeudas("La prioridad debe ser un entero entre 1 y 999.", true);
        return;
    }

    if (grupoConReservas(grupoId)) {
        informarDeudas(
            "Este grupo ya tiene reservas. Completa sus pagos " +
            "antes de añadir otra deuda",
            true
        );
        return;
    }

    const usados = deudas.map(function (deuda) {
        return deuda.id;
    });

    deudas.push({
        id: generarId(usados),
        nombre: nombre,
        grupoId: grupoId,
        objetivoCentavos: objetivo,
        prioridad: prioridad,
        aportaciones: [],
        liquidada: false
    });

    formularioDeuda.reset();
    completarCambioDeudas("Deuda registrada.");
}

function registrarApartado(evento) {
    evento.preventDefault();

    const registrado = registrarApartadoConNomina(
        "deuda",
        campoDestinoApartado.value,
        campoMontoApartado.value
    );

    if (registrado) {
        campoMontoApartado.value = "";
    }
}

function liquidarDeuda(id) {
    if (!puedeModificarDeudas()) {
        return;
    }

    const deuda = deudas.find(function (elemento) {
        return elemento.id === id;
    });

    if (!deuda || deuda.liquidada) {
        return;
    }

    const resumen = resumirDeuda(deuda);

    if (resumen.faltaCentavos !== 0) {
        informarDeudas("Todavía no has reunido el importe completo.", true);
        return;
    }

    const confirmado = confirm(
        "¿Ya pagaste " +
        formatoMoneda.format(deuda.objetivoCentavos / 100) +
        " a " + deuda.nombre + "? " +
        "Confirma solo después de realizar el pago."
    );

    if (!confirmado) {
        return;
    }

    deuda.liquidada = true;

    if (deudaEnEdicionId === deuda.id) {
        cerrarEditorDeuda();
    }

    completarCambioDeudas(
        "Liquidación registrada. La deuda permanece en tu historial."
    );
}

//Tarjetas
function crearTarjetaDeuda(deuda) {
    const resumen = resumirDeuda(deuda);
    const tarjeta = document.createElement("article");

    tarjeta.className = "deuda";
    tarjeta.dataset.estado = deuda.liquidada
        ? "liquidada"
        : resumen.faltaCentavos === 0 ? "lista" : "reuniendo";

    const titulo = document.createElement("h3");
    titulo.textContent = deuda.nombre;

    const estado = document.createElement("p");
    estado.className = "deuda__estado";
    estado.textContent =
        "Prioridad " + deuda.prioridad + " · " + resumen.estado;

    const cifras = document.createElement("p");
    cifras.className = "deuda__cifras";
    cifras.textContent =
        "Objetivo: " +
        formatoMoneda.format(deuda.objetivoCentavos / 100) +
        " · Apartado disponible: " +
        formatoMoneda.format(resumen.apartadoDisponibleCentavos / 100);

    tarjeta.appendChild(titulo);
    tarjeta.appendChild(estado);
    tarjeta.appendChild(cifras);

    if (!deuda.liquidada) {
        const botonEditar = document.createElement("button");
        botonEditar.type = "button";
        botonEditar.className = "boton-secundario";
        botonEditar.textContent = "Editar deuda";

        botonEditar.addEventListener("click", function () {
            abrirEditorDeuda(deuda.id);
        });

        tarjeta.appendChild(botonEditar);

        const progreso = document.createElement("progress");
        progreso.max = deuda.objetivoCentavos;
        progreso.value = resumen.reunidoCentavos;
        progreso.setAttribute(
            "aria-label",
            "Dinero reunido para " + deuda.nombre
        );

        const pendiente = document.createElement("p");
        pendiente.className = "ayuda";
        pendiente.textContent =
            resumen.porcentaje.toFixed(1) + "% reunido. Falta " +
            formatoMoneda.format(resumen.faltaCentavos / 100) + ".";

        const botonPagar = document.createElement("button");
        botonPagar.type = "button";
        botonPagar.className = "boton-principal";
        botonPagar.textContent = "Confirmar pago realizado";
        botonPagar.disabled = resumen.faltaCentavos !== 0;

        botonPagar.addEventListener("click", function () {
            liquidarDeuda(deuda.id);
        });

        tarjeta.appendChild(progreso);
        tarjeta.appendChild(pendiente);
        tarjeta.appendChild(botonPagar);
    }

    const historial = document.createElement("details");
    const encabezado = document.createElement("summary");
    encabezado.textContent = "Aportaciones y transferencias";

    const lista = document.createElement("ol");

    for (const monto of deuda.aportaciones) {
        const fila = document.createElement("li");
        fila.textContent = formatoMoneda.format(monto / 100);
        lista.appendChild(fila);
    }

    for (const movimiento of deuda.transferencias ?? []) {
        const fila = document.createElement("li");

        const grupo = gruposDeudas.find(
            elemento => elemento.id === movimiento.grupoId
        );

        fila.textContent =
            (
                movimiento.montoCentavos > 0
                    ? "Recibo de grupo "
                    : "Enviado al grupo"
            ) +
            (grupo?.nombre ?? "registrado") +
            ": " +
            formatoMoneda, format(
                Math.abs(movimiento.montoCentavos) / 100
            );

        lista.appendChild(fila)
    }

    for (const movimiento of deuda.aportacionesNomina ?? []) {
        const fila = document.createElement("li");

        fila.textContent =
            formatoMoneda.format(movimiento.montoCentavos / 100) +
            ". Origen " +
            describirOriginNomina(movimiento);

        lista.appendChild(fila);
    }

    historial.appendChild(encabezado);
    historial.appendChild(lista);
    tarjeta.appendChild(historial);

    return tarjeta;
}

function mostrarListaPorGrupos(ordenadas) {
    const estadosAnteriores = new Map();

    for (const bloque of listaDeudas.querySelectorAll("details.grupo-deudas")) {
        estadosAnteriores.set(bloque.dataset.grupoId, bloque.open);
    }

    listaDeudas.replaceChildren();

    const gruposVisibles = [
        ...gruposDeudas,
        { id: null, nombre: "Sin grupo" }
    ];

    let visibles = 0;

    for (const grupo of gruposVisibles) {
        const integrantes = ordenadas.filter(function (deuda) {
            return (deuda.grupoId ?? null) === grupo.id;
        });

        if (grupo.id === null && integrantes.length === 0) {
            continue;
        }

        const filtradas = integrantes.filter(function (deuda) {
            return coincideConFiltroDeuda(deuda, campoFiltroDeudas.value);
        });

        const bloque = document.createElement("details");
        bloque.className = "grupo-deudas";

        const clave = grupo.id ?? "";
        bloque.dataset.grupoId = clave;
        bloque.open = estadosAnteriores.get(clave) ?? true;

        const encabezado = document.createElement("summary");
        encabezado.className = "grupo-deudas__encabezado";

        const nombre = document.createElement("span");
        nombre.className = "grupo-deudas__nombre";
        nombre.textContent = grupo.nombre;

        const cantidad = document.createElement("span");
        cantidad.className = "grupo-deudas__cantidad";
        cantidad.textContent = integrantes.length === 1
            ? "1 deuda"
            : integrantes.length + "deudas";

        encabezado.append(nombre, cantidad);

        const cifras = document.createElement("p");
        cifras.className = "grupo-deudas__totales";

        const resumen = grupo.id === null
            ? resumirGrupoDeudas(integrantes)
            : resumirFondoGrupo(grupo);

        if (resumen === null) {
            cifras.textContent =
                "Los importes superan el limite del calculo";
        } else {
            cifras.textContent =
                "Pendiente de pago: " +
                formatoMoneda.format(resumen.pendienteCentavos / 100) +
                " Apartado disponible: " +
                formatoMoneda.format(resumen.apartadoCentavos / 100) +
                " Falta Reunir: " +
                formatoMoneda.format(resumen.faltaCentavos / 100);
        }

        const contenido = document.createElement("div");
        contenido.className = "grupo-deudas__contenido";

        for (const deuda of filtradas) {
            contenido.appendChild(crearTarjetaDeuda(deuda));
            visibles++;
        }

        if (filtradas.length === 0) {
            const aviso = document.createElement("p");
            aviso.className = "ayuda";
            aviso.textContent = integrantes.length === 0
                ? "Todavia no se han asignado deudas a este grupo"
                : "No hay deudas de este grupo que coincidan con el filtro";

            contenido.appendChild(aviso);
        }
        bloque.append(encabezado, cifras);

        if (grupo.id !== null) {
            bloque.appendChild(crearControlesFondo(grupo));
        }

        bloque.appendChild(contenido);

        listaDeudas.appendChild(bloque);
    }
    return visibles;
}

function mostrarDeudas() {
    const destinoAnterior = campoDestinoApartado.value;
    const ordenadas = ordenarDeudas(deudas);

    actualizarSelectoresGrupos();

    const visibles = mostrarListaPorGrupos(ordenadas);

    campoDestinoApartado.replaceChildren();

    let pendientes = 0;
    let liquidadas = 0;

    for (const deuda of ordenadas) {
        if (deuda.liquidada) {
            liquidadas++;
            continue;
        }

        pendientes++;

        if (
            !usaFondoGrupo(deuda) &&
            resumirDeuda(deuda).faltaCentavos > 0
        ) {
            const grupo = obtenerGrupoDeuda(deuda);

            const opcion = document.createElement("option");
            opcion.value = deuda.id;
            opcion.textContent = grupo
                ? grupo.nombre + " — " + deuda.nombre
                : deuda.nombre;

            campoDestinoApartado.appendChild(opcion);
        }
    }

    const sigueDisponible = Array.from(campoDestinoApartado.options).some(
        function (opcion) {
            return opcion.value === destinoAnterior;
        }
    );

    if (sigueDisponible) {
        campoDestinoApartado.value = destinoAnterior;
    }

    const sinDestinos = campoDestinoApartado.options.length === 0;

    if (sinDestinos) {
        const opcion = document.createElement("option");
        opcion.value = "";
        opcion.textContent = "No hay deudas que necesiten apartados";
        campoDestinoApartado.appendChild(opcion);
    }

    campoDestinoApartado.disabled = sinDestinos;
    campoMontoApartado.disabled = sinDestinos;
    botonRegistrarApartado.disabled = sinDestinos;

    resumenDeudas.textContent =
        pendientes + " pendientes · " + liquidadas + " liquidadas";

    deudasVacias.hidden = deudas.length > 0;
    sinResultadosDeudas.hidden = deudas.length === 0 || visibles > 0;
    actualizarOrigenApartados();
}

//Validacion
function limpiarDeudas(lista) {
    if (lista === undefined) {
        return [];
    }

    if (!Array.isArray(lista)) {
        return null;
    }

    const limpias = [];
    const ids = new Set();

    for (const deuda of lista) {
        if (
            typeof deuda !== "object" ||
            deuda === null ||
            Array.isArray(deuda)
        ) {
            return null;
        }

        if (
            typeof deuda.id !== "string" ||
            deuda.id.trim() === "" ||
            ids.has(deuda.id)
        ) {
            return null;
        }

        if (
            typeof deuda.nombre !== "string" ||
            deuda.nombre.trim() === "" ||
            deuda.nombre.trim().length > 80
        ) {
            return null;
        }

        if (
            !Number.isSafeInteger(deuda.objetivoCentavos) ||
            deuda.objetivoCentavos <= 0 ||
            !Number.isInteger(deuda.prioridad) ||
            deuda.prioridad < 1 ||
            deuda.prioridad > 999 ||
            typeof deuda.liquidada !== "boolean" ||
            !Array.isArray(deuda.aportaciones)
        ) {
            return null;
        }

        const reunido = calcularReservaDeuda(deuda);

        if (reunido === null) {
            return null;
        }

        const aportaciones = [...deuda.aportaciones];

        const transferencias = (deuda.transferencias ?? []).map(
            function (movimiento) {
                return {
                    id: movimiento.id,
                    grupoId: movimiento.grupoId,
                    montoCentavos: movimiento.montoCentavos
                };
            }
        );

        if (deuda.liquidada && reunido !== deuda.objetivoCentavos) {
            return null;
        }

        ids.add(deuda.id);

        const grupoId = deuda.grupoId === undefined
            ? null
            : deuda.grupoId;

        if (
            grupoId !== null &&
            (
                typeof grupoId !== "string" ||
                grupoId.trim() === ""
            )
        ) {
            return null;
        }

        limpias.push({
            id: deuda.id,
            nombre: deuda.nombre.trim(),
            grupoId: grupoId,
            objetivoCentavos: deuda.objetivoCentavos,
            prioridad: deuda.prioridad,
            aportaciones: aportaciones,
            aportacionesNomina: limpiarAportacionesNomin(
                deuda.aportacionesNomina
            ),
            transferencias: transferencias,
            liquidada: deuda.liquidada
        });
    }

    return limpias;
}

//Edicion
function abrirEditorDeuda(id) {
    if (!puedeModificarDeudas()) {
        return;
    }

    const deuda = deudas.find(function (elemento) {
        return elemento.id === id;
    });

    if (!deuda || deuda.liquidada) {
        informarDeudas("Solo puedes editar deudas pendientes.", true);
        return;
    }

    deudaEnEdicionId = deuda.id;
    campoEditarNombre.value = deuda.nombre;
    campoEditarObjetivo.value = (deuda.objetivoCentavos / 100).toFixed(2);
    campoEditarPrioridad.value = deuda.prioridad;
    actualizarSelectoresGrupos();
    campoEditarGrupoDeuda.value = deuda.grupoId ?? "";

    const resumen = resumirDeuda(deuda);

    ayudaEditarDeuda.textContent =
        "Ya reuniste " +
        formatoMoneda.format(resumen.reunidoCentavos / 100) +
        ". El nuevo objetivo no puede ser menor que ese importe.";

    editorDeuda.hidden = false;
    campoEditarNombre.focus();
}

function cerrarEditorDeuda() {
    deudaEnEdicionId = null;
    formularioEditarDeuda.reset();
    editorDeuda.hidden = true;
}

function guardarEdicionDeuda(evento) {
    evento.preventDefault();

    if (!puedeModificarDeudas()) {
        return;
    }

    const deuda = deudas.find(function (elemento) {
        return elemento.id === deudaEnEdicionId;
    });

    if (!deuda || deuda.liquidada) {
        cerrarEditorDeuda();
        informarDeudas("La deuda ya no está disponible para editar.", true);
        return;
    }

    const nombre = campoEditarNombre.value.trim();
    const objetivo = convertirPesosACentavos(campoEditarObjetivo.value);
    const prioridad = Number(campoEditarPrioridad.value);
    const grupoId = campoEditarGrupoDeuda.value || null;

    if (grupoId !== null && !existeGrupoDeuda(grupoId)) {
        informarDeudas("Selecciona un grupo disponible", true);
        return;
    }

    if (nombre === "" || nombre.length > 80) {
        informarDeudas("Escribe un nombre de hasta 80 caracteres.", true);
        return;
    }

    if (objetivo === null) {
        informarDeudas("Escribe un saldo objetivo positivo válido.", true);
        return;
    }

    if (
        !Number.isInteger(prioridad) ||
        prioridad < 1 ||
        prioridad > 999
    ) {
        informarDeudas("La prioridad debe estar entre 1 y 999.", true);
        return;
    }

    const resumen = resumirDeuda(deuda);

    if (objetivo < resumen.reunidoCentavos) {
        informarDeudas(
            "El objetivo no puede ser menor que el dinero ya apartado.",
            true
        );
        return;
    }

    const cambiaImporteOGrupo =
        objetivo !== deuda.objetivoCentavos ||
        grupoId !== (deuda.grupoId ?? null);

    if (
        cambiaImporteOGrupo &&
        (
            grupoConReservas(deuda.grupoId) ||
            grupoConReservas(grupoId)
        )
    ) {
        informarDeudas(
            "Hay reservas en el grupo. Completa sus pagos " +
            "antes de cambiar importes o integrantes.",
            true
        );
        return;
    }

    const destinoEsCompartido = gruposDeudas.some(function (grupo) {
        return grupo.id === grupoId && grupo.modalidad === "grupo";
    });

    if (
        grupoId !== (deuda.grupoId ?? null) &&
        destinoEsCompartido &&
        resumen.reunidoCentavos > 0
    ) {
        informarDeudas(
            "Esta deuda ya tiene apartados individuales. " +
            "No puede entrar en un fondo compartido.",
            true
        );
        return;
    }

    deuda.nombre = nombre;
    deuda.objetivoCentavos = objetivo;
    deuda.prioridad = prioridad;
    deuda.grupoId = grupoId;

    cerrarEditorDeuda();
    completarCambioDeudas("Deuda actualizada.");
}

//Filtros y proyeccion
function coincideConFiltroDeuda(deuda, filtro) {
    const resumen = resumirDeuda(deuda);

    if (filtro === "pendientes") {
        return !deuda.liquidada;
    }

    if (filtro === "listas") {
        return !deuda.liquidada && resumen.faltaCentavos === 0;
    }

    if (filtro === "liquidadas") {
        return deuda.liquidada;
    }

    return true;
}

function construirObjetivosHorizonte(listaDeudas, listaGrupos) {
    const deudasLimpias = limpiarDeudas(listaDeudas);
    const gruposLimpios = limpiarGruposDeudas(listaGrupos);

    if (deudasLimpias === null || gruposLimpios === null) {
        throw new Error(
            "No se pudieron revisar las deudas y los grupos."
        );
    }

    const gruposPorId = new Map(
        gruposLimpios.map(grupo => [grupo.id, grupo])
    );

    const hayGrupoInexistente = deudasLimpias.some(
        deuda =>
            deuda.grupoId !== null &&
            !gruposPorId.has(deuda.grupoId)
    );

    if (
        hayGrupoInexistente ||
        !validarFondosGrupos(gruposLimpios, deudasLimpias)
    ) {
        throw new Error(
            "Las deudas y los fondos no coinciden."
        );
    }

    const objetivos = [];
    const incluidos = new Set();

    for (const deuda of deudasLimpias) {
        if (deuda.liquidada) {
            continue;
        }

        const grupo = gruposPorId.get(deuda.grupoId);

        if (grupo?.modalidad === "grupo") {
            if (incluidos.has(grupo.id)) {
                continue;
            }

            incluidos.add(grupo.id);

            const integrantes = deudasLimpias.filter(
                elemento =>
                    elemento.grupoId === grupo.id &&
                    !elemento.liquidada
            );

            const resumen = resumirFondoGrupo(
                grupo,
                deudasLimpias
            );

            if (resumen === null) {
                throw new Error(
                    "No se pudo calcular el fondo de " +
                    grupo.nombre + "."
                );
            }

            objetivos.push({
                tipo: "grupo",
                id: grupo.id,
                nombre: grupo.nombre,
                prioridad: integrantes.reduce(
                    (menor, elemento) =>
                        Math.min(menor, elemento.prioridad),
                    999
                ),
                objetivoCentavos: resumen.pendienteCentavos,
                apartadoCentavos: resumen.apartadoCentavos,
                cantidadDeudas: integrantes.length
            });
        } else {
            const resumen = resumirDeuda(deuda);

            objetivos.push({
                tipo: "deuda",
                id: deuda.id,
                nombre: grupo
                    ? grupo.nombre + " / " + deuda.nombre
                    : deuda.nombre,
                prioridad: deuda.prioridad,
                objetivoCentavos: deuda.objetivoCentavos,
                apartadoCentavos:
                    resumen.apartadoDisponibleCentavos,
                cantidadDeudas: 1
            });
        }
    }

    return objetivos;
}

function mostrarProyeccionDeudas(evento) {
    evento.preventDefault();
    resultadoProyeccion.replaceChildren();

    const texto = campoPresupuestoApartados.value.trim();
    const esCero = /^0+(?:\.0{1,2})?$/.test(texto);

    const presupuesto = esCero
        ? 0
        : convertirPesosACentavos(texto);

    try {
        if (presupuesto === null) {
            throw new Error(
                "Escribe un importe válido con hasta dos decimales."
            );
        }

        const objetivos = construirObjetivosHorizonte(
            deudas,
            gruposDeudas
        );

        const proyeccion = proyectarHorizonte(
            objetivos,
            presupuesto
        );

        if (proyeccion.error !== null) {
            throw new Error(proyeccion.error);
        }

        if (proyeccion.filas.length === 0) {
            mensajeProyeccion.className = "ayuda";
            mensajeProyeccion.textContent =
                "No hay deudas pendientes para proyectar.";
            return;
        }

        for (const fila of proyeccion.filas) {
            const elemento = document.createElement("li");

            const titulo = document.createElement("h4");
            titulo.textContent =
                (fila.tipo === "grupo" ? "Grupo: " : "Deuda: ") +
                fila.nombre;

            const cifras = document.createElement("p");
            cifras.textContent =
                "Pendiente de pago: " +
                formatoMoneda.format(
                    fila.objetivoCentavos / 100
                ) +
                " · Ya apartado: " +
                formatoMoneda.format(
                    fila.apartadoCentavos / 100
                ) +
                " · Falta reunir: " +
                formatoMoneda.format(
                    fila.faltaCentavos / 100
                );

            const horizonte = document.createElement("p");
            horizonte.className = "ayuda";

            let plazo;

            if (fila.semanaObjetivo === 0) {
                plazo =
                    "Importe ya reunido. Esto no confirma que esté pagado.";
            } else if (fila.semanaObjetivo === null) {
                plazo =
                    "Sin plazo estimado: el aporte semanal supuesto es cero.";
            } else {
                plazo =
                    "Reunirías el importe en la semana " +
                    fila.semanaObjetivo +
                    " del escenario.";
            }

            horizonte.textContent =
                "Prioridad " + fila.prioridad +
                (
                    fila.tipo === "grupo"
                        ? " · " + fila.cantidadDeudas +
                          " deudas pendientes. "
                        : ". "
                ) +
                plazo;

            elemento.append(titulo, cifras, horizonte);
            resultadoProyeccion.appendChild(elemento);
        }

        const resumen = proyeccion.resumen;

        const cierre = resumen.semanaFinal === 0
            ? "Todos los importes pendientes ya están reunidos."
            : resumen.semanaFinal === null
                ? "No hay una semana final estimada."
                : "Reunirías todo lo pendiente en la semana " +
                  resumen.semanaFinal + ".";

        mensajeProyeccion.className = "ayuda";
        mensajeProyeccion.textContent =
            "Reservas registradas: " +
            formatoMoneda.format(
                resumen.apartadoCentavos / 100
            ) +
            ". Falta reunir: " +
            formatoMoneda.format(
                resumen.faltaCentavos / 100
            ) +
            ". Supuesto futuro: " +
            formatoMoneda.format(presupuesto / 100) +
            " por semana. " +
            cierre +
            " No se registraron apartados ni pagos.";
    } catch (error) {
        resultadoProyeccion.replaceChildren();
        mensajeProyeccion.className = "aviso error";
        mensajeProyeccion.textContent = error.message;
    }
}

function invalidarProyeccionDeudas() {
    resultadoProyeccion.replaceChildren();
    mensajeProyeccion.className = "ayuda";
    mensajeProyeccion.textContent =
        "Calcula nuevamente el horizonte con los datos actuales.";
}

//Eventos
formularioDeuda.addEventListener("submit", registrarDeuda);
formularioApartado.addEventListener("submit", registrarApartado);
formularioEditarDeuda.addEventListener("submit", guardarEdicionDeuda);
botonCancelarEdicion.addEventListener("click", cerrarEditorDeuda);
campoFiltroDeudas.addEventListener("change", mostrarDeudas);
formularioProyeccion.addEventListener("submit", mostrarProyeccionDeudas);
campoPresupuestoApartados.addEventListener("input", invalidarProyeccionDeudas);
formularioGrupoDeuda.addEventListener("submit", registrarGrupoDeuda);