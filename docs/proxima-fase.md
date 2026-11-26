> Actualización: cuentas de efectivo/débito y transferencias ya tienen interfaz, persistencia y pruebas. Consulta [Cuentas y transferencias](cuentas-y-transferencias.md). Los contratos siguientes para compras, cashback y demás funciones siguen siendo preparación; todavía no actualizan las cuentas desde sus pantallas.

# Próxima fase: base preparada, integración pendiente

## Alcance de esta entrega
Se completan las comprobaciones de instalación y se publica una guía. El módulo de dominio es una preparación comprobable, todavía sin carga desde index.html y sin cambios de esquema de las copias actuales. No hay funciones financieras nuevas a medio activar.

## Separar cuatro conceptos
1. Cuenta: dónde está el dinero o cuánto crédito se debe.
2. Presupuesto: para qué se asignó el dinero.
3. Movimiento: qué ocurrió realmente.
4. Proyección: qué podría ocurrir; nunca altera el saldo guardado.

Una transferencia banco → efectivo cambia la ubicación, no el gasto. Una compra a crédito genera gasto y deuda; pagar esa tarjeta reduce dinero y deuda, sin repetir el gasto. El cashback confirmado es una recompensa distinta del sueldo; el pendiente no aumenta el disponible.

## Contrato del módulo
Archivo: js/dominio/base-financiera.mjs. Importaciones ES, sin DOM, red ni localStorage. Todos los importes son enteros seguros en centavos; MXN es la única moneda admitida. Fechas civiles ISO YYYY-MM-DD; no se interpretan como instantes del huso horario.

Cuenta: id, nombre, tipo (efectivo/debito/credito), moneda, saldoInicialCentavos y, para crédito, limiteCentavos (null si no se configuró). El saldo de crédito positivo representa deuda y el negativo representa saldo a favor.

Movimiento: id, tipo, concepto, fecha, estado (pendiente/confirmado), totalCentavos. Según el tipo:
- ingreso/cashback: destinoId; cashback exige referencia única por destino.
- gasto: partidas por categoriaId y pagos por cuentaId; ambos desgloses suman el mismo total.
- transferencia/pago_tarjeta: origenId y destinoId distintos. El origen es efectivo o débito.
Los efectos sobre cuentas siempre se recalculan. El importe recibido del formulario nunca define sus propios efectos.

Un cashback pendiente se confirma modificando el mismo registro, no añadiendo otro con la misma referencia. Las referencias y los IDs duplicados se rechazan. El cashback en crédito puede dejar saldo a favor; la integración deberá mostrarlo separado de la línea de crédito.

## Funciones comprobadas
- centavos / fechaCivil / repartirCentavos: validación y redondeo exacto por mayor resto.
- prepararMovimiento: normalización y efectos derivados.
- calcularCuentas: saldos de movimientos confirmados, disponible y saldo a favor.
- comprobarNuevaOperacion: rechaza una salida nueva sin saldo y una compra que exceda el crédito.
- resumirPresupuestos: gasto por categoría dentro de un intervalo; no añade pagos de tarjeta.
- crearCalendario: ordena vencimientos explícitos sin pagarlos.
- prepararCierre: vista previa sin escritura; siempre requiere confirmación.
- proyectarLiquidez: serie estimada de entradas/salidas futuras, incluido el mínimo.

calcularCuentas permite representar saldos históricos negativos y exceso de crédito para poder revisarlos; comprobarNuevaOperacion es la puerta para nuevas salidas. La integración deberá aplicar además reglas de fecha, referencias a compras, cuenta archivada y auditoría de cambios retroactivos.

## Orden de integración
1. Cuentas + transferencias (1 y 2): vista de mapeo de saldos existentes. Nada de sumar reservas como si fueran dinero nuevo. Mantener separación efectivo/debito/credito.
2. Compras + divisiones + cashback (3, 9 y 8): una operación y sus partes se guardan juntas. Cashback solo cuando el abono sea real; no se estima automáticamente a partir de una tasa.
3. Subpresupuestos + calendario (4 y 5): conectar IDs de categorías y recurrencias ya existentes. Un vencimiento no ejecuta un pago.
4. Cierre + proyección (6 y 11): confirmar cada periodo una vez, conservar detalle y diferenciar cifras reales/estimadas.

## Antes de activar almacenamiento nuevo
- Exportar y validar una copia de la versión actual.
- Diseñar un campo de versión nuevo y un adaptador explícito; no cambiar el formato actual silenciosamente.
- Mostrar qué se puede vincular y qué queda sin cuenta/fecha. El usuario decide.
- Guardar toda la conversión de forma atómica; ante error, conservar datos originales.
- Mantener importación de copias antiguas y probar recarga, borrado y dos pestañas.
- Bloquear registros duplicados con IDs estables, incluso tras doble toque.
- No conectar el módulo a la UI hasta terminar formularios, validación, persistencia y pruebas completas.

## Criterios de aceptación por escenario
- Retirar 200 del cajero: banco -200, efectivo +200, gasto 0.
- Compra 100 con 40 en efectivo y 60 en tarjeta: gasto 100, efectivo -40, deuda +60.
- Pagar esos 60: banco -60, deuda -60, ningún gasto nuevo.
- Cashback pendiente 10: disponible sin cambios. Confirmado: +10 en débito o -10 en deuda; sueldo sin cambios.
- Dividir 100.00 entre tres destinos: 33.34 + 33.33 + 33.33.
- Internet con presupuesto 300 y gasto 350: restante -50, sin ocultar el exceso.
- Cerrar un mes dos veces: la segunda confirmación no crea movimientos.
- Proyectar una salida futura: el saldo real guardado permanece igual.

## Límites de la preparación
No están implementados los formularios de cuentas, el almacenamiento del nuevo registro, el calendario visual, el cierre global persistente ni las recompensas automáticas. Las funciones actuales de gastos, cierres por apartado, tarjetas, ahorro y fondos siguen funcionando como antes.
