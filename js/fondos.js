//Datos del fondo

function limpiarDatosFondo(grupo) {
    const modalidad = grupo.modalidad === undefined
        ? "indivisual" : grupo.modalidad;

    const originales = grupo.movimientosFondo === undefined
        ? [] : grupo.movimientosFondo;

    if (
        !["individual", "grupo"].includes(modalidad) ||
        !Array.isArray(originales)
    ) {
        return null;
    }

    const movimientosFondo = [];
    let saldo = 0;

    for (const movimiento of originales) {
        if (
            !movimiento ||
            typeof movimiento !== "object" ||
            Array.isArray(movimiento) ||
            !["apartado", "asignacion"].includes(movimiento.tipo) ||
            !Number.isSafeInteger(movimiento.montoCentavos) ||
            movimiento.montoCentavos <= 0
        ) {
            return null;
        }

        const esAsignacion = movimiento.tipo === "asignacion";

        if (
            esAsignacion &&
            (
                typeof movimiento.deudaId !== "string" ||
                movimiento.deudaId.trim() === ""
            )
        ) {
            return null;
        }

        saldo += esAsignacion
            ? -movimiento.montoCentavos
            : movimiento.montoCentavos;

        if(!Number.isSafeInteger(saldo) || saldo < 0){
            return null;
        }

        movimientosFondo.push({
            tipo: movimiento.tipo,
            montoCentavos: movimiento.montoCentavos,
            deudaId: esAsignacion ? movimiento.deudaId: null
        });
    }

    if(modalidad === "individual" && saldo !== 0){
        return null;
    }

    return{
        modalidad: modalidad,
        movimientosFondo: movimientosFondo
    };
}

function obtenerGrupoDeuda(deuda){
    return gruposDeudas.find(function(grupo){
        return grupo.id === deuda.grupoId;
    });
}

function usaFondoGrupo(deuda){
    return obtenerGrupoDeuda(deuda)?.modalidad === "grupo";
}

function resumirFondoGrupo(grupo, lista = deudas){
    const integrantes = lista.filter(function(deuda){
        return deuda.grupoId === grupo.id;
    });

    const base = resumirGrupoDeudas(integrantes);
    const datos = limpiarDatosFondo(grupo);

    if(base === null || datos === null){
        return null;
    }

    let fondoCentavos = 0;

    for (const movimiento of datos.movimientosFondo){
        fondoCentavos += movimiento.tipo === "apartado"
            ? movimiento.montoCentavos
            : -movimiento.montoCentavos;
    }

    const disponible = base.apartadoCentavos + fondoCentavos;

    if(
        !Number.isSafeInteger(disponible) ||
        disponible > base.pendienteCentavos
    ){
        return null;
    }

    return{
        pendientes: base.pendientes,
        pendienteCentavos: base.pendienteCentavos,
        asignadoCentavos: base.apartadoCentavos,
        fondoCentavos: fondoCentavos,
        apartadoCentavos: disponible,
        faltaCentavos: base.pendienteCentavos - disponible
    };
}

function validarFondosGrupos(grupos, lista){
    const idsDeudas = new Set(lista.map(deuda => deuda.id));

    return grupos.every(function(grupo){
        const datos = limpiarDatosFondo(grupo);
        const resumen = resumirFondoGrupo(grupo, lista);

        if(datos === null || resumen === null){
            return false;
        }

        if(
            datos.modalidad === "grupo" &&
            resumen.asignadoCentavos > 0 &&
            (
                resumen.faltaCentavos !== 0 ||
                resumen.fondoCentavos !== 0
            )
        ){
            return false;
        }

        return datos.movimientosFondo.every(function(movimiento){
            return movimiento.tipo !== "asignacion" || 
            idsDeudas.has(movimiento.deudaId);
        });
    });
}

//Operaciones

function cambiarModalidadGrupo(id, modalidad){
    if(!puedeModificarDeudas()){
        return;
    }

    const grupo = gruposDeudas.find(elemento => elemento.id === id);

    if(!grupo || !["individual", "grupo"].includes(modalidad)){
        return;
    }

    if((grupo.modalidad ?? "individual") === modalidad){
        return;
    }

    const resumen = resumirFondoGrupo(grupo);

    if(resumen === null || resumen.apartadoCentavos > 0){
        informarDeudas(
            "Este grupo tiene dinero reservado, en esta version solo se puede: " +
            "cambiar la modalidad cuando no quedan reservas disponibles", 
            true
        );
        return;
    }

    grupo.modalidad = modalidad;
    completarCambioDeudas("Habilidad actualizada");
}

function registrarApartadoGrupo(id, textoMonto){
    if(!puedeModificarDeudas()){
        return;
    }

    const grupo = gruposDeudas.find(elemento => elemento.id === id);
    const monto = convertirPesosACentavos(textoMonto);

    if(grupo || grupo.modalidad !== "grupo" || monto === null){
        informarDeudas(
            "Revisa el grupo y escribe un importe positivo",
            true
        );
        return;
    }

    const resumen = resumirFondoGrupo(grupo);

    if(resumen === null || monto > resumen.faltaCentavos){
        informarDeudas(
            "El apartado supera lo que falta resumir para el grupo",
            true
        );
        return;
    }

    grupo.movimientosFondo = [
        ...(grupo.movimientosFondo ?? []),
        {
            tipo: "apartado",
            montoCentavos: monto,
            deudaId: null
        }
    ];

    completarCambioDeudas("Apartado registrado en el fondo del grupo");
}

function distribuirFondoGrupoId(id){
    if(!puedeModificarDeudas()){
        return;
    }

    const grupo = gruposDeudas.find(elemento => elemento.id === id);

    if(!grupo || grupo.modalidad !== "grupo"){
        return;
    }

    const resumen = resumirFondoGrupo(grupo);

    if(
        resumen === null ||
        resumen.faltaCentavos !== 0 ||
        resumen.fondoCentavos === 0
    ){
        informarDeudas(
            "Primero reune el importe completo del grupo",
            true
        );
        return;
    }

    const plan = deudas
        .filter(deuda => deuda.grupoId === id && !deuda.liquidada)
        .map(function(deuda){
            return{
                deuda: deuda,
                monto: resumirDeuda(deuda).faltaCentavos
            };
        })
        .filter(fila => fila.monto > 0);
    
    const total = plan.reduce(function(suma, fila){
        return suma + fila.monto;
    }, 0);

    if(
        !Number.isSafeInteger(total) || 
        total !== resumen.fondoCentavos
    ){
        informarDeudas(
            "Los importes del fondo no coinciden con las deudas",
            true
        );
        return;
    }

    const confirmado = confirm(
        "Asignar" + formatoMoneda.format(total/100) +
        "del fondo a las deudas pendientes " +
        "Esta operacion prepara los importes; no confirma ningun pago"
    );

    if(!confirmado){
        return;
    }

    const movimientos = [...(grupo.movimientosFondo ?? [])];

    for(const fila of plan){
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

function grupoConReservas(id){
    const grupo = gruposDeudas.find(elemento => elemento.id === id);

    if(!grupo || grupo.modalidad !== "grupo"){
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

        formulario.append(etiquetaMonto, agregar);

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

        fila.textContent = movimiento.tipo === "apartado"
            ? "Entrada al fondo: "
            : "Asignación a " + (deuda?.nombre ?? "deuda registrada") + ": ";

        fila.textContent +=
            formatoMoneda.format(movimiento.montoCentavos / 100);

        lista.appendChild(fila);
    }

    historial.append(titulo, lista);
    panel.appendChild(historial);

    return panel;
}