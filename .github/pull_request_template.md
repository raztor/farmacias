## Qué cambia y por qué

<!-- Resumen breve del cambio y del problema que resuelve. Enlaza el issue: "Closes #123". -->

## Tipo de cambio

- [ ] `feat` — nueva funcionalidad
- [ ] `fix` — corrección de error
- [ ] `refactor` / `perf` — sin cambio de comportamiento visible
- [ ] `chore` / `ci` / `docs` / `test`

## Checklist

Ver [docs/REPO_RULES.md](../docs/REPO_RULES.md).

- [ ] `pnpm check` pasa localmente (formato, dependencias, nombres, arquitectura, lint, typecheck y tests).
- [ ] Agregué o actualicé **tests** (todo `*.service.ts` tiene tests; flujos críticos de admin y de la web de la app con Playwright en `apps/e2e`).
- [ ] Agregué un **changeset** (`pnpm changeset`) si el cambio es visible para usuarios, o no aplica.
- [ ] No hay `eslint-disable`, `@ts-ignore`, `console.*` ni límites de código saltados.
- [ ] Si cambié una regla del repo, incluí un ADR en `docs/adr/`.
- [ ] Si agregué una migración de Prisma, es compatible con la versión desplegada (sin pasos destructivos sin plan).
- [ ] Actualicé la documentación (`README.md`, `docs/ARCHITECTURE.md`) si corresponde.

## Nueva dependencia (borrar si no aplica)

Requerido por [REPO_RULES §4](../docs/REPO_RULES.md#4-dependencias-):

- **Paquete y versión (catálogo):**
- **Para qué sirve:**
- **Alternativas consideradas (incluida "no agregar nada"):**
- **Tamaño / impacto en el bundle:**
- **Estado de mantenimiento (últimas versiones, issues, licencia):**

## Capturas de pantalla (cambios de UI)

<!-- Antes / después en admin y en la app (web, iOS y Android si aplica). Borrar si no aplica. -->

| Antes | Después |
| ----- | ------- |
|       |         |

## Cómo probarlo

<!-- Pasos para que quien revisa verifique el cambio. -->
