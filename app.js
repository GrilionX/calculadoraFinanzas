const PAGOS_POR_ANIO = {
    semanal: 52,
    cada2semanas: 26,
    quincenal: 24,
    mensual: 12
};

const categorias = [
    {id: "basicos", nombre: "Gastos basicos", porcentaje: 55},
    {id: "ocio", nombre: "Ocio", porcentaje: 5},
    {id: "deudas", nombre: "Deudas", porcentaje: 25},
    {id: "ahorro", nombre: "Ahorro", porcentaje: 15},
    {id: "inversion", nombre: "Inversion", porcentaje: 0}
]

const cuerpoTabla = document.getElementById("filas-reparto");

function construirTabla(){
    for (const cat of categorias) {
        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td>${cat.nombre}</td>
            <td><input id="pct-${cat.id}" type="number" min="0" max="100" step="any" value="${cat.porcentaje}"></td>
            <td id="sem-${cat.id}"></td>
            <td id="qui-${cat.id}"></td>
            <td id="mes-${cat.id}"></td>
        `;
        cuerpoTabla.appendChild(fila);
    }
}

const formatoMoneda = new Intl.NumberFormat("es-MX", {style: "currency", currency: "MXN"});

const campoMonto = document.getElementById("monto");
const campoFrecuencia = document.getElementById("frecuencia");


function leerMonto(){
    const numero = Number(campoMonto.value);
    if (numero < 0 || Number.isNaN(numero)){
        return 0;
    }
    return numero;
}

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
    for (const cat of categorias){
        const fraccion = cat.porcentaje/100;
        resultado.push({
            id: cat.id,
            porcentaje: cat.porcentaje,
            semana: eq.semanal * fraccion,
            quincena: eq.quincena * fraccion,
            mes: eq.mes * fraccion
        });
    }
    return resultado;
}

function mostrarEquivalentes(){
    console.log("recalculando");
    const frecuencia = campoFrecuencia.value;
    const monto = leerMonto();
    const eq = calcularEquivalentes(frecuencia, monto);

    document.getElementById("eq-semanal").textContent = formatoMoneda.format(eq.semanal);
    document.getElementById("eq-cada2semanas").textContent = formatoMoneda.format(eq.cada2semanas);
    document.getElementById("eq-quincenal").textContent = formatoMoneda.format(eq.quincenal);
    document.getElementById("eq-mensual").textContent = formatoMoneda.format(eq.mensual);
    document.getElementById("eq-anual").textContent = formatoMoneda.format(eq.anual);
}

campoMonto.addEventListener("input", mostrarEquivalentes);
campoFrecuencia.addEventListener("change", mostrarEquivalentes);

mostrarEquivalentes();
construirTabla();