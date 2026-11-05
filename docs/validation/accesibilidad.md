# Auditoría de accesibilidad y legibilidad

> Tarea: T-09 ([#32](https://github.com/raztor/farmacias/issues/32)) · Requisitos: RNF-01 (teclado, foco visible, no solo color), RNF-02 (zoom 200 % sin pérdida ni desplazamiento horizontal) · Indicador del Inception §3.4: «cero defectos críticos en la lista de comprobación definida para el MVP» · Código: [`apps/e2e/src/a11y`](../../apps/e2e/src/a11y), [`packages/ui/src/lib/contrast.test.ts`](../../packages/ui/src/lib/contrast.test.ts)

## Resultado

**Cero defectos críticos.** Las 12 pantallas críticas de las dos apps web pasan axe-core (WCAG 2.0/2.1 A y AA) **sin ninguna violación** (ni siquiera de impacto menor), los dos flujos críticos se completan **solo con teclado** con foco visible en las 23 paradas, todas las pantallas se reacomodan a 200 % de zoom sin scroll horizontal y los 69 pares de color de los tokens cumplen el contraste WCAG en modo claro y oscuro.

La auditoría encontró **4 defectos** (3 serios para axe y 1 de contraste de componentes), todos corregidos en este mismo cambio (ver [Defectos encontrados y corregidos](#defectos-encontrados-y-corregidos)).

Fecha: 2026-11-03. Rama `feat/sprint-1-mvp` (PR [#37](https://github.com/raztor/farmacias/pull/37)). Chromium de escritorio contra el stack E2E completo (build de producción del admin y export web de Expo).

| Verificación                                      | Resultado                                                    |
| ------------------------------------------------- | ------------------------------------------------------------ |
| axe, 7 pantallas del residente + 5 del admin      | 0 violaciones (antes de corregir: 5 serias en 6 pantallas)   |
| Flujo del residente solo con teclado (13 paradas) | Completo, foco visible en todas                              |
| Flujo del operario solo con teclado (10 paradas)  | Completo, foco visible en todas; «Saltar al contenido» y Esc |
| Zoom 200 % (640 px) en las 12 pantallas           | 0 px de scroll horizontal (antes: 12 px en «Usuarios»)       |
| Estados con texto (no solo color)                 | Disponibilidad, estado del pedido y bandeja con texto        |
| Contraste de tokens (claro y oscuro)              | 69 de 69 casos (antes: 5 fallaban)                           |
| Estabilidad (`--repeat-each=2`)                   | 8 de 8                                                       |
| Regresión de la suite E2E existente en Chromium   | 16 de 16                                                     |

## Lista de comprobación del MVP

Criterio de «defecto crítico»: cualquier violación de impacto `serious` o `critical` de axe, o cualquier ítem de esta lista que falle en una vista crítica.

| #   | Ítem                                                                 | WCAG 2.1     | RNF    | Cómo se verifica                                                                                | Estado |
| --- | -------------------------------------------------------------------- | ------------ | ------ | ----------------------------------------------------------------------------------------------- | ------ |
| 1   | Las funciones críticas se operan solo con teclado                    | 2.1.1        | RNF-01 | `keyboard.spec.ts` (ambas apps): Tab, Enter, Espacio y Esc, sin clics                           | ✅     |
| 2   | Sin trampas de foco; Esc cancela la confirmación de avance           | 2.1.2        | RNF-01 | `a11y/admin/keyboard.spec.ts` (paso «Escape cancela…»)                                          | ✅     |
| 3   | Orden de foco lógico (correo → contraseña → botón)                   | 2.4.3        | RNF-01 | `keyboard.spec.ts`: un solo Tab entre campos consecutivos                                       | ✅     |
| 4   | Foco visible en cada control del flujo                               | 2.4.7        | RNF-01 | `focusIndicator`: estilo computado (outline opaco o anillo `box-shadow`), anotado en el reporte | ✅     |
| 5   | Enlace «Saltar al contenido» como primera parada del admin           | 2.4.1        | RNF-01 | `a11y/admin/keyboard.spec.ts`: primer Tab, visible, Enter enfoca `#contenido`                   | ✅     |
| 6   | Nombres y roles accesibles (botones, enlaces, campos, listas, zonas) | 4.1.2, 1.3.1 | RNF-01 | axe (`button-name`, `link-name`, `label`, `list`…) + consultas por rol en los specs             | ✅     |
| 7   | El nombre accesible contiene el texto visible                        | 2.5.3        | RNF-01 | axe `label-content-name-mismatch`                                                               | ✅     |
| 8   | Estados no dependen solo del color (texto + símbolo)                 | 1.4.1        | RNF-01 | `screens.spec.ts`: «Pago validado», «Disponibilidad: …» como texto; axe `link-in-text-block`    | ✅     |
| 9   | Contraste de texto ≥ 4,5:1                                           | 1.4.3        | RNF-01 | axe `color-contrast` + `contrast.test.ts`                                                       | ✅     |
| 10  | Contraste de componentes y foco ≥ 3:1 (bordes de campos, anillo)     | 1.4.11       | RNF-01 | `contrast.test.ts` (axe no lo mide)                                                             | ✅     |
| 11  | Zoom 200 % sin pérdida de información                                | 1.4.4        | RNF-02 | `checkScreen`: el contenido clave sigue visible a 640 px y ninguna caja recorta contenido       | ✅     |
| 12  | Reflujo sin scroll horizontal                                        | 1.4.10       | RNF-02 | `checkScreen` (640 px) + `responsive.spec.ts` de T-12 (320 px = 400 %), con `reflowProblems`    | ✅     |
| 13  | Idioma de la página, títulos y encabezados                           | 3.1.1, 2.4.2 | RNF-01 | axe (`html-has-lang`, `document-title`, `heading-order`)                                        | ✅     |
| 14  | Errores que dicen qué pasó y cómo seguir                             | 3.3.1, 3.3.3 | RNF-09 | Cubierto por los E2E de T-08 (`delivery-validation`, `payment-rejected`, `sign-in`)             | ✅     |

## Método

### 1. Automatizado con axe-core

`auditScreen` ([`apps/e2e/src/support/a11y.ts`](../../apps/e2e/src/support/a11y.ts)) ejecuta `@axe-core/playwright` con las etiquetas `wcag2a`, `wcag2aa`, `wcag21a` y `wcag21aa`. Las violaciones `serious` y `critical` hacen fallar la prueba; las de impacto menor quedan como anotación `a11y-minor` en el reporte (hoy no hay ninguna). El resultado completo de axe de cada pantalla se adjunta al reporte HTML de Playwright (`axe-<pantalla>`).

Pantallas auditadas, con datos reales creados por la API (residente desechable, pedido pagado):

| App                  | Pantallas                                                                                                                                                                             | Spec                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Residente (Expo web) | Catálogo con resultados, detalle de producto, inicio de sesión, Mi pedido, Confirmar (despacho y retiro), Pago simulado, resultado del pago, detalle con línea de tiempo, Mis pedidos | `a11y/mobile-web/screens.spec.ts` |
| Admin (Next.js)      | Inicio de sesión, bandeja filtrada, detalle del pedido, confirmación de avance (con nota), Usuarios, Auditoría                                                                        | `a11y/admin/screens.spec.ts`      |

### 2. Teclado y foco visible (Playwright)

`keyboardWalker` llega a cada control **solo con Tab** (falla si no es alcanzable en 60 pulsaciones) y lo activa con Enter (o Espacio en las opciones de modalidad). En cada parada inspecciona el estilo computado de `document.activeElement`: cuenta como indicador un `outline` con color opaco o una capa de `box-shadow` (los anillos de Tailwind) con color opaco y tamaño. El `outline: 2px solid transparent` que deja `outline-none` **no** cuenta. Cada parada queda anotada en el reporte, por ejemplo `5× Tab → <button> «Simular pago aprobado» rgb(37, 99, 235) 0px 0px 0px 2px`.

- **Residente** (`a11y/mobile-web/keyboard.spec.ts`): búsqueda → resultado → «Inicia sesión para agregarlo» → correo → contraseña → «Iniciar sesión» → «Agregar al pedido» → «Ver mi pedido» → «Continuar» → «Retiro en farmacia» (Espacio) → «Confirmar pedido» → «Simular pago aprobado» → «Ver seguimiento» → navegación principal «Mis pedidos».
- **Operario/administración** (`a11y/admin/keyboard.spec.ts`): inicio de sesión → «Saltar al contenido» → filtro por código → «Aplicar filtros» → «Ver pedido» → «Iniciar preparación» (la confirmación recibe el foco y **Esc** la cancela sin cambios) → «Sí, iniciar preparación» → navegación «Usuarios» → selector de rol.

### 3. Zoom 200 % (RNF-02)

`checkScreen` repite cada pantalla con un viewport de **640 px** de ancho, que equivale a una ventana de 1280 px con el navegador al 200 %: el contenido clave de la pantalla debe seguir visible y `reflowProblems` ([`apps/e2e/src/support/layout.ts`](../../apps/e2e/src/support/layout.ts)) no debe encontrar nada:

- **Documento:** sin scroll horizontal (`scrollWidth − clientWidth = 0`).
- **Cajas que recortan o se desplazan:** ningún elemento con `overflow-x` distinto de `visible` puede tener contenido más ancho que él (`scrollWidth > clientWidth`). Con `hidden`/`clip` el contenido queda **recortado** (información perdida); con `auto`/`scroll` la caja se desplaza de lado. El mensaje nombra la caja y el primer elemento que sobresale. Se excluyen los campos de formulario (desplazan su propio texto), los elementos visualmente ocultos (`sr-only`, como «Saltar al contenido» antes de recibir el foco) y las cajas que contienen una tabla de datos: las tablas del admin pueden desplazarse dentro de su propia caja (excepción de WCAG 1.4.10 para tablas de datos).

La segunda parte es indispensable en la app del residente: cada pantalla vive dentro de un `ScrollView` de react-native-web (`overflow-x: hidden`), la plantilla web de Expo fija `body { overflow: hidden }` y las vistas de RN-web se encogen (`min-width: 0`). Una fila que no cabe a 640 px queda cortada en el borde derecho **sin ensanchar el documento**, así que la medición solo del documento (la que había antes de la revisión adversarial del PR [#37](https://github.com/raztor/farmacias/pull/37)) nunca podía fallar en la web de la app. Las autopruebas de [`apps/e2e/src/self-test/layout.spec.ts`](../../apps/e2e/src/self-test/layout.spec.ts) reproducen esa estructura y verifican que la medición del documento da 0 mientras `reflowProblems` detecta los 560 px recortados; además se comprobó contra el export web real insertando una fila de 1200 px en «Iniciar sesión» (documento: 0 px; `reflowProblems`: 672 px recortados en el `ScrollView`). Con la comprobación nueva, todas las pantallas críticas de ambas apps siguen pasando a 640 px y a 320 px.

La prueba de T-12 (`responsive.spec.ts`) cubre además 320 px (400 %).

### 4. Contraste de tokens (prueba unitaria)

[`packages/ui/src/lib/contrast.test.ts`](../../packages/ui/src/lib/contrast.test.ts) calcula la razón de contraste WCAG (luminancia relativa) de cada par de tokens de [`@repo/tailwind-config`](../../packages/tailwind-config/src/tokens.js) que las apps realmente dibujan, en modo claro y oscuro: 24 pares de texto (≥ 4,5:1) y 9 de componentes (anillo de foco, bordes de campos y de estados, ≥ 3:1). Corre en `pnpm test` sin navegador, así que un cambio de color que rompa la legibilidad falla antes de cualquier E2E.

Valores después de las correcciones (modo claro / oscuro):

| Par                                      |  Claro | Oscuro |
| ---------------------------------------- | -----: | -----: |
| `foreground` / `background`              | 19,9:1 | 19,1:1 |
| `muted-foreground` / `muted`             |  5,1:1 |  5,8:1 |
| `muted-foreground` / `accent`            |  5,2:1 |  5,7:1 |
| `primary` / `background` (enlaces, info) |  5,2:1 |  7,8:1 |
| `destructive` / `background` (errores)   |  4,8:1 |  7,2:1 |
| `warning-foreground` / `warning`         |  5,0:1 |  9,0:1 |
| `ring` / `background` (foco)             |  5,2:1 |  7,8:1 |
| `input` / `background` (borde de campos) |  3,4:1 |  4,1:1 |

## Defectos encontrados y corregidos

| #   | Defecto                                                                                                                                                                                                                       | WCAG   | Dónde                                              | Corrección                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| D1  | Texto secundario (`muted-foreground` #71717a) sobre `muted`/`accent`: 4,4:1. axe lo marcó serio en «Mi pedido» (total de unidades), «Confirmar» (descripción de modalidad) y la ayuda de la nota en la confirmación del admin | 1.4.3  | Token compartido                                   | `muted-foreground` claro → #67676f (5,1:1 sobre `muted`, 5,6:1 sobre blanco)                          |
| D2  | Borde de los campos (`input` #d4d4d8 claro, #3f3f46 oscuro): 1,5:1 y 1,9:1 contra el fondo; un adulto mayor con baja visión no distingue dónde escribir                                                                       | 1.4.11 | Token compartido                                   | `input` → #8a8a93 (3,4:1) y #71717a oscuro (4,1:1)                                                    |
| D3  | Tarjetas de resultado y de «Mis pedidos» con un `accessibilityLabel` que reescribía el contenido: el nombre accesible no contenía el texto visible (control por voz: «clic en Losartán 50 mg» no funcionaba)                  | 2.5.3  | `product-card.tsx`, `order-list-item.tsx` (mobile) | El enlace toma su nombre del contenido visible (la insignia aporta «Disponibilidad: …» / «Estado: …») |
| D4  | «Usuarios» del admin: 12 px de scroll horizontal a 200 %: el encabezado `sr-only` («Acciones») es absoluto y escapaba de la caja con scroll de la tabla                                                                       | 1.4.10 | `users-table.tsx` (admin)                          | Contenedor `relative` para que el `sr-only` quede dentro de su caja                                   |

## Hallazgos no críticos (pendientes)

No bloquean la entrega (no son defectos críticos según la lista), pero conviene abordarlos:

1. **Recorrido largo con Tab en listas:** en el catálogo hay 9 paradas (filtros de categoría) antes del primer resultado y en la bandeja del admin 13 antes del campo «Código de pedido» y 16 hasta el primer pedido. El admin tiene «Saltar al contenido»; la app del residente no tiene un atajo equivalente para saltar los filtros. Sugerencia: enlace «Ir a los resultados».
2. **Nombre de las tarjetas sin pausas:** al tomar el nombre del contenido, algunos lectores de pantalla leen «Venlafaxina Cordillera Venlafaxina · Cápsulas…» sin separadores entre bloques. Es comprensible, pero se puede mejorar con un nombre que _empiece_ por el texto visible y agregue la información extra (cumple 2.5.3).
3. **App nativa (iOS/Android):** axe solo audita la versión web. VoiceOver/TalkBack y el texto del sistema al 200 % en el teléfono se revisan a mano (pendiente de la prueba de usabilidad moderada, Inception §3.4). Los componentes de `@repo/ui` ya exponen roles y etiquetas nativas.
4. **Modo oscuro en el navegador:** los tokens oscuros están cubiertos por la prueba unitaria de contraste, pero axe solo corrió en modo claro.
5. **Otros motores con teclado:** las pruebas de accesibilidad corren en Chromium. En Safari, Tab no recorre enlaces salvo que el usuario active «Opción+Tab»/la preferencia del sistema (comportamiento del navegador, no de la app). La matriz de T-12 valida la operación general en Firefox y WebKit.
6. **Revisión con lector de pantalla:** las herramientas automáticas no detectan todos los problemas de WCAG; queda pendiente una pasada manual con NVDA o VoiceOver por los flujos críticos durante la prueba de usabilidad.

## Cómo ejecutarlo

```bash
# Contraste de tokens (unitaria, sin navegador)
pnpm --filter @repo/ui test

# Accesibilidad E2E (requiere el stack: ver docs/validation/e2e.md)
pnpm --filter @repo/e2e e2e:full -- --project=a11y-admin --project=a11y-mobile-web
# o, con el stack ya levantado (pnpm --filter @repo/e2e e2e:stack):
pnpm --filter @repo/e2e test:e2e --project=a11y-admin --project=a11y-mobile-web
pnpm --filter @repo/e2e exec playwright show-report   # resultados de axe y paradas de foco
```

Los proyectos `a11y-admin` y `a11y-mobile-web` (definidos en [`apps/e2e/playwright.config.ts`](../../apps/e2e/playwright.config.ts)) corren en el job `e2e` de CI junto con el resto de la suite (`e2e:full` ejecuta todos los proyectos). Usan su propio carril de productos (`PRODUCT_LANES.accessibility`), así que no interfieren con las demás pruebas en paralelo.

## Trazabilidad

| Criterio                                 | Prueba                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| axe sin violaciones críticas             | `apps/e2e/src/a11y/mobile-web/screens.spec.ts`, `apps/e2e/src/a11y/admin/screens.spec.ts`                                    |
| RNF-01 teclado y foco visible            | `apps/e2e/src/a11y/mobile-web/keyboard.spec.ts`, `apps/e2e/src/a11y/admin/keyboard.spec.ts`                                  |
| RNF-01 no depender solo del color        | `screens.spec.ts` (estado y disponibilidad como texto), `packages/ui/src/lib/tones.ts` (símbolo + texto en `Badge`/`Notice`) |
| RNF-01 contraste                         | `packages/ui/src/lib/contrast.test.ts`, axe `color-contrast`                                                                 |
| RNF-02 zoom 200 % sin scroll horizontal  | `checkScreen` en ambos `screens.spec.ts`; `responsive.spec.ts` (T-12, 320 px); autoprueba `self-test/layout.spec.ts`         |
| Checklist manual documentado y evidencia | Este documento; reporte de Playwright con los adjuntos `axe-*` y anotaciones `focus`                                         |
