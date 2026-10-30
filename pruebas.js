// pruebas.js: comprueba que los cálculos den lo mismo que tu Excel.
// Se ejecuta desde la consola con:  ejecutarPruebas()

// Los decimales no se comparan con === (0.1 + 0.2 da 0.30000000000000004).
// Por eso se acepta una diferencia de menos de medio centavo.
function casiIgual(a, b){
    return Math.abs(a - b) < 0.005;
}

let fallos = 0;

// Para comparar números
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

    // ----- Sueldo -----
    let eq = calcularEquivalentes("mensual", 9377);
    comprobar("9,377 mensual: semanal", eq.semanal, 2163.92);
    comprobar("9,377 mensual: cada dos semanas", eq.cada2semanas, 4327.85);
    comprobar("9,377 mensual: quincenal", eq.quincenal, 4688.50);
    comprobar("9,377 mensual: anual", eq.anual, 112524);

    const reparto = calcularReparto(eq);
    comprobar("Gastos básicos por semana", reparto[0].sueldo.semanal, 1190.16);
    comprobar("Deudas por semana", reparto[2].sueldo.semanal, 540.98);
    comprobar("Ahorro por mes", reparto[3].sueldo.mensual, 1406.55);

    // El reparto completo debe sumar el sueldo
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

    // ----- Otros ingresos: cuánto son -----
    let extra = calcularExtra({ nombre: "Prueba", monto: 10000, frecuencia: "anual", diasPorSemana: 5 });
    comprobar("10,000 una vez al año: por mes", extra.mensual, 833.33);
    extra = calcularExtra({ nombre: "Prueba", monto: 500, frecuencia: "semanal", diasPorSemana: 5 });
    comprobar("500 cada semana: por año", extra.anual, 26000);
    comprobar("500 cada semana: por mes", extra.mensual, 2166.67);
    extra = calcularExtra({ nombre: "Prueba", monto: 3000, frecuencia: "trimestral", diasPorSemana: 5 });
    comprobar("3,000 cada 3 meses: por mes", extra.mensual, 1000);

    // Propinas de 150 al día, 6 días a la semana
    extra = calcularExtra({ nombre: "Propinas", monto: 150, frecuencia: "diaria", diasPorSemana: 6 });
    comprobar("Propinas diarias: por semana", extra.semanal, 900);
    comprobar("Propinas diarias: cada dos semanas", extra.cada2semanas, 1800);
    comprobar("Propinas diarias: por quincena", extra.quincenal, 1950);
    comprobar("Propinas diarias: por mes", extra.mensual, 3900);
    comprobar("Propinas diarias: por año", extra.anual, 46800);

    // ----- Otros ingresos: a dónde van -----
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

    // ----- Revisión de datos que vienen de fuera (lo guardado) -----
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

    categorias = respaldoCategorias;             // devuelvo tus datos como estaban
    otrosIngresos = respaldoExtras;

    if (fallos === 0) {
        console.log("Todas las pruebas pasaron ✔");
    } else {
        console.log("Fallaron " + fallos + " prueba(s) ✘");
    }
}