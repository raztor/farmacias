# Compatibilidad de navegadores y diseño responsivo

> Tarea: T-12 ([#35](https://github.com/raztor/farmacias/issues/35)) · Requisito: **RNF-03** (dos últimas versiones de Chrome, Edge y Firefox, en escritorio y móvil; web de la app y admin) · Suite: [e2e.md](./e2e.md) · Código: [`apps/e2e/playwright.config.ts`](../../apps/e2e/playwright.config.ts)

## Resultado

**Chromium (motor de Chrome y Edge) y WebKit (Safari), en escritorio y en teléfono, pasan el 100 % de la suite E2E** en local: 52 de 52 ejecuciones (2026-11-03). Firefox, Google Chrome y Microsoft Edge de marca se ejecutan en el job `e2e` de CI (Ubuntu), que publica la misma matriz en el resumen de cada ejecución; en local Firefox no arranca en macOS 27 (ver [Limitaciones](#limitaciones)).

## Cómo se cubre RNF-03

Las mismas pruebas E2E del flujo crítico (no un smoke aparte) corren en cada proyecto de Playwright:

| Proyecto              | App                  | Motor / dispositivo                                           | Cubre                                           | Dónde corre |
| --------------------- | -------------------- | ------------------------------------------------------------- | ----------------------------------------------- | ----------- |
| `admin-chromium`      | Admin (Next.js)      | Chromium 156, escritorio 1280×720                             | Chrome y Edge (mismo motor Blink + V8)          | Local y CI  |
| `admin-firefox`       | Admin                | Firefox (Gecko) de Playwright, escritorio                     | Firefox                                         | CI          |
| `admin-webkit`        | Admin                | WebKit 27.2, escritorio                                       | Safari (extra, no exigido)                      | Local y CI  |
| `admin-chrome`        | Admin                | Google Chrome estable instalado (`channel: "chrome"`)         | Chrome de marca                                 | CI          |
| `admin-edge`          | Admin                | Microsoft Edge estable instalado (`channel: "msedge"`)        | Edge de marca                                   | CI          |
| `mobile-web-chromium` | Web de la app (Expo) | Chromium 156, escritorio                                      | Chrome y Edge de escritorio                     | Local y CI  |
| `mobile-web-firefox`  | Web de la app        | Firefox de Playwright, escritorio                             | Firefox de escritorio                           | CI          |
| `mobile-web-webkit`   | Web de la app        | WebKit 27.2, escritorio                                       | Safari (extra)                                  | Local y CI  |
| `mobile-web-chrome`   | Web de la app        | Google Chrome estable instalado                               | Chrome de marca                                 | CI          |
| `mobile-web-edge`     | Web de la app        | Microsoft Edge estable instalado                              | Edge de marca                                   | CI          |
| `mobile-web-pixel`    | Web de la app        | Pixel 7 (Chromium móvil, 412×839, táctil, user agent Android) | Chrome y Edge en Android                        | Local y CI  |
| `mobile-web-iphone`   | Web de la app        | iPhone 15 (WebKit móvil, 393×659, táctil)                     | Safari / navegadores de iOS (todos usan WebKit) | Local y CI  |

- **Edge:** desde 2020 Edge usa Chromium (Blink + V8), igual que Chrome, por lo que los proyectos `*-chromium` y `mobile-web-pixel` prueban su motor. En CI, además, `*-edge` corre la suite en el Microsoft Edge estable instalado en `ubuntu-latest` (`E2E_BRANDED_BROWSERS=1`), y `*-chrome` en Google Chrome estable.
- **Móvil:** la app del residente se prueba en viewport de teléfono con emulación táctil (Pixel 7 y iPhone 15). El admin es una herramienta de escritorio para el personal; su adaptación a pantallas chicas se verifica con la prueba responsiva a 320 px.
- **Diseño responsivo:** `mobile-web/responsive.spec.ts` y `admin/responsive.spec.ts` verifican con `reflowProblems` que no haya scroll horizontal del documento ni cajas que recorten o desplacen contenido de lado (p. ej. dentro del `ScrollView` de RN-web) en el viewport de cada proyecto y a 320 px de ancho (equivale a 1280 px con 400 % de zoom, WCAG 1.4.10). La tabla de la bandeja oculta columnas secundarias y, si hace falta, se desplaza dentro de su propio recuadro, nunca la página completa.
- **«Dos últimas versiones»:** Playwright fija una versión por motor (la estable más reciente del momento de su lanzamiento) y Chrome/Edge de marca en CI son la estable vigente del runner. La versión anterior no se automatiza: la app no usa APIs recientes sin soporte amplio (React Native Web, CSS de Tailwind/NativeWind y `fetch`), y si se requiere evidencia de la versión N-1 se puede correr la misma suite con `channel: "chrome-beta"`/una instalación anterior del navegador. Queda como verificación manual pendiente.

## Matriz registrada (local)

Comando: `pnpm --filter @repo/e2e e2e:full -- --project='*chromium' --project='*webkit' --project=mobile-web-pixel --project=mobile-web-iphone` (generada con `node apps/e2e/src/scripts/matrix-summary.ts apps/e2e/test-results/results.json`).

Ejecución: 2026-11-03T08:44:16Z · 52 ejecuciones · 0,5 min · fallas: 0. «—» = la prueba no es de esa app o el proyecto no corrió en local (Firefox).

| Prueba                                                                            | admin-chromium | admin-firefox | admin-webkit | mobile-web-chromium | mobile-web-firefox | mobile-web-webkit | mobile-web-pixel | mobile-web-iphone |
| --------------------------------------------------------------------------------- | :------------: | :-----------: | :----------: | :-----------------: | :----------------: | :---------------: | :--------------: | :---------------: |
| admin: acceso denegado a residentes (HU-07 #2)                                    |       ✅       |      CI       |      ✅      |          —          |         —          |         —         |        —         |         —         |
| admin: bandeja y avance de un pedido hasta «Entregado» (HU-07, HU-08)             |       ✅       |      CI       |      ✅      |          —          |         —          |         —         |        —         |         —         |
| admin: diseño responsivo, sin scroll horizontal en escritorio y a 320 px (RNF-03) |       ✅       |      CI       |      ✅      |          —          |         —          |         —         |        —         |         —         |
| admin: inicio de sesión (3 pruebas)                                               |       ✅       |      CI       |      ✅      |          —          |         —          |         —         |        —         |         —         |
| mobile-web: acceso denegado entre cuentas (HU-09 #2)                              |       —        |       —       |      —       |         ✅          |         CI         |        ✅         |        ✅        |        ✅         |
| mobile-web: buscador sin sesión, sin tildes ni mayúsculas (HU-01)                 |       —        |       —       |      —       |         ✅          |         CI         |        ✅         |        ✅        |        ✅         |
| mobile-web: término sin resultados y «Modificar la búsqueda» (HU-01 #2)           |       —        |       —       |      —       |         ✅          |         CI         |        ✅         |        ✅        |        ✅         |
| mobile-web: despacho simulado exige sus campos (HU-04)                            |       —        |       —       |      —       |         ✅          |         CI         |        ✅         |        ✅        |        ✅         |
| mobile-web: pago rechazado sin cambio de stock y reintentos (HU-05 #2 #3)         |       —        |       —       |      —       |         ✅          |         CI         |        ✅         |        ✅        |        ✅         |
| mobile-web: flujo feliz hasta «Pago validado» (HU-01..HU-06, HU-09)               |       —        |       —       |      —       |         ✅          |         CI         |        ✅         |        ✅        |        ✅         |
| mobile-web: diseño responsivo de «/» y «/sign-in» (2 pruebas, RNF-03)             |       —        |       —       |      —       |         ✅          |         CI         |        ✅         |        ✅        |        ✅         |
| mobile-web: inicio de sesión (2 pruebas)                                          |       —        |       —       |      —       |         ✅          |         CI         |        ✅         |        ✅        |        ✅         |

Los proyectos `*-chrome` y `*-edge` solo existen con `E2E_BRANDED_BROWSERS=1` (CI). La matriz completa de cada ejecución de CI queda en el resumen del job `E2E (Playwright, stack completo, matriz de navegadores)`.

## Limitaciones

- **Firefox local:** el binario de Firefox de Playwright 1.64.1 termina al iniciar en macOS 27.0.1 («Could not find profile folder»), aun con un perfil propio y fuera del sandbox; no es un problema de la app. Se cubre en CI (Ubuntu). Pendiente: anotar aquí el resultado de la primera ejecución de CI del PR #37.
- **Chrome y Edge de marca:** no están instalados en el equipo local; se cubren en CI.
- **Versión N-1** de cada navegador: no automatizada (ver arriba).
- Dispositivos físicos: no se probaron; la emulación de Playwright reproduce viewport, densidad, táctil y user agent, pero no el navegador real del teléfono.
