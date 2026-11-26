//Paneles de tarjetas y apartados
const monedaGestion=n=>formatoMoneda.format(n/100);
const nodoGestion=(tag,texto,clase)=>{const n=document.createElement(tag);if(texto!==undefined)n.textContent=texto;if(clase)n.className=clase;return n;};
function botonGestion(texto,accion,clase="") {
    const b=nodoGestion("button",texto,clase);b.type="button";
    b.addEventListener("click",async()=>{try{await accion();}catch(e){avisoGestion(e.message,true);}});
    return b;
}
function avisoGestion(texto,error=false) {const n=document.getElementById("aviso-gestion");n.textContent=texto;n.className=error?"aviso error":"aviso ok";}
function campoGestion(form,nombre,etiqueta,tipo="text",valor="") {
    const label=nodoGestion("label",etiqueta),input=document.createElement("input");
    input.name=nombre;input.type=tipo;input.value=valor;input.defaultValue=String(valor);input.required=true;
    if(tipo==="number"){input.min="0.01";input.step="0.01";input.inputMode="decimal";}
    label.append(input);form.append(label);return input;
}
function selectorGestion(form,nombre,etiqueta,opciones) {
    const label=nodoGestion("label",etiqueta),select=document.createElement("select");
    select.name=nombre;select.required=true;
    for(const [v,t]of opciones)select.add(new Option(t,v));
    label.append(select);form.append(label);return select;
}
function formularioGestion(id,titulo,construir,accion) {
    const d=nodoGestion("details",undefined,"accion-gestion"),summary=nodoGestion("summary",titulo),f=document.createElement("form");
    f.id=id;f.className="formulario-gestion";construir(f);
    const b=nodoGestion("button","Guardar","boton-principal");b.type="submit";f.append(b);
    f.addEventListener("submit",e=>{e.preventDefault();try{accion(Object.fromEntries(new FormData(f)));const actual=document.getElementById(id);if(actual){actual.reset();actual.dispatchEvent(new Event("change"));actual.closest("details").open=false;}avisoGestion("Guardado.");}catch(err){avisoGestion(err.message,true);}});
    d.append(summary,f);return d;
}
function resumenMoneda(titulo,monto,clave) {
    const card=nodoGestion("div",undefined,"saldo-gestion");card.append(nodoGestion("span",titulo));
    const strong=nodoGestion("strong");strong.dataset.importe=String(monto);strong.dataset.numero=clave;card.append(strong);
    animarImporte(strong,monto,clave);return card;
}
const ultimosImportes=new Map();
function animarImporte(n,total,clave) {
    const anterior=ultimosImportes.get(clave)??total;ultimosImportes.set(clave,total);
    n.setAttribute("aria-label",monedaGestion(total));
    if(matchMedia("(prefers-reduced-motion: reduce)").matches||anterior===total){n.textContent=monedaGestion(total);return;}
    const inicio=performance.now();
    const dibujar=ahora=>{if(!n.isConnected&&ahora-inicio>50)return;const p=Math.min(1,(ahora-inicio)/450);n.textContent=monedaGestion(Math.round(anterior+(total-anterior)*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(dibujar);};
    requestAnimationFrame(dibujar);
}
async function eliminarFilaGestion(tipo,id,padre,abuelo) {
    if(!await confirmarBorrado("¿Eliminar este registro y sus movimientos? Se recalcularán los saldos."))return;
    const fila=document.querySelector('[data-entidad="'+CSS.escape(id)+'"]');
    if(fila&&!matchMedia("(prefers-reduced-motion: reduce)").matches)await fila.animate([{opacity:1,transform:"scale(1)"},{opacity:0,transform:"scale(.96)"}],{duration:180}).finished;
    borrarGestion(tipo,id,padre,abuelo);avisoGestion("Eliminado.");
}
function opcionesIngresosGestion(categoria) {
    return [["","Selecciona ingreso"],...nominas.filter(n=>n.reparto.some(c=>!categoria||c.id===categoria)).map(n=>[n.id,n.referencia])];
}
const panelTarjetas=nodoGestion("section",undefined,"panel-gestion");panelTarjetas.id="tarjetas-credito";
const panelApartados=nodoGestion("section",undefined,"panel-gestion");panelApartados.id="apartados-basicos";
const panelAhorros=nodoGestion("section",undefined,"panel-gestion");panelAhorros.id="ahorros-apartados";
document.getElementById("vista-deudas").prepend(panelTarjetas);
document.getElementById("vista-reparto").append(panelApartados);
document.getElementById("vista-ahorro").prepend(panelAhorros);
const avisoNuevo=nodoGestion("p",undefined,"aviso");avisoNuevo.id="aviso-gestion";avisoNuevo.setAttribute("role","status");document.querySelector("main").prepend(avisoNuevo);
let mesGestion=fechaLocalGasto().slice(0,7);
function mostrarGestion() {
    if(!document.getElementById("tarjetas-credito"))return;
    //Conservar formularios abiertos durante los refrescos
    const borradores=new Map([...document.querySelectorAll(".panel-gestion form")].map(f=>[f.id,{abierto:f.closest("details").open,datos:[...f.elements].filter(x=>x.name).map(x=>[x.name,x.value])}]));
    panelTarjetas.replaceChildren(nodoGestion("h2","▣ Tarjetas de crédito"));
    const mesLabel=nodoGestion("label","Mes");const mesInput=document.createElement("input");mesInput.type="month";mesInput.value=mesGestion;mesInput.id="mes-gestion";
    mesInput.onchange=()=>{if(mesValido(mesInput.value)){mesGestion=mesInput.value;mostrarGestion();}};mesLabel.append(mesInput);panelTarjetas.append(mesLabel);
    if(nominas.some(n=>n.reparto.some(c=>c.id==="pendiente")))avisoGestion("Hay importes por reasignar en ingresos anteriores.",true);
    const total=sumaGestion(gestion.tarjetas.flatMap(t=>t.compras.map(c=>resumenCompra(c,mesGestion).pendienteMes)));
    panelTarjetas.append(resumenMoneda("Pendiente al mes seleccionado",total,"mensual-tarjetas"));
    panelTarjetas.append(formularioGestion("nueva-tarjeta","＋ Agregar tarjeta",f=>camposCredito(f),v=>crearTarjeta(v.nombre,v.limite,v.corte,v.pago)));
    for(const t of gestion.tarjetas) {
        const card=nodoGestion("article",undefined,"tarjeta-gestion");card.dataset.entidad=t.id;card.append(nodoGestion("h3",t.nombre));
        const credito=resumenCredito(t),fechas=fechasTarjeta(t,mesGestion);
        const creditoUI=nodoGestion("div",undefined,"saldos-gestion");
        creditoUI.append(resumenMoneda("Crédito usado",credito.utilizado,t.id+"usado"));
        if(credito.limite!==null)creditoUI.append(resumenMoneda("Límite",credito.limite,t.id+"limite"),resumenMoneda("Disponible",credito.disponible,t.id+"disponible"));
        else creditoUI.append(nodoGestion("p","Límite sin configurar","etiqueta"));
        card.append(creditoUI,nodoGestion("p","Corte: "+(fechas.corte||"Sin configurar")+" · Pago: "+(fechas.pago||"Sin configurar"),"fechas-credito"));
        if(credito.excedido)card.append(nodoGestion("p","Límite excedido: "+monedaGestion(credito.excedido),"aviso error"));
        if(credito.limite>0){const barra=document.createElement("progress");barra.max=credito.limite;barra.value=Math.min(credito.utilizado,credito.limite);barra.setAttribute("aria-label","Crédito utilizado");card.append(barra);card.append(graficaPastel("Uso de crédito",[["Usado",credito.utilizado],["Disponible",credito.disponible]]));}
        card.append(formularioGestion("editar-tarjeta-"+t.id,"Editar límite y fechas",f=>camposCredito(f,t),v=>editarTarjeta(t.id,v.nombre,v.limite,v.corte,v.pago)));
        card.append(botonGestion("Eliminar tarjeta",()=>eliminarFilaGestion("tarjeta",t.id), "boton-peligro"));
        card.append(formularioGestion("compra-"+t.id,"＋ Compra o saldo",f=>{
            campoGestion(f,"nombre","Concepto");campoGestion(f,"total","Monto total","number");
            const m=campoGestion(f,"meses","Meses (1 = pago único)","number","1");m.min="1";m.max="120";m.step="1";
            campoGestion(f,"inicio","Primer mes de pago","month",mesGestion);
            const vista=nodoGestion("output","");f.append(vista);
            f.addEventListener("input",()=>{const total=convertirPesosACentavos(f.elements.total.value),meses=Number(f.elements.meses.value);
                vista.textContent=total&&Number.isInteger(meses)&&meses>0&&meses<=120?monedaGestion(Math.floor(total/meses))+" / mes":"";});
        },v=>crearCompra(t.id,v.nombre,v.total,v.meses,v.inicio)));
        for(const c of t.compras) {
            const r=resumenCompra(c,mesGestion),detail=nodoGestion("details",undefined,"compra-gestion");
            detail.append(nodoGestion("summary",c.nombre+" · "+monedaGestion(r.saldo)));
            const grid=nodoGestion("div",undefined,"saldos-gestion");grid.append(resumenMoneda("Total",c.totalCentavos,c.id+"total"),resumenMoneda("Mensual",r.mensual,c.id+"mensual"),resumenMoneda("Pendiente del mes",r.pendienteMes,c.id+"pendiente"));detail.append(grid);
            detail.append(nodoGestion("p",r.faltan+" de "+c.meses+" pagos pendientes · Última cuota "+monedaGestion(cuotaCompra(c,c.meses-1))));
            const progress=document.createElement("progress");progress.max=c.totalCentavos;progress.value=r.pagado;progress.setAttribute("aria-label","Compra pagada");detail.append(progress);
            if(r.saldo>0)detail.append(formularioGestion("pago-"+c.id,"＋ Registrar pago",f=>{
                const ingreso=selectorGestion(f,"nomina","Ingreso",opcionesIngresosGestion());
                const cat=selectorGestion(f,"categoria","Presupuesto",[]);
                const actualizar=()=>{cat.replaceChildren();for(const x of nominas.find(n=>n.id===ingreso.value)?.reparto??[])if(esCategoriaDeGasto(x.id))cat.add(new Option(x.nombre,x.id));};
                ingreso.onchange=actualizar;actualizar();
                campoGestion(f,"monto","Importe","number",String(Math.min(r.saldo,r.pendienteMes||r.mensual)/100));
                campoGestion(f,"fecha","Fecha","date",fechaLocalGasto());
            },v=>pagarCompra(t.id,c.id,v.monto,v.nomina,v.categoria,v.fecha)));
            for(const p of c.pagos){const row=nodoGestion("div",undefined,"movimiento-gestion");row.append(nodoGestion("span",p.fecha+" · "+monedaGestion(p.montoCentavos)),botonGestion("Eliminar pago",()=>eliminarFilaGestion("pago",p.id,c.id,t.id)));detail.append(row);}
            detail.append(botonGestion("Eliminar compra",()=>eliminarFilaGestion("compra",c.id,t.id)));card.append(detail);
        }
        panelTarjetas.append(card);
    }
    panelApartados.replaceChildren(nodoGestion("h2","◈ Apartados de gastos básicos"));
    if(nominas.some(n=>n.reparto.some(c=>c.id==="pendiente")))panelApartados.append(formularioGestion("reasignar-pendiente","Reasignar saldo anterior",f=>{
        const n=selectorGestion(f,"nomina","Ingreso",[["","Selecciona ingreso"],...nominas.filter(n=>n.reparto.some(c=>c.id==="pendiente")).map(n=>[n.id,n.referencia])]);
        const c=selectorGestion(f,"destino","Destino",[]);
        n.onchange=()=>{c.replaceChildren();for(const x of nominas.find(x=>x.id===n.value)?.reparto??[])if(x.id!=="pendiente")c.add(new Option(x.nombre,x.id));};
    },v=>reasignarPendiente(v.nomina,v.destino)));
    panelApartados.append(nodoGestion("p","Mes: "+mesGestion,"etiqueta"));
    panelApartados.append(formularioGestion("nuevo-apartado","＋ Crear apartado",f=>{
        campoGestion(f,"nombre","Nombre");selectorGestion(f,"medio","Medio",[["tarjeta","Tarjeta"],["efectivo","Solo efectivo"]]);
        campoGestion(f,"monto","Monto por periodo","number");const tasa=campoGestion(f,"tasa","Tasa anual (%)","number","0");tasa.min="0";tasa.max="1000";
    },v=>crearApartado(v.nombre,v.medio,v.monto,v.tasa)));
    for(const a of gestion.apartados) {
        const card=nodoGestion("article",undefined,"tarjeta-gestion");card.dataset.entidad=a.id;card.append(nodoGestion("h3",a.nombre),nodoGestion("p",a.medio==="efectivo"?"Efectivo":"Tarjeta","etiqueta"));
        const r=resumenApartado(a,mesGestion),grid=nodoGestion("div",undefined,"saldos-gestion");
        grid.append(resumenMoneda("Apartado",r.apartado,a.id+"apartado"),resumenMoneda("Gasto real",r.gastado,a.id+"gastado"),resumenMoneda("Excedente",r.excedente,a.id+"excedente"));card.append(grid);
        const mesLabel=nodoGestion("label","Mes del apartado"),mes=document.createElement("input");mes.type="month";mes.value=mesGestion;mes.onchange=()=>{if(mesValido(mes.value)){mesGestion=mes.value;mostrarGestion();}};mesLabel.append(mes);card.append(mesLabel);
        if(!r.cerrado) {
            card.append(formularioGestion("aporte-"+a.id,"＋ Apartar del ingreso",f=>{
                selectorGestion(f,"nomina","Ingreso",opcionesIngresosGestion("basicos"));campoGestion(f,"monto","Importe","number",String(a.porPeriodo/100));campoGestion(f,"mes","Mes de destino","month",mesGestion);
            },v=>aportarBasico(a.id,v.nomina,v.monto,v.mes)));
            card.append(formularioGestion("gasto-apartado-"+a.id,"＋ Registrar gasto",f=>{
                campoGestion(f,"concepto","Concepto");campoGestion(f,"monto","Importe","number");campoGestion(f,"fecha","Fecha","date",fechaLocalGasto());
            },v=>gastarApartado(a.id,v.concepto,v.monto,v.fecha)));
            card.append(botonGestion("Cerrar mes",()=>{if(confirm("¿Cerrar "+mesGestion+" y transferir el excedente?")){cerrarMesApartado(a.id,mesGestion);avisoGestion("Excedente enviado a "+(a.medio==="efectivo"?"Ahorro en efectivo":"Fondo de emergencia")+".");}}));
        }else card.append(nodoGestion("p","✓ Mes cerrado · "+(a.medio==="efectivo"?"Ahorro en efectivo":"Fondo de emergencia"),"aviso ok"));
        const tasaLabel=nodoGestion("label","Tasa anual (%)"),tasa=document.createElement("input");tasa.type="number";tasa.min="0";tasa.max="1000";tasa.step="0.01";tasa.value=a.tasa;tasa.setAttribute("aria-label","Tasa anual de "+a.nombre);
        const proyeccion=nodoGestion("output");
        const actualizar=()=>{try{proyeccion.textContent="Proyección a 12 meses: "+monedaGestion(proyectarApartado(r.excedente,Number(tasa.value)));}
            catch{proyeccion.textContent="Tasa fuera de rango.";}};
        tasa.oninput=actualizar;tasa.onchange=()=>{try{exigirGestion(tasa.value!=="");cambiarTasaApartado(a.id,tasa.value);}catch(e){avisoGestion(e.message,true);}};
        actualizar();tasaLabel.append(tasa);card.append(tasaLabel,proyeccion);
        const historial=nodoGestion("details");historial.append(nodoGestion("summary","Movimientos"));
        for(const [tipo,lista]of [["aporte",a.aportes],["gasto",a.gastos]])for(const x of lista){const row=nodoGestion("div",undefined,"movimiento-gestion");row.append(nodoGestion("span",(tipo==="aporte"?"Apartado · ":"Gasto · ")+(x.mes??x.fecha)+" · "+monedaGestion(x.montoCentavos)));
            if(!a.cierres.some(c=>c.mes===(x.mes??x.fecha.slice(0,7))))row.append(botonGestion("Eliminar",()=>eliminarFilaGestion(tipo,x.id,a.id)));historial.append(row);}
        card.append(historial,botonGestion("Eliminar apartado",()=>eliminarFilaGestion("apartado",a.id)));panelApartados.append(card);
    }
    const s=saldosApartados();panelAhorros.replaceChildren(nodoGestion("h2","Fondo de emergencia"));
    const grid=nodoGestion("div",undefined,"saldos-gestion");grid.append(resumenMoneda("Apartado de emergencia general",sumaGestion([s.emergencia,s.efectivo]),"fondo-emergencia"),resumenMoneda("Del total: en efectivo",s.efectivo,"ahorro-efectivo"));panelAhorros.append(grid,controlesEmergencia("general"));
    for(const a of gestion.apartados) {
        const fondo=nodoGestion("article",undefined,"fondo-emergencia");fondo.id="fondo-"+a.id;fondo.tabIndex=-1;
        fondo.append(resumenMoneda("Fondo de emergencia "+a.nombre,saldoEmergencia(a),a.id+"fondo"));
        fondo.append(nodoGestion("p",a.medio==="efectivo"?"Guardado en efectivo":"Guardado en tarjeta / cuenta","etiqueta"),controlesEmergencia(a.id));
        const historial=nodoGestion("details");historial.append(nodoGestion("summary","Historial del fondo"));
        for(const c of a.cierres)historial.append(nodoGestion("p",c.fecha+" · Sobrante de "+c.mes+" · +"+monedaGestion(c.excedente)));
        for(const m of a.emergencia??[])historial.append(nodoGestion("p",m.fecha+" · "+m.concepto+" · "+(m.tipo==="retiro"?"−":"+")+monedaGestion(m.montoCentavos)));
        fondo.append(historial);panelAhorros.append(fondo);
    }
    panelAhorros.append(botonGestion("＋ Añadir fondo",()=>irSeccionLateral("nuevo-fondo")));
    if(typeof actualizarFondosLateral==="function")actualizarFondosLateral();
    for(const [id,b]of borradores){const f=document.getElementById(id);if(!f)continue;f.closest("details").open=b.abierto;for(const [n,v]of b.datos){const el=f.elements.namedItem(n);if(el){el.value=v;if(n==="nomina")el.dispatchEvent(new Event("change"));}}f.dispatchEvent(new Event("change"));}
}
const mostrarNominasAnterior=mostrarHistorialNominas;
mostrarHistorialNominas=function(){mostrarNominasAnterior();mostrarGestion();};
mostrarGestion();

function camposCredito(f,t={}) {
    campoGestion(f,"nombre","Nombre","text",t.nombre??"");
    const limite=campoGestion(f,"limite","Límite de crédito","number",t.limiteCentavos==null?"":String(t.limiteCentavos/100));limite.min="0";limite.required=false;limite.placeholder="Sin configurar";
    for(const [id,label,valor] of [["corte","Día de corte",t.diaCorte],["pago","Día de pago",t.diaPago]]) {
        const dia=campoGestion(f,id,label,"number",valor??"");dia.min="1";dia.max="31";dia.step="1";dia.required=false;dia.placeholder="1–31";
    }
}
