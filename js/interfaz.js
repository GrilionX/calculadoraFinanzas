//Presentación: no modifica los datos financieros
function actualizarDistribucionVisual() {
    const barra = document.getElementById("barra-distribucion");
    const leyenda = document.getElementById("texto-distribucion");
    barra.replaceChildren();
    leyenda.replaceChildren();
    leyenda.className = "leyenda-distribucion";
    try {
        const r = calcularResumenFinanciero(document.getElementById("resumen-nomina").value);
        if (r.ingresos === 0) {
            barra.setAttribute("aria-label", "Todavía no hay ingresos registrados");
            leyenda.textContent = "Tu primer ingreso dará forma a este resumen.";
            return;
        }
        const datos = [
            ["Apartados", r.destinadoBasicos, "apartados", "#67c8ff"],
            ["Gastos", r.gastos, "gastos", "#f4af7a"],
            ["Ahorro", r.ahorroDestinado, "ahorro", "#6caeff"],
            ["Deudas", r.destinadoDeudas, "deudas", "#b693fa"],
            ["Disponible", r.disponible, "disponible", "#68dfbc"]
        ];
        const descripciones = [];
        for (const [nombre, monto, clase, color] of datos) {
            const porcentaje = monto / r.ingresos * 100;
            const segmento = document.createElement("span");
            segmento.className = "segmento-" + clase;
            segmento.style.width = porcentaje + "%";
            segmento.setAttribute("aria-hidden", "true");
            barra.appendChild(segmento);
            const etiqueta = document.createElement("span");
            etiqueta.style.setProperty("--color", color);
            etiqueta.textContent = nombre + " " + porcentaje.toLocaleString("es-MX", { maximumFractionDigits: 1 }) + "%";
            leyenda.appendChild(etiqueta);
            descripciones.push(nombre + ": " + formatoMoneda.format(monto / 100));
        }
        barra.setAttribute("aria-label", descripciones.join(". "));
    } catch {
        barra.setAttribute("aria-label", "Distribución no disponible");
        leyenda.textContent = "Revisa el aviso del resumen para comprobar los datos.";
    }
}

document.getElementById("ir-a-ingreso").addEventListener("click", () => {
    cambiarVista("reparto");
    document.getElementById("titulo-nomina").scrollIntoView({ block: "start" });
    document.getElementById("referencia-nomina").focus({ preventScroll: true });
});
for (const boton of document.querySelectorAll(".navegacion-vistas button")) {
    boton.addEventListener("click", () => {
        document.querySelector(".titulo-app").scrollIntoView({ block: "start" });
    });
}
for (const contenedor of document.querySelectorAll(".tabla-scroll")) {
    contenedor.tabIndex = 0;
    contenedor.setAttribute("role", "region");
    const caption = contenedor.querySelector("caption");
    contenedor.setAttribute("aria-label", caption?.textContent.trim() || "Tabla de importes. Desplázate horizontalmente para ver todas las columnas.");
}
const observadorResumenVisual = new MutationObserver(actualizarDistribucionVisual);
observadorResumenVisual.observe(document.getElementById("mensaje-resumen-financiero"), { childList: true, subtree: true });
actualizarDistribucionVisual();
