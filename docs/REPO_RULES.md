# Reglas del repositorio

Estas reglas existen para que el monorepo escale sin perder calidad. **Todas las reglas marcadas con 🔒 se aplican automáticamente** (ESLint, TypeScript, `pnpm check:*` o CI) y bloquean el merge. Cambiar una regla requiere un ADR en [`docs/adr`](./adr).

Comando para verificar todo localmente:

```bash
pnpm check
```

---

## 1. Principios

1. **Tipos de punta a punta.** Los clientes (admin y la app Expo en iOS, Android y web) obtienen los tipos de la API desde `@repo/api` (`AppRouter`) sin generar código.
2. **Validar en los bordes.** Todo dato que entra al sistema (HTTP, variables de entorno, jobs de cola, formularios) se valida con `zod`.
3. **Módulos pequeños con API pública explícita.** Cada módulo expone un `index.ts`; el resto es privado.
4. **Una sola versión de cada dependencia** en todo el repo (catálogo de pnpm).
5. **Nada de magia en producción:** migraciones explícitas, configuración por variables de entorno, logs estructurados.

## 2. Límites de código 🔒

Definidos en [`tooling/eslint/limits.js`](../tooling/eslint/limits.js) y aplicados como `error`:

| Regla                                        | Límite | Regla ESLint                    |
| -------------------------------------------- | -----: | ------------------------------- |
| Líneas por archivo (sin blancos/comentarios) |    300 | `max-lines`                     |
| Líneas por función / componente              |     60 | `max-lines-per-function`        |
| Complejidad ciclomática por función          |     12 | `complexity`                    |
| Profundidad de bloques anidados              |      4 | `max-depth`                     |
| Parámetros por función                       |      4 | `@typescript-eslint/max-params` |
| Callbacks anidados                           |      3 | `max-nested-callbacks`          |
| Niveles de `../` en un import                |      2 | `no-restricted-imports`         |

Los tests (`*.test.ts`, `e2e/`) están exentos de los límites por función. **No se permite desactivar estas reglas con `eslint-disable`**: si un archivo crece, se divide.

## 3. Estructura y módulos

### 3.1 Capas del monorepo 🔒

```
apps/*      → pueden usar packages/*            (nunca otra app)
packages/*  → pueden usar otros packages/*      (nunca apps)
tooling/*   → configuración compartida (TS, ESLint, Prettier, scripts)
```

Grafo permitido entre paquetes (sin ciclos):

```
shared ← db ← auth ← api
shared ← queue ←────── api
tailwind-config ← ui
observability (solo Node: server y worker)
```

### 3.2 API pública de cada paquete 🔒

- Cada paquete declara su API en `package.json#exports`. **Prohibido** importar `@repo/x/src/...`.
- Prohibido `export *`: se exporta explícitamente.
- Prohibido `export default` salvo donde el framework lo exige (rutas de Next.js/Expo Router, stories y archivos `*.config.*`).

### 3.3 Módulos del backend (`packages/api/src/modules/<modulo>/`) 🔒

```
<modulo>/
├── index.ts                 # API pública del módulo (router + tipos)
├── <modulo>.router.ts       # Procedimientos tRPC: validan input y delegan. Sin lógica.
├── <modulo>.service.ts      # Lógica de negocio. Recibe dependencias por parámetro.
├── <modulo>.repository.ts   # Único lugar con acceso a Prisma.
├── <modulo>.schema.ts       # Schemas zod de entrada/salida.
└── <modulo>.service.test.ts # Tests unitarios del servicio.
```

Reglas (dependency-cruiser):

- `router → service → repository`. Un router no importa un repositorio.
- Solo `*.repository.ts` importa valores de `@repo/db` (los tipos se permiten en cualquier lugar).
- Un módulo usa otro **solo a través de su `index.ts`**.

### 3.4 Features de las apps (`apps/*/src/features/<feature>/`) 🔒

```
<feature>/
├── index.ts(x)            # API pública de la feature
├── sign-in-form.tsx       # Componentes (kebab-case, un componente por archivo)
├── use-auth-submit.ts     # Hooks (prefijo `use-`)
└── <feature>.schema.ts    # Schemas zod (opcional)
```

- Las features son **planas** (sin subcarpetas `components/` ni `hooks/`): con una carpeta más, llegar a `src/lib` o `src/components` exigiría tres niveles de `../`, que el límite de imports prohíbe (§2).
- Las rutas (`src/app/**`) son delgadas: componen features, no contienen lógica. En Next.js, los grupos de rutas importan las features a través de un `_deps.ts` del grupo (p. ej. `src/app/(app)/_deps.ts`) por el mismo motivo.
- Una feature usa otra solo vía su `index.ts`.

### 3.5 Otras reglas de arquitectura 🔒

- Sin imports circulares.
- El código de producción no importa tests ni stories.
- El código de producción no usa `devDependencies` (salvo imports de solo tipos, p. ej. `type AppRouter`).
- Todo import externo debe estar declarado en el `package.json` del workspace.

## 4. Dependencias 🔒

Se aplica con `pnpm check:deps` ([`tooling/scripts/src/policy.ts`](../tooling/scripts/src/policy.ts)).

1. **Catálogo único:** toda dependencia externa se declara en `pnpm-workspace.yaml` (`catalog:`) y los `package.json` usan `"catalog:"`. Las internas usan `"workspace:*"`.
2. **Máximo de dependencias externas por workspace** (las `@repo/*` no cuentan):

   | Tipo         | `dependencies` | `devDependencies` |
   | ------------ | -------------: | ----------------: |
   | `apps/*`     |             20 |                15 |
   | `packages/*` |              8 |                10 |
   | `tooling/*`  |              8 |                10 |

   Excepciones justificadas en `LIMIT_OVERRIDES` (hoy: `mobile` por los módulos nativos de Expo, `observability` por OpenTelemetry, `storybook`).

3. **Paquetes prohibidos** (con alternativa): `moment`, `lodash`, `axios`, `node-fetch`, `express`, `jest`, `uuid`, `yup`, `joi`, `class-validator`, etc.
4. **Entradas del catálogo sin uso** se eliminan.
5. **Supply chain:** pnpm no instala versiones publicadas hace menos de 3 días (`minimumReleaseAge`) y solo los paquetes en `allowBuilds` pueden ejecutar scripts de instalación.
6. **Agregar una dependencia nueva** requiere en el PR: para qué sirve, alternativas consideradas, tamaño y estado de mantenimiento.

## 5. TypeScript 🔒

- `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax` (ver `tooling/typescript/base.json`).
- Prohibido `any` explícito, `enum` (usar `as const`) y `@ts-ignore` (usar `@ts-expect-error` con motivo).
- `type` en vez de `interface` (`consistent-type-definitions`).
- Imports de tipos con `import { type X }`.
- ESLint con reglas `strictTypeChecked`: promesas sin manejar, `switch` no exhaustivos y comparaciones inseguras son errores.

## 6. Nombres 🔒

- **Archivos y carpetas en kebab-case**, con sufijos separados por punto: `sign-in-form.tsx`, `user.service.ts`, `button.stories.tsx` (`pnpm check:naming`). Se permite la sintaxis de rutas: `[id]`, `(group)`, `_layout`, `+not-found`.
- Componentes y tipos en `PascalCase`; funciones y variables en `camelCase`; constantes globales en `SCREAMING_SNAKE_CASE`.
- Sin alias de rutas (`@/…`): se usan imports relativos (máx. 2 niveles) o paquetes `@repo/*`.
- **Idioma:** código, identificadores y comentarios en inglés; documentación y textos de UI en español.

## 7. Errores, logs y variables de entorno

- 🔒 Prohibido `console.*`: se usa el logger (`@repo/observability`, pino) con logs estructurados.
- 🔒 `process.env` solo se lee en los archivos `env.ts` (validados con zod) y en configs de herramientas.
- Los errores de dominio se lanzan como `AppError` (`@repo/shared`) y la API los traduce a errores tRPC.
- Nunca se capturan errores para ignorarlos en silencio. Si se capturan, se registran o se re-lanzan.
- Datos sensibles (contraseñas, tokens, cookies, headers de auth) se redactan en los logs.

## 8. Testing

- **Unitarios:** Vitest, colocados junto al código (`*.test.ts`). Todo `*.service.ts` tiene tests.
- **API:** tests con `createCaller` y repositorios falsos (sin base de datos).
- **Pirámide:** muchos unitarios (rápidos, sin base de datos), menos de integración sobre PostgreSQL real y muy pocos E2E. `pnpm test` nunca necesita base de datos.
- 🔒 **Cobertura:** `pnpm --filter @repo/api test:coverage` (v8) exige ≥ 80 % de líneas en cada `src/modules/**/*.service.ts`; CI la ejecuta en el job `integration` y publica el resumen.
- 🔒 CI ejecuta lint, typecheck, tests y build en cada PR, más las pruebas de integración (§8.1) y los E2E (§8.2).

### 8.1 Pruebas de integración (PostgreSQL real)

Para repositorios, transacciones, concurrencia y restricciones de la base (CHECK, UNIQUE): lo que un repositorio falso no puede probar.

- **Archivos:** `*.int.test.ts` junto al código de `packages/api/src`. Corren con `vitest.integration.config.ts` (`pnpm test:integration`), **en serie** (sin paralelismo de archivos), y la config unitaria los excluye.
- **Base de datos aislada por ejecución:** el `globalSetup` (`packages/api/src/testing/integration/global-setup.ts`) crea en el servidor de `TEST_DATABASE_URL` una base nueva con nombre único (`farmacias_api_it_<tiempo>_<azar>`), le aplica las **migraciones reales** de `@repo/db` con `prisma migrate deploy` (lo mismo que corre la imagen `migrate` en producción) y la elimina al terminar (`DROP DATABASE ... WITH (FORCE)`). Nunca toca la base de `TEST_DATABASE_URL` ni otras bases: solo crea/elimina nombres con ese prefijo.
- **Helpers** (`packages/api/src/testing/integration`, importar desde su `index.ts`):
  - `INTEGRATION_ENABLED` para `describe.skipIf(!INTEGRATION_ENABLED)(...)`;
  - `getTestDb()` (PrismaClient del archivo) y `disconnectTestDb()` en `afterAll`;
  - `resetDatabase()` en `beforeEach`: `TRUNCATE ... RESTART IDENTITY CASCADE` de todas las tablas (salvo `_prisma_migrations`) y reinicio de secuencias (`order_code_seq` vuelve a `P-000001`);
  - factories con datos sintéticos válidos: `createUser({ role })`, `createProduct({ onHand, priceClp, ... })` (con su fila de inventario), `setStock`, `createOrder(residentId, { status, fulfillment, lines })`, `createPayment(order, { status, idempotencyKey })`.
- **Sin `TEST_DATABASE_URL`** las suites se omiten con un mensaje claro; **en CI (`CI=true`) su ausencia es un error**, para que el job nunca quede verde sin probar nada.
- **Ejemplo mínimo:** ver `packages/api/src/testing/integration/harness.int.test.ts` (smoke del arnés: migraciones aplicadas, `CHECK on_hand >= 0`, `idempotency_key` única).

Ejecutarlas localmente con el PostgreSQL de compose (el usuario `app` tiene permiso para crear bases):

```bash
pnpm dev:services                       # postgres:18-alpine en 127.0.0.1:5432
TEST_DATABASE_URL=postgresql://app:app@localhost:5432/app pnpm test:integration
# Solo @repo/api: pnpm --filter @repo/api test:integration
```

CI: el job `integration` de `.github/workflows/ci.yml` levanta un servicio `postgres:18-alpine`, define `TEST_DATABASE_URL` y ejecuta `pnpm test:integration` (tarea Turborepo sin caché que solo recibe `TEST_DATABASE_URL` y `CI`). La tarea corre en `@repo/api` (Vitest, `*.int.test.ts`) y en `@repo/db` (Vitest, `vitest.integration.config.ts`: restricciones del esquema, paridad de las listas de `@repo/shared` con los `CHECK`, seed del catálogo, fechas `timestamptz` y zona horaria de la sesión).

### 8.2 E2E

- **E2E web:** Playwright en el workspace `apps/e2e` (`@repo/e2e`) contra el stack completo (API, worker, admin, export web de Expo, PostgreSQL y Redis). `pnpm --filter @repo/e2e e2e:full` levanta el stack, corre la suite y lo detiene. Proyectos `admin-*` y `mobile-web-*` por navegador (Chromium, Firefox, WebKit, viewports Pixel 7 e iPhone 15; Chrome y Edge con `E2E_BRANDED_BROWSERS=1`) y `a11y-*` (axe, teclado, zoom 200 %). Specs en `apps/e2e/src/{admin,mobile-web,a11y}/**/*.spec.ts`; variables y ejecución registrada en [docs/validation/e2e.md](./validation/e2e.md).
- **E2E mobile nativo:** Maestro (`apps/mobile/.maestro`).

## 9. Git y Pull Requests

- 🔒 **Conventional Commits** (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`…), validado por commitlint en el hook `commit-msg`.
- Ramas: `feat/<descripcion>`, `fix/<descripcion>`, `chore/<descripcion>`.
- `main` está protegida: solo se integra por PR con CI en verde y al menos 1 aprobación.
- PRs pequeños (idealmente < 400 líneas cambiadas). Un PR = un cambio coherente.
- Cambios visibles para usuarios llevan un changeset (`pnpm changeset`).
- Hooks locales: `pre-commit` formatea con Prettier los archivos staged; `pre-push` corre lint y typecheck de lo afectado.

## 10. Seguridad

- Secretos solo en variables de entorno; nunca se versiona un `.env` (solo `.env.example`).
- La API usa `helmet`, CORS con orígenes explícitos y rate limiting.
- Toda entrada se valida con zod; las queries usan Prisma (sin SQL concatenado).
- Las imágenes Docker corren como usuario no-root.
- Las dependencias se actualizan con Renovate, respetando el catálogo.

## 11. Cómo cambiar una regla

1. Escribir un ADR en `docs/adr/NNNN-titulo.md` (contexto, decisión, consecuencias).
2. Actualizar la configuración (`tooling/eslint/limits.js`, `tooling/scripts/src/policy.ts`, `.dependency-cruiser.cjs`…) y este documento en el mismo PR.
