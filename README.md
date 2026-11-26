# Mis finanzas

## Instalación: empieza aquí

### 1. Publicar la web (una sola vez)

**Pendiente de tu cuenta:** en la revisión del 25 de noviembre de 2026, GitHub Pages no estaba activado y la dirección devolvía 404. Subir código a main no activa Pages por sí solo.

1. Inicia sesión en GitHub y abre [Settings → Pages](https://github.com/GrilionX/calculadoraFinanzas/settings/pages).
2. En **Build and deployment → Source**, selecciona **Deploy from a branch**.
3. Elige **main** y **/(root)**; pulsa **Save**.
4. Espera a que GitHub termine la publicación. Abre la dirección que aparezca en Pages.
5. La dirección prevista es [Mis finanzas](https://grilionx.github.io/calculadoraFinanzas/). Si muestra 404, revisa Pages y el despliegue; no borres los datos de tu navegador.

Esta activación requiere acceso a la configuración del repositorio. La conexión usada para actualizar archivos no dispone de esa operación de administración.

### 2. Instalar en el teléfono

1. Abre la dirección HTTPS publicada con internet en tu navegador habitual.
2. Entra en **Secciones → Datos y copias**.
3. Espera **Lista para usar sin conexión**.
4. Abre **Instalación, actualizaciones y datos** y pulsa **Comprobar este dispositivo**.
5. Pulsa **Instalar en mi teléfono**, si aparece. También puedes usar el menú del navegador → **Instalar aplicación** o **Añadir a pantalla de inicio**. En iPhone: Safari → Compartir → Añadir a pantalla de inicio. El texto exacto depende del navegador.
6. Abre el nuevo icono, activa modo avión, cierra y vuelve a abrir. Comprueba que tus registros siguen disponibles.
7. Descarga y prueba una copia JSON antes de pasar de pruebas a datos reales.

No requiere cuentas, nube ni ordenador encendido después de preparar el uso sin conexión. GitHub contiene el código; tus registros permanecen en el navegador. El teléfono y el ordenador no se sincronizan automáticamente.

**Guía completa:** [PDF de instalación, actualización y pruebas](docs/guia-instalacion-y-pruebas.pdf).

### 3. Ejecutar en VS Code

Con Git y Node.js instalados, desde la carpeta del repositorio:

```sh
node scripts/servir.cjs
```

Abre **http://127.0.0.1:5173**. No necesitas instalar paquetes para usar la web. Detén el servidor con **Ctrl+C**. No abras index.html directamente si quieres probar instalación o funcionamiento sin conexión.

El servidor es local al ordenador; esa dirección no abre la web del ordenador desde el teléfono. Para el teléfono usa la publicación HTTPS.

### 4. Actualizar la copia de VS Code

Primero comprueba tu carpeta y rama:

```sh
git status
git branch --show-current
git remote -v
```

Si no hay cambios locales pendientes:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
git log -1 --oneline
```

Si tienes modificaciones que quieres conservar, antes de cambiar de rama:

```sh
git stash push -u -m "Trabajo local antes de actualizar"
```

Después ejecuta los comandos de actualización anteriores. Tus cambios quedan guardados; no apliques el stash automáticamente sobre la nueva versión. Si Git avisa de conflictos o historial divergente, detente y revisa el mensaje. No uses reset --hard para resolverlo.

### 5. Actualizar la aplicación instalada

Con internet, entra en **Datos y copias → Instalación, actualizaciones y datos → Buscar actualización**. Termina de guardar tus formularios, descarga una copia y pulsa **Aplicar actualización disponible** cuando aparezca. Revisa la versión instalada y vuelve a comprobar el dispositivo. No borres almacenamiento para actualizar.

## Copias, traslado y borrado

- Exporta un JSON desde **Datos y copias** y verifica que esté en Descargas.
- Importar reemplaza el conjunto actual; no fusiona copias. Guarda primero una copia de lo que quieras conservar.
- Cambiar de dirección, puerto, navegador o dispositivo utiliza otro almacenamiento. Traslada los registros con exportar/importar.
- Las copias contienen información financiera: guárdalas fuera del repositorio público.
- Para empezar limpio, usa **Borrar datos anteriores → Eliminar datos de este navegador → Sí**. Las copias descargadas no se eliminan.
- Solicitar conservación de datos al navegador no sustituye una copia descargada.
- **Comprobar este dispositivo** es una revisión de solo lectura: no crea movimientos ni confirma que una descarga esté guardada a salvo.

## Funciones disponibles

- Nóminas variables y reparto por ingreso; simulador separado de los ingresos recibidos.
- Gastos por categoría, categorías personalizadas y gastos recurrentes con confirmación.
- Ahorro personal y metas, con avance visual.
- Deudas individuales o por grupo; reservas separadas de los pagos.
- Tarjetas: límite, corte, pago, compras a meses y abonos.
- Apartados básicos por periodo, gasto real y cierre mensual confirmado.
- Fondos de emergencia individuales (Gas, Internet, etc.) y suma general sin duplicar dinero. El efectivo aparece como parte del total.
- Aportaciones y retiros por fondo; desde el general, aportaciones iguales y retiros proporcionales, con vista previa.
- Gráficas de básicos, ocio, tarjetas/deudas y ahorro; fondos identificados individualmente.
- Menú izquierdo y vistas independientes, adaptación móvil y movimiento reducido.
- Copias JSON, correcciones, borrado con confirmación y preparación sin conexión.

## Reglas que mantienen los cálculos

Los importes se calculan en centavos enteros. El reparto de cada nómina se conserva. El disponible descuenta gastos, aportaciones de ahorro, reservas de deuda y compromisos de apartados/tarjetas; los saldos no se suman de nuevo como ingresos.

Un cierre mueve el sobrante al fondo del apartado una sola vez. El total de emergencia es una suma, no una segunda cuenta. Retirar ahorro o emergencia no libera la nómina original ni registra automáticamente un gasto. La tasa anual es una proyección; no genera ganancias reales.

Las gráficas actuales muestran pagos y aportaciones registrados; las reservas y compras a crédito aún sin pagar no se presentan como pagos. La próxima fase separará expresamente el gasto al comprar del flujo de dinero al pagar.

## Preparación de la próxima fase

Se ha añadido un módulo independiente en **js/dominio/base-financiera.mjs**, con pruebas. **Todavía no está conectado a la interfaz ni al almacenamiento actual**: prepara cálculos y validaciones, no activa las nueve funciones completas.

| Función elegida | Base preparada | Siguiente implementación |
| --- | --- | --- |
| 1. Cuentas y efectivo | Tipos de cuenta, saldo y crédito disponible | Alta/edición, vinculación voluntaria de datos existentes |
| 2. Transferencias | Salida y entrada vinculadas, sin ingreso ni gasto ficticio | Formulario y registro atómico |
| 3. Compras y tarjetas | Compra mixta y pago de tarjeta diferenciados | Vincular compras y pagos a la interfaz actual |
| 4. Subpresupuestos | Límites y gasto por subcategoría | Editor por periodo y avisos |
| 5. Calendario | Eventos ordenados por fecha y estado | Integrar recurrencias, deudas y tarjetas sin duplicados |
| 6. Cierre mensual | Vista previa de ingresos, compras, pagos y cashback | Confirmación persistida y protección frente a doble cierre |
| 8. Cashback | Pendiente/confirmado, referencia única y saldo a favor | Captura del abono real y vínculo con tarjeta/cuenta |
| 9. Gasto dividido | Desglose por categoría y medio de pago con suma exacta | Editor visual de divisiones |
| 11. Proyección | Saldo estimado, trayectoria y mínimo previsto | Derivar eventos pendientes hasta el próximo ingreso |

Consulta [el plan técnico y sus criterios de aceptación](docs/proxima-fase.md). No se reconstruyen cuentas ni fechas antiguas por suposición. Antes de integrar el módulo se añadirá una migración explícita, con vista previa, copia y posibilidad de cancelar.

## Pruebas

Para desarrollar y ejecutar las pruebas, instala las dependencias de desarrollo:

```sh
npm install
npx playwright install chromium
npm test
```

La suite cubre cálculos, saldos, guardado fallido, copias, borrado, navegación, gráficos, actualización y uso sin conexión. Las pruebas del módulo nuevo cubren transferencias, cashback, desgloses, presupuestos, fechas y proyecciones. Usa datos ficticios; algunas pruebas generan capturas en test-results/.

**Pendiente real:** activar Pages desde tu cuenta y probar en tu teléfono instalación, modo avión, reapertura y restauración de una copia. Una APK se evaluará después si la instalación web no es suficiente; no se incluye todavía.

## Documentación

- [Instalar y usar en el teléfono](docs/instalar-telefono.md)
- [Actualizar desde VS Code](docs/actualizar-vscode.md)
- [Navegación](docs/dashboard.md)
- [Fondos, tarjetas y apartados](docs/version-gestion.md)
- [Próxima fase](docs/proxima-fase.md)
- [Guía PDF](docs/guia-instalacion-y-pruebas.pdf)

La publicación sigue las [instrucciones de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). La instalación depende del soporte del navegador descrito en la [guía de PWA de MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

### Verificación de esta entrega
122 pruebas de integración y 17 pruebas unitarias superadas (139 en total). También se comprobó la entrega del PDF desde el servidor local y se revisaron visualmente sus siete páginas. Esto no sustituye la prueba de instalación en tu teléfono real.
