# Seis mejoras para el uso diario

Se conservan las tres pestañas principales y el guardado local. No necesitas crear una cuenta para usar estas funciones.

## 1. Corregir ingresos
En **Ingresos → Ingresos registrados → Corregir o anular un ingreso**, selecciona el pago.

- Si no tiene referencias, puedes cambiar importe y porcentajes; deben sumar 100 %.
- Si tiene gastos, ahorro, apartados o referencias en el historial de deudas, puedes corregir nombre, fecha y periodo. Su importe y reparto quedan protegidos.
- Anular un ingreso sin referencias lo retira del saldo activo y conserva una copia del registro con motivo en el historial.
- También se consideran referencias los gastos y aportaciones anulados: no se borran para permitir una anulación incompatible.
- Cambiar el periodo no multiplica ni repite el sueldo; describe el pago recibido.
- No se borra el historial de deudas para liberar una nómina artificialmente.

## 2. Consultar la actividad
En **Ingresos → Cada movimiento, en su lugar → Historial unificado y búsqueda**:
- Busca conceptos, referencias y acreedores.
- Filtra por tipo, ingreso de origen, presupuesto, estado y fechas.
- Se muestran 40 resultados y puedes solicitar más.
- Los registros anteriores sin fecha siguen visibles sin filtros de fechas. No se les asigna una fecha inventada.
- Para ingresos, ahorro con identificador, apartados vinculados y pagos puedes completar o corregir su fecha desde la fila.
- Las correcciones se distinguen de los movimientos monetarios. Una transferencia interna no aparece como otro ingreso ni otro gasto.
- El historial refleja el estado actual, incluidas anulaciones; no es un estado de cuenta bancario ni un registro inalterable.

## 3. Vencimientos
En **Deudas → Fechas de tus deudas**, asigna una fecha a cada deuda pendiente.
Se muestran primero las que tienen vencimiento, con indicaciones para vencidas, hoy y próximos siete días.
Puedes cambiar o quitar la fecha. El aviso no añade intereses, cargos ni registra un pago.
El pago continúa requiriendo reunir el total y confirmarlo después de realizarlo. Los avisos aparecen al consultar la web; todavía no hay notificaciones fuera de ella.

## 4. Resumen por mes o por pago
En **Ingresos → Cada movimiento, en su lugar → Resumen por mes o por pago**:
- **Movimientos del mes**: ingresos, gastos, aportaciones y retiros de ahorro, apartados y pagos con fecha en ese mes. Excluye los anulados y los registros sin fecha; informa cuántos siguen sin fechar.
- **Uso de un ingreso**: importe, gastos, ahorro destinado, deudas destinadas y disponible de una nómina, aunque se hayan utilizado en distintos meses.

No sumes apartado y pago como dos salidas del mismo dinero. Tampoco es correcto llamar saldo bancario a la resta de las tarjetas mensuales: faltan movimientos externos que la aplicación no conoce. Los registros antiguos sin identificador de ahorro o sin origen de nómina permanecen en sus saldos originales; no se inventa su trazabilidad.

## 5. Metas de ahorro
En **Ahorro → Dale un destino a tu ahorro**, crea o edita nombre y objetivo. Puedes archivar metas sin saldo y reactivarlas.

El dinero de una meta forma parte del ahorro personal total. Aportar a una meta consume el presupuesto de ahorro de una nómina; retirar reduce solo el saldo de ese destino. No devuelve disponibilidad a la nómina original.

El formulario de ahorro permite elegir **Ahorro general** o una meta activa. También puedes reclasificar movimientos existentes con identificador desde **Asignar ahorro ya registrado**. Se comprueba que no quede saldo negativo en ningún punto del historial de cada destino, no solo en el total final. Por ello puede ser necesario corregir o reclasificar primero un retiro relacionado. Los movimientos antiguos sin identificador permanecen en ahorro general.

## 6. Gastos recurrentes
En **Gastos → Tus gastos recurrentes**, elige una categoría ya creada, importe, primera fecha y frecuencia semanal, cada 14 días, mensual o anual.

- Crear la programación no consume dinero.
- Cuando llega la fecha, elige el ingreso de origen, la fecha real y pulsa **Confirmar pago**.
- Se registra un gasto y su confirmación en una misma escritura, validando el disponible.
- Una ocurrencia no puede pagarse dos veces. Las programaciones activas exactamente iguales también se rechazan.
- Puedes omitir una ocurrencia sin gasto, pausar y reanudar.
- Al reanudar se conserva la siguiente ocurrencia pendiente; no se cobran atrasos automáticamente.
- Para cambiar importe o calendario, pausa la programación anterior y crea otra.
- Los meses cortos usan su último día y luego recuperan el día original: enero 31 → febrero 28/29 → marzo 31.
- Un gasto confirmado se anula desde su historial de gastos. La confirmación permanece marcada como gasto anulado y no se recrea automáticamente.

## Guardado y compatibilidad
Las copias nuevas usan la versión 8. Las versiones 1 a 7 siguen siendo compatibles y comienzan con los nuevos paneles vacíos cuando no contienen esos datos.
La sección `mejoras` almacena fechas, vencimientos, metas, destinos de ahorro, programaciones, ingresos anulados y correcciones de ingresos.
El borrado total elimina también estos datos.

El funcionamiento es local. Exporta una copia JSON para trasladar registros a otro dispositivo; importar reemplaza la copia local y no mezcla historiales.

## Organización técnica
- `js/datos-mejoras.js`: validación, fechas y cambios completos con restauración si falla el guardado.
- `js/ingresos-edicion.js`: dependencias, edición y anulación de ingresos.
- `js/metas-recurrentes.js`: metas, calendario recurrente y vencimientos.
- `js/actividad.js`: historial derivado, búsqueda y resumen mensual.
- `js/paneles-mejoras.js`: construcción de controles, tarjetas y eventos.
- `css/mejoras.css`: presentación adaptable y transiciones suaves.

El historial se calcula una vez durante el refresco conjunto y se reutiliza para la vista y el resumen. Los importes siguen almacenándose en centavos enteros. No se incorporaron frameworks ni dependencias de producción.

Las animaciones respetan la preferencia de movimiento reducido del dispositivo. Referencias: [preferencia de movimiento reducido](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion), [campos de fecha](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date).
