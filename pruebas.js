function casiIgual(a, b){
    return Math.abs(a - b) < 0.005;
}

let fallos = 0;

function comprobar(nombre, obtenido, esperado){
    if (casiIgual(obtenido, esperado)) {
        console.log("✔ " + nombre);
    } else {
        fallos++;
        console.error("✘ " + nombre + ": se esperaba " + esperado + " y salió " + obtenido);
    }
}

// Para comparar textos, verdadero/falso y null con ===
function comprobarIgual(nombre, obtenido, esperado){
    if (obtenido === esperado) {
        console.log("✔ " + nombre);
    } else {
        fallos++;
        console.error("✘ " + nombre + ": se esperaba " + esperado + " y salió " + obtenido);
    }
}

function ejecutarPruebas(){
    fallos = 0;
    const respaldoCategorias = categorias;       // guardo tus datos actuales
    const respaldoExtras = otrosIngresos;
    categorias = copiarCategoriasIniciales();    // uso los iniciales para probar
    otrosIngresos = [];

    //Sueldo
    let eq = calcularEquivalentes("mensual", 9377);
    comprobar("9,377 mensual: semanal", eq.semanal, 2163.92);
    comprobar("9,377 mensual: cada dos semanas", eq.cada2semanas, 4327.85);
    comprobar("9,377 mensual: quincenal", eq.quincenal, 4688.50);
    comprobar("9,377 mensual: anual", eq.anual, 112524);

    const reparto = calcularReparto(eq);
    comprobar("Gastos básicos por semana", reparto[0].sueldo.semanal, 1190.16);
    comprobar("Deudas por semana", reparto[2].sueldo.semanal, 540.98);
    comprobar("Ahorro por mes", reparto[3].sueldo.mensual, 1406.55);

    let suma = 0;
    for (const fila of reparto) {
        suma += fila.sueldo.semanal;
    }
    comprobar("El reparto suma el sueldo semanal", suma, eq.semanal);

    eq = calcularEquivalentes("quincenal", 4688.5);
    comprobar("4,688.50 quincenal: mensual", eq.mensual, 9377);

    eq = calcularEquivalentes("mensual", 12000);
    comprobar("12,000 mensual: semanal", eq.semanal, 2769.23);
    comprobar("12,000 mensual: deudas por semana", calcularReparto(eq)[2].sueldo.semanal, 692.31);

    eq = calcularEquivalentes("mensual", 7000);
    comprobar("7,000 mensual: deudas por semana", calcularReparto(eq)[2].sueldo.semanal, 403.85);

    eq = calcularEquivalentes("semanal", 1000);
    comprobar("1,000 semanal: mensual", eq.mensual, 4333.33);
    comprobar("1,000 semanal: quincenal", eq.quincenal, 2166.67);

    eq = calcularEquivalentes("mensual", 0);
    comprobar("0 de sueldo: anual", eq.anual, 0);

    let extra = calcularExtra({ nombre: "Prueba", monto: 10000, frecuencia: "anual", diasPorSemana: 5 });
    comprobar("10,000 una vez al año: por mes", extra.mensual, 833.33);
    extra = calcularExtra({ nombre: "Prueba", monto: 500, frecuencia: "semanal", diasPorSemana: 5 });
    comprobar("500 cada semana: por año", extra.anual, 26000);
    comprobar("500 cada semana: por mes", extra.mensual, 2166.67);
    extra = calcularExtra({ nombre: "Prueba", monto: 3000, frecuencia: "trimestral", diasPorSemana: 5 });
    comprobar("3,000 cada 3 meses: por mes", extra.mensual, 1000);

    extra = calcularExtra({ nombre: "Propinas", monto: 150, frecuencia: "diaria", diasPorSemana: 6 });
    comprobar("Propinas diarias: por semana", extra.semanal, 900);
    comprobar("Propinas diarias: cada dos semanas", extra.cada2semanas, 1800);
    comprobar("Propinas diarias: por quincena", extra.quincenal, 1950);
    comprobar("Propinas diarias: por mes", extra.mensual, 3900);
    comprobar("Propinas diarias: por año", extra.anual, 46800);

    eq = calcularEquivalentes("mensual", 9377);
    otrosIngresos = [{ nombre: "Propinas", monto: 150, frecuencia: "diaria", diasPorSemana: 6, sumar: true, destinos: ["ocio", "ahorro"] }];
    let r = calcularReparto(eq);
    comprobar("Propinas a ocio y ahorro: ocio recibe la mitad", r[1].extras.semanal, 450);
    comprobar("Propinas a ocio y ahorro: ahorro recibe la mitad", r[3].extras.semanal, 450);
    comprobar("Propinas a ocio y ahorro: deudas no recibe nada", r[2].extras.semanal, 0);
    comprobar("Los extras no cambian la parte del sueldo", r[1].sueldo.semanal, 108.20);

    otrosIngresos[0].sumar = false;
    r = calcularReparto(eq);
    comprobar("Sin marcar 'sumar', no se reparte nada", r[1].extras.semanal, 0);

    otrosIngresos[0].sumar = true;
    otrosIngresos[0].destinos = ["noexiste"];
    r = calcularReparto(eq);
    comprobar("Un destino que no existe no recibe dinero", r[1].extras.semanal, 0);
    comprobar("Se detecta el extra sin destino", extrasSinDestino().length, 1);

    otrosIngresos = [
        { nombre: "Propinas", monto: 150, frecuencia: "diaria", diasPorSemana: 6, sumar: true, destinos: ["ahorro"] },
        { nombre: "Venta", monto: 100, frecuencia: "semanal", diasPorSemana: 5, sumar: true, destinos: ["ahorro"] }
    ];
    r = calcularReparto(eq);
    comprobar("Dos extras al mismo destino se suman", r[3].extras.semanal, 1000);

    otrosIngresos = [{ nombre: "Propinas", monto: 150, frecuencia: "diaria", diasPorSemana: 6, sumar: true, destinos: ["ocio", "ahorro"] }];
    quitarDestino("ocio");
    comprobar("Quitar una categoría la saca de los destinos", otrosIngresos[0].destinos.length, 1);

    const cats = limpiarCategorias([
        { nombre: 5, porcentaje: "abc" },
        null,
        "x",
        { id: "a", nombre: "Uno", porcentaje: 10 },
        { id: "a", nombre: "Dos", porcentaje: 20 }
    ]);
    comprobar("limpiarCategorias descarta lo que no es un objeto", cats.length, 3);
    comprobarIgual("limpiarCategorias: nombre inválido queda vacío", cats[0].nombre, "");
    comprobar("limpiarCategorias: porcentaje inválido queda en 0", cats[0].porcentaje, 0);
    comprobarIgual("limpiarCategorias: le inventa un id a la que no lo trae", typeof cats[0].id, "string");
    comprobarIgual("limpiarCategorias: conserva un id válido", cats[1].id, "a");
    comprobarIgual("limpiarCategorias: cambia un id repetido", cats[2].id !== "a", true);

    const limpios = limpiarExtras([
        { nombre: 5, monto: "abc", frecuencia: "toString", diasPorSemana: 99, sumar: "si", destinos: ["ocio", "ocio", "hack"] },
        null,
        "texto suelto",
        { nombre: "Bono", monto: "300", frecuencia: "anual", sumar: true, destinos: ["ahorro"] }
    ], ["ocio", "ahorro"]);
    comprobar("limpiarExtras descarta lo que no es un objeto", limpios.length, 2);
    comprobarIgual("limpiarExtras: nombre inválido queda vacío", limpios[0].nombre, "");
    comprobar("limpiarExtras: monto inválido queda en 0", limpios[0].monto, 0);
    comprobarIgual("limpiarExtras: frecuencia inválida queda en mensual", limpios[0].frecuencia, "mensual");
    comprobar("limpiarExtras: los días se limitan a 7", limpios[0].diasPorSemana, 7);
    comprobarIgual("limpiarExtras: 'sumar' solo vale si es true", limpios[0].sumar, false);
    comprobar("limpiarExtras: quita destinos repetidos o inventados", limpios[0].destinos.length, 1);
    comprobarIgual("limpiarExtras: conserva un nombre válido", limpios[1].nombre, "Bono");
    comprobar("limpiarExtras: convierte el monto en número", limpios[1].monto, 300);
    comprobar("limpiarExtras: sin días guardados usa 5", limpios[1].diasPorSemana, 5);
    comprobarIgual("limpiarExtras: conserva sumar verdadero", limpios[1].sumar, true);
    comprobarIgual("limpiarExtras: sin lista devuelve null", limpiarExtras(undefined, []), null);

    const aguinaldo = { nombre: "Aguinaldo", monto: 10000, modo: "golpe", semana: 8, repetir: 52, sumar: true, destinos: ["ahorro"] };
    comprobar("Aguinaldo: antes de su semana no llega nada", montoDeGolpe(aguinaldo, 7), 0);
    comprobar("Aguinaldo: en su semana llega completo", montoDeGolpe(aguinaldo, 8), 10000);
    comprobar("Aguinaldo: la semana siguiente no llega nada", montoDeGolpe(aguinaldo, 9), 0);
    comprobar("Aguinaldo: se repite un año después", montoDeGolpe(aguinaldo, 60), 10000);
    comprobar("Aguinaldo: una semana antes de repetirse no llega", montoDeGolpe(aguinaldo, 59), 0);
    const unaVez = { nombre: "Bono", monto: 5000, modo: "golpe", semana: 8, repetir: 0, sumar: true, destinos: ["ahorro"] };
    comprobar("Una sola vez: llega en su semana", montoDeGolpe(unaVez, 8), 5000);
    comprobar("Una sola vez: no se repite", montoDeGolpe(unaVez, 60), 0);
    const trimestral = { nombre: "Bono", monto: 3000, modo: "golpe", semana: 13, repetir: 13, sumar: true, destinos: ["deudas"] };
    comprobar("Cada 13 semanas: llega en la 26", montoDeGolpe(trimestral, 26), 3000);
    comprobar("Cada 13 semanas: no llega en la 20", montoDeGolpe(trimestral, 20), 0);

    eq = calcularEquivalentes("mensual", 9377);
    otrosIngresos = [aguinaldo, trimestral];
    let cal = calcularCalendario(eq, 26);
    comprobar("Calendario: tiene 26 semanas", cal.semanas.length, 26);
    comprobar("Calendario: semana normal, solo sueldo", cal.semanas[0].total, 2163.92);
    comprobar("Calendario: la semana 8 trae el aguinaldo", cal.semanas[7].deGolpe, 10000);
    comprobar("Calendario: la semana 8 suma sueldo y aguinaldo", cal.semanas[7].total, 12163.92);
    comprobar("Calendario: el bono llega en la semana 13", cal.semanas[12].deGolpe, 3000);
    comprobar("Calendario: el bono llega otra vez en la 26", cal.semanas[25].deGolpe, 3000);
    comprobar("Calendario: Ahorro recibe el aguinaldo", cal.porCategoria[3].deGolpe, 10000);
    comprobar("Calendario: Deudas recibe los dos bonos", cal.porCategoria[2].deGolpe, 6000);
    comprobar("Calendario: Ocio no recibe nada de golpe", cal.porCategoria[1].deGolpe, 0);

    aguinaldo.sumar = false;
    cal = calcularCalendario(eq, 26);
    comprobar("Calendario: sin marcar 'sumar', no llega", cal.semanas[7].deGolpe, 0);
    aguinaldo.sumar = true;
    aguinaldo.destinos = ["ahorro", "ocio"];
    cal = calcularCalendario(eq, 26);
    comprobar("Calendario: dos destinos, partes iguales", cal.porCategoria[1].deGolpe, 5000);

    r = calcularReparto(eq);
    comprobar("De golpe no se promedia en el reparto", r[3].extras.semanal, 0);

    const golpeLimpio = limpiarExtras([
        { nombre: "A", modo: "hola", semana: 0, repetir: -4 },
        { nombre: "B", modo: "golpe", semana: 99999, repetir: 3.6 }
    ], []);
    comprobarIgual("limpiarExtras: un modo inválido queda en promedio", golpeLimpio[0].modo, "promedio");
    comprobar("limpiarExtras: la semana mínima es 1", golpeLimpio[0].semana, 1);
    comprobar("limpiarExtras: repetir no puede ser negativo", golpeLimpio[0].repetir, 0);
    comprobarIgual("limpiarExtras: conserva el modo golpe", golpeLimpio[1].modo, "golpe");
    comprobar("limpiarExtras: la semana máxima es 520", golpeLimpio[1].semana, 520);
    comprobar("limpiarExtras: repetir se redondea", golpeLimpio[1].repetir, 4);

    //Copia de seguridad
    comprobarIgual("Una copia válida se reconoce", esCopiaValida({ app: "finanzas-personal", version: 1, datos: {} }), true);
    comprobarIgual("Otra aplicación no se acepta", esCopiaValida({ app: "otra", datos: {} }), false);
    comprobarIgual("null no se acepta", esCopiaValida(null), false);
    comprobarIgual("Un texto suelto no se acepta", esCopiaValida("hola"), false);
    comprobarIgual("Sin datos no se acepta", esCopiaValida({ app: "finanzas-personal" }), false);
    comprobarIgual("Datos como lista no se aceptan", esCopiaValida({ app: "finanzas-personal", datos: [] }), false);

    const paquete = construirPaquete();
    comprobarIgual("El paquete trae las categorías", Array.isArray(paquete.categorias), true);
    comprobarIgual("El paquete trae los otros ingresos", Array.isArray(paquete.otrosIngresos), true);
    const vuelta = limpiarCategorias(JSON.parse(JSON.stringify(paquete)).categorias);
    comprobar("Guardar y volver a leer conserva las categorías", vuelta.length, categorias.length);
    comprobarIgual("Guardar y volver a leer conserva los ids", vuelta[0].id, categorias[0].id);

    categorias = respaldoCategorias;
    otrosIngresos = respaldoExtras;

    if (fallos === 0) {
        console.log("Todas las pruebas pasaron ✔");
    } else {
        console.log("Fallaron " + fallos + " prueba(s) ✘");
    }
}