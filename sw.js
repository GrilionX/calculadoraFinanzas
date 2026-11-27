//Solo archivos de la aplicación: nunca copias ni registros personales
const VERSION = "2026-11-26-deudas-1.1.2";
const PREFIJO = "mis-finanzas-app:" + self.registration.scope + ":";
const CACHE = PREFIJO + VERSION;
const ARCHIVOS = [
    "js/deudas-pagos.js",
    "js/cuentas.js","js/cuentas-ui.js","css/cuentas.css",
    "js/emergencia.js","js/graficas.js","css/graficas.css",
    "js/espacio.js","js/controles.js","css/dashboard.css",
    "index.html",
    "manifest.webmanifest",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "js/calculos.js",
    "js/nominas.js",
    "js/deudas.js",
    "js/fondos.js",
    "js/origenes.js",
    "js/gastos.js",
    "js/correcciones.js",
    "js/ahorro.js",
    "js/ajustes.js",
    "js/grupos.js",
    "js/resumen.js",
    "js/datos-mejoras.js",
    "js/ingresos-edicion.js",
    "js/metas-recurrentes.js",
    "js/actividad.js",
    "js/historial-local.js",
    "js/confirmaciones.js",
    "js/migracion-categorias.js",
    "js/gestion.js",
    "js/gestion-ui.js",
    "css/gestion.css",
    "js/navegacion.js",
    "css/navegacion.css",
    "js/app.js",
    "js/pruebas.js",
    "js/interfaz.js",
    "js/correcciones-avanzadas.js",
    "js/paneles-mejoras.js",
    "js/movil.js",
    "js/instalacion.js",
    "css/styles.css",
    "css/sistema.css",
    "css/ingresos.css",
    "css/movil.css",
    "css/cuenta.css",
    "css/mejoras.css",
    "css/instalacion.css"
];
const RUTAS = new Set(ARCHIVOS.map(r => new URL(r, self.registration.scope).pathname));

self.addEventListener("install", evento => {
    evento.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        try {
            await cache.addAll(ARCHIVOS.map(r => new Request(new URL(r, self.registration.scope), { cache: "reload" })));
        } catch (error) { await caches.delete(CACHE); throw error; }
    })());
});
self.addEventListener("activate", evento => {
    evento.waitUntil((async () => {
        for (const nombre of await caches.keys()) if (nombre.startsWith(PREFIJO) && nombre !== CACHE) await caches.delete(nombre);
        await self.clients.claim();
    })());
});
self.addEventListener("message", evento => {
    if (evento.data?.tipo === "ACTIVAR_ACTUALIZACION") evento.waitUntil(self.skipWaiting());
    if (evento.data?.tipo === "COMPROBAR_OFFLINE") {
        evento.waitUntil((async () => {
            const cache = await caches.open(CACHE);
            const resultados = await Promise.all(ARCHIVOS.map(r => cache.match(new URL(r, self.registration.scope).href)));
            evento.ports[0]?.postMessage({ listo: resultados.every(Boolean), version: VERSION });
        })());
    }
});
self.addEventListener("fetch", evento => {
    const peticion = evento.request;
    const url = new URL(peticion.url), base = new URL(self.registration.scope);
    if (peticion.method !== "GET" || url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return;
    const navegacion = peticion.mode === "navigate" && (url.pathname === base.pathname || url.pathname === new URL("index.html",base).pathname);
    if (!navegacion && !RUTAS.has(url.pathname)) return;
    evento.respondWith((async () => {
        const cache = await caches.open(CACHE);
        const ruta = navegacion ? new URL("index.html", base).href : url.origin + url.pathname;
        return await cache.match(ruta) ?? new Response("No se pudo recuperar la aplicación. Abre la web con conexión para prepararla de nuevo.",
            { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    })());
});
