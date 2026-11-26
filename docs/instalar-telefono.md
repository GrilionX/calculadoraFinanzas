# Usar la aplicación en el teléfono
No necesita cuentas, Supabase ni un ordenador encendido después de instalarla. VS Code sirve para editar el código; GitHub Pages entrega los archivos en la primera visita y al actualizar.

## Publicación inicial
Verificación del 25 de noviembre de 2026: Pages no está activado y la URL prevista devuelve 404. Actívalo desde tu sesión de GitHub siguiendo estos pasos.
En GitHub, abre el repositorio → Settings → Pages. Selecciona Deploy from a branch, rama main y carpeta / (root). Guarda y espera a que el despliegue termine.
La dirección prevista es https://grilionx.github.io/calculadoraFinanzas/. No está disponible hasta que Pages publique correctamente.

## Instalación
1. Abre la dirección HTTPS con internet, en el navegador habitual del teléfono.
2. En Secciones → Datos y copias, espera «Lista para usar sin conexión». En «Instalación, actualizaciones y datos» pulsa «Comprobar este dispositivo».
3. Pulsa Instalar aplicación si aparece. En Android también puedes usar el menú del navegador → Instalar aplicación o Añadir a pantalla de inicio. En iPhone usa Safari → Compartir → Añadir a pantalla de inicio.
4. Abre el icono, activa modo avión, cierra y vuelve a abrir. Comprueba que puedes registrar un ingreso ficticio y verlo tras cerrar y abrir.
5. Antes de usar datos oficiales, prueba exportar y restaurar una copia y después Empezar de cero.

La instalación y las opciones del menú dependen del navegador, no de la marca del celular. Abrir un archivo HTML directamente no instala el funcionamiento sin conexión.

## Copias y cambio de dispositivo
En Copia de seguridad y cambio de teléfono, exporta un JSON. Comprueba que el archivo se descargó y guárdalo en un lugar que puedas recuperar si pierdes el teléfono. Contiene tus datos financieros: no lo subas al repositorio público.
Importar muestra cuántos registros contiene y pide confirmar el reemplazo completo. No fusiona dos copias. Exporta primero los datos actuales si quieres conservarlos. Las versiones antiguas compatibles dejan vacías las secciones que no contienen.
La fecha de exportación indica que se solicitó la descarga, no que el archivo esté guardado a salvo.

Los datos del ordenador y del teléfono son independientes. Borrar los datos del navegador, desinstalar o perder el dispositivo puede eliminar registros. Solicitar almacenamiento persistente ayuda cuando el navegador lo admite, pero no sustituye las copias.

## Actualizaciones
Con internet, pulsa Buscar actualización. Cuando esté preparada, termina de registrar los formularios y pulsa Actualizar aplicación. La versión anterior sigue funcionando si falla la descarga. Sin conexión puedes seguir usando la versión instalada.
No borres los datos del navegador para actualizar.

## Comprobación pendiente
Las pruebas automatizadas usan datos ficticios en Chromium. Antes de usar datos reales, confirma en tu teléfono real instalación, apertura en modo avión, cierre y reapertura, exportación/importación y borrado seguido de un ingreso nuevo.

Referencias: [instalación de PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [funcionamiento sin conexión](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation).

Guía paso a paso: [descargar PDF](guia-instalacion-y-pruebas.pdf).
