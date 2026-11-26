//Navegación vertical
const panelNavegacion=document.getElementById("panel-navegacion");
const abrirNavegacion=document.getElementById("abrir-navegacion");
const cerrarNavegacion=document.getElementById("cerrar-navegacion");
const fondoNavegacion=document.getElementById("fondo-navegacion");
const pantallaMenu=matchMedia("(max-width: 900px)");
let menuAbierto=false, inerteAnterior=false, focoAnterior=null;
function cambiarMenuLateral(abierto,devolverFoco=true) {
    if(abierto===menuAbierto)return;
    const main=document.querySelector("main");
    if(abierto){focoAnterior=document.activeElement;inerteAnterior=main.inert;main.inert=true;}
    else main.inert=inerteAnterior||reinicioDetectado;
    menuAbierto=abierto;
    panelNavegacion.classList.toggle("abierto",abierto);
    fondoNavegacion.hidden=!abierto;
    abrirNavegacion.setAttribute("aria-expanded",String(abierto));
    document.body.classList.toggle("menu-lateral-abierto",abierto);
    if(abierto)cerrarNavegacion.focus();
    else if(devolverFoco&&focoAnterior?.isConnected)focoAnterior.focus();
}
abrirNavegacion.onclick=()=>cambiarMenuLateral(!menuAbierto);
cerrarNavegacion.onclick=()=>cambiarMenuLateral(false);
fondoNavegacion.onclick=()=>cambiarMenuLateral(false);
pantallaMenu.addEventListener("change",()=>{if(!pantallaMenu.matches)cambiarMenuLateral(false,false);});
panelNavegacion.addEventListener("keydown",e=>{
    if(e.key==="Escape"){if(menuAbierto){e.preventDefault();cambiarMenuLateral(false);}return;}
    if(e.key!=="Tab"||!menuAbierto)return;
    const controles=[...panelNavegacion.querySelectorAll("button,summary,a[href]")].filter(el=>el.getClientRects().length&&!el.disabled);
    const primero=controles[0],ultimo=controles.at(-1);
    if(e.shiftKey&&document.activeElement===primero){e.preventDefault();ultimo.focus();}
    else if(!e.shiftKey&&document.activeElement===ultimo){e.preventDefault();primero.focus();}
});
function rutaLateral(ruta) {
    if(ruta.startsWith("fondo:")) {
        const id=ruta.slice(6),a=gestion.apartados.find(a=>a.id===id);
        return a?{vista:"ahorro",grupo:"ahorro",target:"fondo-"+id}:null;
    }
    return ({
 cuentas:{grupo:"ingresos",vista:"reparto"},datos:{grupo:"",vista:"datos"},correcciones:{grupo:"",vista:"correcciones"},actividad:{grupo:"ingresos",vista:"reparto"},simulador:{grupo:"ingresos",vista:"reparto"},
        ingresos:{vista:"reparto",grupo:"ingresos",target:"titulo-nomina"},
        gastos:{vista:"gastos",grupo:"ingresos",target:"titulo-gastos"},
        destinos:{vista:"reparto",grupo:"ingresos",target:"apartados-basicos"},
        ahorro:{vista:"ahorro",grupo:"ahorro",target:"titulo-ahorro"},
        emergencia:{vista:"ahorro",grupo:"ahorro",target:"ahorros-apartados"},
        "nuevo-fondo":{vista:"reparto",grupo:"ahorro",target:"nuevo-apartado"},
        deudas:{vista:"deudas",grupo:"deudas",target:"titulo-deudas"},
        acreedores:{vista:"deudas",grupo:"deudas",target:"formulario-deuda"},
        tarjetas:{vista:"deudas",grupo:"deudas",target:"tarjetas-credito"}
    })[ruta]??null;
}
function sincronizarNavLateral(ruta) {
    if(ruta===undefined){try{ruta=decodeURIComponent(location.hash.slice(1));}catch{return;}}
    const config=rutaLateral(ruta);if(!config)return;
    for(const b of panelNavegacion.querySelectorAll("[data-ruta]")){
        if(b.dataset.ruta===ruta)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");
    }
    const rama=panelNavegacion.querySelector('[data-grupo="'+config.grupo+'"]');if(rama)rama.open=true;
    if(ruta==="emergencia"||ruta.startsWith("fondo:"))document.getElementById("rama-fondos").open=true;
}
function irSeccionLateral(ruta,registrar=true,enfocar=true){
 if(!rutaLateral(ruta))ruta="ingresos";
 if(menuAbierto)cambiarMenuLateral(false,false);
 if(!activarPaginaFinanzas(ruta,enfocar))return;
 let actual;try{actual=decodeURIComponent(location.hash.slice(1));}catch{actual="";}
 if(registrar&&actual!==ruta)history.pushState(null,"","#"+encodeURIComponent(ruta));
 sincronizarNavLateral(ruta);
}
panelNavegacion.addEventListener("click",e=>{
    const b=e.target.closest("[data-ruta]");if(b)irSeccionLateral(b.dataset.ruta);
});
function actualizarFondosLateral() {
    const contenedor=document.getElementById("enlaces-fondos");if(!contenedor)return;
    const fondos=gestion.apartados;
    const firma=JSON.stringify(fondos.map(a=>[a.id,a.nombre]));
    actualizarVistaDinamica();
    if(contenedor.dataset.firma===firma)return;
    contenedor.dataset.firma=firma;contenedor.replaceChildren();
    for(const a of fondos){const b=document.createElement("button");b.type="button";b.dataset.ruta="fondo:"+a.id;b.textContent="Fondo de emergencia "+a.nombre;contenedor.append(b);}
    sincronizarNavLateral();
}
function restaurarLateral(){let ruta;try{ruta=decodeURIComponent(location.hash.slice(1));}catch{return;}irSeccionLateral(ruta,false);}
window.addEventListener("popstate",restaurarLateral);
window.addEventListener("hashchange",restaurarLateral);
actualizarFondosLateral();
let rutaInicial;try{rutaInicial=decodeURIComponent(location.hash.slice(1));}catch{rutaInicial="ingresos";}
irSeccionLateral(rutaInicial||"ingresos",false,false);
