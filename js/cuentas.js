//Cuentas y movimientos
const REGLAS_CUENTAS=Object.freeze({maxCuentas:100,maxNombre:60,maxConcepto:120});
function carteraInicial(){return {version:1,cuentas:[],movimientos:[]};}
function comprobarCartera(d){
 exigirGestion(d&&d.version===1&&Array.isArray(d.cuentas)&&Array.isArray(d.movimientos),"Revisa las cuentas.");
 exigirGestion(d.cuentas.length<=REGLAS_CUENTAS.maxCuentas,"Límite de cuentas alcanzado.");
 const ids=new Set(),nombres=new Set(),saldos=new Map(),cuentas=new Map(),movimientos=new Map(),revertidos=new Set();
 const id=x=>{exigirGestion(idMejora(x)&&!ids.has(x),"Identificador repetido.");ids.add(x);};
 const dinero=x=>Number.isSafeInteger(x)&&x>=0;
 for(const c of d.cuentas){
  id(c.id);exigirGestion(textoMejora(c.nombre,REGLAS_CUENTAS.maxNombre)&&["efectivo","debito"].includes(c.tipo)&&dinero(c.saldoInicialCentavos)&&fechaGastoValida(c.fecha)&&typeof c.archivada==="boolean","Cuenta no válida.");
  const nombre=c.nombre.trim().toLocaleLowerCase("es");exigirGestion(!nombres.has(nombre),"Usa nombres distintos.");nombres.add(nombre);
  saldos.set(c.id,c.saldoInicialCentavos);cuentas.set(c.id,c);
 }
 let fecha="";
 for(const m of d.movimientos){
  id(m.id);exigirGestion(fechaGastoValida(m.fecha)&&m.fecha>=fecha&&textoMejora(m.concepto,REGLAS_CUENTAS.maxConcepto),"Revisa fecha y concepto.");fecha=m.fecha;
  const cuenta=cid=>exigirGestion(cuentas.has(cid)&&m.fecha>=cuentas.get(cid).fecha,"La cuenta no existía en esa fecha.");
  if(m.tipo==="transferencia"){
   cuenta(m.origen);cuenta(m.destino);
   exigirGestion(m.origen!==m.destino&&dinero(m.montoCentavos)&&m.montoCentavos>0,"Revisa la transferencia.");
   if(m.revierte!==null){
    const anterior=movimientos.get(m.revierte);
    exigirGestion(anterior?.tipo==="transferencia"&&anterior.revierte===null&&!revertidos.has(m.revierte)&&anterior.origen===m.destino&&anterior.destino===m.origen&&anterior.montoCentavos===m.montoCentavos,"Reversión duplicada o inválida.");revertidos.add(m.revierte);
   }
   saldos.set(m.origen,sumarSeguroMejora(saldos.get(m.origen),-m.montoCentavos));
   exigirGestion(saldos.get(m.origen)>=0,"Saldo insuficiente en origen.");
   saldos.set(m.destino,sumarSeguroMejora(saldos.get(m.destino),m.montoCentavos));
  }else{
   exigirGestion(m.tipo==="conciliacion","Movimiento desconocido.");cuenta(m.cuentaId);
   exigirGestion(dinero(m.saldoAnteriorCentavos)&&dinero(m.saldoNuevoCentavos)&&m.saldoAnteriorCentavos===saldos.get(m.cuentaId)&&m.saldoAnteriorCentavos!==m.saldoNuevoCentavos,"Revisa el saldo anterior y el nuevo.");
   saldos.set(m.cuentaId,m.saldoNuevoCentavos);
  }
  movimientos.set(m.id,m);
 }
 for(const c of d.cuentas)exigirGestion(!c.archivada||saldos.get(c.id)===0,"Solo puedes archivar cuentas sin saldo.");
 sumarCentavosResumen([...saldos.values()]);return {saldos,revertidos};
}
function saldosCuentas(d=gestion.cartera){return comprobarCartera(d).saldos;}
function operarCuentas(fn){return operarGestion(d=>{d.cartera??=carteraInicial();fn(d.cartera);comprobarCartera(d.cartera);});}
function cuentaActiva(d,id){const c=d.cuentas.find(c=>c.id===id);exigirGestion(c&&!c.archivada,"Selecciona una cuenta activa.");return c;}
function fechaCuentaActual(d,fecha){
 exigirGestion(fechaGastoValida(fecha)&&fecha<=fechaLocalGasto(),"Usa una fecha válida, no futura.");
 exigirGestion(!d.movimientos.length||fecha>=d.movimientos.at(-1).fecha,"La fecha no puede ser anterior al último movimiento.");
}
function montoCuenta(saldo){const s=String(saldo).trim();return /^0(?:[.,]0{1,2})?$/.test(s)?0:convertirPesosACentavos(s);}
function crearCuentaLocal(nombre,tipo,saldo,fecha){return operarCuentas(d=>{fechaCuentaActual(d,fecha);d.cuentas.push({id:idGestion(),nombre:nombre.trim(),tipo,saldoInicialCentavos:montoCuenta(saldo),fecha,archivada:false});});}
function transferirCuentas(origen,destino,monto,fecha,concepto,operacionId){
 exigirGestion(idMejora(operacionId),"Falta el identificador de operación.");
 return operarCuentas(d=>{
  exigirGestion(!d.movimientos.some(m=>m.id===operacionId),"Este movimiento ya se guardó.");
  cuentaActiva(d,origen);cuentaActiva(d,destino);fechaCuentaActual(d,fecha);
  d.movimientos.push({id:operacionId,tipo:"transferencia",origen,destino,montoCentavos:convertirPesosACentavos(monto),fecha,concepto:concepto.trim(),revierte:null});
 });
}
function conciliarCuenta(id,saldo,fecha,concepto,saldoEsperado,operacionId){return operarCuentas(d=>{
 cuentaActiva(d,id);fechaCuentaActual(d,fecha);const anterior=saldosCuentas(d).get(id);
 exigirGestion(anterior===saldoEsperado,"El saldo cambió. Revisa antes de ajustar.");
 d.movimientos.push({id:operacionId,tipo:"conciliacion",cuentaId:id,saldoAnteriorCentavos:anterior,saldoNuevoCentavos:montoCuenta(saldo),fecha,concepto:concepto.trim()});
});}
function revertirTransferencia(id){return operarCuentas(d=>{
 const m=d.movimientos.find(m=>m.id===id);exigirGestion(m?.tipo==="transferencia"&&m.revierte===null,"Selecciona una transferencia.");
 cuentaActiva(d,m.origen);cuentaActiva(d,m.destino);const fecha=fechaLocalGasto();fechaCuentaActual(d,fecha);
 d.movimientos.push({id:idGestion(),tipo:"transferencia",origen:m.destino,destino:m.origen,montoCentavos:m.montoCentavos,fecha,concepto:"Reversión: "+m.concepto.slice(0,100),revierte:id});
});}
function editarCuentaLocal(id,nombre){return operarCuentas(d=>{const c=d.cuentas.find(c=>c.id===id);exigirGestion(c,"Cuenta no encontrada.");c.nombre=nombre.trim();});}
function archivarCuentaLocal(id){return operarCuentas(d=>{const c=d.cuentas.find(c=>c.id===id);exigirGestion(c,"Cuenta no encontrada.");c.archivada=!c.archivada;});}
function borrarCuentaLocal(id){return operarCuentas(d=>{
 const c=cuentaActiva(d,id);exigirGestion(c.saldoInicialCentavos===0&&!d.movimientos.some(m=>m.cuentaId===id||m.origen===id||m.destino===id),"Conserva el historial: deja la cuenta en cero y archívala.");
 d.cuentas=d.cuentas.filter(c=>c.id!==id);
});}
