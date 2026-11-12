# Arquitectura

## Vista general

```
┌───────────────────────────┐  ┌───────────────────────────┐  ┌─────────────┐
│ apps/mobile (iOS/Android) │  │ apps/mobile (web)         │  │ apps/admin  │  Clientes
│ Expo · EAS                │  │ export estático + Caddy   │  │ Next :3001  │  (tRPC +
│                           │  │ dev :8081 · prod :8080    │  │             │  Better Auth)
└─────────────┬─────────────┘  └─────────────┬─────────────┘  └──────┬──────┘
              │ HTTPS directo                │ proxy /trpc y /api/auth (mismo origen)
              ▼                              ▼                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ apps/server  Fastify :4000      /trpc  /api/auth/*  /health  /ready      │
│   @repo/api (routers) · @repo/auth                                       │
└──────┬─────────────────────────┬─────────────────────────────────────────┘
       │ Prisma                  │ BullMQ (encola)
       ▼                         ▼
┌─────────────┐          ┌──────────────┐        ┌──────────────┐
│ PostgreSQL  │◄─────────┤ apps/worker  │──SMTP─►│ Mailpit/SMTP │
│   :5432     │          │ (consume)    │        └──────────────┘
└─────────────┘          └──────┬───────┘
                                ▼
                         ┌─────────────┐
                         │ Redis :6379 │
                         └─────────────┘
```

Hay **dos clientes**, sin interfaces duplicadas ([ADR 0002](./adr/0002-clientes-expo-universal-y-admin.md)):

- **App para vecinos (`apps/mobile`)**: una sola base de código Expo para iOS, Android y web. Su exportación web (`expo export --platform web`) es el “MVP web responsive” y se sirve con Caddy (`apps/mobile/Dockerfile.web`).
  - Rutas (Expo Router, `apps/mobile/src/app`): `/` catálogo público (HU-01), `/product/[id]`, `/sign-in?redirect=<ruta>`, `/cart` (Mi pedido), `/checkout`, `/pay/[id]` (pago simulado), `/orders` (Mis pedidos), `/order/[id]` (detalle + línea de tiempo), `/account` y `/profile`. El catálogo no exige sesión; las pantallas que la necesitan muestran «Inicia sesión» (`RequireSignIn`) y, tras ingresar, vuelven a la ruta de origen (`redirect` validado contra redirecciones abiertas). Barra de navegación inferior: Catálogo · Mi pedido · Mis pedidos · Mi cuenta.
- **Backoffice (`apps/admin`)**: operación y administración de la farmacia, para los roles `operator` y `admin` (Usuarios y Auditoría solo `admin`); un `resident` ve «Sin acceso».

Cómo llega cada cliente a la API:

- **admin** usa _rewrites_ de Next.js (`/trpc/*` y `/api/auth/*` → `API_INTERNAL_URL`), así las cookies de sesión son del mismo origen y no hay CORS en el navegador.
- **web de la app (producción)** se construye con `EXPO_PUBLIC_API_URL` vacío: el navegador llama a su propio origen y Caddy (`apps/mobile/Caddyfile`) hace de proxy de `/trpc/*` y `/api/auth/*` hacia `API_UPSTREAM`. La cookie de sesión la guarda el navegador (el plugin de Expo no actúa en web) y las requests usan `credentials: "include"`.
- **web de la app (desarrollo)**: `expo start --web` en `:8081` llama a `EXPO_PUBLIC_API_URL` (`http://localhost:4000`); por eso `TRUSTED_ORIGINS` incluye `http://localhost:8081` (CORS con credenciales).
- **iOS/Android** llaman directo a `EXPO_PUBLIC_API_URL` y envían la cookie de sesión que guarda `@better-auth/expo` en SecureStore.

## Stack

| Área           | Tecnología                                                                               |
| -------------- | ---------------------------------------------------------------------------------------- |
| Monorepo       | pnpm 12 workspaces + catálogo, Turborepo 2                                               |
| Lenguaje       | TypeScript 6.0 (estricto), Node.js 26 LTS                                                |
| API            | Fastify 5 + tRPC 11 + superjson                                                          |
| Auth           | Better Auth 1.7 (email+password, plugins `expo` y `admin`)                               |
| Base de datos  | PostgreSQL 18 + Prisma 7 (generador `prisma-client`, adapter `@prisma/adapter-pg`)       |
| Jobs           | BullMQ 6 + Redis 8                                                                       |
| Admin          | Next.js 16 (App Router), NativeWind + react-native-web                                   |
| App vecinos    | Expo SDK 58, Expo Router, NativeWind 4 (iOS/Android con EAS; web estática con Caddy)     |
| UI compartida  | `@repo/ui` (componentes NativeWind universales) + Storybook 10                           |
| Estilos        | Tailwind CSS 3.4 (NativeWind 4 estable no soporta Tailwind 4)                            |
| Observabilidad | pino (logs), Sentry (errores), OpenTelemetry (trazas OTLP)                               |
| Calidad        | ESLint 10 + typescript-eslint, Prettier, dependency-cruiser, Vitest, Playwright, Maestro |

## Workspaces

### Apps

| Workspace        | Paquete           | Puerto | Responsabilidad                                      |
| ---------------- | ----------------- | -----: | ---------------------------------------------------- |
| `apps/server`    | `@repo/server`    |   4000 | Host HTTP: Fastify, Better Auth, tRPC, health checks |
| `apps/worker`    | `@repo/worker`    |   4100 | Procesa colas BullMQ (emails). `/health` en 4100     |
| `apps/admin`     | `@repo/admin`     |   3001 | Backoffice solo para rol `admin`                     |
| `apps/mobile`    | `@repo/mobile`    |   8081 | App para vecinos: iOS, Android y web (Expo)          |
| `apps/storybook` | `@repo/storybook` |   6006 | Catálogo de `@repo/ui`                               |
| `apps/e2e`       | `@repo/e2e`       |      — | Playwright: E2E de admin y de la web de la app       |

### Packages (API pública = `package.json#exports`)

Los paquetes internos se consumen **como código fuente TypeScript** (no se compilan): Next.js los transpila (`transpilePackages`), Metro los resuelve (iOS, Android y web) y `tsup` los empaqueta en server/worker.

#### `@repo/shared` — código puro, sin dependencias de runtime salvo zod

- `createEnv(schema, source)` → valida variables de entorno con zod y lanza un error legible con todas las variables inválidas. `source` es obligatorio: cada `env.ts` pasa `process.env` (o el objeto con las `EXPO_PUBLIC_*`/`NEXT_PUBLIC_*` leídas de forma literal, para que el bundler las inyecte).
- Helpers zod para env (schemas, no funciones): `zBooleanString` (p. ej. `zBooleanString.default(false)`), `zCommaList`. `createEnv` trata los valores vacíos (`VAR=`) como no definidos, así funcionan los opcionales y los defaults.
- `AppError` (`code`: `"BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INTERNAL"`), `isAppError()`.
- `type AppLogger` — interfaz mínima de logger (`debug/info/warn/error(obj, msg?)`, `child(bindings)`), que satisface pino. Permite que paquetes sin Node (api, queue) registren logs sin depender de pino.
- Constantes: `APP_NAME` (`"Farmacia Comunitaria Peñalolén"`), `APP_SCHEME` (`"bnp"`), `AUTH_COOKIE_PREFIX` (`"bnp"`, prefijo de las cookies de Better Auth que comparten API, proxies de Next.js y cliente Expo), y, en `roles.ts`/`permissions.ts`, `ROLES` (`resident`, `operator`, `admin`), `ROLE_VALUES`, `DEFAULT_ROLE` (`resident`), `OPERATIONAL_ROLES`, `ROLE_LABELS`, `isRole()`/`toRole()`/`isResident()`/`isOperational()`/`isAdmin()`, `type Role` y la matriz `PERMISSION_STATEMENTS`/`ROLE_PERMISSIONS` con `can(role, resource, action)`. Mensajes de inicio de sesión compartidos: `INVALID_CREDENTIALS_MESSAGE` (genérico), `RESIDENT_APP_ONLY_MESSAGE`, `BACKOFFICE_ONLY_MESSAGE` e `isInvalidCredentials()`.
- `noopLogger` (implementación vacía de `AppLogger`).
- Dominio (`src/domain`, mismas listas que los `CHECK` de la base): `ORDER_STATUSES` + `ORDER_STATUS_LABELS`, `FULFILLMENT_TYPES` + `FULFILLMENT_LABELS`, `PRODUCT_CATEGORIES` + `PRODUCT_CATEGORY_LABELS`, `STOCK_MOVEMENT_REASONS`, `PAYMENT_STATUSES`, `ACTOR_ROLES`, `AUDIT_ACTIONS` (con sus tipos y guardas `is*`), `ORDER_LINE_MIN_QUANTITY`/`ORDER_LINE_MAX_QUANTITY`, `DEFAULT_LOW_STOCK_THRESHOLD`, `normalizeSearchText(text)` y `buildProductSearchText(product)`.
- Schemas compartidos por formularios y API: `emailSchema`, `passwordSchema` (8–128), `nameSchema`, `signInSchema`, `updateProfileSchema`, `paginationSchema` (`{ cursor?: string; limit: 1..100 = 20 }`).

#### `@repo/db` — Prisma 7

- `prisma/schema.prisma`: modelos de Better Auth (`User`, `Session`, `Account`, `Verification`, `RateLimit` para el rate limiting de auth compartido entre instancias) incluyendo campos del plugin `admin` (`role`, `banned`, `banReason`, `banExpires`, `impersonatedBy`). Tablas en snake_case (`@@map`).
- `prisma.config.ts` (carga `.env` con dotenv), migraciones en `prisma/migrations`.
- Cliente generado en `src/generated/prisma` (ignorado por git) con el generador `prisma-client`.
- Exporta: `createPrismaClient({ databaseUrl, log?, logger? })` (con `logger`, los logs de Prisma y los errores del pool de `pg` van al logger estructurado), `type PrismaClient`, `Prisma`, los tipos de modelos y `assertPostgresUrl` / `InvalidDatabaseUrlError`.
- Solo para Node (server/worker): el cliente generado define `globalThis.__dirname` al importarse. admin y mobile solo usan sus **tipos** (a través de `@repo/api`).
- Modelo del dominio ([spec de datos](./specs/data-model.md)): `Product`, `InventoryItem`, `StockMovement`, `Order`, `OrderLine`, `OrderStatusEvent`, `Payment`, `AuditLog`. Valores cerrados como texto con `CHECK` (sin enums), `pg_trgm` + índice GIN sobre `products.search_text`, únicos parciales (un borrador por persona, un pago aprobado por pedido) y código `P-000001` desde la secuencia `order_code_seq`.
- Seed del catálogo: `seedCatalog(db, { products? })` (idempotente: inserta por `sku` solo los productos que faltan y nunca modifica uno existente, ni sus datos editados por el admin en HU-11 ni su stock; `search_text` con `buildProductSearchText` de `@repo/shared`) y `buildCatalogProducts()` (200 productos sintéticos con las categorías de `PRODUCT_CATEGORIES`). Pruebas con Vitest: `test` (unitarias, sin base) y `test:integration` (`*.int.test.ts`, requieren `TEST_DATABASE_URL`).

#### `@repo/auth` — Better Auth (servidor)

- `createAuth({ db, secret, baseURL, trustedOrigins, isProduction, onUserCreated?, logger? })` → instancia de Better Auth con adapter Prisma, email+password, plugins `expo()` y `admin()`. Valida `secret` (32+ caracteres) y `baseURL` (http/https) y lanza `AuthConfigError`; siempre agrega `bnp://` a `trustedOrigins`. El registro público está deshabilitado (`disableSignUp`): las cuentas son preinscritas (seed o `admin`); el hook opcional `onUserCreated` no se usa en el MVP y sus errores solo se registran.
- Cookies con prefijo `bnp` (`advanced.cookiePrefix = AUTH_COOKIE_PREFIX`), caché de sesión en cookie de 5 minutos (`SESSION_POLICY`) y rate limiting en base de datos (`RateLimit`) en producción.
- **Endpoints HTTP en lista blanca** (`AUTH_HTTP_PATHS`, plugin `http-allowlist`): solo `sign-in/email`, `sign-out`, `get-session`, `sign-up/email` (deshabilitado) y `admin/create-user` responden en `/api/auth/*`; todo lo demás de Better Auth y sus plugins (`/admin/set-role`, `/admin/remove-user`, `/admin/impersonate-user`, `/update-user`, `/expo-authorization-proxy`…) responde 404. Las llamadas de servidor `auth.api.*` (seed) no pasan por HTTP. El rol `admin` solo tiene el permiso de plugin `user:create` (`ADMIN_PLUGIN_PERMISSIONS`), así `admin/create-user` solo crea cuentas `resident`; los roles se cambian con `admin.setRole` (auditado).
- **Límite de inicio de sesión por cuenta** (`SIGN_IN_ACCOUNT_RULE`, plugin `sign-in-account-limit`): 10 intentos cada 15 minutos por par correo + IP (hash SHA-256 en `rate_limit`), además del límite por IP de Better Auth; lee el correo de cuerpos JSON y urlencoded y responde 400 si no puede (falla cerrado); activo cuando el rate limiting lo está (producción).
- `type Auth`, `type AuthSession`, `type AuthUser` (sesión + usuario inferidos).

#### `@repo/observability` — solo Node.js

- `createLogger({ service, level?, pretty?, environment?, destination? })` → logger pino con redacción de datos sensibles (niveles como texto, timestamps ISO). `pretty` solo en desarrollo (usa un transport de `pino-pretty`).
- `initObservability({ serviceName, serviceVersion?, environment, sentryDsn?, otlpEndpoint?, tracesSampleRate? })` → inicia OpenTelemetry (si hay endpoint OTLP) y Sentry (si hay DSN). Devuelve `{ shutdown() }` (rechaza con `AggregateError` si no logra vaciar la telemetría). `tracesSampleRate` aplica a Sentry; el muestreo de OpenTelemetry se configura con las variables estándar `OTEL_TRACES_SAMPLER` / `OTEL_TRACES_SAMPLER_ARG` (default `parentbased_always_on`). Debe llamarse en `instrument.ts`, precargado con `node --import`.
- `captureException(error, context?)`.

#### `@repo/queue` — BullMQ

- `QUEUE_NAMES` (`{ email: "email" }`), schemas zod de cada job (`emailJobSchema`: unión discriminada por `type`, p. ej. `"welcome"`).
- `createQueueClient({ redisUrl, logger?, timeoutMs?, prefix? })` → `{ enqueue(queue, payload, opts?), ping(), close() }`. `enqueue` valida el payload con zod, aplica reintentos con backoff exponencial por defecto, devuelve `{ id, queue, name }` y envuelve los errores en `AppError("INTERNAL")`. `ping()` devuelve `Promise<boolean>` y nunca rechaza (sirve directo para `/ready`). Para evitar duplicados al reintentar, pasar un `jobId` determinista (p. ej. `welcome:<userId>`).
- `createWorker({ queue, redisUrl, concurrency?, logger?, prefix?, process })` → `Worker` de BullMQ que valida el payload antes de llamar a `process(payload, { job, logger, signal })`.
- Re-exporta `UnrecoverableError` de BullMQ para que las apps no importen `bullmq` directamente.
- ⚠️ **Pendiente:** BullMQ 6 declara `ioredis` como _peer_ opcional y todavía no está en el catálogo. Hasta agregarlo (catálogo + `dependencies` de `@repo/queue`), toda conexión a Redis falla: `/ready` del server responde 503, los emails de bienvenida no se encolan y el worker se detiene en su chequeo inicial con un log `fatal`.

#### `@repo/api` — tRPC (lógica de negocio)

- `appRouter`, `type AppRouter`, `type RouterInputs`, `type RouterOutputs`, `createCaller`.
- `createTRPCContext({ deps, headers, requestId })` donde `deps: ApiDependencies = { db, auth, queue, logger }`. `auth` es estructural (`SessionResolver`: `{ api: { getSession({ headers }) } }`); la instancia de `createAuth` lo satisface y los tests usan un falso mínimo. Los errores de validación llegan al cliente en `data.zodError`.
- Procedimientos: `publicProcedure`, `protectedProcedure` (requiere sesión), `adminProcedure` (rol `admin`). Un middleware traduce `AppError` → `TRPCError`.
- Módulos: `health` (`health.ping` → `{ status: "ok", time }`, `time` en ISO 8601), `user` (`user.me`, `user.updateProfile`), `admin` (`admin.stats`, `admin.listUsers`, `admin.setRole`).
- Los clientes (admin y mobile) solo importan **tipos** de `@repo/api` (`type AppRouter`, `type RouterOutputs`…), nunca valores.

#### `@repo/tailwind-config` y `@repo/ui`

- `@repo/tailwind-config/preset`: preset de Tailwind 3 (incluye `nativewind/preset`, `darkMode: "class"`) con los tokens de diseño. Se importa con nombre (`import { preset } from "@repo/tailwind-config/preset"`); desde CommonJS, `require("@repo/tailwind-config/preset")` devuelve el preset. `@repo/tailwind-config` exporta los tokens para uso en TS y `@repo/tailwind-config/tokens` en JS plano.
- `@repo/ui`: componentes universales (React Native + NativeWind) que funcionan en Expo y en Next.js vía react-native-web: `Button`, `Text`, `Heading`, `Input`, `Card`, `Screen`… y `cn()`. Cada componente tiene su `*.stories.tsx`.

## Variables de entorno

Cada app valida sus variables en `src/env.ts`. `pnpm run setup` crea los `.env` desde los `.env.example` (con `run`: `pnpm setup` a secas es un comando propio de pnpm). El `.env` de la raíz configura los servicios de `docker-compose.yml` (`POSTGRES_*`, `REDIS_PORT`, `MAILPIT_*`); el stack de producción usa `docker/.env.example` (ver [DEPLOYMENT.md](./DEPLOYMENT.md)).

| Variable                                                                    | Usada por                | Ejemplo / default                                                                                                                                                                                          |
| --------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                  | todas                    | `development`                                                                                                                                                                                              |
| `LOG_LEVEL`                                                                 | server, worker           | `info`                                                                                                                                                                                                     |
| `DATABASE_URL`                                                              | db, server, worker       | `postgresql://app:app@localhost:5432/app`                                                                                                                                                                  |
| `REDIS_URL`                                                                 | server, worker           | `redis://localhost:6379`                                                                                                                                                                                   |
| `PORT` / `HOST`                                                             | server                   | `4000` / `0.0.0.0`                                                                                                                                                                                         |
| `BETTER_AUTH_SECRET`                                                        | server                   | 32+ caracteres aleatorios                                                                                                                                                                                  |
| `BETTER_AUTH_URL`                                                           | server                   | `http://localhost:4000`                                                                                                                                                                                    |
| `TRUSTED_ORIGINS`                                                           | server                   | `http://localhost:8081,http://localhost:3001,bnp://`                                                                                                                                                       |
| `TRUST_PROXY_HOPS`                                                          | server                   | `1` (proxies delante de la API; `0` si se expone directo)                                                                                                                                                  |
| `TRUST_PROXY_ADDRESSES`                                                     | server                   | (opcional) `loopback,uniquelocal`: proxies de confianza por dirección; reemplaza a `TRUST_PROXY_HOPS` (ver DEPLOYMENT)                                                                                     |
| `RATE_LIMIT_MAX`                                                            | server                   | `300` (requests por minuto e IP, por instancia)                                                                                                                                                            |
| `SENTRY_DSN`                                                                | server, worker           | (opcional)                                                                                                                                                                                                 |
| `OTEL_EXPORTER_OTLP_ENDPOINT`                                               | server, worker           | (opcional) `http://localhost:4318`                                                                                                                                                                         |
| `SMTP_URL` / `EMAIL_FROM`                                                   | worker                   | `smtp://localhost:1025` / `App <no-reply@app.local>`                                                                                                                                                       |
| `WORKER_CONCURRENCY`                                                        | worker                   | `5`                                                                                                                                                                                                        |
| `WORKER_HEALTH_PORT`                                                        | worker                   | `4100`                                                                                                                                                                                                     |
| `API_INTERNAL_URL`                                                          | admin (servidor)         | `http://localhost:4000`                                                                                                                                                                                    |
| `RESIDENT_APP_URL`                                                          | admin (servidor)         | (opcional) URL http(s) de la app de vecinos (web), enlazada desde «Sin acceso» (R-ACC-07)                                                                                                                  |
| `NEXT_PUBLIC_SENTRY_DSN`                                                    | admin                    | (opcional)                                                                                                                                                                                                 |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT`                       | admin, mobile (build)    | (opcional) subida de source maps                                                                                                                                                                           |
| `SKIP_ENV_VALIDATION`                                                       | admin (build)            | `1` omite la validación en el build (Docker/CI)                                                                                                                                                            |
| `EXPO_PUBLIC_API_URL`                                                       | mobile                   | `http://localhost:4000` (obligatoria en iOS/Android; vacía en web = mismo origen)                                                                                                                          |
| `API_UPSTREAM`                                                              | mobile-web (Caddy)       | `http://server:4000` (destino del proxy `/trpc` y `/api/auth`)                                                                                                                                             |
| `EXPO_PUBLIC_SENTRY_DSN`                                                    | mobile                   | (opcional)                                                                                                                                                                                                 |
| `EAS_PROJECT_ID` / `APP_VARIANT`                                            | mobile (`app.config.ts`) | `eas init` / perfil de `eas.json`                                                                                                                                                                          |
| `SEED_RESIDENT_PASSWORD` / `SEED_OPERATOR_PASSWORD` / `SEED_ADMIN_PASSWORD` | server (`pnpm db:seed`)  | contraseñas sintéticas (mín. 8) de las cuentas preinscritas: `residente1..3@demo.farmacia.cl`, `operador@demo.farmacia.cl`, `admin@demo.farmacia.cl` (valores de desarrollo en `apps/server/.env.example`) |

`API_INTERNAL_URL` queda fija en los _rewrites_ al ejecutar `next build`: la imagen de admin se construye para una topología concreta (ver DEPLOYMENT.md). La web de la app, en cambio, lee `API_UPSTREAM` al iniciar Caddy.

## Flujos principales

**Cuentas:** no hay registro público (`POST /api/auth/sign-up/email` responde 400). `pnpm db:seed` crea las cuentas sintéticas preinscritas (`residente1..3`, `operador`, `admin` en `@demo.farmacia.cl`, contraseñas `SEED_*_PASSWORD`) y el `admin` puede cambiar roles (`admin.setRole`, auditado). El job `welcome` de la cola queda disponible pero el MVP no lo encola.

**Llamada tRPC autenticada:** cliente → `/trpc/user.me` → `createTRPCContext` obtiene la sesión con `auth.api.getSession({ headers })` → `protectedProcedure` → `user.service` → `user.repository` (Prisma).

## Dominio

El contrato funcional del MVP (Inception v2.0: RF-01..RF-12, RNF-01..RNF-11, HU-01..HU-09) está bajado a una spec por módulo en [`docs/specs`](./specs/README.md), con el registro de decisiones que precisan el Inception (D-06 en adelante), y a la [matriz de trazabilidad](./traceability.md) problema → objetivo → requisito → historia → prueba → evidencia. Diagramas UML (ER, estados, secuencia de pago, componentes, despliegue) en Mermaid dentro de las specs y en PlantUML en [`docs/uml`](./uml/README.md).

| Módulo (`packages/api/src/modules/…`) | Responsabilidad                                                                             | Spec                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `catalog`                             | Búsqueda pública por nombre comercial o principio activo, precio y disponibilidad           | [catalog](./specs/catalog.md)               |
| `admin` + guardas de `trpc`           | Roles `resident` / `operator` / `admin`, cuentas preinscritas, cambio de rol                | [accounts-roles](./specs/accounts-roles.md) |
| `orders`                              | Borrador único por persona, líneas, modalidad retiro/despacho simulado, confirmar, cancelar | [orders](./specs/orders.md)                 |
| `order-status`                        | Máquina de estados pura: transiciones válidas por actor, etiquetas en español               | [order-status](./specs/order-status.md)     |
| `payments`                            | Pago simulado idempotente detrás del puerto `PaymentGateway`                                | [payments](./specs/payments.md)             |
| `inventory`                           | Descuento por pago, restauración, recepciones y ajustes, alertas de stock bajo (backoffice) | [inventory](./specs/inventory.md)           |
| `operations`                          | Bandeja operativa (filtros, FIFO) y transiciones físicas con concurrencia optimista         | [operations](./specs/operations.md)         |
| `tracking`                            | “Mis pedidos” y línea de tiempo del pedido propio                                           | [tracking](./specs/tracking.md)             |
| `audit`                               | Registro de cambios críticos en la misma transacción; consulta solo `admin`                 | [audit](./specs/audit.md)                   |

**Pago simulado (flujo crítico):** app → `payments.pay({ orderId, idempotencyKey, scenario })` → una transacción: registra el intento (clave única) → `PaymentGateway.charge` → si aprueba, descuento condicional por línea (`on_hand >= q`, en orden de `productId`) → _compare-and-set_ del pedido a `payment_validated` → evento de estado + movimientos + auditoría. Ver la [secuencia completa](./specs/payments.md#4-estados-y-transiciones).

## Producción

- Imágenes Docker multi-stage por app (`apps/*/Dockerfile` y `apps/mobile/Dockerfile.web`), construidas con `turbo prune`, usuario no-root y `HEALTHCHECK` (server: `/health`; worker: `/health` en `WORKER_HEALTH_PORT`; admin: `/sign-in`; mobile-web: `/health` de Caddy).
- server y worker se empaquetan con `tsup`: los `@repo/*` se incluyen en el bundle y sus dependencias externas quedan como imports relativos a `packages/<pkg>/node_modules`, por lo que la imagen conserva el layout del workspace podado (no se usa `pnpm deploy`). Se inician con `node --import ./dist/instrument.js dist/index.js`.
- Migraciones: servicio/job `migrate` (`docker/migrate.Dockerfile`, `prisma migrate deploy`) que corre **antes** de desplegar server/worker. Las apps nunca migran al iniciar.
- `docker-compose.yml`: servicios de desarrollo (Postgres, Redis, Mailpit). `docker-compose.prod.yml`: stack completo con las imágenes de producción.
- Apagado ordenado (SIGTERM): dejar de aceptar requests, terminar jobs en curso, cerrar Redis/Postgres y vaciar telemetría.
- App para vecinos: iOS/Android con EAS Build (`eas.json` con perfiles `development`, `preview`, `production`) y EAS Update; web con la imagen `mobile-web` (export estático + Caddy).
