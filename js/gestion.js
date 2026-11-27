//Tarjetas y apartados
let gestion = gestionInicial();
function gestionInicial() { return { version: 1, tarjetas: [], apartados: [], cartera: carteraInicial() }; }
function mesValido(m) { return typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && +m.slice(0,4) >= 1900; }
function mesNumero(m) { return +m.slice(0,4)*12 + +m.slice(5,7)-1; }
function desplazarMes(m,n) { const v=mesNumero(m)+n; return String(Math.floor(v/12)).padStart(4,"0")+"-"+String(v%12+1).padStart(2,"0"); }
function sumaGestion(xs) { return sumarCentavosResumen(xs); }
function exigirGestion(ok,mensaje="Revisa los datos.") { if (!ok) throw new Error(mensaje); }
function cuotaCompra(c,i) { return i===c.meses-1 ? c.totalCentavos-Math.floor(c.totalCentavos/c.meses)*(c.meses-1) : Math.floor(c.totalCentavos/c.meses); }
function resumenCompra(c,mes=fechaLocalGasto().slice(0,7)) {
    const pagado=sumaGestion(c.pagos.map(p=>p.montoCentavos));
    const alMes=sumaGestion(c.pagos.filter(p=>p.fecha.slice(0,7)<=mes).map(p=>p.montoCentavos));
    const vencidas=Math.max(0,Math.min(c.meses,mesNumero(mes)-mesNumero(c.inicio)+1));
    let exigible=0, completas=0, acumulado=0;
    for(let i=0;i<c.meses;i++) {const cuota=cuotaCompra(c,i); if(i<vencidas)exigible+=cuota; acumulado+=cuota;if(acumulado<=pagado)completas++;}
    return { pagado, saldo:c.totalCentavos-pagado, mensual:cuotaCompra(c,0), faltan:c.meses-completas, pendienteMes:Math.max(0,exigible-alMes) };
}
function resumenApartado(a,mes) {
    const apartado=sumaGestion(a.aportes.filter(x=>x.mes===mes).map(x=>x.montoCentavos));
    const gastado=sumaGestion(a.gastos.filter(x=>x.fecha.slice(0,7)===mes).map(x=>x.montoCentavos));
    return {apartado,gastado,excedente:apartado-gastado,cerrado:a.cierres.some(x=>x.mes===mes)};
}
function saldosApartados(d=gestion) {
    let emergencia=0,efectivo=0,reservado=0;
    for(const a of d.apartados) {
        const cerrado=sumaGestion(a.cierres.map(c=>c.excedente));
        if(a.medio==="efectivo")efectivo=sumaGestion([efectivo,saldoEmergencia(a)]);else emergencia=sumaGestion([emergencia,saldoEmergencia(a)]);
        reservado+=sumaGestion(a.aportes.map(x=>x.montoCentavos))-sumaGestion(a.gastos.map(x=>x.montoCentavos))-cerrado;
    }
    return {emergencia,efectivo,reservado};
}
function proyectarApartado(centavos,tasa,meses=12) {
    exigirGestion(Number.isSafeInteger(centavos)&&centavos>=0&&Number.isFinite(tasa)&&tasa>=0&&tasa<=1000&&Number.isInteger(meses)&&meses>=0&&meses<=600);
    const resultado=Math.round(centavos*Math.pow(1+tasa/100,meses/12));
    exigirGestion(Number.isSafeInteger(resultado),"Proyección fuera de rango.");
    return resultado;
}
function compromisosGestion(d=gestion) {
    return [...d.apartados.flatMap(a=>[...a.aportes,...(a.emergencia??[]).filter(x=>x.tipo==="aportacion")].map(x=>({id:x.id,nominaId:x.nominaId,categoriaId:"basicos",montoCentavos:x.montoCentavos}))),
        ...d.tarjetas.flatMap(t=>t.compras.flatMap(c=>c.pagos.map(p=>({id:p.id,nominaId:p.nominaId,categoriaId:p.categoriaId,montoCentavos:p.montoCentavos}))))];
}
function limpiarGestion(valor,paquete) {
    const d=valor===undefined?gestionInicial():copiar(valor);
    try {
        exigirGestion(d&&d.version===1&&Array.isArray(d.tarjetas)&&Array.isArray(d.apartados));
        d.cartera ??= carteraInicial();
        comprobarCartera(d.cartera);
        const ids=new Set();
        const id=x=>{exigirGestion(idMejora(x)&&!ids.has(x));ids.add(x);};
        const dinero=x=>exigirGestion(Number.isSafeInteger(x)&&x>0);
        const origen=(x,cat)=>exigirGestion(paquete.nominas.some(n=>n.id===x&&n.reparto.some(c=>c.id===cat)));
        for(const t of d.tarjetas) {
            id(t.id);exigirGestion(textoMejora(t.nombre,60)&&Array.isArray(t.compras));
            t.limiteCentavos ??= null; t.diaCorte ??= null; t.diaPago ??= null;
            exigirGestion(t.limiteCentavos===null||(Number.isSafeInteger(t.limiteCentavos)&&t.limiteCentavos>=0));
            for(const dia of [t.diaCorte,t.diaPago])exigirGestion(dia===null||(Number.isInteger(dia)&&dia>=1&&dia<=31));
            for(const c of t.compras) {
                id(c.id);dinero(c.totalCentavos);
                exigirGestion(textoMejora(c.nombre,80)&&Number.isInteger(c.meses)&&c.meses>=1&&c.meses<=120&&c.totalCentavos>=c.meses&&mesValido(c.inicio)&&Array.isArray(c.pagos));
                for(const p of c.pagos){id(p.id);dinero(p.montoCentavos);exigirGestion(fechaGastoValida(p.fecha)&&esCategoriaDeGasto(p.categoriaId));origen(p.nominaId,p.categoriaId);}
                exigirGestion(resumenCompra(c).saldo>=0,"El pago supera la compra.");
            }
        }
        for(const a of d.apartados) {
            id(a.id);dinero(a.porPeriodo);
            a.emergencia ??= [];
            exigirGestion(Array.isArray(a.emergencia));
            for(const m of a.emergencia){id(m.id);dinero(m.montoCentavos);exigirGestion(["aportacion","retiro"].includes(m.tipo)&&fechaGastoValida(m.fecha)&&textoMejora(m.concepto,80));if(m.tipo==="aportacion")origen(m.nominaId,"basicos");else exigirGestion(m.nominaId===null);}
            exigirGestion(textoMejora(a.nombre,60)&&["efectivo","tarjeta"].includes(a.medio)&&Number.isFinite(a.tasa)&&a.tasa>=0&&a.tasa<=1000&&Array.isArray(a.aportes)&&Array.isArray(a.gastos)&&Array.isArray(a.cierres));
            for(const x of a.aportes){id(x.id);dinero(x.montoCentavos);origen(x.nominaId,"basicos");exigirGestion(mesValido(x.mes)&&fechaGastoValida(x.fecha));}
            for(const x of a.gastos){id(x.id);dinero(x.montoCentavos);exigirGestion(fechaGastoValida(x.fecha)&&textoMejora(x.concepto,80));}
            const meses=new Set([...a.aportes.map(x=>x.mes),...a.gastos.map(x=>x.fecha.slice(0,7))]);
            for(const m of meses)exigirGestion(resumenApartado(a,m).excedente>=0,"El gasto supera el apartado.");
            const cerrados=new Set();
            for(const c of a.cierres){exigirGestion(mesValido(c.mes)&&!cerrados.has(c.mes)&&fechaGastoValida(c.fecha)&&Number.isSafeInteger(c.excedente)&&c.excedente>=0&&c.excedente===resumenApartado(a,c.mes).excedente);cerrados.add(c.mes);}
            let saldo=sumaGestion(a.cierres.map(c=>c.excedente));
            for(const m of a.emergencia){saldo=sumaGestion([saldo,m.tipo==="retiro"?-m.montoCentavos:m.montoCentavos]);exigirGestion(saldo>=0,"El retiro supera el fondo individual.");}
        }
        saldosApartados(d);
        return d;
    }catch{return null;}
}
function operarGestion(fn) {return guardarOperacionMejora(p=>fn(p.gestion));}
function idGestion() {return crypto.randomUUID();}
function datosCredito(limite="",corte="",pago="") {
    const limiteCentavos=limite===""||limite===null?null:limite==="0"||limite===0?0:convertirPesosACentavos(limite);
    exigirGestion(limite===""||limite===null||limiteCentavos!==null,"Revisa el límite de crédito.");
    const dia=valor=>{if(valor===""||valor===null)return null;const n=Number(valor);exigirGestion(Number.isInteger(n)&&n>=1&&n<=31,"Usa días del 1 al 31.");return n;};
    return {limiteCentavos,diaCorte:dia(corte),diaPago:dia(pago)};
}
function crearTarjeta(nombre,limite="",corte="",pago="") {
    const config=datosCredito(limite,corte,pago);
    return operarGestion(d=>d.tarjetas.push({id:idGestion(),nombre:nombre.trim(),...config,compras:[]}));
}
function editarTarjeta(id,nombre,limite,corte,pago) {
    const config=datosCredito(limite,corte,pago);
    return operarGestion(d=>{const t=d.tarjetas.find(t=>t.id===id);exigirGestion(t,"Tarjeta no encontrada.");Object.assign(t,{nombre:nombre.trim(),...config});});
}
function resumenCredito(t) {
    const utilizado=sumaGestion(t.compras.map(c=>resumenCompra(c).saldo));
    const limite=t.limiteCentavos??null;
    return {utilizado,limite,disponible:limite===null?null:Math.max(0,limite-utilizado),excedido:limite===null?0:Math.max(0,utilizado-limite)};
}
function fechaDiaTarjeta(mes,dia) {
    if(dia===null||dia===undefined)return "";
    exigirGestion(mesValido(mes)&&Number.isInteger(dia)&&dia>=1&&dia<=31);
    const ultimo=new Date(Date.UTC(+mes.slice(0,4),+mes.slice(5,7),0)).getUTCDate();
    return mes+"-"+String(Math.min(dia,ultimo)).padStart(2,"0");
}
function fechasTarjeta(t,mes) {
    const corte=fechaDiaTarjeta(mes,t.diaCorte);
    const mesPago=t.diaCorte&&t.diaPago&&t.diaPago<=t.diaCorte?desplazarMes(mes,1):mes;
    return {corte,pago:fechaDiaTarjeta(mesPago,t.diaPago)};
}
function crearCompra(tarjeta,nombre,total,meses,inicio) {
    return operarGestion(d=>{const t=d.tarjetas.find(t=>t.id===tarjeta);exigirGestion(t,"Selecciona una tarjeta.");
        const importe=convertirPesosACentavos(total),credito=resumenCredito(t);
        exigirGestion(importe!==null,"Revisa el monto.");
        exigirGestion(credito.disponible===null||importe<=credito.disponible,"La compra supera el crédito disponible.");
        t.compras.push({id:idGestion(),nombre:nombre.trim(),totalCentavos:importe,meses:Number(meses),inicio,pagos:[]});});
}
function pagarCompra(tarjeta,compra,monto,nominaId,categoriaId,fecha) {
    return operarGestion(d=>{const c=d.tarjetas.find(t=>t.id===tarjeta)?.compras.find(c=>c.id===compra);exigirGestion(c,"Selecciona una compra.");
        c.pagos.push({id:idGestion(),montoCentavos:convertirPesosACentavos(monto),nominaId,categoriaId,fecha});});
}
function crearApartado(nombre,medio,porPeriodo,tasa) {
    return operarGestion(d=>d.apartados.push({id:idGestion(),nombre:nombre.trim(),medio,porPeriodo:convertirPesosACentavos(porPeriodo),tasa:Number(tasa),aportes:[],gastos:[],cierres:[]}));
}
function aportarBasico(id,nominaId,monto,mes,fecha=fechaLocalGasto()) {
    return operarGestion(d=>{const a=d.apartados.find(a=>a.id===id);exigirGestion(a&&!a.cierres.some(c=>c.mes===mes),"Mes cerrado.");
        a.aportes.push({id:idGestion(),nominaId,montoCentavos:convertirPesosACentavos(monto),mes,fecha});});
}
function gastarApartado(id,concepto,monto,fecha) {
    return operarGestion(d=>{const a=d.apartados.find(a=>a.id===id);exigirGestion(a&&!a.cierres.some(c=>c.mes===fecha.slice(0,7)),"Mes cerrado.");
        a.gastos.push({id:idGestion(),concepto:concepto.trim(),montoCentavos:convertirPesosACentavos(monto),fecha});});
}
function cerrarMesApartado(id,mes) {
    return operarGestion(d=>{const a=d.apartados.find(a=>a.id===id);exigirGestion(a&&mesValido(mes),"Selecciona un mes.");
        const r=resumenApartado(a,mes);exigirGestion(!r.cerrado&&r.apartado>0,"El mes está cerrado o no tiene aportes.");
        a.cierres.push({mes,fecha:fechaLocalGasto(),excedente:r.excedente});});
}
function cambiarTasaApartado(id,tasa) {
    return operarGestion(d=>{const a=d.apartados.find(a=>a.id===id);exigirGestion(a);a.tasa=Number(tasa);});
}
function borrarGestion(tipo,id,padre,abuelo) {
    return operarGestion(d=>{
        if(tipo==="tarjeta")d.tarjetas=d.tarjetas.filter(t=>t.id!==id);
        if(tipo==="compra"){const t=d.tarjetas.find(t=>t.id===padre);exigirGestion(t);t.compras=t.compras.filter(c=>c.id!==id);}
        if(tipo==="pago"){const c=d.tarjetas.find(t=>t.id===abuelo)?.compras.find(c=>c.id===padre);exigirGestion(c);c.pagos=c.pagos.filter(p=>p.id!==id);}
        if(tipo==="apartado"){const a=d.apartados.find(a=>a.id===id);exigirGestion(a&&!a.cierres.length&&!(a.emergencia??[]).length,"Conserva este apartado: tiene historial de emergencia.");d.apartados=d.apartados.filter(a=>a.id!==id);}
        if(tipo==="aporte"||tipo==="gasto"){const a=d.apartados.find(a=>a.id===padre);exigirGestion(a);const campo=tipo==="aporte"?"aportes":"gastos";const x=a[campo].find(x=>x.id===id);exigirGestion(x);const mes=x.mes??x.fecha.slice(0,7);exigirGestion(!a.cierres.some(c=>c.mes===mes),"El mes ya está cerrado.");a[campo]=a[campo].filter(x=>x.id!==id);}
    });
}

function reasignarPendiente(nominaId,destino) {
    return guardarOperacionMejora(p=>{
        const n=p.nominas.find(n=>n.id===nominaId),origen=n?.reparto.find(c=>c.id==="pendiente"),fin=n?.reparto.find(c=>c.id===destino);
        exigirGestion(origen&&fin&&destino!=="pendiente","Selecciona ingreso y destino.");
        const usados=obtenerCompromisosNomina(p.deudas,p.gruposDeudas,p.gastosBasicos,p.movimientosAhorros,p.gestion);
        exigirGestion(!usados.some(m=>m.nominaId===nominaId&&m.categoriaId==="pendiente"),"Ese saldo tiene movimientos vinculados.");
        exigirGestion(!p.historialCorrecciones.some(e=>[e.antes,e.despues].some(s=>obtenerApartadosNomina(s.deudas,s.gruposDeudas).some(m=>m.nominaId===nominaId&&m.categoriaId==="pendiente"))),"Ese saldo tiene historial vinculado.");
        const antes=copiar(n);
        const reparto=n.reparto.filter(c=>c.id!=="pendiente").map(c=>({...c,porcentaje:c.id===destino?Math.round((Number(c.porcentaje)+Number(origen.porcentaje))*100)/100:Number(c.porcentaje)}));
        n.reparto=repartirNomina(n.montoCentavos,reparto);
        p.mejoras.cambiosIngresos.push({id:idGestion(),fecha:fechaLocalGasto(),motivo:"Reasignación de saldo pendiente",antes,despues:copiar(n)});
    });
}

function devolverBasicoDisponible(apartadoId,aporteId,textoMonto){
 const monto=convertirPesosACentavos(textoMonto);exigirGestion(monto!==null,"Escribe un monto positivo.");
 return operarGestion(d=>{
  const a=d.apartados.find(a=>a.id===apartadoId),aporte=a?.aportes.find(x=>x.id===aporteId);
  exigirGestion(a&&aporte,"Selecciona un aporte.");const r=resumenApartado(a,aporte.mes);
  exigirGestion(!r.cerrado,"El mes está cerrado; ese dinero ya pasó al fondo.");
  exigirGestion(monto<=aporte.montoCentavos&&monto<=r.excedente,"Solo puedes devolver el dinero que sigue sin gastarse.");
  aporte.montoCentavos-=monto;if(aporte.montoCentavos===0)a.aportes=a.aportes.filter(x=>x.id!==aporteId);
 });
}
