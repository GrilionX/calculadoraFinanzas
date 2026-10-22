const PAGOS_POR_ANIO = {
    semanal: 52,
    cada2semanas: 26,
    quincenal: 24,
    mensual: 12
};

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