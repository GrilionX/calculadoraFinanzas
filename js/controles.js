//Selectores y movimiento
const controlesSelect=new WeakMap();
let selectorAbierto=null,contadorSelect=0;
function cerrarSelector(){
 if(!selectorAbierto)return;
 selectorAbierto.boton.setAttribute("aria-expanded","false");selectorAbierto.boton.removeAttribute("aria-activedescendant");
 selectorAbierto.lista.remove();selectorAbierto=null;
}
function sincronizarSelector(select){
 const c=controlesSelect.get(select);if(!c)return;
 const texto=select.selectedOptions[0]?.textContent||"Selecciona una opción";
 if(c.boton.textContent!==texto)c.boton.textContent=texto;
 if(c.boton.disabled!==select.disabled)c.boton.disabled=select.disabled;
 c.boton.setAttribute("aria-required",String(select.required));
 const label=select.labels?.[0]?.cloneNode(true);label?.querySelectorAll("select,.control-select").forEach(e=>e.remove());
 const etiqueta=label?.textContent.trim()||select.getAttribute("aria-label")||select.name||"Opciones";
 const nombre=etiqueta+" · "+texto;
 if(c.boton.getAttribute("aria-label")!==nombre)c.boton.setAttribute("aria-label",nombre);
}
function abrirSelector(select){
 cerrarSelector();sincronizarSelector(select);
 const c=controlesSelect.get(select);if(select.disabled)return;
 const lista=document.createElement("div");lista.className="lista-select";lista.id=c.boton.id+"-opciones";lista.setAttribute("role","listbox");lista.setAttribute("aria-label",c.boton.getAttribute("aria-label"));
 c.lista=lista;c.select=select;c.firma=JSON.stringify([...select.options].map(o=>[o.value,o.textContent,o.disabled]));c.indice=Math.max(0,select.selectedIndex);
 const elegir=i=>{const o=select.options[i];if(!o||o.disabled)return;select.selectedIndex=i;cerrarSelector();select.dispatchEvent(new Event("input",{bubbles:true}));select.dispatchEvent(new Event("change",{bubbles:true}));sincronizarSelector(select);if(c.boton.isConnected)c.boton.focus({preventScroll:true});};
 [...select.options].forEach((o,i)=>{const el=document.createElement("div");el.id=lista.id+"-"+i;el.className="opcion-select";el.setAttribute("role","option");el.setAttribute("aria-selected",String(o.selected));el.setAttribute("aria-disabled",String(o.disabled));el.textContent=o.textContent;el.addEventListener("pointerdown",e=>e.preventDefault());el.onclick=()=>elegir(i);lista.append(el);});
 c.elegir=elegir;document.body.append(lista);selectorAbierto=c;c.boton.setAttribute("aria-expanded","true");c.boton.setAttribute("aria-controls",lista.id);
 const r=c.boton.getBoundingClientRect();c.posicion={top:r.top,left:r.left};
 const ancho=Math.min(Math.max(r.width,200),innerWidth-24),abajo=innerHeight-r.bottom-12;
 lista.style.width=ancho+"px";lista.style.left=Math.max(12,Math.min(r.left,innerWidth-ancho-12))+"px";
 if(abajo<180&&r.top>abajo){lista.style.bottom=(innerHeight-r.top+8)+"px";lista.style.maxHeight=Math.min(300,r.top-20)+"px";}
 else{lista.style.top=(r.bottom+8)+"px";lista.style.maxHeight=Math.max(80,Math.min(300,abajo-8))+"px";}
 marcarOpcion(c.indice);
}
function marcarOpcion(indice){
 const c=selectorAbierto;if(!c)return;
 c.indice=Math.max(0,Math.min(indice,c.select.options.length-1));
 [...c.lista.children].forEach((e,i)=>e.classList.toggle("opcion-activa",i===c.indice));
 const el=c.lista.children[c.indice];if(el){c.boton.setAttribute("aria-activedescendant",el.id);el.scrollIntoView({block:"nearest"});}
}
function prepararSelectores(){
 if(selectorAbierto&&(!selectorAbierto.select.isConnected||selectorAbierto.select.disabled||selectorAbierto.firma!==JSON.stringify([...selectorAbierto.select.options].map(o=>[o.value,o.textContent,o.disabled]))))cerrarSelector();
 document.querySelectorAll("main select:not([multiple])").forEach(select=>{
 if(controlesSelect.has(select)){sincronizarSelector(select);return;}
 const envoltura=document.createElement("span");envoltura.className="control-select";
 const boton=document.createElement("button");boton.type="button";boton.className="boton-select";boton.id="selector-"+(++contadorSelect);boton.setAttribute("role","combobox");boton.setAttribute("aria-haspopup","listbox");boton.setAttribute("aria-expanded","false");
 select.before(envoltura);envoltura.append(select,boton);select.classList.add("select-base");select.tabIndex=-1;select.setAttribute("aria-hidden","true");
 const c={boton,select};controlesSelect.set(select,c);sincronizarSelector(select);
 boton.onclick=()=>selectorAbierto===c?cerrarSelector():abrirSelector(select);
 let texto="",timer;
 boton.onkeydown=e=>{
 if(["ArrowDown","ArrowUp","Home","End","Enter"," ","Escape","Tab"].includes(e.key)){
 if(e.key==="Tab"){cerrarSelector();return;}
 e.preventDefault();
 if(e.key==="Escape"){cerrarSelector();return;}
 if(!selectorAbierto||selectorAbierto!==c){abrirSelector(select);return;}
 if(e.key==="Enter"||e.key===" "){c.elegir(c.indice);return;}
 let i=e.key==="Home"?0:e.key==="End"?select.options.length-1:c.indice+(e.key==="ArrowUp"?-1:1);
 const paso=e.key==="ArrowUp"||e.key==="End"?-1:1;
 while(i>=0&&i<select.options.length&&select.options[i].disabled)i+=paso;
 if(i>=0&&i<select.options.length)marcarOpcion(i);
 }else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(selectorAbierto!==c)abrirSelector(select);clearTimeout(timer);texto+=e.key.toLocaleLowerCase();const i=[...select.options].findIndex(o=>!o.disabled&&o.textContent.trim().toLocaleLowerCase().startsWith(texto));if(i>=0)marcarOpcion(i);timer=setTimeout(()=>texto="",700);}
 };
 select.addEventListener("change",()=>{sincronizarSelector(select);boton.removeAttribute("aria-invalid");});
 select.addEventListener("focus",()=>boton.focus());
 select.addEventListener("invalid",e=>{e.preventDefault();boton.setAttribute("aria-invalid","true");boton.focus();abrirSelector(select);});
 select.form?.addEventListener("reset",()=>setTimeout(()=>sincronizarSelector(select),0));
 });
}
let pendienteSelect=false;
new MutationObserver(()=>{if(pendienteSelect)return;pendienteSelect=true;queueMicrotask(()=>{pendienteSelect=false;prepararSelectores();});}).observe(document.querySelector("main"),{childList:true,subtree:true,attributes:true,attributeFilter:["disabled","selected","required"]});
document.addEventListener("pointerdown",e=>{if(selectorAbierto&&!selectorAbierto.lista.contains(e.target)&&!selectorAbierto.boton.contains(e.target))cerrarSelector();});
window.addEventListener("resize",cerrarSelector);
document.addEventListener("scroll",e=>{if(selectorAbierto&&e.target!==selectorAbierto.lista){const r=selectorAbierto.boton.getBoundingClientRect(),p=selectorAbierto.posicion;if(Math.abs(r.top-p.top)>2||Math.abs(r.left-p.left)>2)cerrarSelector();}},true);
window.addEventListener("hashchange",cerrarSelector);window.addEventListener("popstate",cerrarSelector);
prepararSelectores();

//Despliegues con apertura y cierre suaves
document.addEventListener("click",e=>{
 const s=e.target.closest("summary");if(!s||e.target.closest("button,a,input"))return;
 if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
 const d=s.parentElement;e.preventDefault();
 const abrir=d.dataset.transicion?d.dataset.transicion==="cerrando":!d.open;
 const inicio=d.getBoundingClientRect().height;
 d.getAnimations().forEach(a=>a.cancel());d.open=true;d.style.overflow="hidden";
 const final=abrir?d.getBoundingClientRect().height:s.getBoundingClientRect().height+parseFloat(getComputedStyle(d).paddingTop)+parseFloat(getComputedStyle(d).paddingBottom);
 d.dataset.transicion=abrir?"abriendo":"cerrando";
 const a=d.animate([{height:inicio+"px"},{height:final+"px"}],{duration:260,easing:"cubic-bezier(.2,.8,.2,1)"});
 a.onfinish=()=>{d.open=abrir;delete d.dataset.transicion;d.style.overflow="";};
});
