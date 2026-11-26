//Vista de cuentas
const panelCuentas=nodoGestion("section",undefined,"panel-cuentas");
panelCuentas.id="panel-cuentas";
crearPaginaFinanzas("cuentas",repartoFinanzas,[panelCuentas]);
titulosFinanzas.cuentas=["DÓNDE ESTÁ TU DINERO","Cuentas y efectivo"];
const enlaceCuentas=nodoGestion("button","◈ Cuentas y efectivo");enlaceCuentas.type="button";enlaceCuentas.dataset.ruta="cuentas";
document.querySelector('[data-grupo="ingresos"]').append(enlaceCuentas);
panelCuentas.append(nodoGestion("p","Saldos de tus cuentas. No se suman a ingresos ni apartados.","ayuda"));
const resumenCuentasUI=nodoGestion("div",undefined,"saldos-gestion");
panelCuentas.append(resumenCuentasUI);
panelCuentas.append(formularioGestion("nueva-cuenta","＋ Agregar cuenta",f=>{
 campoGestion(f,"nombre","Nombre").maxLength=REGLAS_CUENTAS.maxNombre;
 selectorGestion(f,"tipo","Tipo",[["efectivo","Efectivo"],["debito","Débito"]]);
 campoGestion(f,"saldo","Saldo actual","number","0").min="0";
 campoGestion(f,"fecha","Fecha del saldo","date",fechaLocalGasto()).max=fechaLocalGasto();
 f.append(nodoGestion("p","Registra lo que ya tienes. No crea un ingreso.","ayuda"));
},v=>crearCuentaLocal(v.nombre,v.tipo,v.saldo,v.fecha)));
let transferenciaToken=idGestion();
panelCuentas.append(formularioGestion("transferir-cuentas","⇄ Transferir",f=>{
 selectorGestion(f,"origen","Desde",[]);selectorGestion(f,"destino","Hacia",[]);
 campoGestion(f,"monto","Monto","number");
 campoGestion(f,"fecha","Fecha","date",fechaLocalGasto()).max=fechaLocalGasto();
 campoGestion(f,"concepto","Concepto","text","Transferencia").maxLength=REGLAS_CUENTAS.maxConcepto;
 const previa=nodoGestion("p","","ayuda");previa.id="previa-transferencia";previa.setAttribute("aria-live","polite");f.append(previa);
 f.addEventListener("input",actualizarPreviaCuenta);f.addEventListener("change",actualizarPreviaCuenta);
},v=>{transferirCuentas(v.origen,v.destino,v.monto,v.fecha,v.concepto,transferenciaToken);transferenciaToken=idGestion();}));
const listaCuentasUI=nodoGestion("div",undefined,"lista-cuentas");
const historialCuentasUI=nodoGestion("details");historialCuentasUI.append(nodoGestion("summary","Movimientos de cuentas"));
const movimientosCuentasUI=nodoGestion("ol",undefined,"movimientos-cuentas");historialCuentasUI.append(movimientosCuentasUI);
panelCuentas.append(listaCuentasUI,historialCuentasUI);
function actualizarPreviaCuenta(){
 const f=document.getElementById("transferir-cuentas"),s=saldosCuentas(),origen=f.elements.origen.value,destino=f.elements.destino.value,monto=convertirPesosACentavos(f.elements.monto.value);
 document.getElementById("previa-transferencia").textContent=origen&&destino&&origen!==destino&&monto!==null?
 "Después: origen "+monedaGestion(s.get(origen)-monto)+" · destino "+monedaGestion(s.get(destino)+monto):"Mover dinero entre cuentas no es un gasto.";
}
function mostrarCuentas(){
 const d=gestion.cartera,{saldos,revertidos}=comprobarCartera(d);
 const borradores=new Map([...listaCuentasUI.querySelectorAll("form")].map(f=>[f.id,{abierto:f.closest("details").open,datos:[...f.elements].filter(e=>e.name).map(e=>[e.name,e.value])}]));
 const efectivo=sumaGestion(d.cuentas.filter(c=>c.tipo==="efectivo").map(c=>saldos.get(c.id))),debito=sumaGestion(d.cuentas.filter(c=>c.tipo==="debito").map(c=>saldos.get(c.id)));
 resumenCuentasUI.replaceChildren(resumenMoneda("Total registrado",sumaGestion([efectivo,debito]),"cuentas-total"),resumenMoneda("Efectivo",efectivo,"cuentas-efectivo"),resumenMoneda("Débito",debito,"cuentas-debito"));
 for(const nombre of ["origen","destino"]){
  const select=document.getElementById("transferir-cuentas").elements[nombre],valor=select.value;
  select.replaceChildren(new Option("Selecciona cuenta",""));
  for(const c of d.cuentas.filter(c=>!c.archivada))select.add(new Option(c.nombre+" · "+monedaGestion(saldos.get(c.id)),c.id));
  if([...select.options].some(o=>o.value===valor))select.value=valor;
 }
 listaCuentasUI.replaceChildren();
 if(!d.cuentas.length)listaCuentasUI.append(nodoGestion("p","Agrega tu efectivo o tu primera cuenta de débito.","estado-vacio"));
 for(const c of d.cuentas){
  const card=nodoGestion("article",undefined,"tarjeta-gestion tarjeta-cuenta");card.dataset.cuenta=c.id;
  card.append(nodoGestion("h3",c.nombre),nodoGestion("p",c.archivada?"Archivada":c.tipo==="efectivo"?"Efectivo":"Débito","etiqueta"),resumenMoneda("Saldo",saldos.get(c.id),"cuenta-"+c.id));
  card.append(formularioGestion("nombre-cuenta-"+c.id,"Editar nombre",f=>{campoGestion(f,"nombre","Nombre","text",c.nombre).maxLength=REGLAS_CUENTAS.maxNombre;},v=>editarCuentaLocal(c.id,v.nombre)));
  if(!c.archivada){
   const saldoEsperado=saldos.get(c.id),token=idGestion();
   card.append(formularioGestion("conciliar-cuenta-"+c.id,"Conciliar saldo",f=>{
    campoGestion(f,"saldo","Saldo que tienes ahora","number",String(saldoEsperado/100)).min="0";
    for(const [n,v] of [["saldoEsperado",saldoEsperado],["token",token]]){const input=document.createElement("input");input.type="hidden";input.name=n;input.value=String(v);f.append(input);}
    campoGestion(f,"fecha","Fecha","date",fechaLocalGasto()).max=fechaLocalGasto();
    campoGestion(f,"concepto","Motivo").maxLength=REGLAS_CUENTAS.maxConcepto;
    f.append(nodoGestion("p","Ajusta esta cuenta; no registra gastos ni ingresos. Revisa también tus registros.","ayuda"));
   },v=>conciliarCuenta(c.id,v.saldo,v.fecha,v.concepto,Number(v.saldoEsperado),v.token)));
  }
  const acciones=nodoGestion("div",undefined,"acciones-cuenta");
  const archivar=botonGestion(c.archivada?"Reactivar":"Archivar",()=>archivarCuentaLocal(c.id));
  archivar.disabled=!c.archivada&&saldos.get(c.id)!==0;archivar.title=archivar.disabled?"Deja el saldo en cero antes de archivar":"";acciones.append(archivar);
  if(!c.archivada&&c.saldoInicialCentavos===0&&!d.movimientos.some(m=>m.cuentaId===c.id||m.origen===c.id||m.destino===c.id))acciones.append(botonGestion("Eliminar",async()=>{if(await confirmarBorrado("¿Eliminar esta cuenta vacía?"))borrarCuentaLocal(c.id);},"boton-peligro"));
  card.append(acciones);listaCuentasUI.append(card);
 }
 movimientosCuentasUI.replaceChildren();
 const nombre=id=>d.cuentas.find(c=>c.id===id)?.nombre??"Cuenta";
 for(const m of [...d.movimientos].reverse()){
  const li=nodoGestion("li"),descripcion=m.tipo==="transferencia"?nombre(m.origen)+" → "+nombre(m.destino)+" · "+monedaGestion(m.montoCentavos):nombre(m.cuentaId)+" · "+monedaGestion(m.saldoAnteriorCentavos)+" → "+monedaGestion(m.saldoNuevoCentavos);
  li.append(nodoGestion("strong",descripcion),nodoGestion("span",nombreFecha(m.fecha)+" · "+m.concepto));
  if(m.tipo==="transferencia"&&m.revierte===null&&!revertidos.has(m.id))li.append(botonGestion("Revertir",async()=>{if(await confirmarBorrado("¿Devolver esta transferencia a su cuenta de origen? El historial se conserva."))revertirTransferencia(m.id);}));
  if(revertidos.has(m.id))li.append(nodoGestion("span","Revertida","etiqueta"));movimientosCuentasUI.append(li);
 }
 if(!d.movimientos.length)movimientosCuentasUI.append(nodoGestion("li","Sin movimientos."));
 for(const [id,b]of borradores){const f=document.getElementById(id);if(!f)continue;f.closest("details").open=b.abierto;for(const [n,v]of b.datos)if(f.elements[n])f.elements[n].value=v;}
 actualizarPreviaCuenta();
}
const mostrarGestionConCuentas=mostrarGestion;
mostrarGestion=function(){mostrarGestionConCuentas();mostrarCuentas();};
mostrarCuentas();
