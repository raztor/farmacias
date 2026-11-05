# Changesets

Esta carpeta guarda los _changesets_: archivos Markdown que describen un cambio y el tipo de versión que implica (`major`, `minor`, `patch`) para cada workspace afectado. Se usan para versionar y generar los `CHANGELOG.md`.

## Cuándo agregar uno

Agrega un changeset en el PR cuando el cambio es **visible para usuarios** (nueva funcionalidad, corrección, cambio de comportamiento de la API). No hace falta para refactors internos, tests, documentación o CI.

```bash
pnpm changeset
```

El asistente pregunta qué workspaces cambiaron, el tipo de versión y un resumen (en español). Se crea un archivo como `.changeset/nombre-aleatorio.md`, que se commitea junto al cambio.

## Paquetes privados

Todos los workspaces son privados (`"private": true`): **se versionan pero no se publican** en npm. La configuración ([`config.json`](config.json)) usa:

- `privatePackages.version: true` → `pnpm changeset version` sube la versión y actualiza el `CHANGELOG.md` de cada workspace.
- `privatePackages.tag: false` → no se crean tags de git por paquete.
- `baseBranch: "main"` → los cambios se calculan respecto de `main`.

## Liberar una versión

```bash
pnpm changeset version   # consume los changesets, sube versiones y escribe los CHANGELOG
git commit -am "chore(repo): version packages"
```

Más información: <https://github.com/changesets/changesets>.
