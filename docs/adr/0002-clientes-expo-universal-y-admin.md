# 0002. Clientes: app Expo universal para vecinos y backoffice Next.js

- **Estado:** Aceptado
- **Fecha:** 2026-11-03
- **Autores:** equipo Better Name Pending

## Contexto

El proyecto es el MVP de la **Farmacia Comunitaria de Peñalolén** ([github.com/raztor/farmacias](https://github.com/raztor/farmacias)). La Inception pide:

- Una aplicación para los vecinos en iOS y Android.
- Un **“MVP web responsive”** para quienes no instalan la app.
- Un backoffice para que el equipo de la farmacia opere y administre el sistema.

El repositorio partió de una plantilla con tres clientes: `apps/mobile` (Expo), `apps/web` (Next.js, sitio público + área autenticada) y `apps/admin` (Next.js, backoffice). `apps/web` y `apps/mobile` implementaban **las mismas pantallas para el mismo público** (inicio de sesión, registro, perfil) con dos routers, dos clientes de autenticación y dos suites E2E. Con un equipo pequeño, cada funcionalidad para vecinos se habría tenido que construir, probar y mantener dos veces.

Expo SDK 58 + Expo Router genera, desde el mismo código, los binarios nativos y una versión web (`expo export --platform web`) que usa react-native-web; `@repo/ui` ya está escrito con React Native + NativeWind, así que se ve igual en las tres plataformas.

## Opciones consideradas

1. **Mantener `apps/web` (Next.js) + `apps/mobile` (Expo).** Ventajas: SSR y SEO. Desventajas: interfaces duplicadas para el mismo usuario, doble esfuerzo por funcionalidad y riesgo de que ambas versiones diverjan. El MVP no necesita SEO (el contenido es privado, tras inicio de sesión).
2. **Solo Next.js responsive, sin apps nativas.** Ventajas: un solo cliente web. Desventajas: no cumple el requisito de app iOS/Android ni aprovecha capacidades nativas (almacenamiento seguro, notificaciones).
3. **App Expo universal (iOS/Android/web) para vecinos + Next.js solo para el backoffice.** Ventajas: una sola base de código para vecinos; la web sale del mismo código. Desventajas: la web es una SPA (sin SSR) y depende de react-native-web.

## Decisión

Se adopta la **opción 3**:

- **`apps/mobile`** (Expo universal) es el cliente de los vecinos en iOS, Android y web. Su exportación web estática (`expo export --platform web`, `web.output: "single"`) **cumple el “MVP web responsive” de la Inception**.
- **`apps/admin`** (Next.js) es el backoffice de operación y administración, solo para el rol `admin`.
- **`apps/web` se elimina** para no mantener dos interfaces para el mismo público.

## Consecuencias

- **Positivas:**
  - Cada funcionalidad para vecinos se construye una vez y llega a iOS, Android y web.
  - Menos código, dependencias y pipelines que mantener.
  - El backoffice queda separado: puede evolucionar con sus propias necesidades (tablas, reportes) sin afectar la app.
- **Negativas / costos:**
  - La web de la app es una SPA sin SSR ni SEO; si el proyecto necesitara páginas públicas indexables (p. ej. catálogo abierto), habría que evaluar `web.output: "static"` de Expo Router o un sitio aparte en un ADR nuevo.
  - Las librerías de la app deben funcionar en web (o tener una alternativa por plataforma). Por ejemplo, `expo-secure-store` no existe en web: allí la sesión vive en la cookie del navegador.
  - El tamaño del bundle web es mayor que el de una app Next.js equivalente (react-native-web).
- **Cambios que implica:**
  - **E2E en `apps/e2e`** (`@repo/e2e`): Playwright con los proyectos `admin` (`:3001`) y `mobile-web` (`:8081` en desarrollo). Los flujos nativos siguen con Maestro (`apps/mobile/.maestro`).
  - **Proxy del mismo origen para la web de Expo:** en producción la web se construye con `EXPO_PUBLIC_API_URL` vacío y se sirve con Caddy (`apps/mobile/Dockerfile.web`, `apps/mobile/Caddyfile`), que hace de proxy de `/api/auth/*` y `/trpc/*` hacia el server. Así la cookie de sesión de Better Auth es del mismo origen, sin CORS, igual que los _rewrites_ del admin. En iOS/Android el cliente sigue llamando directo a la API con la cookie guardada en SecureStore.
  - `TRUSTED_ORIGINS` incluye la URL de la web de la app (en desarrollo `http://localhost:8081`) y la del admin, además de `bnp://`.
  - `docker-compose.prod.yml` reemplaza el servicio `web` por `mobile-web` (puerto 8080) y CI construye la imagen `mobile-web`.
- **Revisar:** si se necesitan páginas públicas indexables, o si react-native-web limita la accesibilidad o el rendimiento de la web en dispositivos de gama baja.
