# Despliegue

Guía para construir y operar las imágenes Docker de producción (server, worker, admin, mobile-web y el job de migraciones) y para publicar la app en iOS/Android con EAS. La arquitectura general está en [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Imágenes

Todas se construyen **desde la raíz del repo** (el contexto debe contener el monorepo completo; [`.dockerignore`](../.dockerignore) excluye `node_modules`, builds, `.env`, `apps/storybook`, `apps/e2e` y los proyectos nativos de `apps/mobile`).

| Imagen     | Dockerfile                                                    | Puerto | Healthcheck                    | Comando                                            | Tamaño medido |
| ---------- | ------------------------------------------------------------- | -----: | ------------------------------ | -------------------------------------------------- | ------------: |
| server     | [`apps/server/Dockerfile`](../apps/server/Dockerfile)         |   4000 | `GET /health`                  | `node --import ./dist/instrument.js dist/index.js` |        501 MB |
| worker     | [`apps/worker/Dockerfile`](../apps/worker/Dockerfile)         |   4100 | `GET /health` (puerto interno) | `node --import ./dist/instrument.js dist/index.js` |        481 MB |
| admin      | [`apps/admin/Dockerfile`](../apps/admin/Dockerfile)           |   3001 | `GET /sign-in`                 | `node apps/admin/server.js`                        |        229 MB |
| mobile-web | [`apps/mobile/Dockerfile.web`](../apps/mobile/Dockerfile.web) |   8080 | `GET /health` (Caddy)          | `caddy run --config /etc/caddy/Caddyfile`          |        116 MB |
| migrate    | [`docker/migrate.Dockerfile`](../docker/migrate.Dockerfile)   |      — | — (job que termina)            | `prisma migrate deploy`                            |        595 MB |

Tamaños medidos con `podman images` (linux/arm64, 3 de noviembre de 2026). La base `node:26.13-alpine` pesa 183 MB y `caddy:2-alpine`, 64 MB. En server y worker, el resto corresponde casi por completo a `node_modules` de producción (~345 MB). `migrate` incluye el CLI de Prisma con sus dependencias de desarrollo (Prisma Studio, TypeScript, etc.); es un job puntual y no queda corriendo.

Características comunes:

- Base `node:26.13-alpine` (minor fijado; Renovate propone las actualizaciones). pnpm `12.16.1` se instala con `npm i -g` porque las imágenes de Node 26 ya no traen Corepack.
- Multi-stage: `base` → `pruner` (`turbo prune <app> --docker`) → `installer` (`pnpm install --frozen-lockfile` con caché de BuildKit para el store y `pnpm turbo run build`) → `runner`.
- `runner` corre como el usuario no-root `node`, sin npm/npx/corepack, con `NODE_ENV=production` y `HEALTHCHECK` basado en `node -e "fetch(...)"` (Alpine no trae curl).
- Prisma: `build` depende de `db:generate` (turbo.json), así que el cliente se genera dentro de la imagen y tsup lo empaqueta desde el código fuente. El compilador de queries (wasm) viene dentro de `@prisma/client`, que se instala como dependencia de producción.

### Por qué server/worker usan `pnpm install --prod` y no `pnpm deploy`

El bundle de tsup reescribe los imports de terceros de los paquetes internos a rutas como `../../../packages/observability/node_modules/pino/pino.js` (ver `apps/server/tsup.config.ts`). Por eso el runtime necesita el **layout del workspace podado** (`apps/<app>` + `packages/*/node_modules`). `pnpm deploy` aplana el proyecto en un solo directorio y rompería esas rutas, así que la etapa `prod-deps` instala solo dependencias de producción sobre `out/json` con `pnpm install --frozen-lockfile --prod --no-optional --ignore-scripts` y el `runner` copia ese árbol más `dist/`.

`--no-optional` es necesario porque `better-auth` declara `next`, `react`, `react-dom`, `vitest`, `prisma` y `mysql2` como _peers_ opcionales. pnpm los resuelve contra el workspace (admin y tests), por lo que en el lockfile aparecen como `optionalDependencies` de `better-auth`; `turbo prune` no los elimina. Medición sobre el prune de `@repo/server`:

| Instalación            | Paquetes | `node_modules` |
| ---------------------- | -------: | -------------: |
| `--prod`               |     1071 |        ~1,3 GB |
| `--prod --no-optional` |      469 |        ~345 MB |

El bundle no carga en runtime nada que sea opcional. `msgpackr-extract`, la aceleración nativa de BullMQ, tiene _fallback_ en JS.

El job `migrate` sí usa `pnpm deploy --filter=@repo/db` (directorio autocontenido con el CLI de Prisma, `prisma.config.ts`, el schema y las migraciones).

### Next.js (admin)

- `output: "standalone"` con `outputFileTracingRoot` en la raíz del repo: el servidor queda en `.next/standalone/apps/<app>/server.js`. El `runner` copia `standalone/`, `.next/static` y `public/` a `apps/<app>/`.
- `SKIP_ENV_VALIDATION=1` en el build (las variables de servidor se validan al usarse en runtime) y `NEXT_TELEMETRY_DISABLED=1`.
- **`API_INTERNAL_URL` se fija en el build**: los _rewrites_ (`/api/auth/*`, `/trpc/*`) quedan en el `routes-manifest`. Pásalo como build arg con la URL de la API vista desde el contenedor (en compose: `http://server:4000`). Cambiarlo exige reconstruir la imagen.
- `NEXT_PUBLIC_SENTRY_DSN` también se incrusta en el bundle del navegador (build arg).

### Web de la app (mobile-web: Expo + Caddy)

La versión web de la app para vecinos ([ADR 0002](./adr/0002-clientes-expo-universal-y-admin.md)) es el resultado de `expo export --platform web` (SPA: un `index.html` + bundles con hash) servido por Caddy con [`apps/mobile/Caddyfile`](../apps/mobile/Caddyfile):

- Etapas: `pruner` (`turbo prune @repo/mobile --docker`) → `installer` (`pnpm install` + `pnpm --filter @repo/mobile export:web`, salida en `apps/mobile/dist/web`) → `runner` (`caddy:2-alpine`, solo los archivos estáticos, usuario no-root `web`).
- **`EXPO_PUBLIC_API_URL` va vacío en el build**: el navegador llama a su propio origen y Caddy hace de proxy de `/api/auth/*` y `/trpc/*` hacia `API_UPSTREAM` (variable de **runtime**, default `http://server:4000`). Así la cookie de sesión es del mismo origen (sin CORS) y la misma imagen sirve para cualquier entorno.
- Fallback SPA a `/index.html` (Expo Router resuelve la ruta en el navegador), `Cache-Control: public, max-age=31536000, immutable` para `/_expo/static/*` y `/assets/*` (nombres con hash) y `no-cache` para el HTML. Un asset con hash inexistente responde 404 (no `index.html`).
- Headers de seguridad: CSP (`script-src 'self'`; `style-src` admite `'unsafe-inline'` porque react-native-web inyecta estilos en runtime; `connect-src 'self' https:` para Sentry), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` y `Cross-Origin-Opener-Policy`.
- `EXPO_PUBLIC_SENTRY_DSN` se incrusta en el bundle (build arg).
- Caddy escucha en `PORT` (8080) sin TLS (`auto_https off`): el TLS lo termina el proxy inverso de delante. Su estado va a `/tmp` (`XDG_*`), por lo que el contenedor funciona con sistema de archivos de solo lectura.
- La URL pública de esta web debe estar en `TRUSTED_ORIGINS` del server (Better Auth valida el `Origin` de los POST de autenticación).

## Construir imágenes

Siempre desde la raíz del repo. Con **Podman** (verificado con Podman 6.1 y `docker-compose` 5.5 contra el socket de Podman):

```bash
podman build --format docker -f apps/server/Dockerfile      -t farmacias-server:1.0.0 .
podman build --format docker -f apps/worker/Dockerfile      -t farmacias-worker:1.0.0 .
podman build --format docker -f docker/migrate.Dockerfile   -t farmacias-migrate:1.0.0 .
podman build --format docker -f apps/admin/Dockerfile \
  --build-arg API_INTERNAL_URL=http://server:4000 -t farmacias-admin:1.0.0 .
podman build --format docker -f apps/mobile/Dockerfile.web  -t farmacias-mobile-web:1.0.0 .
podman images --filter reference='*farmacias-*'      # tamaños
```

- `--format docker` conserva `HEALTHCHECK` y `STOPSIGNAL`; el formato OCI por defecto los descarta.
- Podman guarda las imágenes como `localhost/farmacias-*`. Compose y `podman run` las encuentran igual por su nombre corto.
- Los `RUN --mount=type=cache` y `--mount=type=secret` funcionan con Buildah. El aviso `missing "..." build argument` aparece en los `ARG` con valor vacío por defecto y es inofensivo.
- Tiempos medidos con la caché del store de pnpm ya caliente: worker ~4 min, migrate ~2 min, mobile-web ~2,5 min y admin ~3,5 min. La primera build de server tarda ~5 min, porque descarga el store.
- Construye **una imagen a la vez** si la VM de Podman es compartida o tiene poca memoria. Cada build ejecuta un `pnpm install` completo del prune.

Equivalente con **Docker** (BuildKit; Docker 23+ lo usa por defecto):

```bash
docker build -f apps/server/Dockerfile -t farmacias-server:1.0.0 .
docker build -f apps/worker/Dockerfile -t farmacias-worker:1.0.0 .
docker build -f docker/migrate.Dockerfile -t farmacias-migrate:1.0.0 .

docker build -f apps/admin/Dockerfile \
  --build-arg API_INTERNAL_URL=http://server:4000 \
  --build-arg NEXT_PUBLIC_SENTRY_DSN="$NEXT_PUBLIC_SENTRY_DSN" \
  --secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
  --build-arg SENTRY_ORG=mi-org --build-arg SENTRY_PROJECT=admin \
  -t farmacias-admin:1.0.0 .

docker build -f apps/mobile/Dockerfile.web \
  --build-arg EXPO_PUBLIC_SENTRY_DSN="$EXPO_PUBLIC_SENTRY_DSN" \
  -t farmacias-mobile-web:1.0.0 .
```

- La subida de source maps a Sentry es opcional: solo ocurre si se entrega el secreto `sentry_auth_token` (nunca como build arg, para que no quede en las capas).
- Multi-arquitectura: `docker buildx build --platform linux/amd64,linux/arm64 ... --push`.
- Build args disponibles en todos los Dockerfiles: `NODE_IMAGE`, `PNPM_VERSION`, `TURBO_VERSION` (deben coincidir con `package.json#packageManager` y el catálogo); `Dockerfile.web` agrega `CADDY_IMAGE` (`caddy:2-alpine`).
- Etiqueta las imágenes con el SHA del commit o la versión; evita desplegar `latest`.

## Variables de entorno por servicio

Cada app valida sus variables al iniciar (`src/env.ts`) y termina con un error legible si falta alguna. Detalle completo en [`ARCHITECTURE.md`](./ARCHITECTURE.md#variables-de-entorno) y en los `apps/*/.env.example`.

| Servicio   | Obligatorias                                                                                  | Opcionales (default)                                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| migrate    | `DATABASE_URL`                                                                                | —                                                                                                                                                                      |
| server     | `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET` (32+), `BETTER_AUTH_URL`, `TRUSTED_ORIGINS` | `NODE_ENV`, `HOST` (`0.0.0.0`), `PORT` (`4000`), `LOG_LEVEL` (`info`), `TRUST_PROXY_HOPS` (`1`), `RATE_LIMIT_MAX` (`300`), `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT` |
| worker     | `DATABASE_URL`, `REDIS_URL`, `SMTP_URL`, `EMAIL_FROM`                                         | `NODE_ENV`, `LOG_LEVEL`, `WORKER_CONCURRENCY` (`5`), `WORKER_HEALTH_PORT` (`4100`), `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT`                                        |
| admin      | `API_INTERNAL_URL` (build y runtime)                                                          | `NEXT_PUBLIC_SENTRY_DSN` (build), `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` (solo build), `PORT` (`3001`)                                                      |
| mobile-web | —                                                                                             | `API_UPSTREAM` (`http://server:4000`), `PORT` (`8080`), `EXPO_PUBLIC_SENTRY_DSN` (solo build)                                                                          |

Notas:

- `TRUSTED_ORIGINS` debe incluir las URLs públicas de la web de la app (mobile-web) y de admin, y `bnp://` (app iOS/Android).
- `TRUST_PROXY_HOPS` cuenta los proxies delante del server: con un proxy TLS → mobile-web (Caddy) → server son 2 saltos para las requests que llegan por la web de la app; si el proxy TLS también enruta directo a la API, usa el valor que corresponda a la ruta más común y revisa el rate limiting.
- Si la contraseña de Postgres tiene caracteres especiales, va _URL-encoded_ dentro de `DATABASE_URL`.
- Variables vacías (`SENTRY_DSN=`) cuentan como no definidas.
- OpenTelemetry (server y worker): las trazas se envían por OTLP/HTTP a `OTEL_EXPORTER_OTLP_ENDPOINT`. Las métricas y los logs son opcionales: `OTEL_METRICS_EXPORTER` (sin definir = desactivadas; `otlp` envía a `<endpoint>/v1/metrics`; también `console` o `prometheus`) y `OTEL_LOGS_EXPORTER` (sin definir = desactivado; los logs de pino siguen saliendo por stdout con `trace_id`/`span_id`). El muestreo usa las variables estándar `OTEL_TRACES_SAMPLER` / `OTEL_TRACES_SAMPLER_ARG`.
- Nunca se copian archivos `.env` a las imágenes: toda la configuración entra por variables de entorno del orquestador.

## Stack completo con Docker Compose

[`docker-compose.prod.yml`](../docker-compose.prod.yml) levanta Postgres 18, Redis 8, `migrate`, server, worker, admin y mobile-web en un solo host. Sirve para staging, demos o despliegues pequeños; en producción también puedes usar Postgres y Redis gestionados. Su proyecto por defecto es `farmacias-prod`, así no comparte contenedores ni volúmenes con los servicios de desarrollo (proyecto `farmacias`). El perfil opcional `demo` agrega Mailpit para capturar los emails (`SMTP_URL=smtp://mailpit:1025`, bandeja en <http://localhost:8025>).

```bash
cp docker/.env.example docker/.env      # completar POSTGRES_PASSWORD, BETTER_AUTH_SECRET, SMTP_URL...

# Podman (docker-compose habla con el socket de Podman). Imágenes ya construidas con IMAGE_TAG:
docker-compose --env-file docker/.env -f docker-compose.prod.yml --profile demo up -d --no-build
docker-compose --env-file docker/.env -f docker-compose.prod.yml --profile demo ps

# Docker (construye las imágenes si hace falta):
docker compose --env-file docker/.env -f docker-compose.prod.yml up -d --build

# Bajar todo (agrega -v para borrar los volúmenes de datos):
docker-compose --env-file docker/.env -f docker-compose.prod.yml --profile demo down
```

- **Archivo de variables:** `docker/.env` (ignorado por git y por `.dockerignore`) se usa con `--env-file` para _interpolar_ el compose. Cada servicio recibe solo sus variables en `environment:`; no se usa un `env_file` compartido para que, por ejemplo, admin nunca vea `BETTER_AUTH_SECRET` ni la contraseña de Postgres. Las variables obligatorias usan `${VAR:?mensaje}`: compose falla antes de crear contenedores si faltan. Si prefieres archivos por servicio (p. ej. secretos montados por tu plataforma), agrega `env_file:` solo en el servicio que los necesita.
- Postgres y Redis no publican puertos. Server (4000), admin (3001) y mobile-web (8080) sí. El `/health` del worker (4100, `WORKER_PORT`) y la bandeja de Mailpit (8025) se publican solo en `127.0.0.1`. Pon delante un proxy inverso con TLS (Caddy, Traefik, Nginx) y ajusta `TRUST_PROXY_HOPS`.
- Redis corre con AOF (`--appendonly yes`) y `--maxmemory-policy noeviction`, obligatorio para BullMQ.
- Defaults moderados: límites de memoria por servicio, logs `json-file` rotados (10 MB × 3), `restart: unless-stopped`, `init: true`, `no-new-privileges`, `cap_drop: ALL` y sistema de archivos de solo lectura en server, worker y mobile-web (`/tmp` en tmpfs).
- Cargar los datos sintéticos de demo (cuentas preinscritas, catálogo y pedidos; idempotente):

  ```bash
  docker compose --env-file docker/.env -f docker-compose.prod.yml run --rm \
    -e SEED_RESIDENT_PASSWORD='otra-clave-larga-1' -e SEED_OPERATOR_PASSWORD='otra-clave-larga-2' \
    -e SEED_ADMIN_PASSWORD='otra-clave-larga-3' server node dist/scripts/seed.js
  ```

- **Zona horaria de PostgreSQL:** las sesiones de Prisma fuerzan `timezone=UTC` (`createPrismaClient` en `@repo/db`), porque el adapter `pg` de Prisma escribe y lee `timestamptz` asumiendo UTC. No hace falta configurar la base, pero cualquier cliente SQL propio debe usar UTC para comparar con `now()`.

### Verificación (smoke test)

Registro histórico de la plantilla, previo al modelo de dominio del Sprint 1 (hoy no hay registro público, ni email de bienvenida, ni `SEED_ADMIN_*`). Se ejecutó el 3 de noviembre de 2026 con Podman 6.1, las cinco imágenes `:dev`, secretos sintéticos y el perfil `demo`. Las cookies de sesión llevan el prefijo `__Secure-bnp.` y el atributo `Secure`, porque `NODE_ENV=production`; con curl se reenvían a mano en el header `cookie:`.

| Verificación                   | Comando (resumen)                                                              | Resultado                                                    |
| ------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Migraciones                    | `migrate` (job)                                                                | `20261102000000_init` aplicada, exit 0                       |
| Seed del admin                 | `run --rm -e SEED_ADMIN_* server node dist/scripts/seed.js`                    | `Admin user created` + `Admin role granted`                  |
| Liveness / readiness           | `curl localhost:4000/health` · `/ready`                                        | 200 · 200 (`database: ok`, `redis: ok`)                      |
| Login                          | `POST /api/auth/sign-in/email` con `origin: http://localhost:8080`             | 200 + 2 `Set-Cookie`                                         |
| Origen no confiable            | mismo POST con `origin: https://evil.example`                                  | 403 `INVALID_ORIGIN`                                         |
| tRPC autenticado               | `GET /trpc/user.me` · `GET /trpc/admin.stats` con la cookie                    | 200 (rol `admin`) · 200; sin cookie → 401                    |
| Registro y email de bienvenida | `POST /api/auth/sign-up/email` → `GET localhost:8025/api/v1/messages`          | 200; el worker envía «¡Te damos la bienvenida…» en < 100 ms  |
| Worker                         | `curl localhost:4100/health`                                                   | 200                                                          |
| Admin                          | `/sign-in` · `/api/auth/get-session` · `/trpc/health.ping` · `/` sin cookie    | 200 · 200 (proxy) · 200 (proxy) · 307 → `/sign-in`           |
| mobile-web                     | `/` · `/sign-in` · bundle `/_expo/static/...` · hash inexistente               | 200 (CSP y `no-cache`) · 200 (SPA) · 200 `immutable` · 404   |
| Proxy de mobile-web            | `/api/auth/get-session` · `/trpc/health.ping` · `POST /api/auth/sign-in/email` | 200 · 200 · 200 + cookies                                    |
| Apagado ordenado               | `podman stop farmacias-server-1 farmacias-worker-1`                            | `Shutting down` → `Shutdown complete ok=true`, exit 0, < 1 s |

Memoria en reposo (`podman stats`): server ~94 MB, worker ~79 MB, admin ~76 MB, mobile-web ~12 MB, Postgres ~32 MB y Redis ~8 MB. Todos quedan muy por debajo de sus límites.

## Orden de despliegue y migraciones

1. **Construir y publicar** las imágenes con la misma etiqueta.
2. **Migrar:** ejecutar `migrate` una vez (`prisma migrate deploy`; solo aplica migraciones pendientes y es idempotente). En compose, server y worker dependen de `migrate` con `service_completed_successfully`. En Kubernetes usa un `Job` (o un hook _pre-upgrade_ de Helm) y en otras plataformas un _release command_.
3. **Desplegar server y worker** (rolling update). Las apps **nunca** migran al iniciar.
4. **Desplegar admin y mobile-web** (y publicar la versión iOS/Android con EAS si corresponde).

Las migraciones deben ser compatibles con la versión anterior del código (patrón _expand/contract_): primero se agregan columnas/tablas opcionales, se despliega el código que las usa y, en un despliegue posterior, se eliminan las antiguas. Así un rollback de la app no requiere revertir la base de datos.

## Escalamiento

- **server** no guarda estado: escala horizontalmente detrás de un balanceador. Sesiones en Postgres (Better Auth) y el rate limiting de auth en la tabla `rate_limit` son compartidos entre instancias; el límite global de `@fastify/rate-limit` es **por instancia** (memoria). Usa `/health` como _liveness_ y `/ready` (Postgres + Redis) como _readiness_.
- **worker**: cada réplica procesa hasta `WORKER_CONCURRENCY` jobs en paralelo por cola; el paralelismo total es `réplicas × WORKER_CONCURRENCY`. Ajústalo según los límites del proveedor SMTP y el pool de conexiones de Postgres. BullMQ reparte los jobs entre réplicas sin duplicarlos.
- **admin** y **mobile-web** son stateless (la caché de Next queda en `apps/admin/.next/cache` dentro del contenedor; mobile-web solo sirve archivos estáticos).
- Conexiones a Postgres: `réplicas × pool por instancia` debe quedar bajo `max_connections`; con muchas réplicas usa PgBouncer.

## Apagado ordenado

Los contenedores reciben `SIGTERM` (`STOPSIGNAL`) y compose espera `stop_grace_period` antes de `SIGKILL`:

- **server:** deja de aceptar conexiones, espera los requests en curso, cierra la cola (Redis), desconecta Prisma y vacía la telemetría. Límite interno 25 s (`stop_grace_period: 30s`).
- **worker:** `/health` pasa a 503, deja de tomar jobs, espera los que están en curso (20 s), cierra SMTP y Redis. Límite interno 27 s (`stop_grace_period: 30s`). Un job interrumpido vuelve a la cola y se reintenta.
- **admin:** el servidor de Next termina los requests en curso.
- **mobile-web:** Caddy deja de aceptar conexiones y termina las que están en curso.

En Kubernetes usa `terminationGracePeriodSeconds: 30` o más y un `preStop` corto (p. ej. `sleep 5`) para que el balanceador deje de enviar tráfico antes del `SIGTERM`.

## App iOS/Android (EAS)

Los binarios nativos no usan Docker (la versión web sí: imagen `mobile-web`): se compilan y publican con EAS ([`apps/mobile/eas.json`](../apps/mobile/eas.json), perfiles `development`, `preview` y `production`).

```bash
cd apps/mobile
eas build --profile production --platform all     # binarios para las tiendas
eas submit --profile production --platform all    # App Store Connect / Google Play
eas update --channel production --message "fix: ..."   # actualización OTA (solo JS/assets)
```

- `EXPO_PUBLIC_API_URL` (URL pública de la API) y `EXPO_PUBLIC_SENTRY_DSN` se incrustan en el build: defínelas como variables de EAS por entorno.
- Un cambio nativo (dependencias nativas, permisos, `app.config.ts`) requiere un nuevo `eas build`; los cambios de JS pueden ir por `eas update` al canal del perfil.
- Despliega la API antes que una versión móvil que dependa de procedimientos nuevos y mantén la API compatible con las versiones móviles aún en uso.

## Desarrollo local

[`docker-compose.yml`](../docker-compose.yml) solo levanta servicios de apoyo (las apps corren en el host con `pnpm dev`): Postgres 18 (`localhost:5432`), Redis 8 (`localhost:6379`) y Mailpit (SMTP `localhost:1025`, bandeja en <http://localhost:8025>). Toma los valores del `.env` raíz (`pnpm run setup`) y publica los puertos solo en `127.0.0.1`.

```bash
pnpm dev:services        # docker compose up -d
pnpm db:deploy           # aplica las migraciones
pnpm db:seed             # cuentas preinscritas, catálogo y pedidos de demo (SEED_*_PASSWORD de apps/server/.env)
pnpm dev:services:down   # docker compose down (agrega -v para borrar los datos)
```

Con Podman, `docker compose` es `docker-compose` (el binario standalone que habla con el socket de Podman): `docker-compose -p farmacias -f docker-compose.yml up -d`. Postgres, Redis y Mailpit quedan _healthy_ en ~10 s.
