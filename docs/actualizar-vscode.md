# Actualizar desde VS Code



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

