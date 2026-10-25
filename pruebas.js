function casiIgual(a, b){
    return Math.abs(a - b) < 0.005;
}

let fallos = 0;

function comprobar (nombre, obtenido, esperado){
    if (casiIgual(obtenido, esperado)){
        console.log("✔ " + nombre);
    } else {
        fallos++;
        console.error("✘ " + nombre + ": se esperaba " + esperado + "y salio: " + obtenido);
    }
}

function ejecutarPruebas(){
    fallos = 0;
    const respaldo = categorias;
    categorias = guardarCategoriasIniciales();

    let eq = calcularEquivalentes("mensual", 9377);
    comprobar("9,377 mensual: semanal", eq.semanal, 2163.92);
    comprobar("9,377 mensual: cada dos semanas", eq.cada2semanas, 4327.85);
    comprobar("9,377 mensual: quincenal", eq.quincenal, 4688.50);
    comprobar("9,377 mensual: anual", eq.anual, 112524);

    const reparto = calcularReparto(eq);
    comprobar("Gastos básicos por semana", reparto[0].semana, 1190.16);
    comprobar("Deudas por semana", reparto[2].semana, 540.98);
    comprobar("Ahorro por mes", reparto[3].mes, 1406.55);

    let suma = 0;
    for (const fila of reparto){
        suma += fila.semana;
    }
    
    comprobar("El reparto suma el sueldo semanal", suma, eq.semanal);

    eq = calcularEquivalentes("quincenal", 4688.5);
    comprobar("4,688.50 quincenal: mensual ", eq.mensual, 9377);

    eq = calcularEquivalentes("mensual", 12000);
    comprobar("12,000 mensual: semanal", eq.semanal, 2769.23);
    comprobar("12,000 mensual: deudas por semana", calcularReparto(eq)[2].semana, 692.31);

    eq = calcularEquivalentes("mensual", 7000);
    comprobar("7,000 mensual: deudas por semana", calcularReparto(eq)[2].semana, 403.85);

    eq = calcularEquivalentes("semanal", 1000);
    comprobar("1,000 semanal: mensual", eq.mensual, 4333.33);
    comprobar("1,000 semanal: quincenal", eq.quincenal, 2166.67);

    eq = calcularEquivalentes("mensual", 0);
    comprobar("0 de sueldo: anual", eq.anual, 0);

    let extra = calcularExtra({nombre: "Prueba", monto: 10000, frecuencia: "anual" });
    comprobar("10,000 una vez al año: por mes", extra.mensual, 833.33);
    extra = calcularExtra({nombre: "prueba", monto: 500, frecuencia: "Semanal "});
    comprobar("500 cada semana: por año", extra.anual, 26000);
    comprobar("500 cada semana: por mes", extra.mensual, 2166.67);
    extra = calcularExtra({ nombre: "Prueba", monto: 3000, frecuencia: "trimestral" });
    comprobar("3,000 cada 3 meses: por mes", extra.mensual, 1000);

    categorias = respaldo;

    if(fallos === 0){
        console.log("Todas las pruebas pasaron");
    } else {
        console.log("Fallaron " + fallos + " prueba(s)");
    }
}