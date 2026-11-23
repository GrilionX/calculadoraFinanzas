# Comprobación en dispositivos móviles
La aplicación sigue guardando los datos en este navegador y dispositivo. No hay sincronización entre celular y ordenador. Descargar una copia permite conservarlos antes de cambiar de navegador.

## Comprobaciones automáticas
La suite incluye navegación atrás/adelante, recarga de enlaces de sección, borrador conservado al cambiar de pestaña, pantallas pequeñas, texto ampliado al 200 %, orientación horizontal y fallo de almacenamiento al registrar un ingreso. La reducción de pantalla simula el teclado; no abre un teclado físico de Android.

## Comprobación pendiente en tu teléfono
Usa datos ficticios en una sesión de prueba, sin borrar tus datos habituales.
1. Abre la web actualizada. Recorre Ingresos, Ahorro y Deudas. Los botones deben ser legibles y el contenido no debe moverse lateralmente.
2. Escribe en un ingreso. Con el teclado abierto, comprueba que puedes llegar al importe, periodo y porcentajes. Al cerrarlo debe reaparecer la navegación inferior.
3. Cambia de sección y utiliza Atrás. Debe regresar a la sección anterior conservando el borrador. Recargar conserva los datos guardados, no un formulario sin enviar.
4. Gira el teléfono y aumenta el tamaño de texto. Las tarjetas deben acomodarse y las tablas amplias desplazarse dentro de su propio espacio.
5. Registra un ingreso ficticio y recarga. Debe aparecer una sola vez; comprueba su reparto y descarga una copia.

Si algo falla, anota modelo del dispositivo, navegador, sección y acción. No compartas importes ni nombres reales.

## Archivos
- `css/movil.css`: tarjetas adaptables, espacios de navegación, orientación y controles táctiles.
- `js/movil.js`: rutas por sección, detección aproximada del teclado, enfoque de avisos y ayudas de tablas.
- `index.html`: configuración de viewport y asociaciones de ayudas.
- `js/nominas.js`: restaura la lista anterior y conserva el formulario cuando falla guardar.
- `tests/finanzas.test.cjs`: regresiones de flujos financieros y comprobaciones móviles.

El teclado se estima con foco, puntero táctil, escala y reducción del área visible. Puede variar entre navegadores. No se desactiva el zoom.

## Referencias técnicas
- [Viewport y teclado en Chrome Android](https://developer.chrome.com/blog/viewport-resize-behavior).
- [VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).
- [Foco y tamaño de objetivos en WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/).

No equivale a certificación de accesibilidad ni a validación en todos los dispositivos físicos.
