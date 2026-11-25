# Navegación lateral y crédito

## Navegación
El menú está a la izquierda. En escritorio permanece visible; en pantallas de hasta 900 px se abre con **Secciones**.

- Ingresos: Ingresos y reparto, Mis gastos y Destino de mis ingresos.
- Ahorro: Ahorro personal, Fondo de emergencia y los fondos de cada apartado.
- Deudas: Deudas generales, Acreedores y Tarjetas de crédito.

Las ramas se abren de forma independiente: abrir una no cierra las demás. Los enlaces conservan Atrás/Adelante y pueden abrirse directamente. En celular se puede cerrar con el botón, tocando fuera o con Escape. El teclado queda dentro del panel mientras está abierto y vuelve al botón al cerrarlo.

Los fondos de emergencia toman su saldo de los cierres de los apartados con medio Tarjeta. No se duplica dinero ni se precargan Gas o Internet. **Añadir fondo** abre el formulario de un apartado: el usuario elige nombre, importe por periodo y tasa; recibe excedentes al cerrar el mes. Los apartados de efectivo mantienen su destino Ahorro en efectivo.

## Tarjetas
Cada tarjeta permite configurar o editar:
- Nombre.
- Límite de crédito; vacío significa sin configurar y cero significa sin crédito disponible.
- Día mensual de corte (1–31).
- Día mensual de pago (1–31).

Crédito usado es la suma pendiente de las compras registradas. Los pagos reducen esa suma y liberan crédito. Una nueva compra que exceda el disponible se rechaza. Se puede bajar el límite por debajo de la deuda existente: se conserva la deuda y se muestra el exceso.

El mes seleccionado representa el mes de corte. Si el día de pago es igual o anterior al de corte, la fecha de pago se muestra en el mes siguiente. Los días que no existen se ajustan al último día del mes, incluido febrero bisiesto. No se ajustan festivos ni se recalculan las cuotas existentes al editar fechas.

Los límites y fechas son opcionales para las tarjetas antiguas. Se guardan en las copias junto a compras y pagos; importar no inventa límites. Cambiar la configuración no registra gastos ni modifica el saldo de los ingresos.

## Diseño
Panel de ramas con animación breve, estado activo y foco visible. Se respeta la preferencia de movimiento reducido.
Referencia de interacción: [patrón de navegación desplegable de W3C](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/).

La navegación ahora abre vistas independientes; consulta [dashboard](dashboard.md).
