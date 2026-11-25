# Navegación y diseño
La navegación está a la izquierda en escritorio. En teléfono se abre con «Secciones» y se cierra al elegir una vista, tocar fuera o pulsar Escape.

Cada opción muestra una vista independiente. Ingresos, apartados, actividad, simulador, ahorro, fondos, deudas, acreedores, tarjetas, correcciones y datos conservan sus controles y borradores al cambiar de sección. Atrás, adelante y recargar conservan la ruta.

Los fondos individuales muestran solo el fondo elegido. «Todos mis fondos» recupera el conjunto. No se duplican saldos ni registros.

Los desplegables tienen diseño propio, flechas, Inicio/Fin, búsqueda por letras, Enter y Escape. Conservan los selectores originales como origen del valor para los cálculos y formularios.

## Archivos
- js/espacio.js: organiza las vistas moviendo los nodos existentes, sin duplicarlos.
- js/navegacion.js: menú, rutas y foco.
- js/controles.js: selectores accesibles y animación de despliegues.
- css/dashboard.css: diseño común y adaptación a tamaños de pantalla.
- sw.js: incluye los nuevos recursos en la copia sin conexión.

La paleta usa fondo lavanda, superficies claras y navegación oscura, siguiendo las referencias visuales aportadas. Las animaciones respetan la preferencia de movimiento reducido. No se añaden cuentas, servicios externos ni dependencias.

## Actualizar y probar
Con conexión, abre «Datos y copias», busca actualizaciones y aplica la versión disponible. Conserva una copia de seguridad antes de probar.

Pendiente de validación en el teléfono real: abrir las secciones, registrar un ingreso y un gasto, comprobar una tarjeta, cerrar/reabrir sin conexión y descargar/restaurar una copia de prueba. Los datos reales permanecen en su navegador; GitHub contiene únicamente la aplicación.
