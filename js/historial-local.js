//Historial compacto en disco; estados completos para las correcciones
function serializarDatosLocales(datos) {
    const lista = datos.historialCorrecciones;
    if (!Array.isArray(lista) || lista.length < 2) return JSON.stringify(datos);
    const entradas = lista.map((entrada, indice) => {
        if (!indice || !estadosIguales(lista[indice - 1].despues, entrada.antes)) return entrada;
        const { antes, ...resto } = entrada;
        return resto;
    });
    return JSON.stringify({ ...datos, historialCorrecciones: entradas, historialCompacto: 1 });
}

function expandirHistorialLocal(datos) {
    if (!datos || !Object.hasOwn(datos, "historialCompacto")) return datos;
    if (datos.historialCompacto !== 1 || !Array.isArray(datos.historialCorrecciones)) return null;
    const entradas = [];
    for (const entrada of datos.historialCorrecciones) {
        if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) return null;
        if (!Object.hasOwn(entrada, "antes") && !entradas.length) return null;
        entradas.push({ ...entrada, antes: Object.hasOwn(entrada, "antes")
            ? entrada.antes : copiar(entradas.at(-1).despues) });
    }
    const { historialCompacto, ...resto } = datos;
    return { ...resto, historialCorrecciones: entradas };
}
