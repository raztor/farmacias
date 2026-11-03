# Guía de contribución

Antes de empezar, lee las [reglas del repositorio](docs/REPO_RULES.md) y la [arquitectura](docs/ARCHITECTURE.md). Las reglas marcadas con 🔒 se verifican automáticamente y bloquean el merge.

## Flujo de trabajo

```
rama  →  commits  →  pnpm check  →  PR  →  CI en verde + 1 aprobación  →  merge a main
```

1. **Rama** desde `main` actualizada: `feat/<descripcion>`, `fix/<descripcion>` o `chore/<descripcion>`.

   ```bash
   git switch main && git pull
   git switch -c feat/perfil-de-usuario
   ```

2. **Commits** con [Conventional Commits](https://www.conventionalcommits.org/es/) (lo valida commitlint en el hook `commit-msg`):

   ```
   feat(api): agrega endpoint para actualizar el perfil
   fix(mobile): corrige el cierre de sesión en Android
   chore(deps): actualiza Prisma a 7.10.2
   ```

   - Tipos: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `ci`, `build`, `style`, `revert`.
   - Scope = nombre corto del workspace (`server`, `admin`, `mobile`, `api`, `ui`, `e2e`…) o del área (`ci`, `docker`, `deps`, `repo`, `tooling`). Ver la lista en [`commitlint.config.js`](commitlint.config.js).
   - Encabezado de máximo 100 caracteres.
   - El hook `pre-commit` formatea con Prettier los archivos staged y revisa los nombres de archivos.

3. **Verifica localmente** antes de subir (el hook `pre-push` corre lint y typecheck de lo afectado):

   ```bash
   pnpm check
   ```

4. **Changeset** si el cambio es visible para usuarios: `pnpm changeset` (ver [`.changeset/README.md`](.changeset/README.md)).

5. **Pull Request** hacia `main` completando la plantilla. Ideal: menos de 400 líneas cambiadas y un solo cambio coherente.

6. **CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) ejecuta formato, `check:deps`, `check:naming`, `check:arch`, lint, typecheck, tests y build de los workspaces afectados; además E2E con Playwright (admin y web de la app, en `apps/e2e`), build de las imágenes Docker (incluida la web de la app) y un export Android de la app.

> Nunca saltes los hooks (`--no-verify`) ni desactives reglas con `eslint-disable`. Si una regla no tiene sentido, propón el cambio con un ADR ([docs/adr](docs/adr/README.md)).

## Agregar una dependencia

Toda dependencia externa vive en el **catálogo** de `pnpm-workspace.yaml`: una sola versión por librería en todo el repo.

1. **¿Hace falta?** Revisa si ya existe algo equivalente en el catálogo o en la plataforma (Node, React Native, zod…). Revisa la lista de paquetes prohibidos en [`tooling/scripts/src/policy.ts`](tooling/scripts/src/policy.ts).
2. **Agrega la versión al catálogo** en la sección que corresponda de `pnpm-workspace.yaml`:

   ```yaml
   catalog:
     date-fns: ^4.1.0
   ```

3. **Úsala desde el workspace** (pnpm solo acepta versiones del catálogo, `catalogMode: strict`):

   ```bash
   pnpm --filter @repo/admin add date-fns    # escribe "date-fns": "catalog:"
   ```

   Las dependencias internas usan `"workspace:*"`.

4. **Verifica la política:** `pnpm check:deps` (límite de dependencias por workspace, catálogo, entradas sin uso).
5. **Justifica en el PR** (sección "Nueva dependencia" de la plantilla): para qué sirve, alternativas consideradas, tamaño e impacto en el bundle, estado de mantenimiento y licencia.

Si el paquete necesita scripts de instalación (`postinstall`), debe agregarse a `allowBuilds` en `pnpm-workspace.yaml` con un comentario que lo justifique. pnpm no instala versiones publicadas hace menos de 3 días (`minimumReleaseAge`).

## Agregar un módulo a la API

Los módulos viven en `packages/api/src/modules/<modulo>/`:

```
packages/api/src/modules/invoice/
├── index.ts                  # API pública: exporta el router y los tipos
├── invoice.router.ts         # Procedimientos tRPC: validan input y delegan al servicio
├── invoice.service.ts        # Lógica de negocio; recibe dependencias por parámetro
├── invoice.repository.ts     # Único archivo con acceso a Prisma
├── invoice.schema.ts         # Schemas zod de entrada/salida
└── invoice.service.test.ts   # Tests del servicio con repositorio falso
```

Pasos:

1. Define los schemas zod en `invoice.schema.ts` (reutiliza los de `@repo/shared` cuando existan).
2. Escribe el repositorio (Prisma) y el servicio. Los errores de dominio se lanzan como `AppError` de `@repo/shared`.
3. Expón los procedimientos en `invoice.router.ts` usando `publicProcedure`, `protectedProcedure` o `adminProcedure`.
4. Exporta el router desde `index.ts` y regístralo en `appRouter`.
5. Agrega tests del servicio (`invoice.service.test.ts`) y, si aplica, tests con `createCaller`.

Reglas (dependency-cruiser): `router → service → repository`; solo `*.repository.ts` importa valores de `@repo/db`; un módulo usa otro solo vía su `index.ts`.

## Agregar una feature a una app

Las features viven en `apps/<app>/src/features/<feature>/`:

```
apps/mobile/src/features/profile/
├── index.ts                  # API pública de la feature
├── profile-form.tsx          # componentes
├── profile-card.tsx
├── use-update-profile.ts     # hooks (prefijo `use-`)
└── profile.schema.ts         # (opcional) schemas del formulario
```

- Las features son planas (sin subcarpetas `components/` ni `hooks/`) para respetar el máximo de 2 niveles de `../` en los imports (ver [REPO_RULES §3.4](docs/REPO_RULES.md)).

- Las rutas (`src/app/**`) son delgadas: importan desde `features/<feature>` (su `index.ts`) y componen la pantalla.
- Una feature usa otra solo a través de su `index.ts`.
- Los componentes reutilizables entre apps van a `@repo/ui` con su `*.stories.tsx`.
- Textos de UI en español (Chile); código y comentarios en inglés.

## Agregar una migración de base de datos

1. Edita `packages/db/prisma/schema.prisma` (tablas en snake_case con `@@map`).
2. Con los servicios arriba (`pnpm dev:services`), crea la migración con un nombre descriptivo:

   ```bash
   pnpm db:migrate --name add_invoice_table
   ```

   Esto genera `packages/db/prisma/migrations/<timestamp>_add_invoice_table/migration.sql` y regenera el cliente.

3. Revisa el SQL generado. Para cambios que rompen compatibilidad (renombrar o borrar columnas), divide el cambio en varias migraciones (expandir → migrar datos → contraer), porque en producción la migración corre **antes** de desplegar las apps.
4. Commitea `schema.prisma` y la carpeta de la migración juntos.
5. En producción se aplican con `pnpm db:deploy` (job `migrate`). Las apps nunca migran al iniciar.
