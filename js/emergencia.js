// El total general es una vista de los fondos; nunca un segundo saldo.
function saldoEmergencia(a) {
    return sumaGestion([...a.cierres.map(c=>c.excedente),...(a.emergencia??[]).map(m=>m.tipo==="retiro"?-m.montoCentavos:m.montoCentavos)]);
}
function planEmergencia(d,destino,tipo,importe) {
    exigirGestion(["aportacion","retiro"].includes(tipo)&&Number.isSafeInteger(importe)&&importe>0,"Revisa el movimiento y el importe.");
    const fondos=destino==="general"?d.apartados:d.apartados.filter(a=>a.id===destino);
    exigirGestion(fondos.length>0,"Crea un apartado primero.");
    if(destino!=="general"){
        exigirGestion(tipo!=="retiro"||saldoEmergencia(fondos[0])>=importe,"El retiro supera este fondo.");
        return [{id:fondos[0].id,montoCentavos:importe}];
    }
    const total=sumaGestion(fondos.map(saldoEmergencia));
    exigirGestion(tipo!=="retiro"||importe<=total,"El retiro supera el total de emergencia.");
    // Aportaciones por partes iguales; retiros proporcionales al saldo, en centavos exactos.
    const pesos=fondos.map(a=>tipo==="retiro"?BigInt(saldoEmergencia(a)):1n);
    const divisor=pesos.reduce((a,b)=>a+b,0n);
    const partes=pesos.map(p=>Number(BigInt(importe)*p/divisor));
    let resto=importe-sumaGestion(partes);
    for(let i=0;resto>0;i=(i+1)%fondos.length){
        if(tipo!=="retiro"||partes[i]<saldoEmergencia(fondos[i])){partes[i]++;resto--;}
    }
    return fondos.map((a,i)=>({id:a.id,montoCentavos:partes[i]})).filter(x=>x.montoCentavos>0);
}
function moverEmergencia(destino,tipo,monto,nominaId,concepto) {
    const importe=convertirPesosACentavos(monto);
    exigirGestion(textoMejora(concepto,80),"Escribe un concepto de hasta 80 caracteres.");
    return operarGestion(d=>{
        for(const parte of planEmergencia(d,destino,tipo,importe)){
            const a=d.apartados.find(a=>a.id===parte.id);
            a.emergencia??=[];
            a.emergencia.push({id:idGestion(),tipo,montoCentavos:parte.montoCentavos,
                nominaId:tipo==="aportacion"?nominaId:null,concepto:concepto.trim(),fecha:fechaLocalGasto()});
        }
    });
}
function controlesEmergencia(destino) {
    return formularioGestion("movimiento-emergencia-"+destino,destino==="general"?"Mover dinero en todos los fondos":"Añadir o retirar de este fondo",f=>{
        const tipo=selectorGestion(f,"tipo","Movimiento",[["aportacion","Añadir"],["retiro","Retirar"]]);
        const origen=selectorGestion(f,"nomina","Ingreso de origen · Gastos básicos",opcionesIngresosGestion("basicos"));
        const monto=campoGestion(f,"monto","Importe total","number");
        campoGestion(f,"concepto","Concepto").maxLength=80;
        f.append(nodoGestion("p",destino==="general"?"Añadir: partes iguales. Retirar: proporcional al saldo de cada fondo. El efectivo conserva su clasificación.":"Este movimiento solo afecta al fondo seleccionado.","ayuda"));
        f.append(nodoGestion("p","Las aportaciones usan tu presupuesto de gastos básicos. Un retiro sale del fondo y no vuelve a liberar el ingreso original.","ayuda"));
        const vista=nodoGestion("output");vista.setAttribute("aria-live","polite");f.append(vista);
        const actualizar=()=>{
            origen.disabled=tipo.value==="retiro";origen.required=!origen.disabled;origen.closest("label").hidden=origen.disabled;
            try{vista.textContent=planEmergencia(gestion,destino,tipo.value,convertirPesosACentavos(monto.value)).map(p=>gestion.apartados.find(a=>a.id===p.id).nombre+": "+monedaGestion(p.montoCentavos)).join(" · ");}
            catch(e){vista.textContent=monto.value?e.message:"Escribe un importe para ver el reparto.";}
        };
        f.addEventListener("input",actualizar);f.addEventListener("change",actualizar);actualizar();
    },v=>moverEmergencia(destino,v.tipo,v.monto,v.nomina,v.concepto));
}
