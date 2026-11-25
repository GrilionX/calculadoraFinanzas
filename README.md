# Calculadora de finanzas personales

Aplicación estática en español: presupuesto, ahorro personal, nóminas variables, deudas individuales, fondos por grupo y proyección. Cada usuario introduce sus datos; no incluye deudas personales precargadas.

## Diseño y uso en celular

La vista principal se llama **Ingresos** y conserva el reparto por nómina. El disponible ocupa la tarjeta principal; los detalles de cálculo y saldos globales se pueden desplegar. El gráfico muestra únicamente movimientos registrados, con leyenda y descripción accesible.

El botón **Registrar un ingreso** lleva al formulario. En escritorio, el registro y el historial se presentan en columnas; en celular se apilan y la navegación de Ingresos, Ahorro y Deudas queda en la parte inferior. Las tablas conservan desplazamiento horizontal y acceso por teclado. El borrado total está dentro del desplegable **Empezar de cero**.

Los estilos se cargan en este orden:
- `css/styles.css`: estilos funcionales existentes.
- `css/sistema.css`: colores, tipografía, componentes y estados compartidos.
- `css/ingresos.css`: resumen, formulario, reparto e historial.
- `css/movil.css`: adaptación por tamaño de pantalla y preferencias de accesibilidad.
- `css/cuenta.css`: confirmaciones de corrección.
- `css/instalacion.css`: instalación, estado de conexión y actualizaciones.

`js/interfaz.js` añade navegación de presentación y la barra de distribución; no modifica los importes ni el almacenamiento. No se añadieron fuentes remotas, librerías visuales ni rastreadores.

Referencias consultadas para jerarquía de información y presentación de presupuestos: [Monarch](https://www.monarch.com/features/budgeting), [YNAB](https://www.ynab.com/features) y [Copilot Money](https://www.copilot.money/). El diseño y los componentes son propios.

## Ejecutar en tu ordenador

Desde la carpeta del repositorio, con Node.js instalado:

```sh
node scripts/servir.cjs
```

Abre http://127.0.0.1:5173. No necesitas instalar dependencias para usar la aplicación. El servidor solo sirve los archivos en tu ordenador; no es una API ni una base de datos. Detén el servidor con Ctrl+C.

Los datos se guardan en el navegador, no en GitHub. Usa siempre la misma dirección y navegador. Cambiar de dirección, puerto o navegador muestra un almacenamiento diferente: exporta una copia JSON e impórtala en la nueva ubicación para trasladar tus datos.

## Gastos y categorías

Desde Reparto, pulsa **Registrar mis gastos**. Se conservan las tres pestañas principales.

1. Selecciona una nómina registrada.
2. Elige el presupuesto: básicos, ocio u otra categoría de gastos que figure en el reparto de esa nómina.
3. Crea tus categorías de gastos dentro del presupuesto elegido y registra concepto, fecha e importe.
4. Consulta sus gastos, reservas para deudas, saldo disponible y sumas por categoría.

Los importes se toman del reparto guardado, sin recalcularlo con porcentajes actuales ni mezclar nóminas. El 55% de básicos y el 5% de ocio son valores iniciales, no límites fijos. Las categorías personales del reparto también pueden financiar gastos. Ahorro, deudas e inversiones se reservan para sus gestores independientes.

Dentro de **Mis categorías de gastos**, puedes cambiar un nombre, archivar una categoría o reactivarla. La identidad se conserva: renombrar actualiza su etiqueta en los movimientos existentes. Archivar no borra gastos ni devuelve dinero; la categoría deja de estar disponible para nuevas capturas y sus importes siguen contando. No se permiten nombres repetidos dentro del mismo presupuesto, incluidas las categorías archivadas. Sí puedes usar el mismo nombre en dos presupuestos distintos.

Un gasto no puede superar el saldo disponible. El mismo dinero no puede financiar un gasto y un apartado. Para corregir una captura, anula el gasto con motivo y registra el correcto. La anulación conserva el movimiento y libera su importe.

Las categorías de gastos antiguas se migran automáticamente al presupuesto de básicos y comienzan activas. Los campos internos `gastosBasicos` y algunas funciones conservan su nombre anterior por compatibilidad, pero ahora almacenan gastos de los distintos presupuestos, identificados por `categoriaId`.

## Administración de grupos

En **Deudas → Administrar mis grupos** puedes cambiar el nombre de un grupo, mover una deuda pendiente a otro grupo o dejarla sin grupo, y eliminar grupos vacíos sin movimientos.

Renombrar conserva el identificador, los pagos y los movimientos. Un traslado conserva el objetivo y los apartados individuales con su origen de nómina. Se bloquea si hay transferencias o asignaciones que referencian esa deuda, si interviene un fondo compartido con reservas o si se intenta llevar una deuda con apartados individuales a un fondo compartido. Las mismas restricciones se aplican desde el editor de deuda.

Eliminar exige que no haya deudas (tampoco liquidadas), movimientos de fondo ni referencias de transferencias. Todos estos cambios quedan en el historial de estados anteriores y posteriores. Si no se puede guardar, se conserva el estado anterior.

## Resumen financiero

En **Reparto → Mi resumen financiero** puedes ver todas las nóminas o elegir una. Se comprueba esta igualdad con importes enteros en centavos:

**Ingresos recibidos = gastos + destinado a ahorro + destinado a deudas + sin utilizar.**

- El destino a ahorro incluye las aportaciones vinculadas activas, aunque después hayas retirado ahorro.
- El destino a deudas incluye los apartados vinculados, aunque se hayan distribuido, transferido o pagado. Cada origen se cuenta una sola vez.
- El disponible por nómina y categoría descuenta gastos, aportaciones de ahorro y apartados activos.
- El simulador y los ingresos supuestos no se incluyen como dinero recibido.

Debajo aparecen los **saldos actuales de toda la cuenta local**, que no cambian con el filtro de nómina: ahorro actual, reservas para deudas pendientes, pagos confirmados, deuda pendiente, lo que falta reunir y retiros de ahorro. Incluyen registros anteriores sin origen de nómina. Son saldos del registro local, no una consulta al banco. No deben sumarse nuevamente a los totales de nóminas. Los retiros de ahorro no crean automáticamente un gasto ni liberan la nómina original.

## Ahorro vinculado

Las nuevas aportaciones requieren elegir una nómina con categoría Ahorro. El importe consume su disponible y no puede reutilizarse en apartados. Los movimientos anteriores sin origen se conservan como ahorro previo; no se inventa una nómina para ellos.

Los retiros salen del saldo de ahorro personal y no devuelven dinero a la nómina. Un retiro no registra automáticamente un gasto ni una transferencia a otro presupuesto. Para corregir una captura, usa **Anular movimiento** con motivo y registra la correcta. La anulación conserva el registro. Se rechaza si produce un saldo negativo en cualquier punto de la historia: primero deben corregirse los retiros que dependían de esa aportación. Los movimientos antiguos sin identificador no muestran anulación.

## Ajustes de objetivos y apartados

En **Correcciones e historial → Ajustar objetivos y apartados concretos**:

- Cambia el objetivo de una deuda pendiente, indicando motivo. Se valida que cubra las reservas individuales y del grupo; las asignaciones ya distribuidas pueden exigir deshacer primero la distribución.
- Corrige el importe de un apartado concreto vinculado a nómina. El nuevo importe sustituye al anterior y la diferencia actualiza la disponibilidad. Cero anula el apartado.
- Solo se ofrecen apartados sin transferencias ni distribución; los pagos confirmados se mantienen protegidos. No se reconstruyen orígenes de movimientos antiguos.
- Los estados anteriores y posteriores, junto con el motivo, se conservan en el historial y en la copia JSON. Los cambios selectivos no requieren deshacer operaciones independientes posteriores.

## Correcciones e historial

El panel registra los nuevos cambios de deudas y grupos. Permite deshacerlos del más reciente al más antiguo, con una vista previa y un motivo obligatorio. La operación original y su corrección permanecen en la copia de seguridad.

- Deshacer un apartado libera su importe en la nómina y categoría de origen.
- Deshacer una distribución devuelve el dinero al fondo; no libera nuevamente la nómina.
- Deshacer una modalidad restaura la modalidad y las reservas anteriores.
- Los pagos confirmados son un límite: no se deshacen ni se puede retroceder a operaciones anteriores a ellos.
- Los movimientos previos a esta versión se conservan, pero no tienen un estado anterior reconstruible para deshacerlos.
- El ahorro personal no se modifica al corregir una deuda.

Se muestran los últimos 30 registros, pero se guarda el historial completo. La representación local omite estados iniciales que repiten el resultado del cambio anterior; al cargar se reconstruyen para las correcciones. El espacio utilizado sigue creciendo con el historial. Si el navegador no puede guardar, se rechaza el cambio de deudas y se muestra un aviso. Descarga copias periódicamente. Este historial local no es un registro inalterable ni sustituye los comprobantes de pago.

Las copias nuevas usan la versión 8 e incluyen fechas, metas, recurrencias y correcciones de ingresos, además de ahorro, gastos y categorías. Se siguen leyendo las versiones 1, 2, 3, 4, 5, 6 y 7; si no contienen gastos, esa sección comienza vacía. El botón **Borrar datos anteriores** abre el panel de eliminación. Es necesario escribir **BORRAR**. Se elimina la clave de almacenamiento de esta aplicación mediante removeItem, incluido el historial, y se recarga con un estado nuevo sin movimientos ni ingresos de ejemplo. Las claves de otras aplicaciones se conservan. Las copias descargadas no se borran.

## Archivos

```text
index.html                 Interfaz y orden de carga
css/styles.css             Estilos funcionales existentes
css/sistema.css            Identidad y componentes compartidos
css/ingresos.css           Vista de ingresos y reparto
css/movil.css              Adaptación móvil y accesibilidad
css/cuenta.css             Confirmaciones de corrección
css/mejoras.css            Actividad, metas y planificación
js/calculos.js             Operaciones monetarias y reparto
js/nominas.js              Registro de nóminas
js/deudas.js               Deudas, grupos y horizonte
js/fondos.js               Fondos, asignaciones y modalidades
js/origenes.js             Vínculo de apartados con nóminas
js/correcciones.js         Validación, historial y reversión
js/correcciones-avanzadas.js Reconstrucción con vista previa
js/gastos.js               Gastos por presupuesto, categorías y disponibilidad conjunta
js/ahorro.js               Origen y correcciones del ahorro personal
js/ajustes.js              Objetivos y apartados concretos con motivo
js/grupos.js               Renombrar, trasladar y eliminar grupos vacíos
js/resumen.js              Conciliación de nóminas y saldos actuales
js/interfaz.js             Navegación visual y distribución accesible
js/movil.js                Teclado, rutas y comodidad móvil
js/datos-mejoras.js        Datos complementarios y guardado completo
js/ingresos-edicion.js     Corrección y anulación de ingresos
js/metas-recurrentes.js    Metas, programación y vencimientos
js/actividad.js            Historial y resumen por fechas
js/paneles-mejoras.js      Interfaz de las seis mejoras
js/app.js                  Persistencia, presupuesto, ahorro y arranque
js/pruebas.js              Comprobaciones existentes
scripts/servir.cjs         Servidor local de archivos
tests/finanzas.test.cjs    Pruebas de integración en navegador
```

`guardar()` conserva el estado de deudas y su historial en una misma escritura. `deshacerUltimoCambio()` valida el estado anterior y añade una reversión con referencia a la operación original. `limpiarHistorialCorrecciones()` comprueba las copias antes de aplicarlas. Las pestañas con datos desactualizados deben recargarse antes de guardar.

## Verificar cambios

```sh
npm install
npx playwright install chromium
npm test
```

Si ya tienes Microsoft Edge, puedes usarlo en PowerShell:

```powershell
$env:BROWSER_CHANNEL = "msedge"
npm test
```

Las pruebas usan datos ficticios y perfiles temporales, sin acceder al almacenamiento de tu navegador habitual.

## Aplicación independiente

Funciona con datos locales, sin cuentas ni sincronización automática. Después de la primera instalación por HTTPS puede abrirse sin conexión. Consulta [instalar en el teléfono](docs/instalar-telefono.md).

`manifest.webmanifest` define la instalación; `sw.js` conserva una versión completa de los archivos; `js/instalacion.js` informa del estado y permite actualizar con confirmación. Los registros financieros se mantienen separados en localStorage.

## Corrección de apartados con dependencias

En **Correcciones e historial → Corregir apartados transferidos o distribuidos**, selecciona el apartado y el importe correcto, prepara la vista previa y revisa la lista completa. Se vuelve al estado previo a las transferencias y se corrige el apartado en una sola escritura. Esto revierte también los cambios posteriores independientes de deudas y grupos mostrados en la lista. Los ingresos, gastos y ahorro se conservan y se comprueba la disponibilidad conjunta.

No se atraviesan pagos confirmados. Tampoco se reconstruyen estados que no estén documentados en el historial. Una vista previa obsoleta se rechaza. La operación queda registrada con motivo y puede deshacerse como último cambio; las entradas originales no se eliminan.


Para actualizar tu copia del código, consulta [docs/actualizar-vscode.md](docs/actualizar-vscode.md).


## Eliminar datos anteriores y seguir guardando
1. Actualiza el código y abre la web en la misma dirección y navegador donde aparecen los registros antiguos.
2. Pulsa **Borrar datos anteriores**, cerca del encabezado.
3. Revisa el resumen y la dirección indicada. Puedes descargar una copia si quieres conservar los registros.
4. Escribe **BORRAR** y pulsa **Eliminar datos de este navegador**.
5. Al recargar verás la confirmación. Los registros nuevos se guardan normalmente y sobreviven a próximas recargas.

La eliminación también funciona con una copia local dañada. No necesita escribir una copia vacía antes de borrar, por lo que puede liberar la copia anterior aunque el almacenamiento no admita nuevas escrituras. Si el navegador impide eliminarla, se muestra el error y no se reinicia la aplicación. Tras eliminar, otras pestañas con registros anteriores quedan bloqueadas para evitar que vuelvan a guardarlos.

El almacenamiento pertenece a una dirección y navegador. Por ejemplo, localhost y 127.0.0.1, puertos diferentes y GitHub Pages pueden tener copias separadas. Abre cada ubicación donde existan registros y repite el borrado con la versión actualizada. La web no puede borrar desde una dirección el almacenamiento de otra ni eliminar tus archivos JSON descargados. Si utilizabas un archivo HTML directamente, abre ese mismo archivo actualizado en el mismo navegador.

Se mantiene el guardado permanente para los datos nuevos; no se incorpora un modo temporal.

Referencia sobre el alcance del almacenamiento: [localStorage en MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

La revisión del borrado pasó 59 pruebas de integración, incluidas eliminación de datos corruptos, error de permisos, almacenamiento sin capacidad de escritura, pestañas antiguas y persistencia de ingresos nuevos.


## Mejoras de uso diario
La [guía de las seis mejoras](docs/mejoras-uso.md) explica dónde encontrar cada función y sus límites.

| Función | Ubicación |
| --- | --- |
| Corregir o anular ingresos | Ingresos → Ingresos registrados |
| Historial y buscador | Ingresos → Cada movimiento, en su lugar |
| Resumen mensual o por pago | Ingresos → Cada movimiento, en su lugar |
| Vencimientos | Deudas → Fechas de tus deudas |
| Metas personales | Ahorro → Dale un destino a tu ahorro |
| Gastos recurrentes | Gastos → Tus gastos recurrentes |

Los ingresos utilizados conservan su importe y reparto; se permite corregir referencia, fecha y periodo. Los ingresos sin referencias pueden cambiar su importe/reparto o anularse con motivo. Las metas no duplican el ahorro y las recurrencias solo descuentan cuando se confirma cada pago. Los registros antiguos sin fecha se conservan como tales.

## Próximos trabajos
- Validar instalación, cierre y reapertura sin conexión en el teléfono real.
- Automatizar pruebas y ampliar cobertura de navegadores.
- Reducir el crecimiento del historial para uso prolongado.
- Mejorar correcciones relacionadas conservando cambios posteriores independientes.
- Evaluar avisos fuera de la aplicación según las capacidades del navegador.

Las cuentas y la sincronización automática quedan fuera del alcance elegido. Excel no forma parte de este flujo.

## Actualización e historial compacto
El botón de actualización conserva la referencia de la versión preparada y comprueba su estado al confirmar. Si no termina, informa del problema y permite reintentar sin borrar registros. Cancelar conserva el formulario abierto.

La [guía del historial compacto](docs/historial-local.md) explica la reducción de repeticiones en el almacenamiento y la compatibilidad de las copias completas versión 8. No se elimina historial.

Referencia del ciclo de actualización: [Service Workers en MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

Esta revisión verificó 86 escenarios de integración, incluidos actualización, cancelación, reducción del historial, recarga, importación de copias completas, rechazo de datos inválidos y fallo de escritura. En el escenario de 30 cambios, la representación compacta reduce más del 30 % del texto almacenado; el ahorro real depende de los datos.

La configuración de GitHub Pages, la comprobación en el teléfono y la automatización de pruebas quedan aplazadas. El trabajo de almacenamiento es parcial: falta reducir el crecimiento a largo plazo y el uso de memoria.
