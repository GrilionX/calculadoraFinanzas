const PAGOS_POR_ANIO = {
    semanal: 52,
    cada2semanas: 26,
    quincenal: 24,
    mensual: 12
};

// Los periodos en que se pueden ver las cantidades
const PERIODOS = {
    semanal: "Por semana",
    cada2semanas: "Cada dos semanas",
    quincenal: "Por quincena",
    mensual: "Por mes"
};

const CLAVES_PERIODO = ["semanal", "cada2semanas", "quincenal", "mensual", "anual"];

const CATEGORIAS_INICIALES = [
    { id: "basicos", nombre: "Gastos básicos", porcentaje: 55 },
    { id: "ocio", nombre: "Ocio", porcentaje: 5 },
    { id: "deudas", nombre: "Deudas", porcentaje: 25 },
    { id: "ahorro", nombre: "Ahorro", porcentaje: 15 },
    { id: "inversiones", nombre: "Inversiones", porcentaje: 0 }
];

// Para otros ingresos: cada frecuencia con su texto y cuántos pagos hay al año.
// "usaDias" significa que se multiplica por los días a la semana que se recibe.
const FRECUENCIAS_EXTRA = {
    diaria: { texto: "Cada día", pagosAlAnio: 52, usaDias: true },
    semanal: { texto: "Cada semana", pagosAlAnio: 52, usaDias: false },
    cada2semanas: { texto: "Cada dos semanas", pagosAlAnio: 26, usaDias: false },
    quincenal: { texto: "Cada quincena", pagosAlAnio: 24, usaDias: false },
    mensual: { texto: "Cada mes", pagosAlAnio: 12, usaDias: false },
    trimestral: { texto: "Cada 3 meses", pagosAlAnio: 4, usaDias: false },
    semestral: { texto: "Cada 6 meses", pagosAlAnio: 2, usaDias: false },
    anual: { texto: "Una vez al año", pagosAlAnio: 1, usaDias: false }
};

const EXTRAS_INICIALES = [
    { nombre: "Aguinaldo", monto: 0, modo: "golpe", frecuencia: "anual", diasPorSemana: 5, semana: 8, repetir: 52, sumar: false, destinos: [] },
    { nombre: "Propinas", monto: 0, modo: "promedio", frecuencia: "diaria", diasPorSemana: 5, semana: 1, repetir: 0, sumar: false, destinos: [] }
];

const CLAVE_GUARDADO = "finanzas-personal-v1";

const formatoMoneda = new Intl.NumberFormat("es-MX", {style: "currency", currency: "MXN"});

// Una copia independiente de cualquier lista u objeto
function copiar(datos){
    return JSON.parse(JSON.stringify(datos));
}

function copiarCategoriasIniciales(){
    return copiar(CATEGORIAS_INICIALES);
}

let categorias = copiarCategoriasIniciales();
let otrosIngresos = copiar(EXTRAS_INICIALES);

// ----- Elementos de la página -----
const campoMonto = document.getElementById("monto");
const campoFrecuencia = document.getElementById("frecuencia");
const campoPeriodo = document.getElementById("periodo");
const cuerpoTabla = document.getElementById("filas-reparto");
const listaExtras = document.getElementById("lista-extras");
const botonAgregar = document.getElementById("agregar-categoria");
const botonAgregarExtra = document.getElementById("agregar-extra");
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


function leerEntero(texto, minimo, maximo){
    const numero = Math.round(leerNumero(texto));
    return Math.min(maximo, Math.max(minimo, numero));
}

// Los días a la semana van de 1 a 7
function leerDias(texto){
    return leerEntero(texto, 1, 7);
}

// ----- Identificadores de las categorías -----
function idsDe(lista){
    const ids = [];
    for (const elemento of lista) {
        ids.push(elemento.id);
    }
    return ids;
}

// Inventa un id que no esté en la lista de usados
function generarId(usados){
    let id = "c" + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
    while (usados.includes(id)) {
        id = id + "x";
    }
    return id;
}

// ----- Cálculos -----
// A partir de cuánto es al año, saca todos los equivalentes
function desdeAnual(anual){
    return {
        semanal: anual / 52,
        cada2semanas: anual / 26,
        quincenal: anual / 24,
        mensual: anual / 12,
        anual: anual
    };
}

function calcularEquivalentes(frecuencia, monto) {
    return desdeAnual(monto * PAGOS_POR_ANIO[frecuencia]);
}

// Cuánto representa un ingreso extra en cada periodo
function calcularExtra(extra){
    const frecuencia = FRECUENCIAS_EXTRA[extra.frecuencia];
    let pagos = frecuencia.pagosAlAnio;
    if (frecuencia.usaDias) {
        pagos = pagos * extra.diasPorSemana;
    }
    return desdeAnual(extra.monto * pagos);
}

function multiplicar(eq, factor){
    const resultado = {};
    for (const clave of CLAVES_PERIODO) {
        resultado[clave] = eq[clave] * factor;
    }
    return resultado;
}

function esDeGolpe (extra){
    return extra.modo === "golpe";
}

function montoDeGolpe(extra, semana){
    if (semana < extra.semana){
        return 0;
    }
    if (extra.repetir === 0){
        if (semana === extra.semana){
            return extra.monto;
        }
        return 0;
    }
    if((semana - extra.semana) % extra.repetir === 0){
        return extra.monto;
    }
    return 0;
}

function sumarEq(a, b){
    const resultado = {};
    for (const clave of CLAVES_PERIODO) {
        resultado[clave] = a[clave] + b[clave];
    }
    return resultado;
}

// Los destinos de un extra que todavía existen como categoría
function destinosValidos(extra){
    const validos = [];
    for (const cat of categorias) {
        if (extra.destinos.includes(cat.id)) {
            validos.push(cat.id);
        }
    }
    return validos;
}

// Nombres de los extras que se suman pero no tienen a dónde ir
function extrasSinDestino(){
    const nombres = [];
    for (const extra of otrosIngresos) {
        if (extra.sumar && destinosValidos(extra).length === 0) {
            if (extra.nombre.trim() === "") {
                nombres.push("(sin nombre)");
            } else {
                nombres.push(extra.nombre);
            }
        }
    }
    return nombres;
}

// Reparte el sueldo por porcentajes y, aparte, los extras que se suman a sus destinos
function calcularReparto(eqSueldo){
    const filas = [];
    for (const cat of categorias) {
        filas.push({
            id: cat.id,
            porcentaje: cat.porcentaje,
            sueldo: multiplicar(eqSueldo, cat.porcentaje / 100),
            extras: desdeAnual(0)
        });
    }

    for (const extra of otrosIngresos) {
        const validos = destinosValidos(extra);
        if (extra.sumar && !esDeGolpe(extra) && validos.length > 0) {
            const parte = multiplicar(calcularExtra(extra), 1 / validos.length);
            for (const fila of filas) {
                if (validos.includes(fila.id)) {
                    fila.extras = sumarEq(fila.extras, parte);
                }
            }
        }
    }

    return filas;
}

function calcularCalendario(eqSueldo, cantidadSemanas){
    const repartoSemanal = calcularReparto(eqSueldo);
    const semanas = [];
    const porCategoria = [];

    let promedioPorSemana =  0;
    for (const fila of repartoSemanal){
        promedioPorSemana += filas.extra.semanal;
        porCategoria.push({
            id: fila.id,
            sueldo: fila.sueldo.semanal * cantidadSemanas,
            promediados: fila.extras.semanal * cantidadSemanas,
            deGolpe: 0
        });
    }
    for (let semana = 1; semana <= cantidadSemanas; semana++){
        let deGolpe = 0;
        const llegan = [];

        for (const extra of otrosIngresos){
            const validos = destinosValidos(extra);
            if(extra.sumar && esDeGolpe(extra) && validos.length > 0){
                const monto = montoDeGolpe(extra, semana)
                if (monto > 0){
                    deGolpe += monto;
                    llegan.push({ nombre: extra.nombre, monto: monto });
                    for (const categoria of porCategoria){
                        if (validos.includes(categoria.id)){
                            categoria.deGolpe += monto/validos.length;
                        }
                    }
                }
            }
        }

        semanas.push({
            semana: semana, 
            sueldo: eqSueldo.semanal,
            promediados: promedioPorSemana,
            deGolpe: deGolpe,
            total: eqSueldo.semanal + promedioPorSemana + deGolpe,
            llegan: llegan
        });
    }

    return { semana: semanas, porCategoria: porCategoria };
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

    const sinDestino = extrasSinDestino();
    if (sinDestino.length > 0) {
        problemas.push("Se suman a tu reparto pero no tienen destino: " + sinDestino.join(", ") + ".");
    }

    return problemas;
}

// ----- Guardar y cargar (en tu navegador; nada se envía a internet) -----
function guardar(){
    const datos = {
        frecuencia: campoFrecuencia.value,
        monto: campoMonto.value,
        periodo: campoPeriodo.value,
        categorias: categorias,
        otrosIngresos: otrosIngresos
    };
    try {
        localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(datos));
    } catch (error) {
        console.warn("No se pudo guardar:", error);
    }
}

// Revisa una lista de categorías que viene de fuera. Devuelve una lista limpia,
// o null si no hay una lista que revisar.
function limpiarCategorias(lista){
    if (!Array.isArray(lista)) {
        return null;
    }
    const limpias = [];
    const usados = [];
    for (const c of lista) {
        if (typeof c === "object" && c !== null) {
            let nombre = "";
            if (typeof c.nombre === "string") {
                nombre = c.nombre;
            }
            // Cada categoría necesita un id único; si no lo trae o está repetido, se le da uno nuevo
            let id = c.id;
            if (typeof id !== "string" || id === "" || usados.includes(id)) {
                id = generarId(usados);
            }
            usados.push(id);
            limpias.push({ id: id, nombre: nombre, porcentaje: leerNumero(c.porcentaje) });
        }
    }
    return limpias;
}

// Lo mismo para los otros ingresos. "idsValidos" son las categorías que existen.
function limpiarExtras(lista, idsValidos){
    if (!Array.isArray(lista)) {
        return null;
    }
    const limpios = [];
    for (const e of lista) {
        if (typeof e === "object" && e !== null) {
            let nombre = "";
            if (typeof e.nombre === "string") {
                nombre = e.nombre;
            }
            let frecuencia = "mensual";
            if (Object.keys(FRECUENCIAS_EXTRA).includes(e.frecuencia)) {
                frecuencia = e.frecuencia;
            }
            let dias = 5;
            if (e.diasPorSemana !== undefined) {
                dias = leerDias(e.diasPorSemana);
            }
            const destinos = [];
            if (Array.isArray(e.destinos)) {
                for (const id of e.destinos) {
                    if (idsValidos.includes(id) && !destinos.includes(id)) {
                        destinos.push(id);
                    }
                }
            }
            limpios.push({
                nombre: nombre,
                monto: leerNumero(e.monto),
                frecuencia: frecuencia,
                diasPorSemana: dias,
                sumar: e.sumar === true,
                destinos: destinos
            });
        }
    }
    return limpios;
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
        const categoriasLimpias = limpiarCategorias(datos.categorias);
        let idsValidos = idsDe(categorias);
        if (categoriasLimpias !== null) {
            idsValidos = idsDe(categoriasLimpias);
        }
        const extrasLimpios = limpiarExtras(datos.otrosIngresos, idsValidos);

        if (Object.keys(PAGOS_POR_ANIO).includes(datos.frecuencia)) {
            campoFrecuencia.value = datos.frecuencia;
        }
        if (typeof datos.monto === "string") {
            campoMonto.value = datos.monto;
        }
        if (Object.keys(PERIODOS).includes(datos.periodo)) {
            campoPeriodo.value = datos.periodo;
        }
        if (categoriasLimpias !== null) {
            categorias = categoriasLimpias;
        }
        if (extrasLimpios !== null) {
            otrosIngresos = extrasLimpios;
        }
    } catch (error) {
        console.warn("No se pudo cargar lo guardado:", error);
    }
}

// ----- Pantalla: categorías -----
function crearFila(cat){
    const fila = document.createElement("tr");
    // Esta plantilla NO lleva datos de la persona, solo la estructura
    fila.innerHTML = `
        <td><input class="campo-nombre" type="text" placeholder="Nombre" aria-label="Nombre de la categoría"></td>
        <td><input class="campo-pct" type="number" inputmode="decimal" min="0" max="100" step="any" aria-label="Porcentaje"></td>
        <td class="c-sueldo"></td>
        <td class="c-extras"></td>
        <td class="c-total"></td>
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
        construirExtras();      // los destinos muestran el nombre de la categoría
        actualizarPantalla();
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
    categorias.push({ id: generarId(idsDe(categorias)), nombre: "", porcentaje: 0 });
    construirTabla();
    construirExtras();
    actualizarPantalla();
    cuerpoTabla.lastElementChild.querySelector(".campo-nombre").focus();
}

// Quita una categoría de los destinos de todos los extras
function quitarDestino(id){
    for (const extra of otrosIngresos) {
        const posicion = extra.destinos.indexOf(id);
        if (posicion !== -1) {
            extra.destinos.splice(posicion, 1);
        }
    }
}

function eliminarCategoria(cat){
    quitarDestino(cat.id);
    const posicion = categorias.indexOf(cat);
    categorias.splice(posicion, 1);
    construirTabla();
    construirExtras();
    actualizarPantalla();
}

// ----- Pantalla: otros ingresos -----
function crearTarjetaExtra(extra){
    const tarjeta = document.createElement("div");
    tarjeta.className = "extra";
    // Plantilla sin datos de la persona; selector y destinos se llenan después
    tarjeta.innerHTML = `
        <div class="extra-fila">
            <input class="extra-nombre" type="text" placeholder="Nombre" aria-label="Nombre del ingreso">
            <button class="boton-borrar" type="button" aria-label="Eliminar ingreso">✕</button>
        </div>
        <div class="extra-fila">
            <label>Monto <input class="extra-monto" type="number" inputmode="decimal" min="0" step="0.01"></label>
            <select class="extra-frecuencia" aria-label="Cada cuánto"></select>
            <label class="caja-dias">Días por semana <input class="extra-dias" type="number" inputmode="numeric" min="1" max="7" step="1"></label>
        </div>
        <label><input class="extra-sumar" type="checkbox"> Sumar a mi reparto</label>
        <div class="destinos">
            <span>Va a:</span>
            <span class="lista-destinos"></span>
        </div>
        <p class="extra-resultado"></p>
    `;

    const nombreExtra = tarjeta.querySelector(".extra-nombre");
    const montoExtra = tarjeta.querySelector(".extra-monto");
    const frecuenciaExtra = tarjeta.querySelector(".extra-frecuencia");
    const cajaDias = tarjeta.querySelector(".caja-dias");
    const diasExtra = tarjeta.querySelector(".extra-dias");
    const sumarExtra = tarjeta.querySelector(".extra-sumar");
    const listaDestinos = tarjeta.querySelector(".lista-destinos");
    const botonBorrar = tarjeta.querySelector(".boton-borrar");

    // Una opción por cada frecuencia de la tabla FRECUENCIAS_EXTRA
    for (const clave in FRECUENCIAS_EXTRA) {
        const opcion = document.createElement("option");
        opcion.value = clave;
        opcion.textContent = FRECUENCIAS_EXTRA[clave].texto;
        frecuenciaExtra.appendChild(opcion);
    }

    // Una casilla por cada categoría
    for (const cat of categorias) {
        const etiqueta = document.createElement("label");
        const casilla = document.createElement("input");
        casilla.type = "checkbox";
        casilla.checked = extra.destinos.includes(cat.id);
        casilla.addEventListener("change", function () {
            if (casilla.checked) {
                if (!extra.destinos.includes(cat.id)) {
                    extra.destinos.push(cat.id);
                }
            } else {
                const posicion = extra.destinos.indexOf(cat.id);
                if (posicion !== -1) {
                    extra.destinos.splice(posicion, 1);
                }
            }
            actualizarPantalla();
        });
        etiqueta.appendChild(casilla);
        let nombre = cat.nombre;
        if (nombre.trim() === "") {
            nombre = "(sin nombre)";
        }
        etiqueta.appendChild(document.createTextNode(" " + nombre));
        listaDestinos.appendChild(etiqueta);
    }

    // Los datos de la persona se ponen como valor, nunca como HTML
    nombreExtra.value = extra.nombre;
    montoExtra.value = extra.monto;
    frecuenciaExtra.value = extra.frecuencia;
    diasExtra.value = extra.diasPorSemana;
    sumarExtra.checked = extra.sumar;
    cajaDias.hidden = !FRECUENCIAS_EXTRA[extra.frecuencia].usaDias;

    nombreExtra.addEventListener("input", function () {
        extra.nombre = nombreExtra.value;
        actualizarPantalla();
    });
    montoExtra.addEventListener("input", function () {
        extra.monto = leerNumero(montoExtra.value);
        actualizarPantalla();
    });
    frecuenciaExtra.addEventListener("change", function () {
        extra.frecuencia = frecuenciaExtra.value;
        cajaDias.hidden = !FRECUENCIAS_EXTRA[extra.frecuencia].usaDias;
        actualizarPantalla();
    });
    diasExtra.addEventListener("input", function () {
        extra.diasPorSemana = leerDias(diasExtra.value);
        actualizarPantalla();
    });
    sumarExtra.addEventListener("change", function () {
        extra.sumar = sumarExtra.checked;
        actualizarPantalla();
    });
    botonBorrar.addEventListener("click", function () {
        eliminarExtra(extra);
    });

    return tarjeta;
}

function construirExtras(){
    listaExtras.innerHTML = "";
    for (const extra of otrosIngresos) {
        listaExtras.appendChild(crearTarjetaExtra(extra));
    }
}

function agregarExtra(){
    otrosIngresos.push({ nombre: "", monto: 0, frecuencia: "mensual", diasPorSemana: 5, sumar: false, destinos: [] });
    construirExtras();
    actualizarPantalla();
    listaExtras.lastElementChild.querySelector(".extra-nombre").focus();
}

function eliminarExtra(extra){
    const posicion = otrosIngresos.indexOf(extra);
    otrosIngresos.splice(posicion, 1);
    construirExtras();
    actualizarPantalla();
}

function mostrarExtras(){
    const periodo = campoPeriodo.value;
    const textoPeriodo = PERIODOS[periodo].toLowerCase();
    let totalTodos = 0;
    let totalSumados = 0;

    for (let i = 0; i < otrosIngresos.length; i++) {
        const extra = otrosIngresos[i];
        const calculo = calcularExtra(extra);
        const tieneDestino = destinosValidos(extra).length > 0;

        let mensaje = formatoMoneda.format(calculo[periodo]) + " " + textoPeriodo + " · " +
            formatoMoneda.format(calculo.anual) + " al año";
        if (extra.sumar && !tieneDestino) {
            mensaje += " · Elige a dónde va";
        }
        listaExtras.children[i].querySelector(".extra-resultado").textContent = mensaje;

        totalTodos += calculo[periodo];
        if (extra.sumar && tieneDestino) {
            totalSumados += calculo[periodo];
        }
    }

    document.getElementById("extras-total").textContent = formatoMoneda.format(totalTodos) + " " + textoPeriodo;
    document.getElementById("extras-sumados").textContent = formatoMoneda.format(totalSumados) + " " + textoPeriodo;
}

// ----- Pantalla: sueldo y reparto -----
function mostrarEquivalentes(eq){
    document.getElementById("eq-semanal").textContent = formatoMoneda.format(eq.semanal);
    document.getElementById("eq-cada2semanas").textContent = formatoMoneda.format(eq.cada2semanas);
    document.getElementById("eq-quincenal").textContent = formatoMoneda.format(eq.quincenal);
    document.getElementById("eq-mensual").textContent = formatoMoneda.format(eq.mensual);
    document.getElementById("eq-anual").textContent = formatoMoneda.format(eq.anual);
}

function mostrarReparto(eq){
    const periodo = campoPeriodo.value;
    const filas = calcularReparto(eq);
    let totalSueldo = 0;
    let totalExtras = 0;

    for (let i = 0; i < filas.length; i++) {
        const sueldo = filas[i].sueldo[periodo];
        const extras = filas[i].extras[periodo];
        const filaHtml = cuerpoTabla.rows[i];
        filaHtml.querySelector(".c-sueldo").textContent = formatoMoneda.format(sueldo);
        filaHtml.querySelector(".c-extras").textContent = formatoMoneda.format(extras);
        filaHtml.querySelector(".c-total").textContent = formatoMoneda.format(sueldo + extras);
        totalSueldo += sueldo;
        totalExtras += extras;
    }

    document.getElementById("tot-pct").textContent = sumaPorcentajes() + "%";
    document.getElementById("tot-sueldo").textContent = formatoMoneda.format(totalSueldo);
    document.getElementById("tot-extras").textContent = formatoMoneda.format(totalExtras);
    document.getElementById("tot-total").textContent = formatoMoneda.format(totalSueldo + totalExtras);

    document.getElementById("resumen-ingreso").textContent =
        "Sueldo " + formatoMoneda.format(eq[periodo]) + " + otros ingresos " + formatoMoneda.format(totalExtras) +
        " = " + formatoMoneda.format(eq[periodo] + totalExtras) + " (" + PERIODOS[periodo].toLowerCase() + ")";
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

// Se llama cada vez que algo cambia: calcula, dibuja y guarda
function actualizarPantalla(){
    const eq = calcularEquivalentes(campoFrecuencia.value, leerMonto());
    mostrarEquivalentes(eq);
    mostrarReparto(eq);
    mostrarExtras();
    mostrarAviso();
    guardar();
}

function llenarSelectorPeriodo(){
    for (const clave in PERIODOS) {
        const opcion = document.createElement("option");
        opcion.value = clave;
        opcion.textContent = PERIODOS[clave];
        campoPeriodo.appendChild(opcion);
    }
}

function restablecer(){
    if (confirm("¿Volver a los valores iniciales? Se perderán tus cambios.")) {
        categorias = copiarCategoriasIniciales();
        otrosIngresos = copiar(EXTRAS_INICIALES);
        campoFrecuencia.value = "mensual";
        campoMonto.value = "";
        campoPeriodo.value = "semanal";
        construirTabla();
        construirExtras();
        actualizarPantalla();
    }
}

// ----- Eventos y arranque -----
campoMonto.addEventListener("input", actualizarPantalla);
campoFrecuencia.addEventListener("change", actualizarPantalla);
campoPeriodo.addEventListener("change", actualizarPantalla);
botonAgregar.addEventListener("click", agregarCategoria);
botonAgregarExtra.addEventListener("click", agregarExtra);
botonRestablecer.addEventListener("click", restablecer);

llenarSelectorPeriodo();
campoPeriodo.value = "semanal";
cargar();
construirTabla();
construirExtras();
actualizarPantalla();