//Instalación y disponibilidad local
let eventoInstalacion = null;
let registroOffline = null;
let actualizacionSolicitada = false;
let versionPendiente = null;
let temporizadorActualizacion = null;
const estadoOffline = document.getElementById("estado-offline");
const mensajeInstalacion = document.getElementById("mensaje-instalacion");
const botonInstalar = document.getElementById("instalar-app");
const botonActualizar = document.getElementById("actualizar-app");

function actualizarConexion() {
    document.getElementById("estado-conexion").textContent = navigator.onLine ? "Con conexión" : "Sin conexión";
}
function comprobarArchivosOffline() {
    return new Promise(resolve => {
        const controlador = navigator.serviceWorker?.controller;
        if (!controlador) { resolve(false); return; }
        const canal = new MessageChannel();
        const cerrar = listo => { clearTimeout(tiempo); canal.port1.close(); resolve(listo); };
        const tiempo = setTimeout(() => cerrar(false), 5000);
        canal.port1.onmessage = evento => cerrar(evento.data?.listo === true);
        controlador.postMessage({ tipo: "COMPROBAR_OFFLINE" }, [canal.port2]);
    });
}
async function actualizarEstadoOffline() {
    const listo = await comprobarArchivosOffline();
    estadoOffline.textContent = listo ? "Lista para usar sin conexión" : "Abre la web con conexión para completar la preparación.";
    estadoOffline.dataset.listo = String(listo);
}
function anunciarActualizacion() {
    const esperando = registroOffline?.waiting;
    versionPendiente = navigator.serviceWorker.controller && esperando && esperando !== navigator.serviceWorker.controller
        ? esperando : null;
    botonActualizar.hidden = !versionPendiente;
    if (versionPendiente) mensajeInstalacion.textContent =
        "Hay una versión nueva lista. Aplícala cuando termines de escribir; los registros guardados se conservan.";
}
window.addEventListener("online", actualizarConexion);
window.addEventListener("offline", actualizarConexion);
window.addEventListener("beforeinstallprompt", evento => {
    evento.preventDefault(); eventoInstalacion = evento; botonInstalar.hidden = false;
});
window.addEventListener("appinstalled", () => {
    eventoInstalacion = null; botonInstalar.hidden = true;
    mensajeInstalacion.textContent = "Aplicación instalada. Puedes abrirla desde su icono.";
});
botonInstalar.addEventListener("click", async () => {
    if (!eventoInstalacion) return;
    const evento = eventoInstalacion; eventoInstalacion = null; botonInstalar.hidden = true;
    await evento.prompt();
    const resultado = await evento.userChoice;
    mensajeInstalacion.textContent = resultado.outcome === "accepted"
        ? "Instalación aceptada. Busca Mis finanzas en tu teléfono."
        : "Puedes instalarla después desde el menú del navegador.";
});
botonActualizar.addEventListener("click", async () => {
    if (actualizacionSolicitada) return;
    if (!guardadoHabilitado || reinicioDetectado) {
        mensajeInstalacion.textContent = "Recupera el guardado antes de actualizar.";
        return;
    }
    const pendiente = versionPendiente;
    if (!pendiente) {
        mensajeInstalacion.textContent = "La actualización todavía se está preparando. Busca actualizaciones y vuelve a intentarlo.";
        return;
    }
    if (!confirm("¿Actualizar ahora? Los datos guardados se conservan; lo que estés escribiendo sin registrar se perderá.")) return;
    actualizacionSolicitada = true;
    botonActualizar.disabled = true;
    mensajeInstalacion.textContent = "Aplicando actualización…";
    try {
        const registro = await navigator.serviceWorker.getRegistration();
        if (!registro || pendiente.state === "redundant") throw new Error("Versión no disponible");
        if (pendiente.state === "activated" && navigator.serviceWorker.controller === pendiente) {
            location.reload();
            return;
        }
        temporizadorActualizacion = setTimeout(() => {
            actualizacionSolicitada = false;
            botonActualizar.disabled = false;
            mensajeInstalacion.textContent = "La actualización no terminó. Tus datos siguen guardados. Puedes volver a intentarlo.";
        }, 15000);
        pendiente.postMessage({ tipo: "ACTIVAR_ACTUALIZACION" });
    } catch {
        actualizacionSolicitada = false;
        botonActualizar.disabled = false;
        mensajeInstalacion.textContent = "No se pudo aplicar esa versión. Busca actualizaciones para volver a intentarlo.";
    }
});
document.getElementById("buscar-actualizacion").addEventListener("click", async () => {
    if (!registroOffline) { mensajeInstalacion.textContent = "Abre la versión HTTPS publicada para preparar la instalación."; return; }
    try {
        await registroOffline.update();
        anunciarActualizacion();
        if (!registroOffline.waiting) mensajeInstalacion.textContent = "Comprobación solicitada. Si hay una nueva versión, aparecerá el botón de actualización.";
    } catch { mensajeInstalacion.textContent = "No se pudo buscar una actualización. Puedes seguir utilizando la versión disponible sin conexión."; }
});
document.getElementById("proteger-almacenamiento").addEventListener("click", async () => {
    if (!navigator.storage?.persist) {
        mensajeInstalacion.textContent = "Este navegador no ofrece esta opción. Conserva copias descargadas de tus datos.";
        return;
    }
    try {
        const aceptado = await navigator.storage.persist();
        mensajeInstalacion.textContent = aceptado
            ? "El navegador concedió almacenamiento persistente. Aun así, borrar los datos del sitio elimina tus registros: conserva copias."
            : "El navegador no concedió almacenamiento persistente. La aplicación sigue funcionando; descarga copias periódicamente.";
    } catch { mensajeInstalacion.textContent = "No se pudo solicitar la conservación. Puedes seguir descargando copias."; }
});
async function prepararInstalacion() {
    actualizarConexion();
    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
        estadoOffline.textContent = "Para instalar y preparar el uso sin conexión, abre la web publicada con HTTPS.";
        return;
    }
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (actualizacionSolicitada) { clearTimeout(temporizadorActualizacion); location.reload(); return; }
        anunciarActualizacion();
        actualizarEstadoOffline();
    });
    try {
        registroOffline = await navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" });
        anunciarActualizacion();
        registroOffline.addEventListener("updatefound", () => {
            const instalando = registroOffline.installing;
            instalando?.addEventListener("statechange", () => {
                if (instalando.state === "installed") { anunciarActualizacion(); actualizarEstadoOffline(); }
                if (instalando.state === "redundant") mensajeInstalacion.textContent = "No se completó la actualización. Se conserva la versión anterior.";
            });
        });
        await navigator.serviceWorker.ready;
        anunciarActualizacion();
        await actualizarEstadoOffline();
    } catch { estadoOffline.textContent = "No se pudo preparar el modo sin conexión. Reintenta con internet y revisa el almacenamiento disponible."; }
}
prepararInstalacion();
