# Actualizar el proyecto desde VS Code
Git actualiza los archivos del código. No traslada ingresos, deudas ni ahorros entre navegadores; para eso se usa una copia JSON.

## Con el repositorio ya clonado
Abre en VS Code la carpeta que contiene `index.html` y `package.json`. En la terminal:

```powershell
git remote -v
git status --short
git branch --show-current
```

Comprueba que origin corresponde a GrilionX/calculadoraFinanzas. Si el estado no muestra archivos pendientes:

```powershell
git switch main
git pull --ff-only origin main
git log -1 --oneline
```

`--ff-only` detiene la actualización si hay commits locales que divergen de GitHub. No borra esos commits ni crea una mezcla inesperada.

## Si hay cambios locales sin guardar en un commit
Guárdalos temporalmente, incluidos los archivos nuevos no ignorados:

```powershell
git stash push -u -m "Respaldo local antes de actualizar"
git switch main
git pull --ff-only origin main
```

Para revisar el respaldo:

```powershell
git stash list
git stash show --stat 'stash@{0}'
```

Si quieres volver a incorporar esos cambios:

```powershell
git stash apply 'stash@{0}'
```

`apply` conserva el respaldo. Si aparecen conflictos, resuélvelos antes de continuar. No uses `reset --hard` ni borres el respaldo para solucionar un rechazo de pull.

## Abrir la versión actualizada
Con Node.js instalado:

```powershell
node scripts/servir.cjs
```

Abre http://127.0.0.1:5173 y usa **Buscar actualización**, seguido de **Actualizar aplicación** cuando se ofrezca. El comando mantiene el servidor activo; Ctrl+C lo detiene. Usa la misma dirección para conservar el almacenamiento local del navegador.

Referencias: [git pull](https://git-scm.com/docs/git-pull), [git stash](https://git-scm.com/docs/git-stash).

## Publicar cambios de la aplicación instalada
Cuando cambies archivos de la aplicación, incrementa `VERSION` en `sw.js`. Si añades o retiras recursos, actualiza `ARCHIVOS`. Publica juntos el worker y todos sus recursos. La nueva versión solo se ofrece cuando termina de descargarse; confirmarla recarga la página y descarta formularios sin registrar, pero conserva los datos guardados.
