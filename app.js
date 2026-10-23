// app.js: lo que hace la página

// ----- Datos -----
const PAGOS_POR_ANIO = {
    semanal: 52,
    cada2semanas: 26,
    quincenal: 24,
    mensual: 12
};

const CATEGORIAS_INICIALES = [
    { nombre: "Gastos básicos", porcentaje: 55 },
    { nombre: "Ocio", porcentaje: 5 },
    { nombre: "Deudas", porcentaje: 25 },
    { nombre: "Ahorro", porcentaje: 15 },
    { nombre: "Inversiones", porcentaje: 0 }
];

const CLAVE_GUARDADO = "finanzas-personal-v1";

const formatoMoneda = new Intl.NumberFormat("es-MX", {style: "currency", currency: "MXN"});

// Una copia independiente de las categorías iniciales
function copiarCategoriasIniciales(){
    return JSON.parse(JSON.stringify(CATEGORIAS_INICIALES));
}

let categorias = copiarCategoriasIniciales();

// ----- Elementos de la página -----
const campoMonto = document.getElementById("monto");
const campoFrecuencia = document.getElementById("frecuencia");
const cuerpoTabla = document.getElementById("filas-reparto");
const botonAgregar = document.getElementById("agregar-categoria");
const botonRestablecer = document.getElementById("restablecer");

// ----- Leer lo que escribe la persona -----
function leerNumero(texto){
    const numero = Number(texto);
    if (numero < 0 || Number.isNaN(numero)){
        return 0;
    }
    return numero;
}

function leerMonto(){
    return leerNumero(campoMonto.value);
}

// ----- Cálculos -----
function calcularEquivalentes(frecuencia, monto) {
    const anual = monto * PAGOS_POR_ANIO[frecuencia];
    return{
        semanal: anual/52,
        cada2semanas: anual/26,
        quincenal: anual/24,
        mensual: anual/12,
        anual: anual
    };
}

function calcularReparto(eq){
    const resultado = [];
    for (const cat of categorias) {
        const fraccion = cat.porcentaje / 100;
        resultado.push({
            porcentaje: cat.porcentaje,
            semana: eq.semanal * fraccion,
            quincena: eq.quincenal * fraccion,
            mes: eq.mensual * fraccion
        });
    }
    return resultado;
}

function sumaPorcentajes(){
    let total = 0;
    for (const cat of categorias) {
        total += cat.porcentaje;
    }
    return Math.round(total * 100) / 100;
}

function hayNombresVacios(){
    for (const cat of categorias) {
        if (cat.nombre.trim() === "") {
            return true;
        }
    }
    return false;
}

function revisarReparto(){
    const problemas = [];

    if (categorias.length === 0) {
        problemas.push("Agrega al menos una categoría.");
    } else {
        const suma = sumaPorcentajes();
        const diferencia = Math.round((100 - suma) * 100) / 100;
        if (diferencia > 0) {
            problemas.push("Los porcentajes suman " + suma + "%. Faltan " + diferencia + "% por repartir.");
        } else if (diferencia < 0) {
            problemas.push("Los porcentajes suman " + suma + "%. Te pasaste por " + (-diferencia) + "%.");
        }
        if (hayNombresVacios()) {
            problemas.push("Hay categorías sin nombre.");
        }
    }

    return problemas;
}

// ----- Guardar y cargar (en tu navegador; nada se envía a internet) -----
function guardar(){
    const datos = {
        frecuencia: campoFrecuencia.value,
        monto: campoMonto.value,
        categorias: categorias
    };
    try {
        localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(datos));
    } catch (error) {
        console.warn("No se pudo guardar:", error);
    }
}

function cargar(){
    try {
        const texto = localStorage.getItem(CLAVE_GUARDADO);
        if (texto === null) {
            return; // no hay nada guardado todavía
        }
        const datos = JSON.parse(texto);
        if (typeof datos !== "object" || datos === null) {
            return;
        }

        // Primero se revisa todo; después se aplica
        const limpias = [];
        if (Array.isArray(datos.categorias)) {
            for (const c of datos.categorias) {
                if (typeof c === "object" && c !== null) {
                    let nombre = "";
                    if (typeof c.nombre === "string") {
                        nombre = c.nombre;
                    }
                    limpias.push({ nombre: nombre, porcentaje: leerNumero(c.porcentaje) });
                }
            }
        }

        if (Object.keys(PAGOS_POR_ANIO).includes(datos.frecuencia)) {
            campoFrecuencia.value = datos.frecuencia;
        }
        if (typeof datos.monto === "string") {
            campoMonto.value = datos.monto;
        }
        if (Array.isArray(datos.categorias)) {
            categorias = limpias;
        }
    } catch (error) {
        console.warn("No se pudo cargar lo guardado:", error);
    }
}

// ----- Pantalla -----
function crearFila(cat){
    const fila = document.createElement("tr");
    // Esta plantilla NO lleva datos de la persona, solo la estructura
    fila.innerHTML = `
        <td><input class="campo-nombre" type="text" placeholder="Nombre" aria-label="Nombre de la categoría"></td>
        <td><input class="campo-pct" type="number" min="0" max="100" step="any" aria-label="Porcentaje"></td>
        <td class="c-semana"></td>
        <td class="c-quincena"></td>
        <td class="c-mes"></td>
        <td><button class="boton-borrar" type="button" aria-label="Eliminar categoría">✕</button></td>
    `;

    const campoNombre = fila.querySelector(".campo-nombre");
    const campoPct = fila.querySelector(".campo-pct");
    const botonBorrar = fila.querySelector(".boton-borrar");

    // Los datos de la persona se ponen como valor, nunca como HTML
    campoNombre.value = cat.nombre;
    campoPct.value = cat.porcentaje;

    campoNombre.addEventListener("input", function () {
        cat.nombre = campoNombre.value;
        mostrarAviso();
        guardar();
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

function construirTabla(){
    cuerpoTabla.innerHTML = "";
    for (const cat of categorias) {
        cuerpoTabla.appendChild(crearFila(cat));
    }
}

function agregarCategoria(){
    categorias.push({ nombre: "", porcentaje: 0 });
    construirTabla();
    actualizarPantalla();
    cuerpoTabla.lastElementChild.querySelector(".campo-nombre").focus();
}

function eliminarCategoria(cat){
    const posicion = categorias.indexOf(cat);
    categorias.splice(posicion, 1);
    construirTabla();
    actualizarPantalla();
}

function restablecer(){
    if (confirm("¿Volver a los valores iniciales? Se perderán tus cambios.")) {
        categorias = copiarCategoriasIniciales();
        campoFrecuencia.value = "mensual";
        campoMonto.value = "";
        construirTabla();
        actualizarPantalla();
    }
}

function mostrarEquivalentes(eq){
    document.getElementById("eq-semanal").textContent = formatoMoneda.format(eq.semanal);
    document.getElementById("eq-cada2semanas").textContent = formatoMoneda.format(eq.cada2semanas);
    document.getElementById("eq-quincenal").textContent = formatoMoneda.format(eq.quincenal);
    document.getElementById("eq-mensual").textContent = formatoMoneda.format(eq.mensual);
    document.getElementById("eq-anual").textContent = formatoMoneda.format(eq.anual);
}

function mostrarReparto(eq){
    const filas = calcularReparto(eq);
    let totalSemana = 0;
    let totalQuincena = 0;
    let totalMes = 0;

    for (let i = 0; i < filas.length; i++) {
        const datos = filas[i];
        const filaHtml = cuerpoTabla.rows[i];
        filaHtml.querySelector(".c-semana").textContent = formatoMoneda.format(datos.semana);
        filaHtml.querySelector(".c-quincena").textContent = formatoMoneda.format(datos.quincena);
        filaHtml.querySelector(".c-mes").textContent = formatoMoneda.format(datos.mes);
        totalSemana += datos.semana;
        totalQuincena += datos.quincena;
        totalMes += datos.mes;
    }

    document.getElementById("tot-pct").textContent = sumaPorcentajes() + "%";
    document.getElementById("tot-semana").textContent = formatoMoneda.format(totalSemana);
    document.getElementById("tot-quincena").textContent = formatoMoneda.format(totalQuincena);
    document.getElementById("tot-mes").textContent = formatoMoneda.format(totalMes);
}

function mostrarAviso(){
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

function actualizarPantalla(){
    const eq = calcularEquivalentes(campoFrecuencia.value, leerMonto());
    mostrarEquivalentes(eq);
    mostrarReparto(eq);
    mostrarAviso();
    guardar();
}

// ----- Eventos y arranque -----
campoMonto.addEventListener("input", actualizarPantalla);
campoFrecuencia.addEventListener("change", actualizarPantalla);
botonAgregar.addEventListener("click", agregarCategoria);
botonRestablecer.addEventListener("click", restablecer);

cargar();
construirTabla();
actualizarPantalla();