//Datos
const PAGOS_POR_ANIO = {
    semanal: 52,
    cada2semanas: 26,
    quincenal: 24,
    mensual: 12
};

const PERIODOS = {
    semanal: "Por semana",
    cada2semanas: "Cada dos semanas",
    quincenal: "Por quincena",
    mensual: "Por mes"
};

const CLAVES_PERIODO = [
    "semanal", "cada2semanas", "quincenal", "mensual", "anual"
];

const CATEGORIAS_INICIALES = [
    { id: "basicos", nombre: "Gastos básicos", porcentaje: 55 },
    { id: "ocio", nombre: "Ocio", porcentaje: 5 },
    { id: "deudas", nombre: "Deudas", porcentaje: 25 },
    { id: "ahorro", nombre: "Ahorro", porcentaje: 15 }
];

const FRECUENCIAS_EXTRA = {
    diaria: { texto: "Cada día", pagosAlAnio: 52, usaDias: true },
    semanal: { texto: "Cada semana", pagosAlAnio: 52, usaDias: false },
    cada2semanas: { texto: "Cada dos semanas", pagosAlAnio: 26, usaDias: false },
    quincenal: { texto: "Cada quincena", pagosAlAnio: 24, usaDias: false },
    mensual: { texto: "Cada mes", pagosAlAnio: 12, usaDias: false },
    trimestral: { texto: "Cada 3 meses", pagosAlAnio: 4, usaDias: false },
    semestral: { texto: "Cada 6 meses", pagosAlAnio: 2, usaDias: false },
    anual: { texto: "Una vez al año", pagosAlAnio: 1, usaDias: false }
};

const EXTRAS_INICIALES = [
    {
        nombre: "Aguinaldo", monto: 0, modo: "golpe",
        frecuencia: "anual", diasPorSemana: 5,
        semana: 8, repetir: 52, sumar: false, destinos: []
    },
    {
        nombre: "Propinas", monto: 0, modo: "promedio",
        frecuencia: "diaria", diasPorSemana: 5,
        semana: 1, repetir: 0, sumar: false, destinos: []
    }
];

const CLAVE_GUARDADO = "finanzas-personal-v1";

const formatoMoneda = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
});

function copiar(datos) {
    return JSON.parse(JSON.stringify(datos));
}

function copiarCategoriasIniciales() {
    return copiar(CATEGORIAS_INICIALES);
}

let categorias = copiarCategoriasIniciales();
let otrosIngresos = copiar(EXTRAS_INICIALES);
let movimientosAhorros = [];
let guardadoHabilitado = true;
let reinicioActual = null;
let reinicioDetectado = false;
let ultimoTextoGuardado = null;

//Elementos
const campoMonto = document.getElementById("monto");
const campoFrecuencia = document.getElementById("frecuencia");
const campoPeriodo = document.getElementById("periodo");
const campoSemanas = document.getElementById("semanas-mostrar");
const cuerpoCalendario = document.getElementById("filas-calendario");
const cuerpoResumenCategorias = document.getElementById("filas-resumen-categorias");
const botonExportar = document.getElementById("exportar-copia");
const botonImportar = document.getElementById("importar-copia");
const campoArchivo = document.getElementById("archivo-copia");
const mensajeCopia = document.getElementById("mensaje-copia");
const cuerpoTabla = document.getElementById("filas-reparto");
const listaExtras = document.getElementById("lista-extras");
const botonAgregar = document.getElementById("agregar-categoria");
const botonAgregarExtra = document.getElementById("agregar-extra");
const botonRestablecer = document.getElementById("restablecer");
const botonReparto = document.getElementById("boton-reparto");
const botonAhorro = document.getElementById("boton-ahorro");
const botonDeudas = document.getElementById("boton-deudas");
const vistaDeudas = document.getElementById("vista-deudas");
const vistaReparto = document.getElementById("vista-reparto");
const vistaAhorro = document.getElementById("vista-ahorro");
const formularioAhorro = document.getElementById("formulario-ahorro");
const campoTipoAhorro = document.getElementById("tipo-movimiento-ahorro");
const campoConceptoAhorro = document.getElementById("concepto-ahorro");
const campoMontoAhorro = document.getElementById("monto-ahorro");
const saldoAhorro = document.getElementById("saldo-ahorro");
const mensajeAhorro = document.getElementById("mensaje-ahorro");
const historialAhorro = document.getElementById("historial-ahorro");
const ahorroVacio = document.getElementById("ahorro-vacio");
const estadoGuardado = document.getElementById("estado-guardado");

const formularioBorradoTotal =
    document.getElementById("formulario-borrado-total");

const mensajeBorrado =
    document.getElementById("mensaje-borrado");

const botonRespaldoAntesBorrar =
    document.getElementById("respaldo-antes-borrar");

const avisoReinicioExterno =
    document.getElementById("aviso-reinicio-externo");

const textoReinicioExterno =
    document.getElementById("texto-reinicio-externo");

const botonRecargarReinicio =
    document.getElementById("recargar-reinicio");

//Leer datos
function leerNumero(texto) {
    const numero = Number(texto);
    if (numero < 0 || !Number.isFinite(numero)) {
        return 0;
    }
    return numero;
}

function leerMonto() {
    return leerNumero(campoMonto.value);
}

function leerEntero(texto, minimo, maximo) {
    const numero = Math.round(leerNumero(texto));
    return Math.min(maximo, Math.max(minimo, numero));
}

function leerDias(texto) {
    return leerEntero(texto, 1, 7);
}

function idsDe(lista) {
    const ids = [];
    for (const elemento of lista) {
        ids.push(elemento.id);
    }
    return ids;
}

function generarId(usados) {
    let id = "c" + Date.now().toString(36) +
        Math.floor(Math.random() * 1000).toString(36);

    while (usados.includes(id)) {
        id += "x";
    }
    return id;
}

//Calculos
function desdeAnual(anual) {
    return {
        semanal: anual / 52,
        cada2semanas: anual / 26,
        quincenal: anual / 24,
        mensual: anual / 12,
        anual: anual
    };
}

function calcularEquivalentes(frecuencia, monto) {
    return desdeAnual(monto * PAGOS_POR_ANIO[frecuencia]);
}

function calcularExtra(extra) {
    const frecuencia = FRECUENCIAS_EXTRA[extra.frecuencia];
    let pagos = frecuencia.pagosAlAnio;

    if (frecuencia.usaDias) {
        pagos *= extra.diasPorSemana;
    }
    return desdeAnual(extra.monto * pagos);
}

function esDeGolpe(extra) {
    return extra.modo === "golpe";
}

function montoDeGolpe(extra, semana) {
    if (semana < extra.semana) {
        return 0;
    }
    if (extra.repetir === 0) {
        return semana === extra.semana ? extra.monto : 0;
    }
    if ((semana - extra.semana) % extra.repetir === 0) {
        return extra.monto;
    }
    return 0;
}

function multiplicar(eq, factor) {
    const resultado = {};
    for (const clave of CLAVES_PERIODO) {
        resultado[clave] = eq[clave] * factor;
    }
    return resultado;
}

function sumarEq(a, b) {
    const resultado = {};
    for (const clave of CLAVES_PERIODO) {
        resultado[clave] = a[clave] + b[clave];
    }
    return resultado;
}

function destinosValidos(extra) {
    const validos = [];
    for (const cat of categorias) {
        if (extra.destinos.includes(cat.id)) {
            validos.push(cat.id);
        }
    }
    return validos;
}

function extrasSinDestino() {
    const nombres = [];

    for (const extra of otrosIngresos) {
        if (extra.sumar && destinosValidos(extra).length === 0) {
            nombres.push(
                extra.nombre.trim() === "" ? "(sin nombre)" : extra.nombre
            );
        }
    }
    return nombres;
}

function calcularReparto(eqSueldo) {
    const filas = [];

    for (const cat of categorias) {
        filas.push({
            id: cat.id,
            porcentaje: cat.porcentaje,
            sueldo: multiplicar(eqSueldo, cat.porcentaje / 100),
            extras: desdeAnual(0)
        });
    }

    for (const extra of otrosIngresos) {
        const validos = destinosValidos(extra);

        if (extra.sumar && !esDeGolpe(extra) && validos.length > 0) {
            const parte = multiplicar(calcularExtra(extra), 1 / validos.length);

            for (const fila of filas) {
                if (validos.includes(fila.id)) {
                    fila.extras = sumarEq(fila.extras, parte);
                }
            }
        }
    }
    return filas;
}

function calcularCalendario(eqSueldo, cantidadSemanas) {
    const repartoSemanal = calcularReparto(eqSueldo);
    const semanas = [];
    const porCategoria = [];
    let promediadosPorSemana = 0;

    for (const fila of repartoSemanal) {
        promediadosPorSemana += fila.extras.semanal;
        porCategoria.push({
            id: fila.id,
            sueldo: fila.sueldo.semanal * cantidadSemanas,
            promediados: fila.extras.semanal * cantidadSemanas,
            deGolpe: 0
        });
    }

    for (let semana = 1; semana <= cantidadSemanas; semana++) {
        let deGolpe = 0;
        const llegan = [];

        for (const extra of otrosIngresos) {
            const validos = destinosValidos(extra);

            if (extra.sumar && esDeGolpe(extra) && validos.length > 0) {
                const monto = montoDeGolpe(extra, semana);

                if (monto > 0) {
                    deGolpe += monto;
                    llegan.push({ nombre: extra.nombre, monto: monto });

                    for (const categoria of porCategoria) {
                        if (validos.includes(categoria.id)) {
                            categoria.deGolpe += monto / validos.length;
                        }
                    }
                }
            }
        }

        semanas.push({
            semana: semana,
            sueldo: eqSueldo.semanal,
            promediados: promediadosPorSemana,
            deGolpe: deGolpe,
            total: eqSueldo.semanal + promediadosPorSemana + deGolpe,
            llegan: llegan
        });
    }

    return { semanas: semanas, porCategoria: porCategoria };
}

function sumaPorcentajes() {
    let total = 0;
    for (const cat of categorias) {
        total += cat.porcentaje;
    }
    return Math.round(total * 100) / 100;
}

function hayNombresVacios() {
    for (const cat of categorias) {
        if (cat.nombre.trim() === "") {
            return true;
        }
    }
    return false;
}

function revisarReparto() {
    const problemas = [];

    if (categorias.length === 0) {
        problemas.push("Agrega al menos una categoría.");
    } else {
        const suma = sumaPorcentajes();
        const diferencia = Math.round((100 - suma) * 100) / 100;

        if (diferencia > 0) {
            problemas.push(
                "Los porcentajes suman " + suma +
                "%. Faltan " + diferencia + "% por repartir."
            );
        } else if (diferencia < 0) {
            problemas.push(
                "Los porcentajes suman " + suma +
                "%. Te pasaste por " + (-diferencia) + "%."
            );
        }

        if (hayNombresVacios()) {
            problemas.push("Hay categorías sin nombre.");
        }
    }

    const sinDestino = extrasSinDestino();
    if (sinDestino.length > 0) {
        problemas.push(
            "Se suman a tu reparto pero no tienen destino: " +
            sinDestino.join(", ") + "."
        );
    }
    return problemas;
}

//Guardar y cargar
function construirPaquete() {
    return {
        reinicioId: reinicioActual,
        mejoras,
        gestion,
        frecuencia: campoFrecuencia.value,
        monto: campoMonto.value,
        periodo: campoPeriodo.value,
        semanasMostrar: String(leerEntero(campoSemanas.value, 1, 156)),
        categorias: categorias,
        otrosIngresos: otrosIngresos,
        movimientosAhorros: movimientosAhorros,
        deudas: deudas,
        gruposDeudas: gruposDeudas,
        nominas: nominas,
        historialCorrecciones: historialCorrecciones,
        categoriasGastos: categoriasGastos,
        gastosBasicos: gastosBasicos
    };
}

function guardar() {
    if (reinicioDetectado) {
        return false;
    }

    if (!guardadoHabilitado) {
        estadoGuardado.className = "aviso error";
        estadoGuardado.textContent =
            "Guardado detenido: no se pudieron recuperar los datos anteriores. " +
            "Importa una copia válida antes de continuar.";

        return false;
    }

    try {
        const anterior = localStorage.getItem(CLAVE_GUARDADO);

        const idGuardado = anterior === null
            ? null
            : leerIdReinicio(JSON.parse(anterior));

        if (anterior !== null && idGuardado !== reinicioActual) {
            bloquearPantallaPorReinicio(
                "Los datos se restablecieron en otra pestaña. " +
                "Recarga antes de continuar."
            );

            return false;
        }

        if (anterior !== ultimoTextoGuardado) {
            bloquearPantallaPorReinicio(
                "Los datos cambiaron en otra pestaña. Recarga para trabajar con la versión más reciente."
            );
            return false;
        }

        if (!limpiarRegistroAhorro(movimientosAhorros) || !validarOrigenAhorro(movimientosAhorros, nominas) ||
            !limpiarCategoriasGastos(categoriasGastos) ||
            !limpiarGastosBasicos(gastosBasicos, categoriasGastos, nominas) ||
            !validarDisponibilidadCompleta(nominas, deudas, gruposDeudas, gastosBasicos)) {
            throw new Error("Los gastos y las reservas superan el saldo o no son válidos.");
        }
        if (!limpiarGestion(gestion, { nominas })) throw new Error("Revisa tarjetas y apartados.");
        const historialNuevo = prepararHistorialGuardado();
        const paquete = construirPaquete();
        paquete.historialCorrecciones = historialNuevo;
        const estadoLimpio = validarEstadoCorreccion(capturarEstadoDeudas(), nominas);
        paquete.deudas = estadoLimpio.deudas;
        paquete.gruposDeudas = estadoLimpio.gruposDeudas;
        paquete.mejoras = prepararFechasNuevas(paquete, baseFechasMejoras);
        const mejorasLimpias = limpiarMejoras(paquete.mejoras, paquete);
        if (!mejorasLimpias) throw new Error("Revisa las metas, fechas y gastos recurrentes.");
        paquete.mejoras = mejorasLimpias;
        const textoNuevo = serializarDatosLocales(paquete);
        localStorage.setItem(CLAVE_GUARDADO, textoNuevo);
        ultimoTextoGuardado = textoNuevo;
        mejoras = mejorasLimpias;
        baseFechasMejoras = copiar({ nominas, movimientosAhorros, deudas, gruposDeudas });
        deudas = estadoLimpio.deudas;
        gruposDeudas = estadoLimpio.gruposDeudas;
        historialCorrecciones = historialNuevo;
        estadoDeudasGuardado = capturarEstadoDeudas();

        estadoGuardado.className = "ayuda";
        estadoGuardado.textContent =
            "Datos guardados en este navegador.";

        mostrarHistorialCorrecciones();
        mostrarGastos();
        actualizarOrigenAhorro();
        mostrarAjustesFinancieros();
        if (typeof mostrarApartadosAvanzados === 'function') mostrarApartadosAvanzados();
        mostrarAdministradorGrupos();
        mostrarResumenFinanciero();
        mostrarDisponibleOrigen();
        if (typeof mostrarPanelesMejoras === 'function') mostrarPanelesMejoras();
        return true;
    } catch (error) {
        deudas = copiar(estadoDeudasGuardado.deudas);
        gruposDeudas = copiar(estadoDeudasGuardado.gruposDeudas);
        estadoGuardado.className = "aviso error";
        estadoGuardado.textContent =
            "No se pudo guardar. El cambio de deudas no se aplicó. Descarga una copia antes de cerrar.";

        console.warn("No se pudo guardar:", error);
        return false;
    }
}

function limpiarCategorias(lista) {
    if (!Array.isArray(lista)) {
        return null;
    }

    const limpias = [];
    const usados = [];

    for (const c of lista) {
        if (typeof c === "object" && c !== null) {
            let nombre = "";
            if (typeof c.nombre === "string") {
                nombre = c.nombre;
            }

            let id = c.id;
            if (typeof id !== "string" || id === "" || usados.includes(id)) {
                id = generarId(usados);
            }

            usados.push(id);
            limpias.push({
                id: id,
                nombre: nombre,
                porcentaje: leerNumero(c.porcentaje)
            });
        }
    }
    return limpias;
}

function limpiarExtras(lista, idsValidos) {
    if (!Array.isArray(lista)) {
        return null;
    }

    const limpios = [];

    for (const e of lista) {
        if (typeof e === "object" && e !== null) {
            let nombre = "";
            if (typeof e.nombre === "string") {
                nombre = e.nombre;
            }

            let modo = "promedio";
            if (e.modo === "golpe") {
                modo = "golpe";
            }

            let frecuencia = "mensual";
            if (Object.keys(FRECUENCIAS_EXTRA).includes(e.frecuencia)) {
                frecuencia = e.frecuencia;
            }

            let dias = 5;
            if (e.diasPorSemana !== undefined) {
                dias = leerDias(e.diasPorSemana);
            }

            const destinos = [];
            if (Array.isArray(e.destinos)) {
                for (const id of e.destinos) {
                    if (idsValidos.includes(id) && !destinos.includes(id)) {
                        destinos.push(id);
                    }
                }
            }

            limpios.push({
                nombre: nombre,
                monto: leerNumero(e.monto),
                modo: modo,
                frecuencia: frecuencia,
                diasPorSemana: dias,
                semana: leerEntero(e.semana, 1, 520),
                repetir: leerEntero(e.repetir, 0, 520),
                sumar: e.sumar === true,
                destinos: destinos
            });
        }
    }
    return limpios;
}

function limpiarMovimientosAhorro(lista) {
    return limpiarRegistroAhorro(lista);
}

function aplicarDatos(datos, soloValidar = false) {
    try { datos = migrarCategoriasAnteriores(expandirHistorialLocal(datos)); } catch { return false; }
    if (
        !datos ||
        typeof datos !== "object" ||
        Array.isArray(datos) ||
        !Array.isArray(datos.categorias)
    ) {
        return false;
    }

    const numeroValido = function (valor) {
        return (
            typeof valor === "number" ||
            (typeof valor === "string" && valor.trim() !== "")
        ) && Number.isFinite(Number(valor)) && Number(valor) >= 0;
    };

    const ids = new Set();

    for (const c of datos.categorias) {
        if (
            !c ||
            typeof c !== "object" ||
            Array.isArray(c) ||
            typeof c.id !== "string" ||
            c.id.trim() === "" ||
            ids.has(c.id) ||
            typeof c.nombre !== "string" ||
            !numeroValido(c.porcentaje)
        ) {
            return false;
        }
        ids.add(c.id);
    }

    if (
        datos.frecuencia !== undefined &&
        !Object.hasOwn(PAGOS_POR_ANIO, datos.frecuencia)
    ) {
        return false;
    }

    if (
        datos.periodo !== undefined &&
        !Object.hasOwn(PERIODOS, datos.periodo)
    ) {
        return false;
    }

    if (
        datos.monto !== undefined &&
        datos.monto !== "" &&
        !numeroValido(datos.monto)
    ) {
        return false;
    }

    if (
        datos.semanasMostrar !== undefined &&
        (
            !numeroValido(datos.semanasMostrar) ||
            !Number.isInteger(Number(datos.semanasMostrar)) ||
            Number(datos.semanasMostrar) < 1 ||
            Number(datos.semanasMostrar) > 156
        )
    ) {
        return false;
    }

    const categoriasLimpias = limpiarCategorias(datos.categorias);
    const extrasOriginales = datos.otrosIngresos === undefined
        ? []
        : datos.otrosIngresos;

    if (!Array.isArray(extrasOriginales)) {
        return false;
    }

    for (const extra of extrasOriginales) {
        if (
            !extra ||
            typeof extra !== "object" ||
            Array.isArray(extra) ||
            typeof extra.nombre !== "string" ||
            !numeroValido(extra.monto) ||
            !Object.hasOwn(FRECUENCIAS_EXTRA, extra.frecuencia) ||
            (
                extra.modo !== undefined &&
                extra.modo !== "promedio" &&
                extra.modo !== "golpe"
            ) ||
            typeof extra.sumar !== "boolean" ||
            !Array.isArray(extra.destinos) ||
            extra.destinos.some(id => typeof id !== "string" || !ids.has(id))
        ) {
            return false;
        }

        for (const [campo, minimo, maximo] of [
            ["diasPorSemana", 1, 7],
            ["semana", 1, 520],
            ["repetir", 0, 520]
        ]) {
            if (
                extra[campo] !== undefined &&
                (
                    !numeroValido(extra[campo]) ||
                    !Number.isInteger(Number(extra[campo])) ||
                    Number(extra[campo]) < minimo ||
                    Number(extra[campo]) > maximo
                )
            ) {
                return false;
            }
        }
    }

    const extrasLimpios = limpiarExtras(
        extrasOriginales,
        idsDe(categoriasLimpias)
    );

    const ahorroPlural = datos.movimientosAhorros;
    const ahorroSingular = datos.movimientosAhorro;

    if (
        ahorroPlural !== undefined &&
        ahorroSingular !== undefined &&
        JSON.stringify(ahorroPlural) !== JSON.stringify(ahorroSingular)
    ) {
        return false;
    }

    const ahorroLimpio = limpiarMovimientosAhorro(
        ahorroPlural !== undefined ? ahorroPlural : ahorroSingular
    );

    const deudasLimpias = limpiarDeudas(datos.deudas);
    const gruposLimpios = limpiarGruposDeudas(datos.gruposDeudas);
    const nominasLimpias = limpiarNominas(datos.nominas);

    if (
        ahorroLimpio === null ||
        deudasLimpias === null ||
        gruposLimpios === null ||
        nominasLimpias === null
    ) {
        return false;
    }

    const idsGrupos = new Set(
        gruposLimpios.map(function (grupo) {
            return grupo.id;
        })
    );

    const hayGrupoInexistente = deudasLimpias.some(function (deuda) {
        return deuda.grupoId !== null && !idsGrupos.has(deuda.grupoId);
    });

    if (
        hayGrupoInexistente ||
        !validarFondosGrupos(gruposLimpios, deudasLimpias) ||
        !validarOrigenesNomina(
            nominasLimpias,
            deudasLimpias,
            gruposLimpios
        )
    ) {
        return false;
    }

    const historialLimpio = limpiarHistorialCorrecciones(
        datos.historialCorrecciones, nominasLimpias,
        { deudas: deudasLimpias, gruposDeudas: gruposLimpios }
    );
    if (historialLimpio === null) return false;

    const gestionLimpia = limpiarGestion(datos.gestion, { nominas: nominasLimpias });
    if (!gestionLimpia) return false;
    const categoriasGastosLimpias = limpiarCategoriasGastos(datos.categoriasGastos);
    const gastosLimpios = categoriasGastosLimpias &&
        limpiarGastosBasicos(datos.gastosBasicos, categoriasGastosLimpias, nominasLimpias);
    if (!categoriasGastosLimpias || !gastosLimpios ||
        !validarDisponibilidadCompleta(nominasLimpias, deudasLimpias, gruposLimpios, gastosLimpios, ahorroLimpio, gestionLimpia) || !validarOrigenAhorro(ahorroLimpio, nominasLimpias)) return false;

    const mejorasLimpias = limpiarMejoras(datos.mejoras, {
        nominas: nominasLimpias, movimientosAhorros: ahorroLimpio, gastosBasicos: gastosLimpios,
        categoriasGastos: categoriasGastosLimpias
    });
    if (!mejorasLimpias) return false;
    if (soloValidar === "normalizar") return {
        frecuencia: datos.frecuencia ?? "mensual", monto: datos.monto === undefined ? "" : String(datos.monto),
        periodo: datos.periodo ?? "semanal", semanasMostrar: datos.semanasMostrar === undefined ? "26" : String(datos.semanasMostrar),
        categorias: categoriasLimpias, otrosIngresos: extrasLimpios, movimientosAhorros: ahorroLimpio,
        deudas: deudasLimpias, gruposDeudas: gruposLimpios, nominas: nominasLimpias,
        categoriasGastos: categoriasGastosLimpias, gastosBasicos: gastosLimpios,
        historialCorrecciones: historialLimpio, mejoras: mejorasLimpias, gestion: gestionLimpia
    };
    if (soloValidar) return true;

    campoFrecuencia.value = datos.frecuencia ?? "mensual";
    campoMonto.value = datos.monto === undefined ? "" : String(datos.monto);
    campoPeriodo.value = datos.periodo ?? "semanal";
    campoSemanas.value = datos.semanasMostrar === undefined
        ? "26"
        : String(datos.semanasMostrar);

    categorias = categoriasLimpias;
    otrosIngresos = extrasLimpios;
    movimientosAhorros = ahorroLimpio;
    deudas = deudasLimpias;
    gruposDeudas = gruposLimpios;
    nominas = nominasLimpias;
    categoriasGastos = categoriasGastosLimpias;
    gastosBasicos = gastosLimpios;
    historialCorrecciones = historialLimpio;
    mejoras = mejorasLimpias;
    gestion = gestionLimpia;
    baseFechasMejoras = copiar({ nominas, movimientosAhorros, deudas, gruposDeudas });
    estadoDeudasGuardado = capturarEstadoDeudas();

    return true;
}

function cargar() {
    try {
        const texto = localStorage.getItem(CLAVE_GUARDADO);
        ultimoTextoGuardado = texto;

        if (texto === null) {
            const iniciales = crearDatosIniciales();
            aplicarDatos(iniciales);
            reinicioActual = iniciales.reinicioId;
            return;
        }

        const datos = JSON.parse(texto);
        const idGuardado = leerIdReinicio(datos);

        if (!aplicarDatos(datos)) {
            throw new Error("Los datos guardados no son válidos.");
        }

        reinicioActual = idGuardado;
    } catch (error) {
        guardadoHabilitado = false;
        estadoGuardado.className = "aviso error";
        estadoGuardado.textContent =
            "No se pudieron recuperar los datos. " +
            "El guardado automático está detenido.";

        console.warn("No se pudo cargar lo guardado:", error);
    }
}

//Copia de seguridad
function mostrarMensajeCopia(texto, esError) {
    mensajeCopia.textContent = texto;
    mensajeCopia.className = esError ? "aviso error" : "aviso ok";
}

function esCopiaValida(contenido) {
    return typeof contenido === "object" &&
        contenido !== null &&
        contenido.app === "finanzas-personal" &&
        [1, 2, 3, 4, 5, 6, 7, 8, 9].includes(contenido.version) &&
        typeof contenido.datos === "object" &&
        contenido.datos !== null &&
        !Array.isArray(contenido.datos) && (contenido.version < 8 || contenido.datos.mejoras?.version === 1) && (contenido.version < 9 || contenido.datos.gestion?.version === 1);
}

function crearCopiaLocal() {
    if (!guardadoHabilitado || reinicioDetectado || localStorage.getItem(CLAVE_GUARDADO) !== ultimoTextoGuardado) {
        throw new Error("Recupera o recarga los datos antes de crear una copia.");
    }
    const datos = copiar(construirPaquete());
    if (!aplicarDatos(datos, true)) throw new Error("Los datos no superaron la validación.");
    return { app: "finanzas-personal", version: 9, creadaEn: new Date().toISOString(), datos };
}

function actualizarEstadoRespaldo() {
    const aviso = document.getElementById("estado-respaldo");
    try {
        const fecha = localStorage.getItem("finanzas-respaldo-info-v1");
        aviso.textContent = fecha && Number.isFinite(Date.parse(fecha))
            ? "Última descarga solicitada: " + new Date(fecha).toLocaleString("es-MX") + ". Comprueba que conservas el archivo."
            : "Todavía no has descargado una copia desde esta versión. Guarda una antes de cambiar de dispositivo.";
    } catch { aviso.textContent = "Descarga una copia para conservar tus datos fuera del navegador."; }
}
function exportarCopia() {
    try {
        const copia = crearCopiaLocal();
        const texto = JSON.stringify(copia, null, 2);
        const archivo = new Blob([texto], { type: "application/json" });
        const direccion = URL.createObjectURL(archivo);
        const enlace = document.createElement("a");
        enlace.href = direccion;
        enlace.download = "mis-finanzas-" + fechaLocalGasto() + "-" + Date.now() + ".json";
        document.body.appendChild(enlace); enlace.click(); enlace.remove();
        setTimeout(() => URL.revokeObjectURL(direccion), 1000);
        try { localStorage.setItem("finanzas-respaldo-info-v1", copia.creadaEn); } catch {}
        actualizarEstadoRespaldo();
        mostrarMensajeCopia("Descarga solicitada. Comprueba el archivo en Descargas y guárdalo fuera del navegador.", false);
    } catch (error) { mostrarMensajeCopia(error.message, true); }
}
function restaurarCopiaLocal(contenido) {
    if (reinicioDetectado) throw new Error("Recarga antes de restaurar una copia.");
    if (!esCopiaValida(contenido) || !aplicarDatos(contenido.datos, true)) {
        throw new Error("La copia contiene datos inválidos o incompatibles. No se aplicó.");
    }
    if (localStorage.getItem(CLAVE_GUARDADO) !== ultimoTextoGuardado) {
        throw new Error("Otra pestaña cambió los datos. Recarga antes de restaurar.");
    }
    const normalizados = aplicarDatos(contenido.datos, "normalizar");
    normalizados.reinicioId = generarId([]);
    const texto = serializarDatosLocales(normalizados);
    try { localStorage.setItem(CLAVE_GUARDADO, texto); }
    catch { throw new Error("No se pudo guardar la copia. Los datos anteriores se conservan."); }
    aplicarDatos(normalizados);
    reinicioActual = normalizados.reinicioId;
    ultimoTextoGuardado = texto;
    guardadoHabilitado = true;
    construirTabla(); construirExtras(); actualizarPantalla(); cerrarEditorDeuda(); invalidarProyeccionDeudas();
    formularioAhorro.reset(); formularioDeuda.reset(); formularioApartado.reset(); formularioNomina.reset();
    prepararCategoriasNomina(); mostrarAhorro(); mostrarDeudas(); mostrarHistorialNominas();
    mensajeAhorro.textContent = ""; mensajeDeudas.textContent = ""; mensajeNomina.textContent = "";
    if (typeof mostrarPanelesMejoras === "function") mostrarPanelesMejoras();
    return true;
}
function importarCopia(archivo) {
    if (archivo.size > 8 * 1024 * 1024) { mostrarMensajeCopia("La copia supera los 8 MB admitidos.", true); return; }
    const lector = new FileReader();
    lector.onload = function () {
        try {
            const contenido = JSON.parse(lector.result);
            if (!esCopiaValida(contenido) || !aplicarDatos(contenido.datos, true)) {
                throw new Error("Ese archivo no contiene una copia válida y compatible.");
            }
            const datos = contenido.datos;
            const resumen = (datos.nominas ?? []).length + " ingresos, " + (datos.deudas ?? []).length + " deudas, " +
                (datos.gastosBasicos ?? []).length + " gastos y " + (datos.mejoras?.metas ?? []).length + " metas.";
            if (!confirm("Vas a cargar: " + resumen + "\nSe reemplazarán los datos de este dispositivo, no se mezclarán. " +
                "Las secciones ausentes en copias antiguas quedarán vacías. Descarga antes la copia actual si quieres conservarla. ¿Continuar?")) return;
            restaurarCopiaLocal(contenido);
            mostrarMensajeCopia("Copia restaurada y guardada en este dispositivo.", false);
        } catch (error) { mostrarMensajeCopia(error.message || "No se pudo leer la copia.", true); }
    };
    lector.onerror = () => mostrarMensajeCopia("No se pudo abrir el archivo.", true);
    lector.readAsText(archivo);
}

//Categorias
function crearFila(cat) {
    const fila = document.createElement("tr");

    fila.innerHTML = `
        <td><input class="campo-nombre" type="text" placeholder="Nombre" aria-label="Nombre de la categoría"></td>
        <td><input class="campo-pct" type="number" inputmode="decimal" min="0" max="100" step="any" aria-label="Porcentaje"></td>
        <td class="c-sueldo"></td>
        <td class="c-extras"></td>
        <td class="c-total"></td>
        <td><button class="boton-borrar" type="button" aria-label="Eliminar categoría">✕</button></td>
    `;

    const campoNombre = fila.querySelector(".campo-nombre");
    const campoPct = fila.querySelector(".campo-pct");
    const botonBorrar = fila.querySelector(".boton-borrar");

    campoNombre.value = cat.nombre;
    campoPct.value = cat.porcentaje;

    campoNombre.addEventListener("input", function () {
        cat.nombre = campoNombre.value;
        construirExtras();
        actualizarPantalla();
    });

    campoPct.addEventListener("input", function () {
        cat.porcentaje = leerNumero(campoPct.value);
        actualizarPantalla();
    });

    botonBorrar.addEventListener("click", function () {
        eliminarCategoria(cat);
    });

    return fila;
}

function construirTabla() {
    cuerpoTabla.innerHTML = "";
    for (const cat of categorias) {
        cuerpoTabla.appendChild(crearFila(cat));
    }
}

function agregarCategoria() {
    categorias.push({
        id: generarId(idsDe(categorias)),
        nombre: "",
        porcentaje: 0
    });

    construirTabla();
    construirExtras();
    actualizarPantalla();
    cuerpoTabla.lastElementChild.querySelector(".campo-nombre").focus();
}

function quitarDestino(id) {
    for (const extra of otrosIngresos) {
        const posicion = extra.destinos.indexOf(id);
        if (posicion !== -1) {
            extra.destinos.splice(posicion, 1);
        }
    }
}

async function eliminarCategoria(cat) {
    if (!await confirmarBorrado("¿Eliminar esta categoría del reparto?")) return;
    quitarDestino(cat.id);
    const posicion = categorias.indexOf(cat);
    categorias.splice(posicion, 1);
    construirTabla();
    construirExtras();
    actualizarPantalla();
}

//Otros ingresos
function crearTarjetaExtra(extra) {
    const tarjeta = document.createElement("div");
    tarjeta.className = "extra";

    tarjeta.innerHTML = `
        <div class="extra-fila">
            <input class="extra-nombre" type="text" placeholder="Nombre" aria-label="Nombre del ingreso">
            <button class="boton-borrar" type="button" aria-label="Eliminar ingreso">✕</button>
        </div>
        <div class="extra-fila">
            <label>Monto <input class="extra-monto" type="number" inputmode="decimal" min="0" step="0.01"></label>
            <select class="extra-modo" aria-label="Cómo lo cuento">
                <option value="promedio">Promediado</option>
                <option value="golpe">Llega de golpe</option>
            </select>
        </div>
        <div class="extra-fila">
            <select class="extra-frecuencia" aria-label="Cada cuánto"></select>
            <label class="caja-dias">Días por semana <input class="extra-dias" type="number" inputmode="numeric" min="1" max="7" step="1"></label>
            <label class="caja-golpe">En la semana <input class="extra-semana" type="number" inputmode="numeric" min="1" max="520" step="1"></label>
            <label class="caja-golpe">Se repite cada <input class="extra-repetir" type="number" inputmode="numeric" min="0" max="520" step="1"> semanas (0 = una vez)</label>
        </div>
        <label><input class="extra-sumar" type="checkbox"> Sumar a mi reparto</label>
        <div class="destinos">
            <span>Va a:</span>
            <span class="lista-destinos"></span>
        </div>
        <p class="extra-resultado"></p>
    `;

    const nombreExtra = tarjeta.querySelector(".extra-nombre");
    const montoExtra = tarjeta.querySelector(".extra-monto");
    const modoExtra = tarjeta.querySelector(".extra-modo");
    const frecuenciaExtra = tarjeta.querySelector(".extra-frecuencia");
    const cajaDias = tarjeta.querySelector(".caja-dias");
    const diasExtra = tarjeta.querySelector(".extra-dias");
    const cajasGolpe = tarjeta.querySelectorAll(".caja-golpe");
    const semanaExtra = tarjeta.querySelector(".extra-semana");
    const repetirExtra = tarjeta.querySelector(".extra-repetir");
    const sumarExtra = tarjeta.querySelector(".extra-sumar");
    const listaDestinos = tarjeta.querySelector(".lista-destinos");
    const botonBorrar = tarjeta.querySelector(".boton-borrar");

    for (const clave in FRECUENCIAS_EXTRA) {
        const opcion = document.createElement("option");
        opcion.value = clave;
        opcion.textContent = FRECUENCIAS_EXTRA[clave].texto;
        frecuenciaExtra.appendChild(opcion);
    }

    for (const cat of categorias) {
        const etiqueta = document.createElement("label");
        const casilla = document.createElement("input");
        casilla.type = "checkbox";
        casilla.checked = extra.destinos.includes(cat.id);

        casilla.addEventListener("change", function () {
            if (casilla.checked) {
                if (!extra.destinos.includes(cat.id)) {
                    extra.destinos.push(cat.id);
                }
            } else {
                const posicion = extra.destinos.indexOf(cat.id);
                if (posicion !== -1) {
                    extra.destinos.splice(posicion, 1);
                }
            }
            actualizarPantalla();
        });

        etiqueta.appendChild(casilla);
        const nombre = cat.nombre.trim() === "" ? "(sin nombre)" : cat.nombre;
        etiqueta.appendChild(document.createTextNode(" " + nombre));
        listaDestinos.appendChild(etiqueta);
    }

    nombreExtra.value = extra.nombre;
    montoExtra.value = extra.monto;
    modoExtra.value = extra.modo;
    frecuenciaExtra.value = extra.frecuencia;
    diasExtra.value = extra.diasPorSemana;
    semanaExtra.value = extra.semana;
    repetirExtra.value = extra.repetir;
    sumarExtra.checked = extra.sumar;

    function ajustarCampos() {
        const golpe = esDeGolpe(extra);
        frecuenciaExtra.hidden = golpe;
        cajaDias.hidden = golpe || !FRECUENCIAS_EXTRA[extra.frecuencia].usaDias;

        for (const caja of cajasGolpe) {
            caja.hidden = !golpe;
        }
    }

    ajustarCampos();

    nombreExtra.addEventListener("input", function () {
        extra.nombre = nombreExtra.value;
        actualizarPantalla();
    });

    montoExtra.addEventListener("input", function () {
        extra.monto = leerNumero(montoExtra.value);
        actualizarPantalla();
    });

    modoExtra.addEventListener("change", function () {
        extra.modo = modoExtra.value;
        ajustarCampos();
        actualizarPantalla();
    });

    frecuenciaExtra.addEventListener("change", function () {
        extra.frecuencia = frecuenciaExtra.value;
        ajustarCampos();
        actualizarPantalla();
    });

    semanaExtra.addEventListener("input", function () {
        extra.semana = leerEntero(semanaExtra.value, 1, 520);
        actualizarPantalla();
    });

    repetirExtra.addEventListener("input", function () {
        extra.repetir = leerEntero(repetirExtra.value, 0, 520);
        actualizarPantalla();
    });

    diasExtra.addEventListener("input", function () {
        extra.diasPorSemana = leerDias(diasExtra.value);
        actualizarPantalla();
    });

    sumarExtra.addEventListener("change", function () {
        extra.sumar = sumarExtra.checked;
        actualizarPantalla();
    });

    botonBorrar.addEventListener("click", function () {
        eliminarExtra(extra);
    });

    return tarjeta;
}

function construirExtras() {
    listaExtras.innerHTML = "";
    for (const extra of otrosIngresos) {
        listaExtras.appendChild(crearTarjetaExtra(extra));
    }
}

function agregarExtra() {
    otrosIngresos.push({
        nombre: "",
        monto: 0,
        modo: "promedio",
        frecuencia: "mensual",
        diasPorSemana: 5,
        semana: 1,
        repetir: 0,
        sumar: false,
        destinos: []
    });

    construirExtras();
    actualizarPantalla();
    listaExtras.lastElementChild.querySelector(".extra-nombre").focus();
}

async function eliminarExtra(extra) {
    if (!await confirmarBorrado("¿Eliminar este ingreso del simulador?")) return;
    const posicion = otrosIngresos.indexOf(extra);
    otrosIngresos.splice(posicion, 1);
    construirExtras();
    actualizarPantalla();
}

function mostrarExtras() {
    const periodo = campoPeriodo.value;
    const textoPeriodo = PERIODOS[periodo].toLowerCase();
    let totalTodos = 0;
    let totalSumados = 0;

    for (let i = 0; i < otrosIngresos.length; i++) {
        const extra = otrosIngresos[i];
        const tieneDestino = destinosValidos(extra).length > 0;
        let mensaje = "";

        if (esDeGolpe(extra)) {
            mensaje = formatoMoneda.format(extra.monto) +
                " llegan de golpe en la semana " + extra.semana;

            if (extra.repetir > 0) {
                mensaje += " y cada " + extra.repetir + " semanas";
            } else {
                mensaje += " (una sola vez)";
            }
        } else {
            const calculo = calcularExtra(extra);
            mensaje = formatoMoneda.format(calculo[periodo]) + " " +
                textoPeriodo + " · " +
                formatoMoneda.format(calculo.anual) + " al año";

            totalTodos += calculo[periodo];
            if (extra.sumar && tieneDestino) {
                totalSumados += calculo[periodo];
            }
        }

        if (extra.sumar && !tieneDestino) {
            mensaje += " · Elige a dónde va";
        }

        listaExtras.children[i].querySelector(".extra-resultado").textContent =
            mensaje;
    }

    document.getElementById("extras-total").textContent =
        formatoMoneda.format(totalTodos) + " " + textoPeriodo;

    document.getElementById("extras-sumados").textContent =
        formatoMoneda.format(totalSumados) + " " + textoPeriodo;
}

//Pantalla
function agregarCelda(fila, texto) {
    const celda = document.createElement("td");
    celda.textContent = texto;
    fila.appendChild(celda);
}

function mostrarCalendario(eq) {
    const cantidad = leerEntero(campoSemanas.value, 1, 156);
    const calendario = calcularCalendario(eq, cantidad);
    let totalSueldo = 0;
    let totalPromediados = 0;
    let totalDeGolpe = 0;

    cuerpoCalendario.innerHTML = "";

    for (const s of calendario.semanas) {
        const fila = document.createElement("tr");
        const textos = [];

        for (const ingreso of s.llegan) {
            const nombre = ingreso.nombre.trim() === ""
                ? "(sin nombre)"
                : ingreso.nombre;

            textos.push(nombre + " " + formatoMoneda.format(ingreso.monto));
        }

        agregarCelda(fila, String(s.semana));
        agregarCelda(fila, formatoMoneda.format(s.sueldo));
        agregarCelda(fila, formatoMoneda.format(s.promediados));
        agregarCelda(fila, formatoMoneda.format(s.deGolpe));
        agregarCelda(fila, formatoMoneda.format(s.total));
        agregarCelda(fila, textos.join(", "));

        if (s.llegan.length > 0) {
            fila.className = "con-golpe";
        }

        cuerpoCalendario.appendChild(fila);
        totalSueldo += s.sueldo;
        totalPromediados += s.promediados;
        totalDeGolpe += s.deGolpe;
    }

    document.getElementById("cal-sueldo").textContent =
        formatoMoneda.format(totalSueldo);
    document.getElementById("cal-promediados").textContent =
        formatoMoneda.format(totalPromediados);
    document.getElementById("cal-golpe").textContent =
        formatoMoneda.format(totalDeGolpe);
    document.getElementById("cal-total").textContent =
        formatoMoneda.format(totalSueldo + totalPromediados + totalDeGolpe);

    cuerpoResumenCategorias.innerHTML = "";

    for (let i = 0; i < calendario.porCategoria.length; i++) {
        const categoria = calendario.porCategoria[i];
        const fila = document.createElement("tr");
        const nombre = categorias[i].nombre.trim() === ""
            ? "(sin nombre)"
            : categorias[i].nombre;

        agregarCelda(fila, nombre);
        agregarCelda(fila, formatoMoneda.format(categoria.sueldo));
        agregarCelda(fila, formatoMoneda.format(categoria.promediados));
        agregarCelda(fila, formatoMoneda.format(categoria.deGolpe));
        agregarCelda(
            fila,
            formatoMoneda.format(
                categoria.sueldo + categoria.promediados + categoria.deGolpe
            )
        );
        cuerpoResumenCategorias.appendChild(fila);
    }
}

function mostrarEquivalentes(eq) {
    document.getElementById("eq-semanal").textContent =
        formatoMoneda.format(eq.semanal);
    document.getElementById("eq-cada2semanas").textContent =
        formatoMoneda.format(eq.cada2semanas);
    document.getElementById("eq-quincenal").textContent =
        formatoMoneda.format(eq.quincenal);
    document.getElementById("eq-mensual").textContent =
        formatoMoneda.format(eq.mensual);
    document.getElementById("eq-anual").textContent =
        formatoMoneda.format(eq.anual);
}

function mostrarReparto(eq) {
    const periodo = campoPeriodo.value;
    const filas = calcularReparto(eq);
    let totalSueldo = 0;
    let totalExtras = 0;

    for (let i = 0; i < filas.length; i++) {
        const sueldo = filas[i].sueldo[periodo];
        const extras = filas[i].extras[periodo];
        const filaHtml = cuerpoTabla.rows[i];

        filaHtml.querySelector(".c-sueldo").textContent =
            formatoMoneda.format(sueldo);
        filaHtml.querySelector(".c-extras").textContent =
            formatoMoneda.format(extras);
        filaHtml.querySelector(".c-total").textContent =
            formatoMoneda.format(sueldo + extras);

        totalSueldo += sueldo;
        totalExtras += extras;
    }

    document.getElementById("tot-pct").textContent = sumaPorcentajes() + "%";
    document.getElementById("tot-sueldo").textContent =
        formatoMoneda.format(totalSueldo);
    document.getElementById("tot-extras").textContent =
        formatoMoneda.format(totalExtras);
    document.getElementById("tot-total").textContent =
        formatoMoneda.format(totalSueldo + totalExtras);

    document.getElementById("resumen-ingreso").textContent =
        "Sueldo " + formatoMoneda.format(eq[periodo]) +
        " + otros ingresos " + formatoMoneda.format(totalExtras) +
        " = " + formatoMoneda.format(eq[periodo] + totalExtras) +
        " (" + PERIODOS[periodo].toLowerCase() + ")";
}

function mostrarAviso() {
    const problemas = revisarReparto();
    const aviso = document.getElementById("aviso");

    if (problemas.length === 0) {
        aviso.textContent = "Los porcentajes suman 100% ✔";
        aviso.className = "aviso ok";
    } else {
        aviso.textContent = problemas.join(" ");
        aviso.className = "aviso error";
    }
}

function actualizarPantalla() {
    const eq = calcularEquivalentes(campoFrecuencia.value, leerMonto());
    mostrarEquivalentes(eq);
    mostrarReparto(eq);
    mostrarExtras();
    mostrarCalendario(eq);
    mostrarAviso();
    mostrarAhorro();
    mostrarDeudas();
    mostrarHistorialNominas();
    guardar();
}

function llenarSelectorPeriodo() {
    for (const clave in PERIODOS) {
        const opcion = document.createElement("option");
        opcion.value = clave;
        opcion.textContent = PERIODOS[clave];
        campoPeriodo.appendChild(opcion);
    }
}

async function restablecer() {
    if (await confirmarBorrado(
        "¿Restablecer sueldo, categorías y otros ingresos? " +
        "Tu ahorro, deudas y nóminas se conservarán."
    )) {
        categorias = copiarCategoriasIniciales();
        otrosIngresos = copiar(EXTRAS_INICIALES);
        campoFrecuencia.value = "mensual";
        campoMonto.value = "";
        campoPeriodo.value = "semanal";
        campoSemanas.value = 26;

        formularioNomina.reset();
        prepararCategoriasNomina();
        mensajeNomina.textContent = "";

        construirTabla();
        construirExtras();
        actualizarPantalla();
    }
}

function cambiarVista(nombreVista) {
    if(typeof activarPaginaFinanzas==="function"){activarPaginaFinanzas(nombreVista==="reparto"?"ingresos":nombreVista,false);return;}
    document.getElementById("vista-gastos").hidden = true;
    const vistas = [
        { nombre: "reparto", boton: botonReparto, panel: vistaReparto },
        { nombre: "ahorro", boton: botonAhorro, panel: vistaAhorro },
        { nombre: "deudas", boton: botonDeudas, panel: vistaDeudas }
    ];

    const existe = vistas.some(function (vista) {
        return vista.nombre === nombreVista;
    });

    if (!existe) {
        return;
    }

    for (const vista of vistas) {
        const activa = vista.nombre === nombreVista;
        vista.panel.hidden = !activa;
        vista.boton.setAttribute("aria-pressed", String(activa));
    }
}

//Ahorro
function mostrarAhorro() {
    const saldoCentavos = calcularSaldoAhorro(movimientosAhorros);
    saldoAhorro.textContent = formatoMoneda.format(saldoCentavos / 100);
    historialAhorro.replaceChildren();

    for (const movimiento of movimientosAhorros) {
        const elemento = document.createElement("li");
        elemento.className = "movimiento-ahorro";
        elemento.dataset.tipo = movimiento.tipo;

        const detalle = document.createElement("div");
        detalle.className = "movimiento-ahorro__detalle";

        const concepto = document.createElement("strong");
        concepto.className = "movimiento-ahorro__concepto";
        concepto.textContent = movimiento.concepto;

        const tipo = document.createElement("span");
        tipo.className = "movimiento-ahorro__tipo";

        const esAportacion = movimiento.tipo === "aportacion";
        tipo.textContent = esAportacion ? "Aportación" : "Retiro";

        const importe = document.createElement("strong");
        importe.className = "movimiento-ahorro__importe";
        importe.textContent = (esAportacion ? "+" : "−") +
            formatoMoneda.format(movimiento.montoCentavos / 100);

        detalle.appendChild(concepto);
        detalle.appendChild(tipo);
        elemento.appendChild(detalle);
        elemento.appendChild(importe);
        detalleOrigenAhorro(movimiento, elemento);
        historialAhorro.appendChild(elemento);
    }

    ahorroVacio.hidden = movimientosAhorros.length > 0;
}

function registrarMovimientoAhorro(evento) {
    evento.preventDefault();
    const ok = registrarAhorroVinculado(campoTipoAhorro.value, campoConceptoAhorro.value.trim(),
        campoMontoAhorro.value, document.getElementById("ahorro-nomina").value,
        document.getElementById("ahorro-meta").value, document.getElementById("fecha-ahorro").value);
    if (ok) { campoConceptoAhorro.value = ""; campoMontoAhorro.value = ""; }
    mensajeAhorro.className = ok ? "aviso ok" : "aviso error";
    mensajeAhorro.textContent = ok ? "Movimiento registrado con su origen." :
        "No se registró. Revisa la fecha, el concepto, la nómina y el saldo del destino de ahorro elegido.";
}

//Eventos
campoMonto.addEventListener("input", actualizarPantalla);
campoFrecuencia.addEventListener("change", actualizarPantalla);
campoPeriodo.addEventListener("change", actualizarPantalla);
campoSemanas.addEventListener("input", actualizarPantalla);
botonAgregar.addEventListener("click", agregarCategoria);
botonAgregarExtra.addEventListener("click", agregarExtra);
botonRestablecer.addEventListener("click", restablecer);
botonExportar.addEventListener("click", exportarCopia);

botonImportar.addEventListener("click", function () {
    campoArchivo.click();
});

campoArchivo.addEventListener("change", function () {
    const archivo = campoArchivo.files[0];
    if (archivo) {
        importarCopia(archivo);
    }
    campoArchivo.value = "";
});

botonReparto.addEventListener("click", function () {
    cambiarVista("reparto");
});

botonAhorro.addEventListener("click", function () {
    cambiarVista("ahorro");
});

botonDeudas.addEventListener("click", function () {
    cambiarVista("deudas");
});

formularioAhorro.addEventListener("submit", registrarMovimientoAhorro);

function leerIdReinicio(datos) {
    if (
        datos.reinicioId === undefined ||
        datos.reinicioId === null
    ) {
        return null;
    }
    if (
        typeof datos.reinicioId !== "string" ||
        datos.reinicioId.trim() === ""
    ) {
        throw new Error("La marca de reincio no es valido");
    }

    return datos.reinicioId;
}

function crearDatosIniciales() {
    return {
        reinicioId: generarId([]),
        mejoras: mejorasIniciales(),
        frecuencia: "mensual",
        monto: "",
        periodo: "semanal",
        semanasMostrar: "26",
        categorias: copiarCategoriasIniciales(),
        otrosIngresos: [],
        movimientosAhorros: [],
        deudas: [],
        gruposDeudas: [],
        nominas: [],
        historialCorrecciones: [],
        categoriasGastos: [],
        gastosBasicos: []
    };
}

function bloquearPantallaPorReinicio(texto) {
    reinicioDetectado = true;
    guardadoHabilitado = false;

    document.querySelector("main").inert = true;

    avisoReinicioExterno.hidden = false;
    textoReinicioExterno.textContent = texto;
    botonRecargarReinicio.focus();
}

function recargarTrasReinicio() {
    window.location.reload();
}

async function restablecerTodosLosDatos(evento) {
    evento.preventDefault();
    if (reinicioDetectado) return;
    if (!await confirmarBorrado("¿Eliminar todos los datos de este navegador?")) return;

    //Eliminar la copia anterior, incluso si está dañada o no queda espacio
    try {
        localStorage.removeItem(CLAVE_GUARDADO);
        if (localStorage.getItem(CLAVE_GUARDADO) !== null) {
            throw new Error("La copia sigue almacenada.");
        }
    } catch (error) {
        mensajeBorrado.textContent =
            "No se pudo eliminar la copia guardada. No se ha reiniciado la aplicación. " +
            "Revisa los permisos de almacenamiento de este sitio e inténtalo de nuevo.";
        return;
    }

    const iniciales = crearDatosIniciales();
    aplicarDatos(iniciales);
    reinicioActual = iniciales.reinicioId;
    ultimoTextoGuardado = null;
    correccionPendiente = null;
    try { localStorage.removeItem("finanzas-respaldo-info-v1"); } catch {}
    try { sessionStorage.setItem("finanzas-aviso-borrado", "1"); } catch {}
    bloquearPantallaPorReinicio("Datos anteriores eliminados. Recarga para empezar de cero.");
    recargarTrasReinicio();
}

function mostrarResumenBorrado() {
    const resumen = document.getElementById("resumen-borrado");
    resumen.textContent = guardadoHabilitado
        ? "Se eliminarán " + nominas.length + " ingresos, " + deudas.length + " deudas, " +
          gruposDeudas.length + " grupos, " + gastosBasicos.length + " gastos y " +
          movimientosAhorros.length + " movimientos de ahorro, junto con sus fondos, categorías e historial."
        : "La copia guardada no se puede recuperar. Puedes eliminarla igualmente para empezar de cero.";
    document.getElementById("ubicacion-borrado").textContent = location.protocol === "file:"
        ? "Estás abriendo un archivo local. El borrado afecta a los datos que este navegador asigna a esta página."
        : "Este borrado corresponde a: " + location.origin;
}

document.getElementById("gestionar-datos").addEventListener("click", () => {
    document.getElementById("panel-borrado").open = true;
    mostrarResumenBorrado();
    document.getElementById("titulo-borrado").focus({ preventScroll: true });
    document.getElementById("panel-borrado").scrollIntoView({ block: "start" });
});
document.getElementById("panel-borrado").addEventListener("toggle", mostrarResumenBorrado);

function revisarReinicioEnOtraPestana(evento) {
    if (
        evento.storageArea !== localStorage ||
        (evento.key !== CLAVE_GUARDADO && evento.key !== null)
    ) {
        return;
    }

    if (evento.key === null || evento.newValue === null) {
        bloquearPantallaPorReinicio("Los datos de esta web se eliminaron en otra pestaña. Recarga para empezar con los datos actuales.");
        return;
    }

    try {
        const idGuardado = evento.newValue === null
            ? null
            : leerIdReinicio(JSON.parse(evento.newValue));
        if (idGuardado !== reinicioActual) {
            bloquearPantallaPorReinicio(
                "Los datos se restablecieron en otra pestaña" +
                "Recarga antes de continuar"
            );
        }
    } catch (error) {
        bloquearPantallaPorReinicio(
            "Los datos guardados cambiaron y no se pueden leer" +
            "Recarga para revisarlos"
        );
    }
}

formularioBorradoTotal.addEventListener(
    "submit",
    restablecerTodosLosDatos
);

botonRecargarReinicio.addEventListener(
    "click",
    recargarTrasReinicio
);

window.addEventListener(
    "storage",
    revisarReinicioEnOtraPestana
);

botonRespaldoAntesBorrar.addEventListener("click", function () {
    if (!guardadoHabilitado || reinicioDetectado) {
        mensajeBorrado.textContent =
            "No se pudo recuperar el estado actual. " +
            "No se generará una copia desde datos incompletos.";

        return;
    }

    exportarCopia();
});

//Arranque
llenarSelectorPeriodo();
campoPeriodo.value = "semanal";
cargar();
prepararCategoriasNomina();
construirTabla();
construirExtras();
actualizarPantalla();

mostrarResumenBorrado();
try {
    if (sessionStorage.getItem("finanzas-aviso-borrado") === "1") {
        sessionStorage.removeItem("finanzas-aviso-borrado");
        const aviso = document.getElementById("aviso-datos-borrados");
        aviso.hidden = false;
        aviso.textContent = guardadoHabilitado
            ? "Datos anteriores eliminados. Ya puedes registrar y guardar tus nuevos datos."
            : "Datos anteriores eliminados. El navegador aún no permite guardar nuevos datos; revisa sus permisos.";
    }
} catch {}

actualizarEstadoRespaldo();
