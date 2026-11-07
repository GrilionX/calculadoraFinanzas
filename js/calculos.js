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