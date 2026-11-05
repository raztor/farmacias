# 0001. Stack y versiones

- **Estado:** Aceptado
- **Fecha:** 2026-11-02
- **Autores:** equipo de plataforma

## Contexto

El proyecto necesita una app web, un backoffice, una app móvil (iOS/Android), una API y procesamiento en segundo plano, mantenidos por un equipo pequeño. Queremos:

- Compartir tipos, validaciones y componentes entre todas las plataformas sin generar código.
- Reglas de calidad que se apliquen solas (en local y en CI), para que el repo escale sin depender de revisiones manuales.
- Usar versiones **estables** y compatibles entre sí. A noviembre de 2026 varias librerías tienen una versión mayor nueva que todavía no es compatible con el resto del ecosistema; esas decisiones quedan registradas aquí.

## Decisiones

### 1. Monorepo con pnpm 12 + Turborepo 2

- **pnpm workspaces con catálogo** (`catalogMode: strict`): una sola versión de cada dependencia en todo el repo; `pnpm add` solo acepta versiones del catálogo. pnpm además aplica `allowBuilds` (solo paquetes aprobados ejecutan scripts de instalación).
- **Turborepo** orquesta `lint`, `typecheck`, `test` y `build` con caché y `--affected` (en el hook `pre-push` y en los PR de CI).
- Alternativas: Nx (más potente pero más pesado y opinado), npm/yarn workspaces (sin catálogo ni políticas de supply chain equivalentes).

### 2. TypeScript 6.0 en lugar de 7

TypeScript 7 (compilador nativo) ya está disponible, pero `typescript-eslint` declara `peerDependencies` `typescript: <6.1.0`. Sin `typescript-eslint` perderíamos las reglas con información de tipos (`strictTypeChecked`), que son parte central de las reglas del repo. Se fija `typescript: ~6.0.3` y Renovate no propone `>=6.1` hasta que `typescript-eslint` lo soporte.

### 3. Prisma 7.10 en lugar de 8.0

Prisma 8 está en _release candidate_. Se usa **Prisma 7.10** (generador `prisma-client`, `prisma.config.ts` y driver adapter `@prisma/adapter-pg`), que ya incluye el cliente sin motor en Rust. Migrar a 8 cuando sea estable debería ser acotado gracias a que solo `*.repository.ts` usa Prisma.

### 4. NativeWind 4 + Tailwind CSS 3.4 en lugar de Tailwind 4

La UI compartida (`@repo/ui`) se escribe una vez con React Native y se usa en Expo y en Next.js (react-native-web), con NativeWind como capa de estilos. **NativeWind 4** (estable) solo soporta **Tailwind 3**; NativeWind 5, que soporta Tailwind 4, sigue en RC. Se fija `tailwindcss: ~3.4` y Renovate no propone Tailwind 4.

### 5. API con Fastify 5 + tRPC 11

- **tRPC** da tipos de punta a punta: web, admin y mobile importan `type AppRouter` desde `@repo/api` sin generar clientes. La lógica vive en `@repo/api` (módulos `router → service → repository`) y es testeable con `createCaller` sin HTTP.
- **Fastify** como host HTTP: rendimiento, plugins oficiales (`helmet`, `cors`, `rate-limit`), logging con pino integrado y apagado ordenado.
- Alternativas: REST + OpenAPI (requiere generación de código), GraphQL (más infraestructura de la necesaria), Express (prohibido: mantenimiento y rendimiento inferiores).

### 6. Autenticación con Better Auth 1.7

Librería open source que corre en nuestro servidor y guarda los datos en nuestra base (adapter Prisma), con email+contraseña, plugin `admin` (roles, baneos) y plugin `expo` (sesiones en SecureStore para mobile). Alternativas: Auth.js (soporte mobile limitado), proveedores SaaS como Clerk/Auth0 (costo por usuario y datos fuera de nuestra base).

### 7. Jobs con BullMQ 6 + Redis

Colas persistentes con reintentos y backoff exponencial, procesadas por `apps/worker`. Los payloads se validan con zod al encolar y al procesar (`@repo/queue`). Alternativas: pg-boss (evita Redis, pero menor throughput y ecosistema), servicios gestionados (SQS, Cloud Tasks) que atan el proyecto a un proveedor.

### 8. Supply chain: `minimumReleaseAge` de 3 días

pnpm (`minimumReleaseAge: 4320` minutos) y Renovate (`minimumReleaseAge: "3 days"`) no instalan ni proponen versiones publicadas hace menos de 3 días. La mayoría de los paquetes comprometidos en npm se detectan y retiran en ese plazo. Costo: los parches de seguridad urgentes requieren una excepción explícita.

### 9. ESLint: `@eslint-react/eslint-plugin` en lugar de `eslint-plugin-react`

El repo usa ESLint 10 (flat config). `eslint-plugin-react` no soporta ESLint 10, mientras que `@eslint-react/eslint-plugin` sí, es más rápido y tiene reglas con información de tipos. Se complementa con `eslint-plugin-react-hooks` y `@next/eslint-plugin-next`.

### 10. Límites de código: 300 / 60 / 12

Definidos en [`tooling/eslint/limits.js`](../../tooling/eslint/limits.js) y aplicados como `error`:

| Límite                                       |         Valor | Motivo                                                                              |
| -------------------------------------------- | ------------: | ----------------------------------------------------------------------------------- |
| Líneas por archivo                           |           300 | Un archivo se lee entero sin perder contexto; obliga a separar responsabilidades.   |
| Líneas por función/componente                |            60 | Cabe en una pantalla; los componentes grandes se dividen en subcomponentes y hooks. |
| Complejidad ciclomática                      |            12 | Funciones con más caminos son difíciles de testear por completo.                    |
| Profundidad / parámetros / callbacks / `../` | 4 / 4 / 3 / 2 | Evitan anidamiento excesivo, firmas largas e imports que cruzan la estructura.      |

No se permite desactivarlos con `eslint-disable`; cambiarlos requiere un nuevo ADR.

## Consecuencias

- **Positivas:** tipos compartidos entre todas las plataformas; una sola versión por dependencia; reglas verificadas automáticamente; versiones estables y compatibles entre sí.
- **Negativas:** no usamos todavía TypeScript 7, Prisma 8 ni Tailwind 4; las actualizaciones de Expo SDK arrastran React y React Native y deben hacerse en bloque; los límites de código obligan a dividir archivos con más frecuencia.
- **Revisar:** cuando `typescript-eslint` soporte TypeScript ≥ 6.1/7, cuando Prisma 8 y NativeWind 5 sean estables, y en cada nuevo SDK de Expo. Cada cambio se documenta en un ADR nuevo.
