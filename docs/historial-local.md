# Historial local compacto

El historial sigue conservando todos los cambios, estados anteriores, resultados, motivos y correcciones. No se recorta por antigüedad ni se borran pagos.

## Qué ocupa menos espacio
En una secuencia de cambios, el estado final de una entrada coincide con el estado inicial de la siguiente. Al guardar, `js/historial-local.js` omite únicamente ese estado inicial repetido y marca el paquete con `historialCompacto: 1`.
Si dos estados no coinciden, conserva ambos. La primera entrada siempre incluye su estado inicial.

Al cargar, reconstruye cada estado y después aplica las validaciones habituales del historial. Una versión desconocida, un primer estado ausente o una cadena inválida se rechazan. Las copias antiguas sin marcador siguen siendo legibles.

La reconstrucción crea copias independientes: corregir un estado en memoria no altera otra entrada. La escritura sigue siendo única y se comprueba que otra pestaña no haya cambiado los datos.

## Copias de seguridad
Exportar produce el formato completo versión 9, con tarjetas y apartados incluidos. Importar valida primero la copia y guarda la representación compacta. No necesitas convertir archivos a mano.
Una versión antigua del código no entiende el nuevo formato local; para volver a ella, exporta primero una copia completa con la versión actual.

## Límites
Este paso elimina repeticiones contiguas en disco. No es un sistema de diferencias por campo: el historial sigue creciendo con cada movimiento y continúa reconstruyéndose completo en memoria. La reducción depende de la cantidad y tamaño de las entradas; no cambia la cuota del navegador.
Si falla guardar, se conserva el historial anterior y se informa del fallo. Mantén copias descargadas.

Quedan por estudiar almacenamiento por registros, diferencias entre estados y archivo histórico explícito. Cualquier cambio debe conservar pagos, trazabilidad y correcciones antes de sustituir el formato actual.
