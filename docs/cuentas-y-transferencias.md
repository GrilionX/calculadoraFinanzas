# Cuentas y transferencias

## Empezar

1. Descarga una copia JSON en **Datos y copias**.
2. Abre **Ingresos → Cuentas y efectivo**.
3. Pulsa **Agregar cuenta**. Escribe un nombre propio, elige efectivo o débito e introduce el saldo que tienes y su fecha.
4. Añade la segunda cuenta para poder transferir.
5. En **Transferir**, elige origen, destino, monto, fecha y concepto. La vista previa muestra los saldos resultantes.
6. Revisa **Movimientos de cuentas**.

Registrar un saldo inicial no crea una nómina. Una transferencia no es un gasto. El total de cuentas no se añade al ahorro ni a los apartados: describe dónde está el dinero, no para qué está reservado.

## Corregir y conservar el historial

- **Editar nombre** cambia la etiqueta sin modificar los movimientos.
- **Conciliar saldo** registra el saldo real observado y un motivo; conserva el saldo anterior en el historial. No genera ingresos ni gastos. Por ahora debes mantener también los registros de gastos e ingresos: aún no se vinculan automáticamente con estas cuentas.
- **Revertir** una transferencia devuelve el mismo monto al origen, previa confirmación Sí/No. Conserva ambos movimientos y solo puede hacerse una vez; requiere saldo suficiente en el destino original.
- **Archivar** requiere saldo cero. Una cuenta archivada no se puede utilizar; puedes reactivarla.
- **Eliminar** solo aparece para cuentas creadas con cero y sin movimientos; solicita Sí/No.
- El borrado total de **Datos y copias** también elimina cuentas y movimientos. Las copias descargadas se conservan fuera de la aplicación.

## Reglas de esta versión

Importes en centavos enteros y totales dentro del rango seguro. No se admiten sobregiros, origen igual a destino, nombres duplicados, fechas futuras ni movimientos anteriores al último registrado o a la apertura de sus cuentas. Las operaciones se validan y guardan juntas; si falla el almacenamiento, se restaura el estado anterior.

Cada transferencia tiene un identificador para rechazar envíos repetidos. La conciliación comprueba que su saldo de partida siga siendo el esperado. Otra pestaña con datos antiguos debe recargarse antes de guardar.

Las copias anteriores abren esta sección vacía: no se inventan cuentas ni se convierten tus nóminas o apartados. Las copias nuevas incluyen la cartera completa. No se guarda información en GitHub.

## Ajustes desde el código

- **js/cuentas.js**: reglas, validación, saldo derivado y operaciones; REGLAS_CUENTAS define cantidad máxima de cuentas y longitudes de texto.
- **js/cuentas-ui.js**: formularios, vista previa e historial.
- **css/cuentas.css**: distribución adaptable y transiciones; respeta movimiento reducido.
- **js/gestion.js**: incorpora cartera al mismo paquete de datos que tarjetas y apartados.
- **js/navegacion.js**, **index.html** y **sw.js**: ruta, carga y disponibilidad sin conexión.
- **tests/finanzas.test.cjs**: casos de transferencia, reversión, conciliación, copias, fallo de escritura y borrado.

Los límites del código no son permisos de servidor: es una aplicación local sin usuarios ni cuentas de acceso. No reduzcas límites por debajo de los datos existentes sin preparar una migración.

## Pendiente dentro del alcance acordado

Vincular ingresos, compras y pagos con cuentas; editor de subpresupuestos; calendario integrado; cierre mensual general persistido e idempotente; cashback recibido, pendiente, cancelado y su reversión; editor de gasto dividido; proyección visual. El módulo de dominio preparado sirve como base, pero no constituye una interfaz terminada.

La instalación y el uso sin conexión todavía deben verificarse en el teléfono real. La activación de GitHub Pages requiere acceso a la configuración del repositorio.
