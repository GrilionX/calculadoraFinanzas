function casiIgual(a, b){
    return Math.abs(a - b) < 0.005;
}

let fallos = 0;

// Para comparar textos (y null) con ===
function comprobarIgual(nombre, obtenido, esperado){
    if (obtenido === esperado) {
        console.log("✔ " + nombre);
    } else {
        fallos++;
        console.error("✘ " + nombre + ": se esperaba " + esperado + " y salió " + obtenido);
    }
}

function comprobar(nombre, obtenido, esperado){
    if (casiIgual(obtenido, esperado)) {
        console.log("✔ " + nombre);
    } else {
        fallos++;
        console.error("✘ " + nombre + ": se esperaba " + esperado + " y salió " + obtenido);
    }
}

function ejecutarPruebas(){
    fallos = 0;
    const respaldo = categorias;             
    categorias = copiarCategoriasIniciales();    

    // Caso 1: 9,377 al mes
    let eq = calcularEquivalentes("mensual", 9377);
    comprobar("9,377 mensual: semanal", eq.semanal, 2163.92);
    comprobar("9,377 mensual: cada dos semanas", eq.cada2semanas, 4327.85);
    comprobar("9,377 mensual: quincenal", eq.quincenal, 4688.50);
    comprobar("9,377 mensual: anual", eq.anual, 112524);

    const reparto = calcularReparto(eq);
    comprobar("Gastos básicos por semana", reparto[0].semana, 1190.16);
    comprobar("Deudas por semana", reparto[2].semana, 540.98);
    comprobar("Ahorro por mes", reparto[3].mes, 1406.55);

    // El reparto completo debe sumar el sueldo
    let suma = 0;
    for (const fila of reparto) {
        suma += fila.semana;
    }
    comprobar("El reparto suma el sueldo semanal", suma, eq.semanal);

    // Caso 2: lo mismo, pero cobrando quincenal
    eq = calcularEquivalentes("quincenal", 4688.5);
    comprobar("4,688.50 quincenal: mensual", eq.mensual, 9377);

    // Caso 3: 12,000 al mes
    eq = calcularEquivalentes("mensual", 12000);
    comprobar("12,000 mensual: semanal", eq.semanal, 2769.23);
    comprobar("12,000 mensual: deudas por semana", calcularReparto(eq)[2].semana, 692.31);

    // Caso 4: 7,000 al mes
    eq = calcularEquivalentes("mensual", 7000);
    comprobar("7,000 mensual: deudas por semana", calcularReparto(eq)[2].semana, 403.85);

    // Caso 5: 1,000 a la semana
    eq = calcularEquivalentes("semanal", 1000);
    comprobar("1,000 semanal: mensual", eq.mensual, 4333.33);
    comprobar("1,000 semanal: quincenal", eq.quincenal, 2166.67);

    // Caso 6: sin sueldo
    eq = calcularEquivalentes("mensual", 0);
    comprobar("0 de sueldo: anual", eq.anual, 0);

    // Ingresos extra
    let extra = calcularExtra({ nombre: "Prueba", monto: 10000, frecuencia: "anual" });
    comprobar("10,000 una vez al año: por mes", extra.mensual, 833.33);
    extra = calcularExtra({ nombre: "Prueba", monto: 500, frecuencia: "semanal" });
    comprobar("500 cada semana: por año", extra.anual, 26000);
    comprobar("500 cada semana: por mes", extra.mensual, 2166.67);
    extra = calcularExtra({ nombre: "Prueba", monto: 3000, frecuencia: "trimestral" });
    comprobar("3,000 cada 3 meses: por mes", extra.mensual, 1000);

    // Revisión de datos que vienen de fuera (lo guardado)
    const limpios = limpiarExtras([
        { nombre: 5, monto: "abc", frecuencia: "toString" },
        null,
        "texto suelto",
        { nombre: "Bono", monto: "300", frecuencia: "anual" }
    ]);
    comprobar("limpiarExtras descarta lo que no es un objeto", limpios.length, 2);
    comprobarIgual("limpiarExtras: nombre inválido queda vacío", limpios[0].nombre, "");
    comprobar("limpiarExtras: monto inválido queda en 0", limpios[0].monto, 0);
    comprobarIgual("limpiarExtras: frecuencia inválida queda en mensual", limpios[0].frecuencia, "mensual");
    comprobarIgual("limpiarExtras: conserva un nombre válido", limpios[1].nombre, "Bono");
    comprobar("limpiarExtras: convierte el monto en número", limpios[1].monto, 300);
    comprobarIgual("limpiarExtras: conserva una frecuencia válida", limpios[1].frecuencia, "anual");
    comprobarIgual("limpiarExtras: sin lista devuelve null", limpiarExtras(undefined), null);

    const cats = limpiarCategorias([{ nombre: 5, porcentaje: "abc" }, null, "x"]);
    comprobar("limpiarCategorias descarta lo que no es un objeto", cats.length, 1);
    comprobarIgual("limpiarCategorias: nombre inválido queda vacío", cats[0].nombre, "");
    comprobar("limpiarCategorias: porcentaje inválido queda en 0", cats[0].porcentaje, 0);

    categorias = respaldo;                       // devuelvo tus categorías como estaban

    if (fallos === 0) {
        console.log("Todas las pruebas pasaron ✔");
    } else {
        console.log("Fallaron " + fallos + " prueba(s) ✘");
    }
}