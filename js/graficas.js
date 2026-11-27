// Visualizaciones derivadas de registros: no modifican los saldos.
function nodoGrafica(tag,texto,clase) {
    const n=document.createElement(tag);if(texto!==undefined)n.textContent=texto;if(clase)n.className=clase;return n;
}
function graficaPastel(titulo,datos) {
    const figura=nodoGrafica("figure",undefined,"grafica-pastel");
    figura.append(nodoGrafica("figcaption",titulo));
    const valores=datos.filter(([,n])=>n>0),total=sumarCentavosResumen(valores.map(([,n])=>n));
    if(!total){figura.append(nodoGrafica("p","Sin movimientos para este periodo.","estado-vacio"));return figura;}
    const colores=["#ad8bf5","#61d4c0","#f2b278","#73b6ff","#ea91c4","#c3d879","#948ee5","#86b8cf"];
    const cuerpo=nodoGrafica("div",undefined,"grafica-cuerpo"),disco=nodoGrafica("div",undefined,"grafica-disco"),lista=nodoGrafica("ul");
    let acumulado=0;const segmentos=[];
    valores.forEach(([nombre,n],i)=>{
        const inicio=acumulado;acumulado+=n/total*100;
        const color=colores[i%colores.length];segmentos.push(color+" "+inicio+"% "+acumulado+"%");
        const fila=nodoGrafica("li"),marca=nodoGrafica("span",undefined,"marca-grafica");marca.style.background=color;marca.setAttribute("aria-hidden","true");
        fila.append(marca,nodoGrafica("span",nombre),nodoGrafica("strong",formatoMoneda.format(n/100)+" · "+(n/total*100).toFixed(1)+"%"));lista.append(fila);
    });
    disco.style.background="conic-gradient("+segmentos.join(",")+")";disco.setAttribute("aria-hidden","true");
    cuerpo.append(disco,lista);figura.append(cuerpo,nodoGrafica("p","Total: "+formatoMoneda.format(total/100),"grafica-total"));return figura;
}
function datosGraficasGastos(mes="") {
    const grupos={basicos:new Map(),ocio:new Map(),deudas:new Map(),ahorro:new Map(),otros:new Map()};
    const agregar=(cat,nombre,importe)=>{const mapa=grupos[cat];if(mapa)mapa.set(nombre,sumarCentavosResumen([mapa.get(nombre)??0,importe]));};
    for(const m of movimientosUnificados()){
        if(m.estado!=="activo"||(mes&&m.fecha?.slice(0,7)!==mes))continue;
        if(m.tipo==="ahorro")agregar("ahorro",m.detalle||m.nombre,m.monto);
        else if(m.tipo==="pago"||m.id.startsWith("tarjeta:"))agregar("deudas",m.acreedor||m.nombre,m.monto);
        else if(m.tipo==="gasto")agregar(grupos[m.categoriaId]?m.categoriaId:"otros",m.detalle||m.nombre,m.monto);
    }
    return grupos;
}
function mostrarGraficasGastos() {
    const padre=document.getElementById("vista-gastos");if(!padre)return;
    let panel=document.getElementById("graficas-gastos");
    if(!panel){
        panel=nodoGrafica("section",undefined,"panel-graficas");panel.id="graficas-gastos";
        panel.append(nodoGrafica("h2","¿A dónde va mi dinero?"),nodoGrafica("p","Gastos pagados y aportaciones al ahorro. Las reservas para deudas y las compras a crédito aún sin pagar no se cuentan como pagos. Los retiros de ahorro no son gastos; las aportaciones se muestran sin restarlos.","ayuda"));
        const label=nodoGrafica("label","Periodo de las gráficas"),select=document.createElement("select");select.id="periodo-graficas";select.add(new Option("Todo el historial",""));
        label.append(select);panel.append(label,nodoGrafica("div",undefined,"rejilla-graficas"));padre.append(panel);select.onchange=mostrarGraficasGastos;
    }
    const select=panel.querySelector("select"),actual=select.value;
    const meses=[...new Set(movimientosUnificados().filter(m=>m.estado==="activo"&&m.fecha).map(m=>m.fecha.slice(0,7)))].sort().reverse();
    select.replaceChildren(new Option("Todo el historial",""),...meses.map(m=>new Option(m,m)));select.value=meses.includes(actual)?actual:"";
    const datos=datosGraficasGastos(select.value),nombres={basicos:"Gastos básicos",ocio:"Ocio",deudas:"Tarjetas / Deudas",ahorro:"Ahorro",otros:"Otras categorías"};
    const grid=panel.querySelector(".rejilla-graficas");grid.replaceChildren(graficaPastel("Distribución general",Object.entries(datos).map(([k,v])=>[nombres[k],sumarCentavosResumen([...v.values()])])));
    for(const [k,v]of Object.entries(datos))if(k!=="otros"||v.size)grid.append(graficaPastel(nombres[k],[...v]));
}
function graficaMeta(meta,saldo) {
    const bloque=nodoGrafica("div",undefined,"grafica-meta");
    const porcentaje=saldo/meta.objetivoCentavos*100;
    bloque.append(nodoGrafica("strong",porcentaje.toFixed(1)+"% de tu objetivo"));
    const movimientos=movimientosAhorros.filter(m=>!m.anulacion&&mejoras.destinosAhorro.some(d=>d.movimientoId===m.id&&d.metaId===meta.id));
    let acumulado=0;const valores=[0];
    for(const m of movimientos){acumulado+=m.tipo==="retiro"?-m.montoCentavos:m.montoCentavos;valores.push(acumulado);}
    const max=Math.max(meta.objetivoCentavos,...valores),ns="http://www.w3.org/2000/svg";
    const svg=document.createElementNS(ns,"svg");svg.setAttribute("viewBox","0 0 320 100");svg.setAttribute("role","img");svg.setAttribute("aria-label","Avance por movimiento de "+meta.nombre+": "+porcentaje.toFixed(1)+"%. Saldo "+formatoMoneda.format(saldo/100)+". Objetivo "+formatoMoneda.format(meta.objetivoCentavos/100));
    const objetivo=document.createElementNS(ns,"line"),y=90-meta.objetivoCentavos/max*75;
    for(const [k,v]of Object.entries({x1:8,x2:312,y1:y,y2:y,stroke:"#9892ac","stroke-dasharray":"5 5"}))objetivo.setAttribute(k,v);
    const linea=document.createElementNS(ns,"polyline");linea.setAttribute("points",valores.map((v,i)=>(8+i/Math.max(1,valores.length-1)*304)+","+(90-v/max*75)).join(" "));linea.setAttribute("fill","none");linea.setAttribute("stroke","#7656cb");linea.setAttribute("stroke-width","3");
    svg.append(objetivo,linea);bloque.append(svg,nodoGrafica("p","Evolución por movimiento registrado · línea punteada: objetivo","ayuda"));return bloque;
}
