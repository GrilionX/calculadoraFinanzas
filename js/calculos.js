function calcularSaldoAhorro(movimientos){
    let saldoCentavos = 0;

    for (const movimiento of movimientos){
        if (movimiento.tipo === "aportacion"){
            saldoCentavos += movimiento.montoCentavos;
        } else if(movimiento.tipo === "retiro"){
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

function resumirDeuda(deuda) {
    let reunidoCentavos = 0;

    for (const aportacion of deuda.aportaciones) {
        reunidoCentavos += aportacion;
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