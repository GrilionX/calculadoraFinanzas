function calcularSaldoAhorro(movimientos) {
    let saldoCentavos = 0;

    for (const movimiento of movimientos) {
        if (movimiento.anulacion) continue;
        if (movimiento.tipo === "aportacion") {
            saldoCentavos += movimiento.montoCentavos;
        } else if (movimiento.tipo === "retiro") {
            saldoCentavos -= movimiento.montoCentavos;
        }
    }

    return saldoCentavos;
}

function convertirPesosACentavos(texto) {
    const valor = String(texto).trim();

    if (!/^\d+(?:\.\d{1,2})?$/.test(valor)) {
        return null;
    }

    const partes = valor.split(".");
    const pesos = Number(partes[0]);
    const decimales = (partes[1] || "").padEnd(2, "0");

    const centavos = pesos * 100 + Number(decimales);

    if (!Number.isSafeInteger(centavos) || centavos <= 0) {
        return null;
    }

    return centavos;
}

function calcularReservaDeuda(deuda) {
    if (
        !deuda ||
        !Number.isSafeInteger(deuda.objetivoCentavos) ||
        deuda.objetivoCentavos <= 0 ||
        !Array.isArray(deuda.aportaciones)
    ) {
        return null;
    }

    const vinculadas = limpiarAportacionesNomina(
        deuda.aportacionesNomina
    );

    const transferencias = deuda.transferencias === undefined
        ? []
        : deuda.transferencias;

    if (
        vinculadas === null ||
        !Array.isArray(transferencias)
    ) {
        return null;
    }

    let saldo = 0;

    for (const monto of deuda.aportaciones) {
        if (!Number.isSafeInteger(monto) || monto <= 0) {
            return null;
        }

        saldo += monto;

        if (!Number.isSafeInteger(saldo)) {
            return null;
        }
    }

    for (const movimiento of vinculadas) {
        saldo += movimiento.montoCentavos;

        if (!Number.isSafeInteger(saldo)) {
            return null;
        }
    }

    const ids = new Set();

    for (const movimiento of transferencias) {
        if (
            !movimiento ||
            typeof movimiento !== "object" ||
            Array.isArray(movimiento) ||
            typeof movimiento.id !== "string" ||
            movimiento.id.trim() === "" ||
            ids.has(movimiento.id) ||
            typeof movimiento.grupoId !== "string" ||
            movimiento.grupoId.trim() === "" ||
            !Number.isSafeInteger(movimiento.montoCentavos) ||
            movimiento.montoCentavos === 0
        ) {
            return null;
        }

        ids.add(movimiento.id);
        saldo += movimiento.montoCentavos;

        if (!Number.isSafeInteger(saldo)) {
            return null;
        }
    }

    return saldo < 0 || saldo > deuda.objetivoCentavos
        ? null
        : saldo;
}

function resumirDeuda(deuda) {
    const reunidoCentavos = calcularReservaDeuda(deuda);

    if(reunidoCentavos === null){
        throw new Error("La reserva de la deuda no es valido");
    }

    const faltaCentavos = deuda.objetivoCentavos - reunidoCentavos;

    let estado = "Reuniendo dinero";

    if (deuda.liquidada) {
        estado = "Liquidada";
    } else if (faltaCentavos === 0) {
        estado = "Lista para pagar";
    }

    return {
        reunidoCentavos: reunidoCentavos,
        apartadoDisponibleCentavos: deuda.liquidada
            ? 0
            : reunidoCentavos,
        faltaCentavos: faltaCentavos,
        porcentaje: reunidoCentavos / deuda.objetivoCentavos * 100,
        estado: estado
    };
}

function ordenarDeudas(lista) {
    return [...lista].sort(function (a, b) {
        if (a.liquidada !== b.liquidada) {
            return a.liquidada ? 1 : -1;
        }

        return a.prioridad - b.prioridad ||
            a.nombre.localeCompare(b.nombre, "es");
    });
}

function proyectarApartados(lista, presupuestoSemanalCentavos) {
    if (
        !Number.isSafeInteger(presupuestoSemanalCentavos) ||
        presupuestoSemanalCentavos < 0
    ) {
        return {
            error: "El presupuesto semanal no es válido.",
            filas: []
        };
    }

    const pendientes = ordenarDeudas(lista).filter(function (deuda) {
        return !deuda.liquidada;
    });

    const filas = [];
    let faltanteAcumulado = 0;

    for (const deuda of pendientes) {
        const resumen = resumirDeuda(deuda);

        if (resumen.faltaCentavos === 0) {
            filas.push({
                id: deuda.id,
                nombre: deuda.nombre,
                faltaCentavos: 0,
                semanaObjetivo: 0
            });

            continue;
        }

        faltanteAcumulado += resumen.faltaCentavos;

        if (!Number.isSafeInteger(faltanteAcumulado)) {
            return {
                error: "Los importes superan el límite de cálculo.",
                filas: []
            };
        }

        const semanaObjetivo = presupuestoSemanalCentavos === 0
            ? null
            : Math.ceil(
                faltanteAcumulado / presupuestoSemanalCentavos
            );

        filas.push({
            id: deuda.id,
            nombre: deuda.nombre,
            faltaCentavos: resumen.faltaCentavos,
            semanaObjetivo: semanaObjetivo
        });
    }

    return {
        error: null,
        filas: filas
    };
}

function repartirNomina(montoCentavos, categoriasPago) {
    const limiteSeguro = Math.floor(
        Number.MAX_SAFE_INTEGER / 10000
    );

    if (
        !Number.isSafeInteger(montoCentavos) ||
        montoCentavos <= 0 ||
        montoCentavos > limiteSeguro
    ) {
        throw new Error("El importe está fuera del rango permitido.");
    }

    if (
        !Array.isArray(categoriasPago) ||
        categoriasPago.length === 0
    ) {
        throw new Error("Agrega al menos una categoría.");
    }

    const ids = new Set();

    const filas = categoriasPago.map(function (categoria) {
        const porcentaje = Number(categoria.porcentaje);
        const puntos = Math.round(porcentaje * 100);

        if (
            typeof categoria.id !== "string" ||
            categoria.id === "" ||
            ids.has(categoria.id) ||
            typeof categoria.nombre !== "string" ||
            categoria.nombre.trim() === "" ||
            !Number.isFinite(porcentaje) ||
            porcentaje < 0 ||
            porcentaje > 100 ||
            Math.abs(porcentaje * 100 - puntos) > 0.000001
        ) {
            throw new Error(
                "Revisa las categorías y usa porcentajes con hasta dos decimales."
            );
        }

        ids.add(categoria.id);

        const producto = montoCentavos * puntos;

        return {
            id: categoria.id,
            nombre: categoria.nombre.trim(),
            porcentaje: porcentaje,
            puntos: puntos,
            montoCentavos: Math.floor(producto / 10000),
            resto: producto % 10000
        };
    });

    const sumaPuntos = filas.reduce(function (total, fila) {
        return total + fila.puntos;
    }, 0);

    if (sumaPuntos !== 10000) {
        throw new Error("Los porcentajes deben sumar exactamente 100%.");
    }

    const asignado = filas.reduce(function (total, fila) {
        return total + fila.montoCentavos;
    }, 0);

    const centavosPendientes = montoCentavos - asignado;

    const orden = filas.map(function (fila, indice) {
        return {
            indice: indice,
            resto: fila.resto
        };
    }).sort(function (a, b) {
        return b.resto - a.resto || a.indice - b.indice;
    });

    for (let i = 0; i < centavosPendientes; i++) {
        filas[orden[i].indice].montoCentavos++;
    }

    return filas.map(function (fila) {
        return {
            id: fila.id,
            nombre: fila.nombre,
            porcentaje: fila.porcentaje,
            montoCentavos: fila.montoCentavos
        };
    });
}

function calcularDisponibleCategoria(
    nomina,
    categoriaId,
    movimientosVinculados
) {
    if (
        !nomina ||
        typeof nomina !== "object" ||
        typeof nomina.id !== "string" ||
        nomina.id.trim() === "" ||
        !Array.isArray(nomina.reparto)
    ) {
        throw new Error("La nomina no es valida");
    }

    if (
        typeof categoriaId !== "string" ||
        categoriaId.trim() === ""
    ) {
        throw new Error("La categoria no es valida");
    }

    if (!Array.isArray(movimientosVinculados)) {
        throw new Error("La lista de movimientos no es valida ");
    }

    const coincidencias = nomina.reparto.filter(function (categoria) {
        return categoria && categoria.id === categoriaId;
    });

    if (coincidencias.length !== 1) {
        throw new Error(
            "La categoria debe existir una sola vez dentro de la nomina"
        );
    }

    const categoria = coincidencias[0];
    const asignadoCentavos = categoria.montoCentavos;

    if (
        !Number.isSafeInteger(asignadoCentavos) ||
        asignadoCentavos < 0
    ) {
        throw new Error("El importe asignado no es valido")
    }

    let utilizadoCentavos = 0;
    const idsRevisados = new Set();

    for (const movimiento of movimientosVinculados) {
        if (
            !movimiento ||
            typeof movimiento !== "object" ||
            Array.isArray(movimiento) ||
            typeof movimiento.id !== "string" ||
            movimiento.id.trim() === "" ||
            typeof movimiento.nominaId !== "string" ||
            movimiento.nominaId.trim() === "" ||
            typeof movimiento.categoriaId !== "string" ||
            movimiento.categoriaId.trim() === "" ||
            !Number.isSafeInteger(movimiento.montoCentavos) ||
            movimiento.montoCentavos <= 0
        ){
            throw new Error("Hay un movimiento vinculado invalido");
        }

        if(idsRevisados.has(movimiento.id)){
            throw new Error("Hay movimientos con el mismo identificador");
        }

        idsRevisados.add(movimiento.id);
        
        const mismaNomina = movimiento.nominaId === nomina.id;
        const mismaCategoria = movimiento.categoriaId === categoriaId;

        if (!mismaNomina || !mismaCategoria){
            continue;
        }

        const siguienteTotal =
            utilizadoCentavos + movimiento.montoCentavos;

        if(!Number.isSafeInteger(siguienteTotal)){
            throw new Error("El total utilizado supera el limite permitido");
        }

        if(siguienteTotal > asignadoCentavos){
            throw new Error(
                "Los movimientos superan el importe asignado a la categoria"
            );
        }

        utilizadoCentavos = siguienteTotal;
    }

    return{
        asignadoCentavos: asignadoCentavos,
        utilizadoCentavos: utilizadoCentavos,
        disponibleCentavos: asignadoCentavos - utilizadoCentavos
    };
}

function proyectarHorizonte(objetivos, presupuestoSemanalCentavos) {
    const fallo = mensaje => ({
        error: mensaje,
        filas: [],
        resumen: null
    });

    if (
        !Array.isArray(objetivos) ||
        !Number.isSafeInteger(presupuestoSemanalCentavos) ||
        presupuestoSemanalCentavos < 0
    ) {
        return fallo(
            "Revisa el presupuesto semanal y los objetivos."
        );
    }

    const claves = new Set();

    for (const objetivo of objetivos) {
        if (
            !objetivo ||
            typeof objetivo !== "object" ||
            !["deuda", "grupo"].includes(objetivo.tipo) ||
            typeof objetivo.id !== "string" ||
            objetivo.id.trim() === "" ||
            typeof objetivo.nombre !== "string" ||
            objetivo.nombre.trim() === "" ||
            !Number.isInteger(objetivo.prioridad) ||
            objetivo.prioridad < 1 ||
            objetivo.prioridad > 999 ||
            !Number.isSafeInteger(objetivo.objetivoCentavos) ||
            objetivo.objetivoCentavos <= 0 ||
            !Number.isSafeInteger(objetivo.apartadoCentavos) ||
            objetivo.apartadoCentavos < 0 ||
            objetivo.apartadoCentavos > objetivo.objetivoCentavos
        ) {
            return fallo("Hay un objetivo con datos inválidos.");
        }

        const clave = objetivo.tipo + ":" + objetivo.id;

        if (claves.has(clave)) {
            return fallo("Hay objetivos repetidos.");
        }

        claves.add(clave);
    }

    const ordenados = [...objetivos].sort(function (a, b) {
        return a.prioridad - b.prioridad ||
            a.nombre.localeCompare(b.nombre, "es") ||
            a.tipo.localeCompare(b.tipo) ||
            a.id.localeCompare(b.id);
    });

    const filas = [];
    let objetivoTotal = 0;
    let apartadoTotal = 0;
    let faltaAcumulada = 0;

    for (const objetivo of ordenados) {
        const falta =
            objetivo.objetivoCentavos -
            objetivo.apartadoCentavos;

        objetivoTotal += objetivo.objetivoCentavos;
        apartadoTotal += objetivo.apartadoCentavos;
        faltaAcumulada += falta;

        if (
            ![
                objetivoTotal,
                apartadoTotal,
                faltaAcumulada
            ].every(Number.isSafeInteger)
        ) {
            return fallo(
                "Los importes superan el límite de cálculo."
            );
        }

        let semanaObjetivo = null;

        if (falta === 0) {
            semanaObjetivo = 0;
        } else if (presupuestoSemanalCentavos > 0) {
            const resto =
                faltaAcumulada % presupuestoSemanalCentavos;

            const semanasCompletas =
                (faltaAcumulada - resto) /
                presupuestoSemanalCentavos;

            semanaObjetivo =
                semanasCompletas + (resto > 0 ? 1 : 0);
        }

        filas.push({
            ...objetivo,
            faltaCentavos: falta,
            semanaObjetivo: semanaObjetivo
        });
    }

    const semanas = filas
        .map(fila => fila.semanaObjetivo)
        .filter(semana => semana !== null);

    return {
        error: null,
        filas: filas,
        resumen: {
            objetivoCentavos: objetivoTotal,
            apartadoCentavos: apartadoTotal,
            faltaCentavos: faltaAcumulada,
            semanaFinal: faltaAcumulada === 0
                ? 0
                : presupuestoSemanalCentavos === 0
                    ? null
                    : semanas.reduce(
                        (mayor, semana) => Math.max(mayor, semana),
                        0
                    )
        }
    };
}
//Reparto por importes exactos
function centavosReparto(valor){
 const texto=String(valor).trim();
 return /^0(?:\.0{1,2})?$/.test(texto)?0:convertirPesosACentavos(texto);
}
function repartirNominaPorMontos(total,lista){
 if(!Number.isSafeInteger(total)||total<=0||total>Math.floor(Number.MAX_SAFE_INTEGER/10000)||!Array.isArray(lista)||!lista.length)throw Error("Revisa el importe y las categorías.");
 const ids=new Set();let suma=0;
 const filas=lista.map(c=>{
  if(!c||typeof c.id!=="string"||!c.id.trim()||ids.has(c.id)||typeof c.nombre!=="string"||!c.nombre.trim()||!Number.isSafeInteger(c.montoCentavos)||c.montoCentavos<0)throw Error("Revisa los montos de cada categoría.");
  ids.add(c.id);suma+=c.montoCentavos;if(!Number.isSafeInteger(suma))throw Error("Importe fuera de rango.");
  const producto=BigInt(c.montoCentavos)*10000n;
  return {id:c.id,nombre:c.nombre.trim(),montoCentavos:c.montoCentavos,puntos:Number(producto/BigInt(total)),resto:producto%BigInt(total)};
 });
 if(suma!==total)throw Error(suma<total?"Falta dinero por asignar.":"Los montos superan el neto recibido.");
 const orden=filas.map((f,i)=>({i,resto:f.resto})).sort((a,b)=>a.resto===b.resto?a.i-b.i:a.resto>b.resto?-1:1);
 const faltan=10000-filas.reduce((s,f)=>s+f.puntos,0);
 for(let i=0;i<faltan;i++)filas[orden[i].i].puntos++;
 return filas.map(f=>({id:f.id,nombre:f.nombre,porcentaje:f.puntos/100,montoCentavos:f.montoCentavos}));
}
