const PERIODOS_NOMINA = {
    unico: "Pago de golpe / único",
    semanal: "Semanal",
    catorcenal: "Catorcenal",
    quincenal: "Quincenal",
    mensual: "Mensual"
};

let nominas = [];
let categoriasBorradorNomina = [];
let modalidadNomina = "porcentajes";

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

    modalidadNomina="porcentajes";
    dibujarCamposReparto();
}

function dibujarCamposReparto(){
    document.querySelectorAll("[name=modalidad-nomina]").forEach(r=>r.checked=r.value===modalidadNomina);
    cajaPorcentajesNomina.replaceChildren();

    categoriasBorradorNomina.forEach(function (categoria, indice) {
        const fila = document.createElement("div");
        fila.className = "porcentaje-nomina";

        const etiqueta = document.createElement("label");
        etiqueta.htmlFor = "porcentaje-nomina-" + indice;
        etiqueta.textContent = categoria.nombre + (modalidadNomina==="montos"?" ($)":" (%)");

        const campo = document.createElement("input");
        campo.id = "porcentaje-nomina-" + indice;
        campo.type = "number";
        campo.min = "0";
        if(modalidadNomina==="porcentajes")campo.max="100";
        campo.step = "0.01";
        campo.required = true;
        campo.inputMode="decimal";
        campo.value = modalidadNomina==="montos"?(categoria.montoTexto??"0"):categoria.porcentaje;

        campo.addEventListener("input", function () {
            if(modalidadNomina==="montos")categoria.montoTexto=campo.value;
            else categoria.porcentaje = campo.value === ""
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
        reparto: modalidadNomina==="montos"?repartirNominaPorMontos(monto,categoriasBorradorNomina.map(c=>({...c,montoCentavos:centavosReparto(c.montoTexto)}))):repartirNomina(monto, categoriasBorradorNomina)
    };
}

function actualizarVistaPreviaNomina() {
    cuerpoVistaPreviaNomina.replaceChildren();
    totalNomina.textContent = "";
    delete avisoNomina.dataset.diferencia;
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
        mostrarRepartoParcial();
        const sinEmpezar = campoNetoNomina.value === "" && campoPeriodoNomina.value === "";
        avisoNomina.className = sinEmpezar ? "ayuda" : "aviso error";
        avisoNomina.textContent = sinEmpezar ? "Introduce el importe y el periodo para ver tu reparto antes de guardarlo." : error.message;
        if(avisoNomina.dataset.diferencia){const d=Number(avisoNomina.dataset.diferencia);avisoNomina.textContent=(d>0?"Por asignar: ":"Exceso: ")+formatoMoneda.format(Math.abs(d)/100);}
    }
}

//Validación visible también dentro de la APK
function validarCamposNomina() {
    for (const campo of formularioNomina.elements) {
        campo.removeAttribute("aria-invalid");
    }
    for (const campo of formularioNomina.elements) {
        if (!campo.willValidate || campo.validity.valid) continue;
        campo.setAttribute("aria-invalid", "true");
        const nombre = campo.labels?.[0]?.textContent.trim() || "Campo";
        let motivo = "Revisa el valor.";
        if (campo.validity.valueMissing) motivo = "Completa este campo.";
        else if (campo.validity.badInput) motivo = "Escribe un número válido.";
        else if (campo.validity.stepMismatch) motivo = "Usa como máximo dos decimales.";
        else if (campo.validity.rangeUnderflow || campo.validity.rangeOverflow) motivo = "El valor está fuera del rango permitido.";
        throw new Error(nombre + ": " + motivo);
    }
}

function mostrarMensajeNomina(texto, correcto = false) {
    mensajeNomina.className = correcto ? "aviso ok" : "aviso error";
    mensajeNomina.textContent = texto;
    mensajeNomina.tabIndex = -1;
    mensajeNomina.focus({ preventScroll: true });
    mensajeNomina.scrollIntoView({ block: "nearest", behavior: "auto" });
}

function registrarNomina(evento) {
    evento.preventDefault();

    if (!guardadoHabilitado) {
        mostrarMensajeNomina("Recupera una copia válida antes de registrar pagos.");
        return;
    }

    try {
        validarCamposNomina();
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
        if (!fechaGastoValida(document.getElementById("fecha-nomina").value)) throw new Error("Selecciona la fecha de recepción.");

        const usados = nominas.map(function (nomina) {
            return nomina.id;
        });

        usados.push(...mejoras.ingresosAnulados.map(a => a.nomina.id));
        const nominasAnteriores = [...nominas];
        nominas.push({
            version: 1,
            id: generarId(usados),
            referencia: referencia,
            periodo: campoPeriodoNomina.value,
            montoCentavos: resultado.montoCentavos,
            reparto: resultado.reparto,
            ...(modalidadNomina==="montos"?{modalidad:"montos"}:{})
        });

        const guardada = guardar();
        if (!guardada) {
            nominas = nominasAnteriores;
            mostrarHistorialNominas();
            throw new Error("No se pudo guardar el ingreso. Tus campos se conservan para reintentarlo.");
        }

        formularioNomina.reset();
        prepararCategoriasNomina();
        mostrarHistorialNominas();

        mostrarMensajeNomina("Pago y reparto registrados.", true);
    } catch (error) {
        mostrarMensajeNomina(error.message);
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
        const titulo = document.createElement("span");
        titulo.className = "nomina-titulo";
        titulo.textContent = nomina.referencia;
        const periodo = document.createElement("span");
        periodo.className = "nomina-periodo";
        periodo.textContent = PERIODOS_NOMINA[nomina.periodo] + ' · ' + nombreFecha(fechaMovimiento('ingreso', nomina.id));
        const importe = document.createElement("span");
        importe.className = "nomina-importe";
        importe.textContent = formatoMoneda.format(nomina.montoCentavos / 100);
        encabezado.append(titulo, periodo, importe);

        const lista = document.createElement("ul");

        for (const categoria of nomina.reparto) {
            const elemento = document.createElement("li");

            const disponible = calcularDisponibleCategoria(
                nomina,
                categoria.id,
                obtenerCompromisosNomina()
            );

            elemento.textContent =
                categoria.nombre +
                " · Asignado: " +
                formatoMoneda.format(
                    disponible.asignadoCentavos / 100
                ) +
                " · Gastado, ahorrado o reservado: " +
                formatoMoneda.format(
                    disponible.utilizadoCentavos / 100
                ) +
                " · Disponible: " +
                formatoMoneda.format(
                    disponible.disponibleCentavos / 100
                );

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

            if(nomina.modalidad!==undefined&&nomina.modalidad!=="montos")return null;
            const repartoComprobado = (nomina.modalidad==="montos"?repartirNominaPorMontos:repartirNomina)(
                nomina.montoCentavos,
                nomina.reparto
            );

            for (let i = 0; i < repartoComprobado.length; i++) {
                if (
                    (nomina.modalidad==="montos"&&repartoComprobado[i].porcentaje!==nomina.reparto[i].porcentaje)||
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
                reparto: repartoComprobado,
                ...(nomina.modalidad==="montos"?{modalidad:"montos"}:{})
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
//Vista parcial y cambio de modalidad
function mostrarRepartoParcial(){
 const total=convertirPesosACentavos(campoNetoNomina.value);if(total===null)return;
 let asignado=0,valido=true;
 for(const c of categoriasBorradorNomina){
  const monto=modalidadNomina==="montos"?centavosReparto(c.montoTexto):Number.isFinite(c.porcentaje)&&c.porcentaje>=0&&c.porcentaje<=100?Math.round(total*c.porcentaje/100):null;
  if(monto===null){valido=false;continue;}
  asignado+=monto;
  const tr=document.createElement("tr");
  for(const texto of [c.nombre,(modalidadNomina==="montos"?monto/total*100:c.porcentaje).toFixed(2)+"%",formatoMoneda.format(monto/100)]){const td=document.createElement("td");td.textContent=texto;tr.append(td);}
  cuerpoVistaPreviaNomina.append(tr);
 }
 totalNomina.textContent=valido?formatoMoneda.format(asignado/100):"Revisa los montos";
 if(modalidadNomina==="montos"&&valido&&asignado!==total)avisoNomina.dataset.diferencia=String(total-asignado);
}
document.querySelectorAll("[name=modalidad-nomina]").forEach(r=>r.addEventListener("change",()=>{
 if(!r.checked||r.value===modalidadNomina)return;
 if(r.value==="montos"){
  let reparto;try{reparto=leerRepartoNomina().reparto;}catch{}
  categoriasBorradorNomina.forEach((c,i)=>{c.montoTexto??=String((reparto?.[i].montoCentavos??0)/100);});
 }
 modalidadNomina=r.value;dibujarCamposReparto();
}));
