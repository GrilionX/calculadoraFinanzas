let deudas = [];

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
const formularioEditarDeuda =
    document.getElementById("formulario-editar-deuda");

const campoEditarNombre =
    document.getElementById("editar-nombre-deuda");

const campoEditarObjetivo =
    document.getElementById("editar-objetivo-deuda");

const campoEditarPrioridad =
    document.getElementById("editar-prioridad-deuda");

const ayudaEditarDeuda =
    document.getElementById("ayuda-editar-deuda");

const botonCancelarEdicion =
    document.getElementById("cancelar-edicion-deuda");

const campoFiltroDeudas =
    document.getElementById("filtro-deudas");

const sinResultadosDeudas =
    document.getElementById("sin-resultados-deudas");

const formularioProyeccion =
    document.getElementById("formulario-proyeccion");

const campoPresupuestoApartados =
    document.getElementById("presupuesto-apartados");

const mensajeProyeccion =
    document.getElementById("mensaje-proyeccion");

const resultadoProyeccion =
    document.getElementById("resultado-proyeccion");

let deudaEnEdicionId = null;

function informarDeudas(texto, esError) {
    mensajeDeudas.textContent = texto;
    mensajeDeudas.className = esError
        ? "aviso error"
        : "aviso ok";
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

function registrarDeuda(evento) {
    evento.preventDefault();

    if (!puedeModificarDeudas()) {
        return;
    }

    const nombre = campoNombreDeuda.value.trim();
    const objetivo = convertirPesosACentavos(campoObjetivoDeuda.value);
    const prioridad = Number(campoPrioridadDeuda.value);

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

    const usados = deudas.map(function (deuda) {
        return deuda.id;
    });

    deudas.push({
        id: generarId(usados),
        nombre: nombre,
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

    if (!puedeModificarDeudas()) {
        return;
    }

    const deuda = deudas.find(function (elemento) {
        return elemento.id === campoDestinoApartado.value;
    });

    const monto = convertirPesosACentavos(campoMontoApartado.value);

    if (!deuda || deuda.liquidada) {
        informarDeudas("Selecciona una deuda pendiente.", true);
        return;
    }

    if (monto === null) {
        informarDeudas("Escribe un importe válido mayor que cero.", true);
        return;
    }

    const resumen = resumirDeuda(deuda);

    if (monto > resumen.faltaCentavos) {
        informarDeudas(
            "Solo falta reunir " +
            formatoMoneda.format(resumen.faltaCentavos / 100) +
            ". No se registró el apartado.",
            true
        );
        return;
    }

    deuda.aportaciones.push(monto);
    campoMontoApartado.value = "";

    completarCambioDeudas("Apartado registrado.");
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

function crearTarjetaDeuda(deuda) {
    const resumen = resumirDeuda(deuda);

    const tarjeta = document.createElement("article");
    tarjeta.className = "deuda";
    tarjeta.dataset.estado = deuda.liquidada
        ? "liquidada"
        : resumen.faltaCentavos === 0
            ? "lista"
            : "reuniendo";

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
    }

    if (!deuda.liquidada) {
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

        formularioEditarDeuda.addEventListener(
            "submit",
            guardarEdicionDeuda
        );

        botonCancelarEdicion.addEventListener(
            "click",
            cerrarEditorDeuda
        );

        campoFiltroDeudas.addEventListener(
            "change",
            mostrarDeudas
        );

        formularioProyeccion.addEventListener(
            "submit",
            mostrarProyeccionDeudas
        );

        campoPresupuestoApartados.addEventListener(
            "input",
            invalidarProyeccionDeudas
        );

        tarjeta.appendChild(progreso);
        tarjeta.appendChild(pendiente);
        tarjeta.appendChild(botonPagar);
    }

    const historial = document.createElement("details");
    const encabezado = document.createElement("summary");
    encabezado.textContent =
        "Historial de apartados (" + deuda.aportaciones.length + ")";

    const lista = document.createElement("ol");

    for (const monto of deuda.aportaciones) {
        const fila = document.createElement("li");
        fila.textContent = formatoMoneda.format(monto / 100);
        lista.appendChild(fila);
    }

    historial.appendChild(encabezado);
    historial.appendChild(lista);
    tarjeta.appendChild(historial);

    return tarjeta;
}

function mostrarDeudas() {
    const destinoAnterior = campoDestinoApartado.value;
    const ordenadas = ordenarDeudas(deudas);

    listaDeudas.replaceChildren();
    campoDestinoApartado.replaceChildren();

    let pendientes = 0;
    let liquidadas = 0;
    let visibles = 0;


    for (const deuda of ordenadas) {
        if (coincideConFiltroDeuda(deuda, campoFiltroDeudas.value)) {
            listaDeudas.appendChild(crearTarjetaDeuda(deuda));
            visibles++;
        }
        if (deuda.liquidada) {
            liquidadas++;
            continue;
        }

        pendientes++;

        if (resumirDeuda(deuda).faltaCentavos > 0) {
            const opcion = document.createElement("option");
            opcion.value = deuda.id;
            opcion.textContent = deuda.nombre;
            campoDestinoApartado.appendChild(opcion);
        }
    }

    const sigueDisponible = Array.from(
        campoDestinoApartado.options
    ).some(function (opcion) {
        return opcion.value === destinoAnterior;
    });

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

    sinResultadosDeudas.hidden =
        deudas.length === 0 || visibles > 0;
}

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

        let reunido = 0;
        const aportaciones = [];

        for (const monto of deuda.aportaciones) {
            if (!Number.isSafeInteger(monto) || monto <= 0) {
                return null;
            }

            reunido += monto;

            if (
                !Number.isSafeInteger(reunido) ||
                reunido > deuda.objetivoCentavos
            ) {
                return null;
            }

            aportaciones.push(monto);
        }

        if (
            deuda.liquidada &&
            reunido !== deuda.objetivoCentavos
        ) {
            return null;
        }

        ids.add(deuda.id);

        limpias.push({
            id: deuda.id,
            nombre: deuda.nombre.trim(),
            objetivoCentavos: deuda.objetivoCentavos,
            prioridad: deuda.prioridad,
            aportaciones: aportaciones,
            liquidada: deuda.liquidada
        });
    }

    return limpias;
}

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

    campoEditarObjetivo.value =
        (deuda.objetivoCentavos / 100).toFixed(2);

    campoEditarPrioridad.value = deuda.prioridad;

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

    const objetivo = convertirPesosACentavos(
        campoEditarObjetivo.value
    );

    const prioridad = Number(campoEditarPrioridad.value);

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

    deuda.nombre = nombre;
    deuda.objetivoCentavos = objetivo;
    deuda.prioridad = prioridad;

    cerrarEditorDeuda();
    completarCambioDeudas("Deuda actualizada.");
}

function coincideConFiltroDeuda(deuda, filtro) {
    const resumen = resumirDeuda(deuda);

    if (filtro === "pendientes") {
        return !deuda.liquidada;
    }

    if (filtro === "listas") {
        return !deuda.liquidada &&
            resumen.faltaCentavos === 0;
    }

    if (filtro === "liquidadas") {
        return deuda.liquidada;
    }

    return true;
}

function mostrarProyeccionDeudas(evento) {
    evento.preventDefault();

    const texto = campoPresupuestoApartados.value.trim();

    const esCero = /^0+(?:\.0{1,2})?$/.test(texto);

    const presupuesto = esCero
        ? 0
        : convertirPesosACentavos(texto);

    resultadoProyeccion.replaceChildren();

    if (presupuesto === null) {
        mensajeProyeccion.className = "aviso error";
        mensajeProyeccion.textContent =
            "Escribe un importe válido, con un máximo de dos decimales.";
        return;
    }

    const proyeccion = proyectarApartados(deudas, presupuesto);

    if (proyeccion.error !== null) {
        mensajeProyeccion.className = "aviso error";
        mensajeProyeccion.textContent = proyeccion.error;
        return;
    }

    if (proyeccion.filas.length === 0) {
        mensajeProyeccion.className = "ayuda";
        mensajeProyeccion.textContent =
            "No hay deudas pendientes para proyectar.";
        return;
    }

    for (const fila of proyeccion.filas) {
        const elemento = document.createElement("li");

        let horizonte;

        if (fila.semanaObjetivo === 0) {
            horizonte = "Ya reuniste el objetivo.";
        } else if (fila.semanaObjetivo === null) {
            horizonte = "Sin estimación: el presupuesto semanal es cero.";
        } else {
            horizonte =
                "Objetivo reunido en la semana " +
                fila.semanaObjetivo + ".";
        }

        elemento.textContent =
            fila.nombre + ": " + horizonte;

        resultadoProyeccion.appendChild(elemento);
    }

    mensajeProyeccion.className = "ayuda";
    mensajeProyeccion.textContent =
        "Escenario calculado con " +
        formatoMoneda.format(presupuesto / 100) +
        " semanales. No se registraron movimientos.";
}

function invalidarProyeccionDeudas() {
    resultadoProyeccion.replaceChildren();

    mensajeProyeccion.className = "ayuda";
    mensajeProyeccion.textContent =
        "Calcula nuevamente el horizonte con los datos actuales.";
}