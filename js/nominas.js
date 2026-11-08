const PERIODOS_NOMINA = {
    unico: "Pago de golpe / único",
    semanal: "Semanal",
    catorcenal: "Catorcenal",
    quincenal: "Quincenal",
    mensual: "Mensual"
};

let nominas = [];
let categoriasBorradorNomina = [];

const formularioNomina = document.getElementById("formulario-nomina");
const campoReferenciaNomina = document.getElementById("referencia-nomina");
const campoNetoNomina = document.getElementById("neto-nomina");
const campoPeriodoNomina = document.getElementById("periodo-nomina");

const cajaPorcentajesNomina =
    document.getElementById("porcentajes-nomina");

const cuerpoVistaPreviaNomina =
    document.getElementById("vista-previa-nomina");

const totalNomina = document.getElementById("total-nomina");
const avisoNomina = document.getElementById("aviso-nomina");
const mensajeNomina = document.getElementById("mensaje-nomina");
const historialNominas = document.getElementById("historial-nominas");
const botonConfirmarNomina = document.getElementById("confirmar-nomina");

const botonUsarCategoriasNomina =
    document.getElementById("usar-categorias-nomina");

    function prepararCategoriasNomina() {
    categoriasBorradorNomina = categorias.map(function (categoria) {
        return {
            id: categoria.id,
            nombre: categoria.nombre,
            porcentaje: categoria.porcentaje
        };
    });

    cajaPorcentajesNomina.replaceChildren();

    categoriasBorradorNomina.forEach(function (categoria, indice) {
        const fila = document.createElement("div");
        fila.className = "porcentaje-nomina";

        const etiqueta = document.createElement("label");
        etiqueta.htmlFor = "porcentaje-nomina-" + indice;
        etiqueta.textContent = categoria.nombre;

        const campo = document.createElement("input");
        campo.id = "porcentaje-nomina-" + indice;
        campo.type = "number";
        campo.min = "0";
        campo.max = "100";
        campo.step = "0.01";
        campo.required = true;
        campo.value = categoria.porcentaje;

        campo.addEventListener("input", function () {
            categoria.porcentaje = campo.value === ""
                ? NaN
                : Number(campo.value);

            actualizarVistaPreviaNomina();
        });

        fila.appendChild(etiqueta);
        fila.appendChild(campo);
        cajaPorcentajesNomina.appendChild(fila);
    });

    actualizarVistaPreviaNomina();
}

function leerRepartoNomina() {
    const monto = convertirPesosACentavos(campoNetoNomina.value);

    if (monto === null) {
        throw new Error("Escribe un importe neto positivo.");
    }

    if (!Object.hasOwn(PERIODOS_NOMINA, campoPeriodoNomina.value)) {
        throw new Error("Selecciona el periodo de este pago.");
    }

    return {
        montoCentavos: monto,
        reparto: repartirNomina(monto, categoriasBorradorNomina)
    };
}

function actualizarVistaPreviaNomina() {
    cuerpoVistaPreviaNomina.replaceChildren();
    totalNomina.textContent = "";
    botonConfirmarNomina.disabled = true;

    try {
        const resultado = leerRepartoNomina();

        for (const categoria of resultado.reparto) {
            const fila = document.createElement("tr");

            const valores = [
                categoria.nombre,
                categoria.porcentaje + "%",
                formatoMoneda.format(categoria.montoCentavos / 100)
            ];

            for (const valor of valores) {
                const celda = document.createElement("td");
                celda.textContent = valor;
                fila.appendChild(celda);
            }

            cuerpoVistaPreviaNomina.appendChild(fila);
        }

        totalNomina.textContent =
            formatoMoneda.format(resultado.montoCentavos / 100);

        avisoNomina.className = "aviso ok";
        avisoNomina.textContent =
            "Reparto de un pago " +
            PERIODOS_NOMINA[campoPeriodoNomina.value].toLowerCase() +
            ". El total coincide con el neto recibido.";

        botonConfirmarNomina.disabled = false;
    } catch (error) {
        avisoNomina.className = "aviso error";
        avisoNomina.textContent = error.message;
    }
}

function registrarNomina(evento) {
    evento.preventDefault();

    if (!guardadoHabilitado) {
        mensajeNomina.className = "aviso error";
        mensajeNomina.textContent =
            "Recupera una copia válida antes de registrar pagos.";
        return;
    }

    try {
        const referencia = campoReferenciaNomina.value.trim();

        if (referencia === "" || referencia.length > 80) {
            throw new Error("Escribe una referencia de hasta 80 caracteres.");
        }

        const repetida = nominas.some(function (nomina) {
            return nomina.referencia.toLowerCase() ===
                referencia.toLowerCase();
        });

        if (repetida) {
            throw new Error(
                "Ya existe un pago con esa referencia. Usa una referencia distinta."
            );
        }

        const resultado = leerRepartoNomina();

        const usados = nominas.map(function (nomina) {
            return nomina.id;
        });

        nominas.push({
            version: 1,
            id: generarId(usados),
            referencia: referencia,
            periodo: campoPeriodoNomina.value,
            montoCentavos: resultado.montoCentavos,
            reparto: resultado.reparto
        });

        const guardada = guardar();

        formularioNomina.reset();
        prepararCategoriasNomina();
        mostrarHistorialNominas();

        mensajeNomina.className = guardada
            ? "aviso ok"
            : "aviso error";

        mensajeNomina.textContent = guardada
            ? "Pago y reparto registrados."
            : "Pago registrado en memoria. Descarga una copia antes de cerrar.";
    } catch (error) {
        mensajeNomina.className = "aviso error";
        mensajeNomina.textContent = error.message;
    }
}

function mostrarHistorialNominas() {
    historialNominas.replaceChildren();

    if (nominas.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "ayuda";
        vacio.textContent = "Todavía no has registrado pagos.";
        historialNominas.appendChild(vacio);
        return;
    }

    const recientesPrimero = [...nominas].reverse();

    for (const nomina of recientesPrimero) {
        const detalle = document.createElement("details");
        detalle.className = "nomina-registrada";

        const encabezado = document.createElement("summary");
        encabezado.textContent =
            nomina.referencia + " · " +
            PERIODOS_NOMINA[nomina.periodo] + " · " +
            formatoMoneda.format(nomina.montoCentavos / 100);

        const lista = document.createElement("ul");

        for (const categoria of nomina.reparto) {
            const elemento = document.createElement("li");

            elemento.textContent =
                categoria.nombre + ": " +
                categoria.porcentaje + "% — " +
                formatoMoneda.format(categoria.montoCentavos / 100);

            lista.appendChild(elemento);
        }

        detalle.appendChild(encabezado);
        detalle.appendChild(lista);
        historialNominas.appendChild(detalle);
    }
}

function limpiarNominas(lista) {
    if (lista === undefined) {
        return [];
    }

    if (!Array.isArray(lista)) {
        return null;
    }

    const limpias = [];
    const ids = new Set();
    const referencias = new Set();

    try {
        for (const nomina of lista) {
            if (
                typeof nomina !== "object" ||
                nomina === null ||
                Array.isArray(nomina) ||
                nomina.version !== 1 ||
                typeof nomina.id !== "string" ||
                nomina.id.trim() === "" ||
                ids.has(nomina.id) ||
                typeof nomina.referencia !== "string" ||
                nomina.referencia.trim() === "" ||
                nomina.referencia.trim().length > 80 ||
                !Object.hasOwn(PERIODOS_NOMINA, nomina.periodo)
            ) {
                return null;
            }

            const referencia = nomina.referencia.trim();
            const claveReferencia = referencia.toLowerCase();

            if (referencias.has(claveReferencia)) {
                return null;
            }

            const repartoComprobado = repartirNomina(
                nomina.montoCentavos,
                nomina.reparto
            );

            for (let i = 0; i < repartoComprobado.length; i++) {
                if (
                    repartoComprobado[i].montoCentavos !==
                    nomina.reparto[i].montoCentavos
                ) {
                    return null;
                }
            }

            ids.add(nomina.id);
            referencias.add(claveReferencia);

            limpias.push({
                version: 1,
                id: nomina.id,
                referencia: referencia,
                periodo: nomina.periodo,
                montoCentavos: nomina.montoCentavos,
                reparto: repartoComprobado
            });
        }

        return limpias;
    } catch {
        return null;
    }
}

formularioNomina.addEventListener("submit", registrarNomina);

campoNetoNomina.addEventListener(
    "input",
    actualizarVistaPreviaNomina
);

campoPeriodoNomina.addEventListener(
    "change",
    actualizarVistaPreviaNomina
);

botonUsarCategoriasNomina.addEventListener(
    "click",
    prepararCategoriasNomina
);