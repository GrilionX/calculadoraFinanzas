// ----- Datos -----
const PAGOS_POR_ANIO = {
    semanal: 52,
    cada2semanas: 26,
    quincenal: 24,
    mensual: 12
};

const categorias = [
    { nombre: "Gastos básicos", porcentaje: 55 },
    { nombre: "Ocio", porcentaje: 5 },
    { nombre: "Deudas", porcentaje: 25 },
    { nombre: "Ahorro", porcentaje: 15 },
    { nombre: "Inversiones", porcentaje: 0 }
];

const formatoMoneda = new Intl.NumberFormat("es-MX", {style: "currency", currency: "MXN"});

// ----- Elementos de la página -----
const campoMonto = document.getElementById("monto");
const campoFrecuencia = document.getElementById("frecuencia");
const cuerpoTabla = document.getElementById("filas-reparto");
const botonAgregar = document.getElementById("agregar-categoria");

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

function mostrarEquivalentes(eq){
    document.getElementById("eq-semanal").textContent = formatoMoneda.format(eq.semanal);
    document.getElementById("eq-cada2semanas").textContent = formatoMoneda.format(eq.cada2semanas);
    document.getElementById("eq-quincenal").textContent = formatoMoneda.format(eq.quincenal);
    document.getElementById("eq-mensual").textContent = formatoMoneda.format(eq.mensual);
    document.getElementById("eq-anual").textContent = formatoMoneda.format(eq.anual);
}

function mostrarReparto(eq){
    const filas = calcularReparto(eq);
    let totalPct = 0;
    let totalSemana = 0;
    let totalQuincena = 0;
    let totalMes = 0;

    for (let i = 0; i < filas.length; i++) {
        const datos = filas[i];
        const filaHtml = cuerpoTabla.rows[i];
        filaHtml.querySelector(".c-semana").textContent = formatoMoneda.format(datos.semana);
        filaHtml.querySelector(".c-quincena").textContent = formatoMoneda.format(datos.quincena);
        filaHtml.querySelector(".c-mes").textContent = formatoMoneda.format(datos.mes);
        totalPct += datos.porcentaje;
        totalSemana += datos.semana;
        totalQuincena += datos.quincena;
        totalMes += datos.mes;
    }

    document.getElementById("tot-pct").textContent = Math.round(totalPct * 100) / 100 + "%";
    document.getElementById("tot-semana").textContent = formatoMoneda.format(totalSemana);
    document.getElementById("tot-quincena").textContent = formatoMoneda.format(totalQuincena);
    document.getElementById("tot-mes").textContent = formatoMoneda.format(totalMes);
}

function actualizarPantalla(){
    const eq = calcularEquivalentes(campoFrecuencia.value, leerMonto());
    mostrarEquivalentes(eq);
    mostrarReparto(eq);
}

// ----- Eventos y arranque -----
campoMonto.addEventListener("input", actualizarPantalla);
campoFrecuencia.addEventListener("change", actualizarPantalla);
botonAgregar.addEventListener("click", agregarCategoria);

construirTabla();
actualizarPantalla();