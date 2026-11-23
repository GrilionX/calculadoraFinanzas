# Activar cuentas y sincronización
El código está preparado, pero la conexión viene desactivada. El modo local y las copias JSON siguen funcionando sin cuenta.

GitHub almacena los archivos de la web. Supabase almacenará las cuentas y las copias privadas. Nunca subas una copia de tus finanzas al repositorio público.

## 1. Crear el servicio
1. Crea un proyecto en [Supabase](https://supabase.com/dashboard).
2. Guarda la contraseña de la base de datos en tu gestor de contraseñas; no va en JavaScript.
3. En SQL Editor ejecuta una sola vez el contenido de `supabase/migrations/001_sincronizacion.sql`.
4. Ejecuta `supabase/tests/seguridad.sql`. Comprueba que termine sin errores: ensaya dos usuarios, acceso anónimo, escrituras directas y revisión obsoleta. La transacción se revierte al terminar y no guarda esas cuentas de prueba. Si falla, no habilites la conexión hasta resolverlo.

La tabla tiene una copia por usuario. La lectura usa Row Level Security. Las escrituras directas están revocadas: la función de guardado obtiene el usuario de la sesión y compara la revisión dentro de la misma operación. La función no acepta un identificador de otra persona. Su privilegio elevado está limitado mediante usuario autenticado, nombres de tablas completos, search_path vacío y permisos de ejecución restringidos.

## 2. Preparar las cuentas
En Authentication:
- Habilita el proveedor Email y la confirmación del correo.
- Configura Site URL con la dirección pública de tu web y permite solo las direcciones de redirección que uses.
- Configura envío de correo para tus usuarios. El servicio de correo de pruebas puede tener restricciones; consulta la configuración de SMTP antes de abrir registros al público.
- Establece una política de contraseña de al menos 12 caracteres.

Esta versión ofrece registro, confirmación por correo, inicio y cierre de sesión. Las sesiones se mantienen únicamente en memoria y terminan al recargar. No hay restauración silenciosa de sesión, recuperación de contraseña dentro de esta web, ni administración de cuentas desde la interfaz todavía.

## 3. Conectar la web
En las opciones de conexión del proyecto copia la URL y la clave **publishable**. Edita `js/configuracion.js`:

```js
window.FINANZAS_NUBE = Object.freeze({
    url: "https://TU-PROYECTO.supabase.co",
    clavePublica: "sb_publishable_TU_CLAVE_PUBLICA"
});
```

La URL debe ser el origen del proyecto, sin rutas. La clave pública puede estar en el código: la seguridad depende de la sesión y de las políticas de la base de datos. No uses claves secretas, service_role ni contraseñas. Esta implementación acepta únicamente el formato publishable para evitar introducir por error una clave privilegiada.

Sube ese archivo a GitHub y espera a que tu alojamiento publique la actualización. GitHub Pages sirve la web, no ejecuta una base de datos ni un servidor Node.js.

## 4. Primer uso con datos ficticios
1. Crea una cuenta, confirma el correo e inicia sesión.
2. Abre **Mi cuenta y sincronización** y pulsa **Comparar con la nube**.
3. En el dispositivo que tiene la versión correcta, pulsa **Enviar esta copia a mi cuenta**.
4. En el otro dispositivo inicia sesión con la misma cuenta, compara y pulsa **Usar la copia de mi cuenta aquí**.
5. Antes del reemplazo se solicita una descarga de la copia local. Verifica que tu navegador la haya descargado; si no, usa primero Descargar copia.
6. Comprueba ingresos, grupos, reservas, ahorro y gastos después de recargar.

La sincronización es manual por copia completa. No suma automáticamente dos versiones distintas. Si ambos dispositivos cambian, consulta y decide cuál conservar, guardando primero las copias de ambos. Si otro dispositivo escribe después de tu consulta, el servidor rechaza la revisión antigua. Si se interrumpe la conexión después de enviar, consulta antes de reintentar para conocer el resultado.

## Datos y límites
- Cerrar sesión conserva los datos locales. En dispositivos compartidos, descarga la copia y usa Empezar de cero antes de cambiar de persona.
- Empezar de cero afecta solo a este navegador; no borra la copia de la nube. Por ahora la eliminación remota se administra desde el proyecto Supabase. Borrar un usuario desde Authentication elimina su copia mediante la relación de la tabla.
- No se envían datos hasta que eliges subirlos. El modo local no requiere red.
- La copia es privada por cuenta, pero no está cifrada de extremo a extremo por esta aplicación.
- La aplicación limita los envíos a aproximadamente 3,5 MB; el servidor admite hasta 4 MB de JSON. El historial completo puede crecer.
- El servidor controla identidad, aislamiento y revisiones; las validaciones de cálculos y formato completo se realizan también en la aplicación antes de enviar o aplicar.
- Una copia inválida, un conflicto o un error de almacenamiento no deben reemplazar los datos locales.

## Verificación
Las pruebas de navegador usan una API simulada para comprobar los flujos del cliente. No acreditan que un proyecto Supabase real esté configurado correctamente. Antes de usar datos reales, ejecuta las pruebas SQL y el recorrido con dos dispositivos y dos cuentas distintas. La migración y las pruebas SQL se entregan pendientes de ejecución en tu proyecto.

## Archivos
- `js/configuracion.js`: conexión pública, vacía por defecto.
- `js/sincronizacion.js`: autenticación, comparación, envío y recuperación.
- `js/app.js`: validación sin modificar el estado mediante `aplicarDatos(datos, true)`.
- `css/cuenta.css`: presentación del panel.
- `supabase/migrations/001_sincronizacion.sql`: tabla, políticas y función de escritura.
- `supabase/tests/seguridad.sql`: comprobaciones de aislamiento y concurrencia.

Referencias: [claves de API](https://supabase.com/docs/guides/getting-started/api-keys), [autenticación con contraseña](https://supabase.com/docs/guides/auth/passwords), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [funciones de base de datos](https://supabase.com/docs/guides/database/functions).
