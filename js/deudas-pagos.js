//Pago visible desde Deudas generales
const panelPagosDeuda=document.createElement("section");
panelPagosDeuda.className="tarjeta";
panelPagosDeuda.id="pagos-deudas";
const tituloPagosDeuda=document.createElement("h2");tituloPagosDeuda.textContent="Liquidar una deuda";
const etiquetaPagoDeuda=document.createElement("label");etiquetaPagoDeuda.htmlFor="deuda-para-liquidar";etiquetaPagoDeuda.textContent="Deuda";
const selectorPagoDeuda=document.createElement("select");selectorPagoDeuda.id="deuda-para-liquidar";
const detallePagoDeuda=document.createElement("p");detallePagoDeuda.id="detalle-pago-deuda";detallePagoDeuda.setAttribute("role","status");
const botonPagoDeuda=document.createElement("button");botonPagoDeuda.type="button";botonPagoDeuda.className="boton-principal";botonPagoDeuda.textContent="Liquidar deuda";
const botonPrepararPagoDeuda=document.createElement("button");botonPrepararPagoDeuda.type="button";botonPrepararPagoDeuda.textContent="Asignar fondo completo del grupo";
const enlaceApartadosDeuda=document.createElement("button");enlaceApartadosDeuda.type="button";enlaceApartadosDeuda.textContent="Ver acreedores y apartados";
enlaceApartadosDeuda.onclick=()=>irSeccionLateral("acreedores");
panelPagosDeuda.append(tituloPagosDeuda,etiquetaPagoDeuda,selectorPagoDeuda,detallePagoDeuda,botonPrepararPagoDeuda,botonPagoDeuda,enlaceApartadosDeuda);
document.getElementById("pagina-deudas").prepend(panelPagosDeuda);
function actualizarDetallePagoDeuda(){
 const d=deudas.find(d=>d.id===selectorPagoDeuda.value);
 botonPagoDeuda.disabled=true;botonPrepararPagoDeuda.hidden=true;
 if(!d){detallePagoDeuda.textContent="Selecciona la deuda que ya pagaste.";return;}
 if(d.liquidada){detallePagoDeuda.textContent="Liquidada · "+formatoMoneda.format(d.objetivoCentavos/100)+". El pago queda guardado en el historial.";return;}
 const r=resumirDeuda(d),g=obtenerGrupoDeuda(d),f=g?.modalidad==="grupo"?resumirFondoGrupo(g):null;
 detallePagoDeuda.textContent="Apartado: "+formatoMoneda.format(r.reunidoCentavos/100)+" · Falta: "+formatoMoneda.format(r.faltaCentavos/100)+".";
 botonPagoDeuda.disabled=r.faltaCentavos!==0||!guardadoHabilitado||reinicioDetectado;
 if(r.faltaCentavos===0)detallePagoDeuda.textContent+=" Confirma la liquidación después de pagar al acreedor.";
 else if(f&&f.faltaCentavos===0&&f.fondoCentavos>0){botonPrepararPagoDeuda.hidden=false;detallePagoDeuda.textContent+=" El dinero está en el fondo del grupo: asígnalo antes de liquidar."; }
}
function mostrarPagosDeuda(){
 const anterior=selectorPagoDeuda.value;
 selectorPagoDeuda.replaceChildren(new Option("Selecciona una deuda",""));
 for(const d of ordenarDeudas(deudas))selectorPagoDeuda.add(new Option(d.nombre+(d.liquidada?" · Liquidada":resumirDeuda(d).faltaCentavos===0?" · Lista para liquidar":""),d.id));
 if(deudas.some(d=>d.id===anterior))selectorPagoDeuda.value=anterior;
 actualizarDetallePagoDeuda();
}
selectorPagoDeuda.onchange=actualizarDetallePagoDeuda;
botonPagoDeuda.onclick=()=>{liquidarDeuda(selectorPagoDeuda.value);mostrarPagosDeuda();};
botonPrepararPagoDeuda.onclick=()=>{const d=deudas.find(d=>d.id===selectorPagoDeuda.value);if(d?.grupoId)distribuirFondoGrupo(d.grupoId);mostrarPagosDeuda();};
const mostrarDeudasConPagos=mostrarDeudas;
mostrarDeudas=function(){mostrarDeudasConPagos();mostrarPagosDeuda();mostrarDisponibleOrigen();};
mostrarPagosDeuda();

//Disponible recuperado sin registrar un gasto
const panelDevoluciones=document.createElement("section");panelDevoluciones.className="tarjeta";panelDevoluciones.id="devolver-apartados";
const tituloDevolucion=document.createElement("h2");tituloDevolucion.textContent="Devolver dinero al disponible";
const formDevolucion=document.createElement("form");
const etiquetaDevolucion=document.createElement("label");etiquetaDevolucion.textContent="Apartado";etiquetaDevolucion.htmlFor="apartado-devolver";
const selectorDevolucion=document.createElement("select");selectorDevolucion.id="apartado-devolver";selectorDevolucion.required=true;
const etiquetaMontoDevolucion=document.createElement("label");etiquetaMontoDevolucion.textContent="Monto que quieres devolver";etiquetaMontoDevolucion.htmlFor="monto-devolver";
const montoDevolucion=document.createElement("input");montoDevolucion.id="monto-devolver";montoDevolucion.type="number";montoDevolucion.min=".01";montoDevolucion.step=".01";montoDevolucion.inputMode="decimal";montoDevolucion.required=true;
const botonDevolucion=document.createElement("button");botonDevolucion.type="submit";botonDevolucion.textContent="Devolver al disponible";
const avisoDevolucion=document.createElement("p");avisoDevolucion.id="aviso-devolucion";avisoDevolucion.setAttribute("role","status");
formDevolucion.append(etiquetaDevolucion,selectorDevolucion,etiquetaMontoDevolucion,montoDevolucion,botonDevolucion);
const notaDevolucion=document.createElement("p");notaDevolucion.textContent="Vuelve al disponible del ingreso y categoría de origen. No se registra como gasto. Los pagos, meses cerrados y transferencias quedan protegidos.";notaDevolucion.className="ayuda";
panelDevoluciones.append(tituloDevolucion,notaDevolucion,formDevolucion,avisoDevolucion);
document.getElementById("pagina-deudas").append(panelDevoluciones);
function opcionesDevolucion(){
 return [
  ...apartadosCorregibles().map(f=>({clave:"deuda:"+f.id,tipo:"deuda",id:f.id,nombre:f.nombre,monto:f.montoCentavos})),
  ...gestion.apartados.flatMap(a=>a.aportes.filter(x=>!resumenApartado(a,x.mes).cerrado).map(x=>({clave:"basico:"+x.id,tipo:"basico",id:x.id,padre:a.id,nombre:a.nombre+" · "+x.mes,monto:Math.min(x.montoCentavos,resumenApartado(a,x.mes).excedente)}))).filter(x=>x.monto>0)
 ];
}
function mostrarDevoluciones(){
 const anterior=selectorDevolucion.value;
 selectorDevolucion.replaceChildren(new Option("Selecciona dinero aún apartado",""));
 for(const f of opcionesDevolucion())selectorDevolucion.add(new Option(f.nombre+" · "+formatoMoneda.format(f.monto/100),f.clave));
 if([...selectorDevolucion.options].some(o=>o.value===anterior))selectorDevolucion.value=anterior;
 botonDevolucion.disabled=selectorDevolucion.options.length===1;
}
formDevolucion.addEventListener("submit",async e=>{
 e.preventDefault();const clave=selectorDevolucion.value,texto=montoDevolucion.value;
 const fila=opcionesDevolucion().find(f=>f.clave===clave),importe=convertirPesosACentavos(texto);
 if(!fila||importe===null||importe>fila.monto){avisoDevolucion.textContent="Revisa el monto: no puede superar el apartado disponible.";return;}
 if(!await confirmarBorrado("¿Devolver "+formatoMoneda.format(importe/100)+" al disponible?"))return;
 try{
  const actual=opcionesDevolucion().find(f=>f.clave===clave);if(!actual||actual.monto<importe)throw Error("El apartado cambió. Revisa de nuevo.");
  if(actual.tipo==="deuda"){if(!devolverApartadoDisponible(actual.id,texto))throw Error("No se pudo devolver. Se conserva el apartado.");}
  else devolverBasicoDisponible(actual.padre,actual.id,texto);
  montoDevolucion.value="";mostrarDevoluciones();mostrarDisponibleOrigen();mostrarResumenFinanciero();
  avisoDevolucion.textContent="Devuelto al disponible: "+formatoMoneda.format(importe/100)+". Ya puedes asignarlo de nuevo desde su ingreso de origen.";
 }catch(error){avisoDevolucion.textContent=error.message;}
});
const mostrarGestionConDevoluciones=mostrarGestion;
mostrarGestion=function(){mostrarGestionConDevoluciones();mostrarDevoluciones();const acceso=document.createElement("button");acceso.type="button";acceso.textContent="Devolver dinero al disponible";acceso.onclick=()=>{irSeccionLateral("deudas");panelDevoluciones.scrollIntoView({block:"start"});selectorDevolucion.focus();};panelApartados.append(acceso);};
const mostrarDeudasConDevoluciones=mostrarDeudas;
mostrarDeudas=function(){mostrarDeudasConDevoluciones();mostrarDevoluciones();};
mostrarDevoluciones();

mostrarGestion();
