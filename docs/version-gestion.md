# Versión de tarjetas y apartados
## Probar la versión
1. Descarga el código completo de la revisión y abre la carpeta en VS Code.
2. Ejecuta `node scripts/servir.cjs` y abre http://127.0.0.1:5173.
3. Si ya hay una versión instalada, usa Buscar actualización y confirma Aplicar actualización disponible. Conserva antes una copia de tus datos.

## Cambios de esta versión
- Cuatro categorías iniciales: básicos, ocio, deudas y ahorro. Los porcentajes deben sumar 100.
- Los saldos de la categoría retirada se convierten en Por reasignar. En Apartados básicos puedes elegir su destino si ese saldo no tiene movimientos vinculados. No se borra dinero del historial.
- Borrados con Sí / No. Las anulaciones conservan su rastro interno sin pedir un motivo escrito.
- Tarjetas en Deudas: nombre, compras/saldos, cuotas, pagos vinculados a ingresos y pendiente acumulado al mes seleccionado. Una compra con un mes representa pago único. No se aplican cargos ni intereses de la tarjeta automáticamente.
- Apartados en Ingresos: importe por periodo, aportes reales del presupuesto básico, gastos del mes y excedente. Registrar un ingreso no crea aportes por sí solo; elige el ingreso y confirma cada aporte.
- Cerrar mes envía el excedente a Fondo de emergencia o Ahorro en efectivo. Cerrar dos veces el mismo mes se rechaza. Los registros del mes cerrado quedan protegidos de cambios parciales.
- La tasa es anual efectiva y solo proyecta el importe a 12 meses. No registra ganancias reales.
- Las copias nuevas son versión 9. Las anteriores siguen admitidas. El borrado total incluye tarjetas, apartados, pagos y cierres.

## Casos para revisar
- Gas con tarjeta: dos aportes de 150, gasto de 200, cierre con 100 en Fondo de emergencia.
- Repetir como efectivo: los 100 van a Ahorro en efectivo.
- Compra de 1000 a tres meses: 333.33, 333.33 y 333.34. Probar abono parcial y liquidación.
- Intentar apartar o pagar más de lo disponible: se rechaza sin cambiar datos.
- Cambiar tasa de 12 a 24: cambia la proyección, no el saldo.
- Borrar con No y después con Sí.
- Exportar, recargar e importar: comprobar los mismos saldos.

Los pagos de tarjeta consumen el presupuesto elegido. Los gastos dentro de un apartado consumen su reserva, sin descontar otra vez del ingreso. El resumen por ingreso muestra todo lo destinado a apartados; el resumen mensual muestra los gastos efectivamente registrados. Evita registrar el mismo gasto también en el gestor general.

Eliminar una tarjeta o un apartado elimina sus movimientos asociados y recalcula sus saldos. La confirmación lo indica. Una copia descargada permite recuperar el estado previo.
