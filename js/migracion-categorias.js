//Compatibilidad de datos anteriores
function migrarCategoriasAnteriores(original) {
    if (!original || !Array.isArray(original.categorias)) return original;
    const antigua = "inversiones";
    const datos = copiar(original);
    const recorrer = valor => {
        if (!valor || typeof valor !== "object") return;
        for (const [clave, contenido] of Object.entries(valor)) {
            if (contenido === antigua) valor[clave] = "pendiente";
            else if (typeof contenido === "object") recorrer(contenido);
        }
        if (valor.id === "pendiente" && typeof valor.nombre === "string") valor.nombre = "Por reasignar";
    };
    recorrer(datos);
    datos.categorias = datos.categorias.filter(c => c.id !== "pendiente");
    datos.otrosIngresos?.forEach(e => { e.destinos = e.destinos.filter(id => id !== "pendiente"); });
    const limpiar = n => {if(n?.reparto) n.reparto=n.reparto.filter(c=>c.id!=="pendiente"||c.montoCentavos!==0||Number(c.porcentaje)!==0);};
    datos.nominas?.forEach(limpiar);
    datos.mejoras?.ingresosAnulados?.forEach(a=>limpiar(a.nomina));
    datos.mejoras?.cambiosIngresos?.forEach(c=>{limpiar(c.antes);limpiar(c.despues);});
    return datos;
}
