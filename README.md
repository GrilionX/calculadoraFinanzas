# Calculadora de finanzas personales

Aplicación estática en español: presupuesto, ahorro personal, nóminas variables, deudas individuales, fondos por grupo y proyección. Cada usuario introduce sus datos; no incluye deudas personales precargadas.

## Ejecutar en tu ordenador

Desde la carpeta del repositorio, con Node.js instalado:

```sh
node scripts/servir.cjs
```

Abre http://127.0.0.1:5173. No necesitas instalar dependencias para usar la aplicación. El servidor solo sirve los archivos en tu ordenador; no es una API ni una base de datos. Detén el servidor con Ctrl+C.

Los datos se guardan en el navegador, no en GitHub. Usa siempre la misma dirección y navegador. Cambiar de dirección, puerto o navegador muestra un almacenamiento diferente: exporta una copia JSON e impórtala en la nueva ubicación para trasladar tus datos.

## Correcciones e historial

El panel registra los nuevos cambios de deudas y grupos. Permite deshacerlos del más reciente al más antiguo, con una vista previa y un motivo obligatorio. La operación original y su corrección permanecen en la copia de seguridad.

- Deshacer un apartado libera su importe en la nómina y categoría de origen.
- Deshacer una distribución devuelve el dinero al fondo; no libera nuevamente la nómina.
- Deshacer una modalidad restaura la modalidad y las reservas anteriores.
- Los pagos confirmados son un límite: no se deshacen ni se puede retroceder a operaciones anteriores a ellos.
- Los movimientos previos a esta versión se conservan, pero no tienen un estado anterior reconstruible para deshacerlos.
- El ahorro personal no se modifica al corregir una deuda.

Se muestran los últimos 30 registros, pero se guarda el historial completo. Esta primera versión guarda estados completos antes y después: el espacio utilizado crece con el historial. Si el navegador no puede guardar, se rechaza el cambio de deudas y se muestra un aviso. Descarga copias periódicamente. Este historial local no es un registro inalterable ni sustituye los comprobantes de pago.

Las copias nuevas usan la versión 4. Se siguen leyendo las versiones 1, 2 y 3. El borrado total elimina también el historial, conserva otras claves del navegador y requiere escribir BORRAR. Las copias descargadas no se borran.

## Archivos

```text
index.html                 Interfaz y orden de carga
css/styles.css             Estilos
js/calculos.js             Operaciones monetarias y reparto
js/nominas.js              Registro de nóminas
js/deudas.js               Deudas, grupos y horizonte
js/fondos.js               Fondos, asignaciones y modalidades
js/origenes.js             Vínculo de apartados con nóminas
js/correcciones.js         Validación, historial y reversión
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

## Pendientes

Profundizar en correcciones selectivas y ajustes de objetivos; añadir gastos reales vinculados a nóminas, subcategorías y administración de grupos; después mejorar diseño y accesibilidad. Cuentas, sincronización y una API quedan para una fase posterior. Excel queda fuera del alcance acordado.
