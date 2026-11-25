//Vistas del espacio financiero
const paginasFinanzas=new Map();
let paginaActualFinanzas="";
const principalFinanzas=document.querySelector("main");
const repartoFinanzas=document.getElementById("vista-reparto");
const ahorroFinanzas=document.getElementById("vista-ahorro");
const deudasFinanzas=document.getElementById("vista-deudas");
function crearPaginaFinanzas(id,padre,elementos){
 const pagina=document.createElement("section");pagina.id="pagina-"+id;pagina.dataset.pagina=id;pagina.className="pagina-finanzas";pagina.hidden=true;
 elementos.filter(Boolean).forEach(e=>pagina.append(e));padre.append(pagina);paginasFinanzas.set(id,pagina);
}
crearPaginaFinanzas("destinos",repartoFinanzas,[document.getElementById("apartados-basicos")]);
crearPaginaFinanzas("actividad",repartoFinanzas,[document.querySelector(".centro-actividad")]);
crearPaginaFinanzas("simulador",repartoFinanzas,[document.querySelector(".simulador-anterior")]);
crearPaginaFinanzas("ingresos",repartoFinanzas,[...repartoFinanzas.children].filter(e=>!e.dataset.pagina));
crearPaginaFinanzas("emergencia",ahorroFinanzas,[document.getElementById("ahorros-apartados")]);
crearPaginaFinanzas("ahorro",ahorroFinanzas,[...ahorroFinanzas.children].filter(e=>!e.dataset.pagina));
crearPaginaFinanzas("tarjetas",deudasFinanzas,[document.getElementById("tarjetas-credito")]);
const acreedoresFinanzas=[...deudasFinanzas.querySelectorAll(":scope > .deudas-registro,:scope > .administrador-grupos,:scope > #editor-deuda")];
const tituloAcreedores=[...deudasFinanzas.children].find(e=>e.tagName==="H3"&&e.textContent.includes("Seguimiento"));
if(tituloAcreedores){let n=tituloAcreedores;while(n){const siguiente=n.nextElementSibling;acreedoresFinanzas.push(n);if(n.id==="lista-deudas")break;n=siguiente;}}
crearPaginaFinanzas("acreedores",deudasFinanzas,acreedoresFinanzas);
crearPaginaFinanzas("deudas",deudasFinanzas,[...deudasFinanzas.children].filter(e=>!e.dataset.pagina));
const gastosFinanzas=document.getElementById("vista-gastos");gastosFinanzas.dataset.pagina="gastos";gastosFinanzas.classList.add("pagina-finanzas");paginasFinanzas.set("gastos",gastosFinanzas);
crearPaginaFinanzas("correcciones",principalFinanzas,[document.querySelector(".panel-correcciones")]);
crearPaginaFinanzas("datos",principalFinanzas,[document.getElementById("panel-dispositivo"),document.getElementById("exportar-copia").closest("section"),document.getElementById("restablecer"),document.getElementById("gestionar-datos"),document.getElementById("aviso-datos-borrados"),document.getElementById("panel-borrado")]);
document.querySelector(".nota")?.remove();document.querySelector(".subtitulo-app")?.remove();
const tituloEspacio=document.querySelector(".titulo-app");tituloEspacio.id="titulo-espacio";tituloEspacio.tabIndex=-1;
const rutaEspacio=document.createElement("p");rutaEspacio.className="ruta-espacio";tituloEspacio.before(rutaEspacio);
const titulosFinanzas={
 ingresos:["TU PANORAMA","Ingresos y reparto"],gastos:["TU DÍA A DÍA","Mis gastos"],destinos:["CADA PESO TIENE UN DESTINO","Mis apartados"],
 actividad:["TUS MOVIMIENTOS","Actividad"],simulador:["PLANIFICA CON CALMA","Simulador"],
 ahorro:["TUS OBJETIVOS","Ahorro personal"],emergencia:["TRANQUILIDAD PARA EL FUTURO","Fondo de emergencia"],
 acreedores:["TUS COMPROMISOS","Acreedores"],deudas:["UN PASO A LA VEZ","Deudas generales"],tarjetas:["TU CRÉDITO BAJO CONTROL","Tarjetas de crédito"],
 datos:["EN ESTE DISPOSITIVO","Datos y copias"],correcciones:["REVISA Y AJUSTA","Correcciones"]
};
function paginaDeRuta(ruta){return ruta.startsWith("fondo:")?"emergencia":ruta==="nuevo-fondo"?"destinos":ruta;}
function actualizarVistaDinamica(){
 const ruta=paginaActualFinanzas;
 for(const e of document.getElementById("ahorros-apartados").children)e.hidden=ruta.startsWith("fondo:")?e.id!=="fondo-"+ruta.slice(6):false;
 for(const e of document.getElementById("apartados-basicos").children)e.hidden=ruta==="nuevo-fondo"?e.tagName!=="H2"&&!e.contains(document.getElementById("nuevo-apartado")):false;
}
function activarPaginaFinanzas(ruta,enfocar=true){
 const clave=paginaDeRuta(ruta),pagina=paginasFinanzas.get(clave);if(!pagina)return false;
 const cambia=paginaActualFinanzas!==ruta;paginaActualFinanzas=ruta;
 for(const p of paginasFinanzas.values())p.hidden=p!==pagina;
 for(const p of [repartoFinanzas,ahorroFinanzas,deudasFinanzas])p.hidden=!p.contains(pagina);
 for(const [id,nombre]of [["boton-reparto","ingresos"],["boton-ahorro","ahorro"],["boton-deudas","deudas"]])document.getElementById(id).setAttribute("aria-pressed",String(clave===nombre));
 if(clave==="gastos")mostrarGastos();
 actualizarVistaDinamica();
 rutaEspacio.textContent=titulosFinanzas[clave][0];tituloEspacio.textContent=titulosFinanzas[clave][1];
 if(ruta.startsWith("fondo:"))tituloEspacio.textContent="Fondo de emergencia "+(gestion.apartados.find(a=>a.id===ruta.slice(6))?.nombre??"");
 if(ruta==="nuevo-fondo"){const f=document.getElementById("nuevo-apartado");f.closest("details").open=true;f.elements.medio.value="tarjeta";f.elements.medio.dispatchEvent(new Event("change",{bubbles:true}));}
 pagina.getAnimations().forEach(a=>a.cancel());
 if(cambia&&!matchMedia("(prefers-reduced-motion: reduce)").matches){pagina.getAnimations().forEach(a=>a.cancel());pagina.animate([{opacity:0,transform:"translateY(18px) scale(.985)"},{opacity:1,transform:"none"}],{duration:380,easing:"cubic-bezier(.2,.8,.2,1)"});}
 if(enfocar){tituloEspacio.focus({preventScroll:true});window.scrollTo({top:0,behavior:"instant"});}
 return true;
}
