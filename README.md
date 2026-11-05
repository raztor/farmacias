# Farmacia Comunitaria Peñalolén

MVP de la **Farmacia Comunitaria de Peñalolén**, desarrollado por el equipo **Better Name Pending** ([github.com/raztor/farmacias](https://github.com/raztor/farmacias)).

Monorepo full-stack en TypeScript con una **app para vecinos universal** (Expo: iOS, Android y web responsive), un **backoffice de operación y administración** (Next.js), una **API** y un **worker de jobs**, compartiendo tipos, validaciones y componentes de UI de punta a punta.

- La API (Fastify + tRPC) expone tipos que consumen directamente admin y mobile (nativo y web), sin generar código.
- La autenticación (Better Auth) funciona igual en navegador (cookies del mismo origen, tanto en admin como en la versión web de la app) y en iOS/Android (SecureStore).
- La app para vecinos es una sola base de código Expo: su exportación web (`expo export --platform web`) es el “MVP web responsive”. Ver [ADR 0002](docs/adr/0002-clientes-expo-universal-y-admin.md).
- Los componentes de `@repo/ui` se escriben una vez con React Native + NativeWind y se usan en Expo y en Next.js.
- Las reglas de calidad (límites de código, arquitectura, dependencias, nombres) se aplican automáticamente en local y en CI.

## Stack

| Área           | Tecnología                                                    |
| -------------- | ------------------------------------------------------------- |
| Monorepo       | pnpm 12 (workspaces + catálogo) y Turborepo 2                 |
| Lenguaje       | TypeScript 6.0 estricto, Node.js 26                           |
| API            | Fastify 5 + tRPC 11                                           |
| Auth           | Better Auth 1.7                                               |
| Base de datos  | PostgreSQL 18 + Prisma 7                                      |
| Jobs           | BullMQ 6 + Redis 8                                            |
| Admin          | Next.js 16 (App Router) + react-native-web                    |
| App vecinos    | Expo SDK 58 + Expo Router (iOS, Android y web)                |
| UI / estilos   | NativeWind 4 + Tailwind CSS 3.4, Storybook 10                 |
| Calidad        | ESLint 10, Prettier, dependency-cruiser, Vitest 5, Playwright |
| Observabilidad | pino, Sentry, OpenTelemetry                                   |

Detalle de paquetes, puertos, variables de entorno y flujos en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Las razones detrás de cada versión están en [docs/adr/0001-stack-y-versiones.md](docs/adr/0001-stack-y-versiones.md).

## Requisitos

- **Node.js 26** (ver [`.nvmrc`](.nvmrc); con nvm: `nvm use`).
- **pnpm 12**: `npm i -g pnpm@12.16.1` (Node 26 ya no incluye corepack).
- **Docker** con Docker Compose (PostgreSQL, Redis y Mailpit para desarrollo).
- Para mobile: Expo Go o un development build; Xcode / Android Studio solo si compilas nativo.

## Inicio rápido

```bash
pnpm install          # instala dependencias y activa los hooks de git (husky)
pnpm run setup        # crea los .env desde los .env.example y genera secretos
pnpm dev:services     # levanta PostgreSQL, Redis y Mailpit con Docker
pnpm db:migrate       # aplica las migraciones de Prisma
pnpm db:seed          # cuentas preinscritas, catálogo (200 productos) y pedidos de demo (SEED_*_PASSWORD)
pnpm dev              # inicia todas las apps en modo desarrollo
```

> Usa `pnpm run setup` (con `run`): `pnpm setup` a secas es un comando propio de pnpm que configura su instalación global.

Con todo arriba:

| Servicio           | URL                     |
| ------------------ | ----------------------- |
| Admin              | <http://localhost:3001> |
| API                | <http://localhost:4000> |
| Worker (health)    | <http://localhost:4100> |
| Storybook          | <http://localhost:6006> |
| Expo (Metro + web) | <http://localhost:8081> |
| Mailpit (correos)  | <http://localhost:8025> |

Para trabajar en una sola app: `pnpm --filter @repo/admin dev` (o `@repo/mobile`, `@repo/server`…). La versión web de la app se abre desde Expo con la tecla `w` (o `pnpm --filter @repo/mobile exec expo start --web`) en <http://localhost:8081>.

## Scripts

| Script                   | Qué hace                                                                                                                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`               | Todas las apps en modo desarrollo (Turborepo)                                                                                                                                                                                                                                    |
| `pnpm dev:services`      | Levanta PostgreSQL, Redis y Mailpit (`docker compose up -d`)                                                                                                                                                                                                                     |
| `pnpm dev:services:down` | Detiene los servicios de desarrollo                                                                                                                                                                                                                                              |
| `pnpm run setup`         | Crea los `.env` locales desde los `.env.example`                                                                                                                                                                                                                                 |
| `pnpm build`             | Compila todas las apps                                                                                                                                                                                                                                                           |
| `pnpm lint` / `lint:fix` | ESLint en todos los workspaces (con `--fix` para corregir)                                                                                                                                                                                                                       |
| `pnpm typecheck`         | `tsc --noEmit` en todos los workspaces                                                                                                                                                                                                                                           |
| `pnpm test`              | Tests unitarios (Vitest)                                                                                                                                                                                                                                                         |
| `pnpm test:integration`  | Tests de integración sobre PostgreSQL real (`*.int.test.ts` de `@repo/api` y `@repo/db`); requiere `TEST_DATABASE_URL` (ver [docs/REPO_RULES.md §8.1](docs/REPO_RULES.md#81-pruebas-de-integración-postgresql-real)). Sin esa variable se omiten, salvo en CI, donde es un error |
| `pnpm test:e2e`          | Tests end-to-end (Playwright en `apps/e2e`, Maestro en mobile) contra un stack ya levantado; `pnpm --filter @repo/e2e e2e:full` levanta el stack, corre la suite y lo apaga ([docs/validation/e2e.md](docs/validation/e2e.md))                                                   |
| `pnpm format`            | Formatea todo con Prettier (`format:check` solo verifica)                                                                                                                                                                                                                        |
| `pnpm check:deps`        | Política de dependencias (catálogo, límites, paquetes prohibidos)                                                                                                                                                                                                                |
| `pnpm check:naming`      | Nombres de archivos y carpetas en kebab-case                                                                                                                                                                                                                                     |
| `pnpm check:arch`        | Reglas de arquitectura con dependency-cruiser                                                                                                                                                                                                                                    |
| `pnpm check`             | Todo lo anterior + lint, typecheck y tests: **correr antes de abrir un PR**                                                                                                                                                                                                      |
| `pnpm db:generate`       | Genera el cliente de Prisma                                                                                                                                                                                                                                                      |
| `pnpm db:migrate`        | Crea/aplica migraciones en desarrollo (`prisma migrate dev`)                                                                                                                                                                                                                     |
| `pnpm db:deploy`         | Aplica migraciones en producción (`prisma migrate deploy`)                                                                                                                                                                                                                       |
| `pnpm db:seed`           | Datos de demo idempotentes: cuentas preinscritas de cada rol (residente, operario, administración; `SEED_*_PASSWORD`), catálogo sintético de 200 productos con su inventario y pedidos de demo                                                                                   |
| `pnpm db:studio`         | Abre Prisma Studio                                                                                                                                                                                                                                                               |
| `pnpm changeset`         | Registra un cambio para el changelog                                                                                                                                                                                                                                             |
| `pnpm clean`             | Borra builds, cachés y `node_modules`                                                                                                                                                                                                                                            |

## Estructura

```
.
├── apps/
│   ├── server/            # API HTTP: Fastify + tRPC + Better Auth (:4000)
│   ├── worker/            # Procesa colas BullMQ (emails) (:4100)
│   ├── admin/             # Next.js: backoffice para rol admin (:3001)
│   ├── mobile/            # Expo + Expo Router: app para vecinos (iOS/Android/web, :8081)
│   ├── e2e/               # Playwright: E2E de admin y de la web de la app
│   └── storybook/         # Catálogo de componentes de @repo/ui (:6006)
├── packages/
│   ├── api/               # Routers tRPC y lógica de negocio (módulos)
│   ├── auth/              # Configuración de Better Auth
│   ├── db/                # Prisma: schema, migraciones y cliente
│   ├── queue/             # Colas BullMQ y schemas de jobs
│   ├── observability/     # Logger, Sentry y OpenTelemetry (Node)
│   ├── shared/            # Schemas zod, errores, constantes y utilidades puras
│   ├── ui/                # Componentes universales (NativeWind)
│   └── tailwind-config/   # Preset de Tailwind y tokens de diseño
├── tooling/
│   ├── eslint/            # Configuración de ESLint compartida y límites de código
│   ├── typescript/        # tsconfig base por plataforma
│   ├── prettier/          # Configuración de Prettier
│   └── scripts/           # check-deps, check-naming, setup-env
├── docs/
│   ├── ARCHITECTURE.md    # Arquitectura, paquetes, variables de entorno
│   ├── REPO_RULES.md      # Reglas del repositorio
│   ├── DEPLOYMENT.md      # Imágenes Docker, stack de producción y EAS
│   └── adr/               # Decisiones de arquitectura (ADR)
├── .github/               # CI, plantillas de PR e issues, CODEOWNERS
├── docker/                # Imagen de migraciones y .env.example del stack de producción
├── docker-compose.yml     # Servicios de desarrollo
├── docker-compose.prod.yml # Stack completo con las imágenes de producción
├── pnpm-workspace.yaml    # Workspaces + catálogo de versiones
└── turbo.json             # Pipeline de tareas
```

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md) — paquetes, API pública, puertos, variables de entorno y flujos.
- [Reglas del repositorio](docs/REPO_RULES.md) — límites, arquitectura, dependencias, nombres y Git.
- [Despliegue](docs/DEPLOYMENT.md) — imágenes Docker, migraciones, stack de producción y EAS.
- [Decisiones de arquitectura (ADR)](docs/adr/README.md).
- [Guía de contribución](CONTRIBUTING.md) — flujo de trabajo, dependencias, módulos, features y migraciones.
- [Instrucciones para agentes de IA](AGENTS.md).
