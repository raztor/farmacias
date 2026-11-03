# Pruebas E2E del flujo crítico

> Tarea: T-08 ([#31](https://github.com/raztor/farmacias/issues/31)) · Historias: HU-01, HU-02, HU-03, HU-04, HU-05, HU-06, HU-07, HU-08, HU-09 · Requisitos: RF-01..RF-11, RNF-05, RNF-10 · Navegadores: T-12, ver [navegadores.md](./navegadores.md) · Código: [`apps/e2e`](../../apps/e2e)

## Resultado

**La suite pasa completa contra el stack real** (API, worker, admin, web de la app Expo, PostgreSQL y Redis): **52 de 52 ejecuciones en verde** (10 pruebas de la app del residente × 4 navegadores/dispositivos y 6 del admin × 2 motores) en 29 s con 6 workers, levantando todo con un solo comando. Con `--repeat-each=2` (dos copias de cada prueba en paralelo) pasaron 88 de 88: los tests no dependen entre sí ni del orden.

Fecha: 2026-11-03. Rama `feat/sprint-1-mvp` (PR [#37](https://github.com/raztor/farmacias/pull/37)). Firefox no se pudo ejecutar en local (ver [Limitaciones](#limitaciones)); lo cubre el job `e2e` de CI.

## Cómo ejecutarlo

Un solo comando levanta el stack completo, corre la suite y lo apaga:

```bash
pnpm --filter @repo/e2e exec playwright install chromium firefox webkit   # una vez
pnpm --filter @repo/e2e e2e:full
```

Qué hace (`apps/e2e/src/scripts/e2e-stack.ts`):

1. **Servicios:** PostgreSQL, Redis y Mailpit de `docker-compose.yml` (`docker compose`, `docker-compose` o `podman compose`, el primero que funcione; `up -d --wait`). Quedan arriba al terminar (se bajan con `pnpm dev:services:down`).
2. **Base de datos dedicada `farmacias_e2e`:** `prisma migrate deploy` (la crea si no existe) y el seed idempotente (`pnpm db:seed`: catálogo sintético, cuentas preinscritas y pedidos de demo). Redis usa la base 1. Los datos E2E nunca se mezclan con los de desarrollo (`app`).
3. **Builds de producción:** server y worker (tsup), admin (`next build`, con `API_INTERNAL_URL` apuntando a la API del stack) y el export web de Expo (`EXPO_PUBLIC_API_URL` vacío = mismo origen).
4. **Procesos:** API en :4000 (espera `/ready`), worker con `/health` en :4100, admin con `next start` en :3001 y el export web en :8081 servido por `src/scripts/serve-static.ts`, que hace de proxy de `/api/auth/*` y `/trpc/*` hacia la API igual que Caddy en producción (cookie de sesión de primera parte). Antes de arrancar verifica que cada puerto esté libre.
5. **Playwright** con toda la matriz de navegadores y luego detiene los procesos (también con Ctrl+C).

Otros modos:

```bash
pnpm --filter @repo/e2e e2e:full -- --project=admin-chromium     # argumentos para Playwright
pnpm --filter @repo/e2e e2e:stack       # solo levanta el stack (Ctrl+C para detenerlo)
pnpm --filter @repo/e2e test:e2e        # en otra terminal: corre la suite contra ese stack
pnpm --filter @repo/e2e exec playwright show-report                # reporte HTML
node apps/e2e/src/scripts/matrix-summary.ts apps/e2e/test-results/results.json  # matriz en Markdown
```

Variables opcionales (cabecera de `src/scripts/stack-config.ts` y `src/support/env.ts`):

| Variable                                                                   | Por defecto                                          | Uso                                                                            |
| -------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| `E2E_SERVICES`                                                             | `compose`                                            | `external` para usar un PostgreSQL/Redis propios o los servicios del job de CI |
| `E2E_COMPOSE`                                                              | autodetección                                        | Comando de compose, p. ej. `podman compose`                                    |
| `E2E_DATABASE_URL`                                                         | `postgresql://app:app@127.0.0.1:5432/farmacias_e2e`  | Base dedicada (se crea y migra sola)                                           |
| `E2E_REDIS_URL` / `E2E_SMTP_URL`                                           | `redis://127.0.0.1:6379/1` / `smtp://127.0.0.1:1025` | Cola del worker / Mailpit                                                      |
| `E2E_API_PORT`, `E2E_ADMIN_PORT`, `E2E_WEB_PORT`, `E2E_WORKER_HEALTH_PORT` | 4000, 3001, 8081, 4100                               | Puertos, si los de desarrollo están ocupados                                   |
| `E2E_SKIP_BUILD=1`                                                         | —                                                    | Reutiliza los builds existentes (iteración rápida)                             |
| `E2E_BRANDED_BROWSERS=1`                                                   | — (CI: `1`)                                          | Agrega Google Chrome y Microsoft Edge instalados (`*-chrome`, `*-edge`)        |
| `SEED_*_PASSWORD`                                                          | valores sintéticos de `apps/server/.env.example`     | Contraseñas del seed; el script las pasa al seed y a Playwright                |

Los logs de cada proceso quedan en `apps/e2e/.cache/stack-logs/<proceso>.log` (ignorados por git); ante una falla el script muestra el final del log. Playwright guarda traza y captura de las pruebas que fallan (`apps/e2e/test-results`).

## Cómo se aíslan los datos

- **Cada prueba crea sus propios datos por la API real**, sin tocar la base: el administrador del seed crea un residente desechable por prueba con el plugin de administración de Better Auth (`POST /api/auth/admin/create-user`; el registro público sigue deshabilitado), y los pedidos se arman con los mismos procedimientos que usan las apps (`orders.addItem` → `orders.setFulfillment` → `orders.confirm`, `payments.pay`). Un residente tiene a lo más un borrador, así que compartir cuentas haría a las pruebas dependientes entre sí.
- **Productos por carriles:** cada spec usa un tramo distinto del catálogo (`PRODUCT_LANES` en `src/support/orders-api.ts`) y cada proyecto (navegador) y repetición un producto distinto dentro del tramo. Así, una prueba que descuenta stock (pago aprobado) nunca afecta a otra que verifica que el stock no cambió (pago rechazado), aunque corran en paralelo en todos los navegadores.
- Las verificaciones de efectos se hacen **por la API**: stock con `catalog.byId`, estado y línea de tiempo con `orders.detail`, transiciones con `operations.order`/`operations.transition`.
- Solo datos sintéticos (RNF-06): correos `e2e-<uuid>@demo.farmacia.cl`, sector «Lo Hermida», referencia «Pasaje Ficticio 123», alias «Vecina Ana».

## Casos

| ID     | Spec (`apps/e2e/src/…`)                                     | Qué verifica                                                                                                                                                                                                                                                                                                                                                   | Criterios                                                                      |
| ------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| E2E-01 | `mobile-web/resident-order.spec.ts`                         | Flujo feliz: busca sin sesión → inicia sesión y vuelve al producto → agrega 1 unidad (el stock no cambia en borrador) → «Mi pedido» → retiro en farmacia sin dirección → pago simulado aprobado → detalle con «Pago validado» y línea de tiempo «Pendiente de pago → Pago validado»; por API el stock bajó exactamente 1                                       | HU-01 #1, #3; HU-02 #1; HU-03 #1; HU-04 #1; HU-05 #1; HU-06 #1; HU-09 #1; D-02 |
| E2E-02 | `mobile-web/payment-rejected.spec.ts`                       | Pago simulado rechazado: muestra «Pago rechazado» y «Intentar de nuevo»; por API el stock no cambió y el pedido quedó en `payment_rejected`; el detalle ofrece reintentar el pago                                                                                                                                                                              | HU-05 #2; RF-08                                                                |
| E2E-03 | `mobile-web/delivery-validation.spec.ts`                    | Despacho simulado: la API rechaza un despacho sin alias (BAD_REQUEST); el formulario marca «Indica una referencia de dirección» e «Indica un alias de contacto» y no confirma (sigue en borrador); con los datos completos confirma y pasa al pago                                                                                                             | HU-04 #2; D-04                                                                 |
| E2E-04 | `mobile-web/access-denied.spec.ts`                          | Un residente no ve el pedido de otro: la API responde NOT_FOUND a `orders.detail` y `orders.cancel` (sin enumeración) y la pantalla muestra «No encontramos ese pedido.» sin el código ni el estado                                                                                                                                                            | HU-09 #2; RNF-05                                                               |
| E2E-05 | `admin/operator-flow.spec.ts`                               | Operario: filtra la bandeja por estado «Pago validado», modalidad «Retiro en farmacia» y código → abre el pedido → solo se ofrece «Iniciar preparación» → En preparación (nunca «Despachar (en ruta)» en retiro) → Listo para retiro → Entregado (sin más acciones); la API rechaza una transición inválida (CONFLICT) y el residente ve el historial completo | HU-07 #1; HU-08 #1, #2; RF-09, RF-10, RF-12                                    |
| E2E-06 | `admin/access-denied.spec.ts`                               | Un residente que entra al admin ve «No tienes acceso a la administración» en la bandeja y en el detalle de un pedido; la API responde FORBIDDEN a `operations.queue` y `operations.transition`                                                                                                                                                                 | HU-07 #2; RNF-05                                                               |
| E2E-07 | `mobile-web/catalog-search.spec.ts`                         | Búsqueda sin sesión por principio activo en mayúsculas y sin tildes; la tarjeta muestra nombre, precio y disponibilidad con texto. Término sin resultados: mensaje y «Modificar la búsqueda» limpia y enfoca el campo                                                                                                                                          | HU-01 #1, #2, #3 (CAT-E01, CAT-E02)                                            |
| E2E-08 | `mobile-web/sign-in.spec.ts`, `admin/sign-in.spec.ts`       | Pantallas de inicio de sesión en español, sin registro público, validación sin llamar a la API; el admin redirige a `/sign-in` sin sesión                                                                                                                                                                                                                      | HU-02; T-03                                                                    |
| E2E-09 | `mobile-web/responsive.spec.ts`, `admin/responsive.spec.ts` | Sin scroll horizontal en el viewport de cada proyecto y a 320 px de ancho (equivale a 400 % de zoom en 1280 px, WCAG 1.4.10)                                                                                                                                                                                                                                   | RNF-03 (T-12), RNF-02                                                          |

Pirámide (RNF-10, `docs/REPO_RULES.md` §8): estas pruebas son las menos numerosas y cubren lo que solo se ve de punta a punta (navegación, sesión por cookie a través de los proxies, permisos en las dos apps). Las reglas finas (cada transición del estado, montos, concurrencia e idempotencia del pago) están en las pruebas unitarias y de integración de `@repo/api`.

## CI

El job `e2e` de [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) corre después de `quality`:

- Servicios del job: `postgres:18-alpine` y `redis:8-alpine` (las mismas imágenes de `docker-compose.yml`), con `E2E_SERVICES=external`.
- Instala Chromium, Firefox y WebKit de Playwright (`--with-deps`) y usa Google Chrome y Microsoft Edge preinstalados en `ubuntu-latest` (`E2E_BRANDED_BROWSERS=1`).
- Ejecuta `pnpm --filter @repo/e2e e2e:full` (2 workers, 1 reintento: un reintento exitoso se marca como inestable en el reporte).
- Publica la matriz de resultados en el resumen de la ejecución (`src/scripts/matrix-summary.ts`) y, si falla, sube el reporte HTML, las trazas y los logs del stack como artefacto `playwright-report`.

## Ejecución local registrada

- **Entorno:** Apple M3 Pro, macOS 27.0.1; Node 26.5; Playwright 1.64.1 (Chromium 156.0.8078.4, WebKit 27.2); PostgreSQL 18.6 y Redis locales (Homebrew) con `E2E_SERVICES=external` y puertos alternativos (`E2E_API_PORT=4401`, `E2E_ADMIN_PORT=3401`, `E2E_WEB_PORT=8481`) porque los de desarrollo estaban en uso.
- **Comando:** `pnpm --filter @repo/e2e e2e:full -- --project='*chromium' --project='*webkit' --project=mobile-web-pixel --project=mobile-web-iphone`.
- **Resultado:** 52 passed (29,2 s). Arranque del stack con builds en caché de Turborepo: ~25 s. Detalle por navegador en [navegadores.md](./navegadores.md).

## Limitaciones

- **Firefox en local:** el Firefox de Playwright 1.64.1 no arranca en macOS 27.0.1 («Could not find profile folder», también fuera del sandbox y con perfil propio). Es un problema del binario en esta versión del sistema, no de la app. Firefox se ejecuta en el job de CI (Ubuntu).
- **Compose en local:** la VM de Podman estaba bloqueada durante esta ejecución, por lo que se usó PostgreSQL y Redis nativos con `E2E_SERVICES=external`. El modo `compose` usa el mismo `docker-compose.yml` de `pnpm dev:services`.
- **Pruebas nativas (iOS/Android):** fuera de esta suite; el smoke nativo es de Maestro (`apps/mobile/.maestro`).
- La base `farmacias_e2e` acumula residentes y pedidos de prueba entre ejecuciones (no se reinicia: las pruebas no dependen de su estado). Para empezar de cero basta con eliminarla; la siguiente ejecución la vuelve a crear, migrar y poblar.
