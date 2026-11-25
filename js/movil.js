//Navegación y comodidad móvil
function tecladoMovilVisible({ tactil, editable, escala, alturaBase, alturaVisible }) {
    return tactil && editable && Math.abs(escala - 1) < 0.05 &&
        alturaBase - alturaVisible > Math.max(120, alturaBase * 0.2);
}

function campoEditableMovil(elemento) {
    return elemento instanceof HTMLElement &&
        (elemento.matches('textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="file"])') ||
            elemento.isContentEditable);
}

let alturaBaseMovil = window.innerHeight;
let anchoBaseMovil = window.innerWidth;
let marcoMovil = 0;

function actualizarViewportMovil() {
    cancelAnimationFrame(marcoMovil);
    marcoMovil = requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const ancho = window.innerWidth;
        const editable = campoEditableMovil(document.activeElement);
        if (Math.abs(ancho - anchoBaseMovil) > 80) {
            alturaBaseMovil = window.innerHeight;
            anchoBaseMovil = ancho;
        } else if (!editable || window.innerHeight > alturaBaseMovil) {
            alturaBaseMovil = window.innerHeight;
        }
        const visible = viewport?.height ?? window.innerHeight;
        const teclado = tecladoMovilVisible({
            tactil: matchMedia("(pointer: coarse)").matches,
            editable, escala: viewport?.scale ?? 1, alturaBase: alturaBaseMovil, alturaVisible: visible
        });
        document.body.classList.toggle("teclado-visible", teclado);
        const nav = document.querySelector(".navegacion-vistas");
        const altoNav = teclado || getComputedStyle(nav).position !== "fixed" ? 0 : nav.getBoundingClientRect().height;
        document.documentElement.style.setProperty("--alto-nav-movil", altoNav + "px");
    });
}

window.addEventListener("resize", actualizarViewportMovil, { passive: true });
window.visualViewport?.addEventListener("resize", actualizarViewportMovil, { passive: true });
document.addEventListener("focusin", actualizarViewportMovil);
document.addEventListener("focusout", () => requestAnimationFrame(actualizarViewportMovil));
actualizarViewportMovil();

//Atrás y adelante dentro de la aplicación
const rutasMoviles = { ingresos: "reparto", ahorro: "ahorro", deudas: "deudas", gastos: "gastos" };
function rutaVisibleMovil() {
    if (!document.getElementById("vista-gastos").hidden) return "gastos";
    if (!document.getElementById("vista-ahorro").hidden) return "ahorro";
    if (!document.getElementById("vista-deudas").hidden) return "deudas";
    return "ingresos";
}

function marcarRutaMovil(ruta, escribir = true) {
    if (!Object.hasOwn(rutasMoviles, ruta)) return;
    if (escribir && location.hash !== "#" + ruta) history.pushState(null, "", "#" + ruta);
    for (const boton of document.querySelectorAll(".navegacion-vistas button[aria-pressed]")) {
        const activo = boton.getAttribute("aria-pressed") === "true";
        if (activo) boton.setAttribute("aria-current", "page");
        else boton.removeAttribute("aria-current");
    }
    if(typeof sincronizarNavLateral==="function")sincronizarNavLateral(ruta);
}

function restaurarRutaMovil() {
    const ruta = location.hash.slice(1);
    if (!Object.hasOwn(rutasMoviles, ruta)) return;
    if (ruta === "gastos") abrirGastos();
    else {
        cambiarVista(rutasMoviles[ruta]);
        const titulo = document.querySelector(ruta === "ingresos" ? ".encabezado-vista h2" :
            ruta === "ahorro" ? "#vista-ahorro h2" : "#vista-deudas h2");
        titulo.tabIndex = -1;
        titulo.focus();
    }
    marcarRutaMovil(ruta, false);
}

for (const [id, ruta] of [["boton-reparto", "ingresos"], ["boton-ahorro", "ahorro"],
    ["boton-deudas", "deudas"], ["abrir-gastos", "gastos"], ["volver-gastos", "ingresos"], ["ir-a-ingreso", "ingresos"]]) {
    document.getElementById(id).addEventListener("click", () => marcarRutaMovil(ruta));
}
window.addEventListener("popstate", restaurarRutaMovil);
window.addEventListener("hashchange", restaurarRutaMovil);
if (Object.hasOwn(rutasMoviles, location.hash.slice(1))) restaurarRutaMovil();
else if (!location.hash) history.replaceState(null, "", "#ingresos");
marcarRutaMovil(rutaVisibleMovil(), false);

//Avisos de formulario cerca de la acción
const avisosFormulariosMoviles = {
    "formulario-nomina": "mensaje-nomina",
    "formulario-gasto": "mensaje-gasto",
    "formulario-ahorro": "mensaje-ahorro",
    "formulario-deuda": "mensaje-deudas",
    "formulario-apartado": "mensaje-deudas"
};
document.addEventListener("submit", evento => {
    const id = avisosFormulariosMoviles[evento.target.id];
    if (!id || !matchMedia("(max-width: 780px)").matches) return;
    requestAnimationFrame(() => {
        const aviso = document.getElementById(id);
        if (!aviso?.textContent.trim()) return;
        aviso.tabIndex = -1;
        aviso.focus({ preventScroll: true });
        aviso.scrollIntoView({ block: "center", behavior: "auto" });
    });
});

//Tablas con aviso cuando hay más columnas
const tablasMoviles = [...document.querySelectorAll(".tabla-scroll")];
function actualizarTablasMoviles() {
    for (const tabla of tablasMoviles) {
        const desborda = tabla.clientWidth > 0 && tabla.scrollWidth > tabla.clientWidth + 2;
        tabla.classList.toggle("tabla-desplazable", desborda);
        const ayuda = document.getElementById(tabla.dataset.ayudaMovil);
        if (ayuda) ayuda.hidden = !desborda;
    }
}
tablasMoviles.forEach((tabla, indice) => {
    const ayuda = document.createElement("p");
    ayuda.id = "ayuda-tabla-movil-" + indice;
    ayuda.className = "ayuda ayuda-tabla-movil";
    ayuda.textContent = "Esta tabla tiene más columnas. Deslízala horizontalmente para verlas.";
    ayuda.hidden = true;
    tabla.before(ayuda);
    tabla.dataset.ayudaMovil = ayuda.id;
    tabla.setAttribute("aria-describedby", ayuda.id);
});
if (typeof ResizeObserver !== "undefined") {
    const observador = new ResizeObserver(actualizarTablasMoviles);
    tablasMoviles.forEach(t => observador.observe(t));
}
const observadorTablasMoviles = new MutationObserver(actualizarTablasMoviles);
tablasMoviles.forEach(t => observadorTablasMoviles.observe(t, { childList: true, subtree: true }));
window.addEventListener("resize", actualizarTablasMoviles, { passive: true });
actualizarTablasMoviles();
