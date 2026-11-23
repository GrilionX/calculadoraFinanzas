//Cuenta y sincronización opcional
//No conservar tokens de enlaces de confirmación en la dirección
if (/(?:^#|&)access_token=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search + '#ingresos');
const panelNube = document.getElementById("panel-nube");
const avisoNube = document.getElementById("mensaje-nube");
let sesionNube = null;
let consultaNube = null;
let nubeOcupada = false;

function configuracionNube() {
    const c = window.FINANZAS_NUBE;
    if (!c?.url || !c.clavePublica) return null;
    const url = new URL(c.url);
    if (url.protocol !== "https:" || url.username || url.password ||
        url.search || url.hash || !/^\/[ ]*$/.test(url.pathname) ||
        !/^sb_publishable_[a-zA-Z0-9_-]+$/.test(c.clavePublica)) {
        throw new Error("Revisa la URL HTTPS y la clave pública publishable de la configuración.");
    }
    return { url: url.origin, clave: c.clavePublica };
}

function mostrarMensajeNube(texto, error = false) {
    avisoNube.textContent = texto;
    avisoNube.className = error ? "aviso error" : "aviso";
}

function actualizarPanelNube() {
    let configurada = false;
    try { configurada = !!configuracionNube(); } catch (error) { mostrarMensajeNube(error.message, true); }
    document.getElementById("nube-sin-configurar").hidden = configurada;
    document.getElementById("nube-cuenta").textContent = sesionNube
        ? "Cuenta: " + sesionNube.email : "Sin sesión. Tus datos siguen en este navegador.";
    for (const boton of panelNube.querySelectorAll("button")) {
        boton.disabled = nubeOcupada || !configurada;
    }
    document.getElementById("consultar-nube").disabled ||= !sesionNube;
    document.getElementById("salir-nube").disabled ||= !sesionNube;
    document.getElementById("subir-nube").disabled ||= !sesionNube || !consultaNube;
    document.getElementById("bajar-nube").disabled ||= !sesionNube || !consultaNube?.remota;
}

async function peticionNube(ruta, { metodo = "GET", cuerpo, autenticar = true } = {}) {
    const c = configuracionNube();
    if (!c) throw new Error("La conexión con la nube aún no está configurada.");
    if (autenticar && (!sesionNube || sesionNube.vence <= Date.now())) {
        sesionNube = null; consultaNube = null;
        throw new Error("Inicia sesión de nuevo para continuar.");
    }
    const control = new AbortController();
    const tiempo = setTimeout(() => control.abort(), 15000);
    try {
        const headers = { apikey: c.clave, "Content-Type": "application/json" };
        if (autenticar) headers.Authorization = "Bearer " + sesionNube.token;
        const respuesta = await fetch(c.url + ruta, {
            method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
            signal: control.signal, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer"
        });
        const texto = await respuesta.text();
        if (texto.length > 4500000) throw new Error("La respuesta es demasiado grande.");
        const datos = texto ? JSON.parse(texto) : null;
        if (!respuesta.ok) {
            if (respuesta.status === 401 && autenticar) { sesionNube = null; consultaNube = null; }
            if (datos?.code === "40001" || respuesta.status === 409) {
                consultaNube = null;
                throw new Error("Otro dispositivo cambió la copia. Consulta de nuevo y compara antes de continuar.");
            }
            if (respuesta.status === 429) throw new Error("Demasiados intentos. Espera unos minutos.");
            throw new Error(autenticar ? "No se pudo completar la operación. Revisa tu sesión y la configuración del servicio." :
                "No se pudo acceder. Revisa el correo, la contraseña y la confirmación del correo.");
        }
        return datos;
    } catch (error) {
        if (error.name === "AbortError" || error instanceof TypeError) {
            throw new Error("No hay respuesta de la nube. Tus datos locales se conservan. Consulta de nuevo antes de reintentar.");
        }
        throw error;
    } finally { clearTimeout(tiempo); }
}

async function accionNube(accion) {
    if (nubeOcupada) return;
    nubeOcupada = true; actualizarPanelNube();
    try { await accion(); }
    catch (error) { mostrarMensajeNube(error.message, true); }
    finally { nubeOcupada = false; actualizarPanelNube(); }
}

function copiaLocalNube() {
    if (!guardadoHabilitado || reinicioDetectado ||
        localStorage.getItem(CLAVE_GUARDADO) !== ultimoTextoGuardado) {
        throw new Error("Recarga y recupera el guardado local antes de sincronizar.");
    }
    const copia = { app: "finanzas-personal", version: 7, datos: copiar(construirPaquete()) };
    if (!aplicarDatos(copia.datos, true)) throw new Error("Los datos locales no superaron la validación.");
    if (new TextEncoder().encode(JSON.stringify(copia)).length > 3500000) {
        throw new Error("La copia supera el tamaño admitido. Descarga una copia JSON; no se envió nada.");
    }
    return copia;
}

function validarCopiaNube(copia) {
    return esCopiaValida(copia) && copia.version === 7 && aplicarDatos(copia.datos, true);
}

function resumenCopiaNube(copia) {
    const d = copia.datos;
    return (d.nominas ?? []).length + " ingresos · " + (d.deudas ?? []).length + " deudas · " +
        (d.gastosBasicos ?? []).length + " gastos · " + (d.movimientosAhorros ?? []).length + " movimientos de ahorro";
}

async function consultarNube() {
    consultaNube = null;
    const local = copiaLocalNube();
    const textoLocal = ultimoTextoGuardado;
    const filas = await peticionNube("/rest/v1/finanzas_copias?select=revision,copia,actualizado_en&limit=1");
    if (!Array.isArray(filas) || filas.length > 1) throw new Error("Respuesta de nube no válida.");
    const remota = filas[0] ?? null;
    if (remota && (!Number.isSafeInteger(remota.revision) || remota.revision < 1 ||
        !validarCopiaNube(remota.copia))) throw new Error("La copia remota no es compatible. No se reemplazó nada.");
    consultaNube = { remota, textoLocal, local: JSON.stringify(local), usuario: sesionNube.id };
    document.getElementById("comparacion-nube").textContent =
        "Este dispositivo: " + resumenCopiaNube(local) + ". " +
        (remota ? "Nube (revisión " + remota.revision + "): " + resumenCopiaNube(remota.copia) +
            ". Última actualización: " + remota.actualizado_en :
            "Todavía no hay copia en esta cuenta.");
    mostrarMensajeNube("Consulta lista. Las copias se reemplazan completas; no se mezclan movimientos.");
}

function comprobarConsultaNube() {
    const local = copiaLocalNube();
    if (!consultaNube || consultaNube.usuario !== sesionNube?.id ||
        consultaNube.textoLocal !== ultimoTextoGuardado || consultaNube.local !== JSON.stringify(local)) {
        consultaNube = null;
        throw new Error("Los datos cambiaron desde la consulta. Vuelve a comparar las copias.");
    }
    return local;
}

async function subirCopiaNube() {
    const copia = comprobarConsultaNube();
    if (!confirm("¿Enviar los datos de este dispositivo a " + sesionNube.email +
        "? Reemplazará la copia de esa cuenta. No se combinarán movimientos.")) return;
    const revision = consultaNube.remota?.revision ?? 0;
    //La revisión se comprueba también en el servidor
    const resultado = await peticionNube("/rest/v1/rpc/guardar_copia_finanzas", {
        metodo: "POST", cuerpo: { revision_esperada: revision, nueva_copia: copia }
    });
    consultaNube = null;
    if (!Array.isArray(resultado) || resultado.length !== 1 ||
        resultado[0].revision !== revision + 1) throw new Error("Respuesta inesperada. Consulta la nube antes de reintentar.");
    mostrarMensajeNube("Copia enviada. Revisión " + resultado[0].revision + ". Puedes consultarla desde tu otro dispositivo.");
}

async function bajarCopiaNube() {
    const local = comprobarConsultaNube();
    const candidata = consultaNube.remota;
    if (!candidata) throw new Error("No hay copia remota para descargar.");
    if (!confirm("¿Reemplazar los datos de este navegador por la copia de " + sesionNube.email +
        "? Se descargará una copia de tus datos locales antes de aplicar el cambio.")) return;
    //Revisar que la copia no cambió mientras se mostraba la comparación
    const filas = await peticionNube("/rest/v1/finanzas_copias?select=revision&limit=1");
    comprobarConsultaNube();
    if (filas?.[0]?.revision !== candidata.revision) {
        consultaNube = null;
        throw new Error("La copia remota cambió. Consulta de nuevo antes de reemplazar.");
    }
    if (!validarCopiaNube(candidata.copia)) throw new Error("Copia incompatible.");
    exportarCopia();
    const datos = copiar(candidata.copia.datos);
    datos.reinicioId = generarId([]);
    //Una sola escritura: si falla, la versión anterior sigue intacta
    localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(datos));
    consultaNube = null;
    bloquearPantallaPorReinicio("Copia de la nube guardada. Recarga para trabajar con ella.");
    recargarTrasReinicio();
}

document.getElementById("formulario-cuenta").addEventListener("submit", evento => {
    evento.preventDefault();
    const crear = evento.submitter?.id === "crear-cuenta";
    accionNube(async () => {
        consultaNube = null;
        const email = document.getElementById("correo-cuenta").value.trim();
        const password = document.getElementById("clave-cuenta").value;
        try {
            const datos = await peticionNube(crear ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password", {
                metodo: "POST", cuerpo: { email, password }, autenticar: false
            });
            if (crear) {
                sesionNube = null;
                mostrarMensajeNube("Si el registro es válido, revisa tu correo para confirmar la cuenta. Después inicia sesión.");
                return;
            }
            if (!datos?.access_token || !datos.user?.id || !Number.isFinite(datos.expires_in)) {
                throw new Error("La sesión recibida no es válida.");
            }
            sesionNube = { token: datos.access_token, id: datos.user.id, email: datos.user.email,
                vence: Date.now() + datos.expires_in * 1000 - 10000 };
            mostrarMensajeNube("Sesión iniciada. Consulta las copias antes de elegir cuál conservar.");
        } finally { document.getElementById("clave-cuenta").value = ""; }
    });
});
document.getElementById("salir-nube").addEventListener("click", () => accionNube(async () => {
    try { await peticionNube("/auth/v1/logout?scope=local", { metodo: "POST" }); }
    finally {
        sesionNube = null; consultaNube = null;
        document.getElementById("comparacion-nube").textContent = "";
        mostrarMensajeNube("Sesión cerrada en esta página. Los datos locales siguen en este navegador.");
    }
}));
document.getElementById("consultar-nube").addEventListener("click", () => accionNube(consultarNube));
document.getElementById("subir-nube").addEventListener("click", () => accionNube(subirCopiaNube));
document.getElementById("bajar-nube").addEventListener("click", () => accionNube(bajarCopiaNube));
actualizarPanelNube();

//Descartar la sesión y las copias en memoria al borrar los datos locales
function limpiarSesionNubeLocal() {
    sesionNube = null;
    consultaNube = null;
    document.getElementById("comparacion-nube").textContent = "";
}
