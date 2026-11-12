# Informe Sprint 3 · Sprint Review

> **Borrador** preparado con datos del repositorio, de los PR y del tablero al 11 de noviembre de 2026. Los campos `[completar]` los llena el equipo al cerrar el sprint. Tarea T-15 ([#44](https://github.com/raztor/farmacias/issues/44)).

| Campo              | Valor                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proyecto           | Sistema de gestión y trazabilidad para la Farmacia Comunitaria de Peñalolén (TICS331, segundo semestre 2026)                                                    |
| Equipo             | Better Name Pending: David Almonacid, Martin Soto, Enrique Larrain, Benjamin Muñoz y Javier Vicencio                                                            |
| Product Owner      | Gino Pietro Bencini Muñoz                                                                                                                                       |
| Fechas del sprint  | `[completar: inicio – término]`                                                                                                                                 |
| Fecha de la review | `[completar]` · Asistentes: `[completar]`                                                                                                                       |
| Repositorio        | <https://github.com/raztor/farmacias> · rama `DEV` · PR [#45](https://github.com/raztor/farmacias/pull/45) a [#54](https://github.com/raztor/farmacias/pull/54) |
| Tablero            | [GitHub Project 8](https://github.com/users/raztor/projects/8) (filtro _Sprint = Sprint 3_)                                                                     |
| Video              | Fuera del alcance de esta tarea: T-15 no incluye el video ni su guion                                                                                           |

## 1. Objetivo del sprint

> El personal de la farmacia **mantiene el inventario y el catálogo desde el backoffice** (recepciones, ajustes con motivo, umbrales y alertas de stock bajo, productos y precios), la administración **consulta reportes operativos básicos** y la persona inscrita **repite un pedido anterior** sin volver a buscar cada producto. Todo cambio queda auditado.

Incorpora las historias Should y Could del backlog (HU-10 a HU-14, requisitos RF-13 a RF-16) sobre el MVP validado en los Sprints 1 y 2. Los criterios se refinaron con las decisiones D-25 a D-31 de [`docs/specs/README.md`](../specs/README.md).

## 2. Historias y tareas comprometidas

Cada historia se implementó en PR apilados (primero la API, después la interfaz) sobre la base común de [#45](https://github.com/raztor/farmacias/pull/45) (acciones de auditoría, permisos D-31 y decisiones D-25 a D-31). «Estado en el tablero» es el valor al 11 de noviembre de 2026.

| ID    | Título                                 | Pts | MoSCoW | Estado en el tablero | Estado real del trabajo                                                                                                                      | Issue                                                |
| ----- | -------------------------------------- | --: | ------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| HU-10 | Registrar recepción y ajustes de stock |   5 | Should | In review            | API ([#47](https://github.com/raztor/farmacias/pull/47)) e interfaz ([#51](https://github.com/raztor/farmacias/pull/51)) fusionadas en `DEV` | [#19](https://github.com/raztor/farmacias/issues/19) |
| HU-11 | Mantener catálogo y precios            |   5 | Should | In review            | API ([#49](https://github.com/raztor/farmacias/pull/49)) e interfaz ([#50](https://github.com/raztor/farmacias/pull/50)) fusionadas en `DEV` | [#20](https://github.com/raztor/farmacias/issues/20) |
| HU-12 | Alertas de stock bajo                  |   3 | Should | In review            | API ([#47](https://github.com/raztor/farmacias/pull/47)) e interfaz ([#52](https://github.com/raztor/farmacias/pull/52)) fusionadas en `DEV` | [#21](https://github.com/raztor/farmacias/issues/21) |
| HU-13 | Reportes operativos básicos            |   5 | Could  | In review            | API ([#53](https://github.com/raztor/farmacias/pull/53)) e interfaz ([#54](https://github.com/raztor/farmacias/pull/54)) fusionadas en `DEV` | [#22](https://github.com/raztor/farmacias/issues/22) |
| HU-14 | Repetir un pedido anterior             |   3 | Could  | In review            | API ([#46](https://github.com/raztor/farmacias/pull/46)) e interfaz ([#48](https://github.com/raztor/farmacias/pull/48)) fusionadas en `DEV` | [#23](https://github.com/raztor/farmacias/issues/23) |
| T-15  | Informe Sprint 3                       |   2 | Should | In progress          | Este informe y la evidencia; el video no forma parte de la tarea                                                                             | [#44](https://github.com/raztor/farmacias/issues/44) |

**Comprometido:** 6 ítems, **23 puntos** (historias 21 + tarea 2); 15 Should (HU-10, HU-11, HU-12, T-15) y 8 Could (HU-13, HU-14). En el tablero T-15 no tiene cargado el campo _Estimate_ (`[completar: cargar 2 puntos]`).

### Completadas y pendientes según la Definition of Done

| Grupo                              | Ítems                             | Puntos | Qué falta                                                                                               |
| ---------------------------------- | --------------------------------- | -----: | ------------------------------------------------------------------------------------------------------- |
| Terminadas (DoD completa)          | —                                 |      0 | Ningún ítem tiene registrada la aceptación del PO ni está desplegado en el entorno de demostración (QA) |
| Código completo fusionado en `DEV` | HU-10, HU-11, HU-12, HU-13, HU-14 |     21 | CI completo del PR de promoción `DEV` → QA, despliegue en QA, demo y aceptación del PO                  |
| En curso                           | T-15                              |      2 | Revisión y fusión de este PR; completar los campos `[completar]` en la review                           |

`[completar en la review]`:

| Historia | ¿Aceptada por el PO? | Comentario del PO |
| -------- | -------------------- | ----------------- |
| HU-10    | `[completar]`        | `[completar]`     |
| HU-11    | `[completar]`        | `[completar]`     |
| HU-12    | `[completar]`        | `[completar]`     |
| HU-13    | `[completar]`        | `[completar]`     |
| HU-14    | `[completar]`        | `[completar]`     |

## 3. Incremento demostrable

Backoffice (Next.js) para operario y administrador, y la app del residente (Expo, web y móvil):

1. **Inventario** (operario y admin): tabla de stock con producto, SKU, unidades, umbral y nivel en texto + símbolo; búsqueda sin tildes por nombre, principio activo, presentación o SKU; filtro «Solo stock bajo» en la URL y «Cargar más productos» (HU-10).
2. **Ficha de stock**: formulario «Registrar recepción o ajuste» con motivo obligatorio (5 a 280 caracteres) y vista previa del stock resultante. Un ajuste que dejaría stock negativo se rechaza con «El ajuste dejaría el stock en negativo.» y no cambia nada. El historial de movimientos muestra fecha, responsable, stock antes → después y motivo o pedido. Cada movimiento queda en la auditoría (D-25).
3. **Umbral y alertas de stock** (operario y admin): umbral por producto (0 a 999, auditado) y página «Alertas de stock» con los productos activos en o bajo su umbral, primero los agotados (HU-12, D-26, D-27).
4. **Catálogo** (solo admin): listado con activos e inactivos, alta y edición de producto y precio en CLP, desactivación en vez de borrado, SKU único con el error junto al campo y aviso si otro administrador cambió el producto mientras se editaba. Un cambio de precio no altera pedidos ya confirmados (HU-11, D-28).
5. **Reportes** (solo admin): unidades dispensadas (pedidos entregados o retirados en el rango), pedidos por estado y productos bajo umbral; rango por defecto de 30 días y máximo de un año, en días de Chile; solo datos agregados (HU-13, D-29).
6. **Repetir pedido** (residente): desde el detalle de un pedido confirmado, «Repetir pedido» suma sus productos al carrito con el precio actual, ajusta cada cantidad a la disponibilidad y al máximo de 99 y muestra un aviso accesible con cada cambio («se agregó 1 de 2 por disponibilidad», «agotado, no se agregó») (HU-14, D-30).
7. **Permisos (D-31)**: `inventory: read, adjust` para operario y admin; `catalog: write` y `reports: read` solo admin. El menú muestra solo lo permitido y la API responde `FORBIDDEN` a los demás roles.

## 4. Evidencia

### 4.1 Criterio de aceptación → prueba automatizada

Tomado de la descripción de cada PR y de las specs de módulo de sus ramas ([`inventory.md`](../specs/inventory.md), [`catalog.md`](../specs/catalog.md), [`orders.md`](../specs/orders.md), [`tracking.md`](../specs/tracking.md) y [`reports.md`](../specs/reports.md)).

| Historia · criterio                                                                | Pruebas principales                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HU-10 #1 recepción o ajuste con motivo → stock cambia y queda auditado             | `packages/api/src/modules/inventory/inventory-admin.service.test.ts` (INV-U04), `inventory-admin.int.test.ts` (INV-I07 movimiento + auditoría en la misma transacción; INV-I09 si falla la auditoría se revierte todo), `apps/e2e/src/admin/inventory.spec.ts` (INV-E01)                                                        |
| HU-10 #2 sin motivo o stock negativo → rechazo con mensaje claro                   | `packages/shared/src/schemas/inventory.schema.test.ts` (INV-U06), `inventory.router.test.ts` (INV-U09), `inventory-admin.service.test.ts` (INV-U05), `inventory-admin.int.test.ts` (INV-I08 sin cambios), `apps/admin/src/features/inventory/stock-adjustment-form.test.ts`, `inventory.spec.ts`                                |
| HU-10 · RNF-08 ajuste concurrente con una venta nunca deja stock negativo          | `inventory-admin.int.test.ts` (INV-I10), `inventory-pagination.int.test.ts` y `inventory-cursor.test.ts` (paginación por clave)                                                                                                                                                                                                 |
| HU-11 #1 admin crea o edita producto o precio → se refleja y queda auditado        | `packages/api/src/modules/catalog/catalog-admin.service.test.ts` (CAT-U08), `catalog-admin.int.test.ts` (CAT-I05 alta y búsqueda pública, CAT-I06 precio y auditoría, CAT-I07 SKU único, CAT-I08 desactivar, CAT-I09 precio de pedidos confirmados), `apps/e2e/src/admin/catalog.spec.ts` (CAT-E03)                             |
| HU-11 #2 otro rol → acceso denegado                                                | `catalog-admin.router.test.ts` (CAT-U09: 4 procedimientos × anónimo, operario y residente), `apps/admin/src/lib/nav-items.test.ts`, `catalog.spec.ts` (CAT-E04)                                                                                                                                                                 |
| HU-12 #1 stock en o bajo el umbral configurable → aparece en alertas               | `inventory-admin.service.test.ts` (INV-U07, INV-U08), `inventory-admin.int.test.ts` (INV-I11 orden y bordes, INV-I12 umbral auditado), `apps/admin/src/features/inventory/threshold-form.test.ts`, `inventory.spec.ts` (INV-E02)                                                                                                |
| HU-13 #1 admin ve unidades dispensadas, pedidos por estado y productos bajo umbral | `packages/api/src/modules/reports/reports.int.test.ts` (REP-I01 a REP-I05), `reports.service.test.ts`, `reports-range.test.ts`, `reports.router.test.ts`, `packages/shared/src/domain/report-range.test.ts`, `apps/admin/src/features/reports/reports-filters.test.ts`, `apps/e2e/src/admin/reports.spec.ts` (REP-E01, REP-E02) |
| HU-14 #1 repetir → borrador ajustado a la disponibilidad y cambios informados      | `packages/api/src/modules/orders/repeat-plan.test.ts`, `order-repeat.service.test.ts`, `order-repeat.int.test.ts` (ORD-I04), `orders.router.test.ts`, `apps/mobile/src/features/orders/repeat-notice.test.ts`, `order-mutations.test.ts`, `apps/e2e/src/mobile-web/repeat-order.spec.ts`                                        |
| Accesibilidad de las pantallas nuevas (RNF-01, RNF-02)                             | `apps/e2e/src/a11y/admin/screens.spec.ts` (inventario, ficha, errores del formulario, alertas, catálogo y reportes: axe y zoom 200 %), `apps/e2e/src/a11y/mobile-web/screens.spec.ts` (carrito con el aviso de «Repetir pedido»)                                                                                                |

### 4.2 Indicadores de éxito del MVP (Inception §3.4)

El Sprint 3 no agrega indicadores nuevos; amplía la evidencia de los existentes.

| Indicador                        | Meta                                                         | Resultado en el Sprint 3                                                                                                                                    | Fuente                                                           |
| -------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Tiempo de respuesta del buscador | 95 % < 2 s                                                   | Sin cambios en el buscador; no se volvió a medir (p95 = 6,31 ms con 2.000 productos en el Sprint 2)                                                         | [rendimiento-buscador.md](../validation/rendimiento-buscador.md) |
| Consistencia pedido-stock        | 100 % de escenarios críticos sin negativo ni doble descuento | ✅ también con ajustes manuales: el ajuste usa el mismo bloqueo de fila que el descuento por pago (INV-I10)                                                 | `inventory-admin.int.test.ts`                                    |
| Trazabilidad operativa           | 100 % de transiciones con fecha, hora y actor                | ✅ ampliada a recepciones, ajustes, umbrales y productos (`stock.receipt`, `stock.adjustment`, `inventory.threshold_change`, `product.*`)                   | `inventory-admin.int.test.ts`, `catalog-admin.int.test.ts`       |
| Éxito en tareas de usabilidad    | ≥ 80 % completa búsqueda, pedido y seguimiento sin ayuda     | ⏳ `[completar con los resultados de las sesiones]`                                                                                                         | [usabilidad.md](../validation/usabilidad.md)                     |
| Accesibilidad                    | Cero defectos críticos                                       | Pantallas nuevas agregadas a la auditoría automatizada (axe y zoom 200 %); verde en el CI de #48; verde en el CI de #50, #51, #52 y #54 antes de fusionarse | [accesibilidad.md](../validation/accesibilidad.md)               |

### 4.3 Pruebas y CI

- **Pirámide de pruebas** (archivos en una rama local que combina `DEV` con las cabezas de #50, #52 y #54, al 11 de noviembre de 2026): **168** archivos de pruebas unitarias (`*.test.ts[x]` sin `*.int.test.ts`), **22** de integración sobre PostgreSQL real (`*.int.test.ts`) y **23** specs E2E de Playwright (`apps/e2e/src/**/*.spec.ts`, incluidos 4 autotests de los helpers). Al cierre del Sprint 2 (commit `2f61d60`) eran 143, 17 y 18: el sprint agrega **25 unitarias, 5 de integración y 5 E2E** (`catalog.spec.ts`, `inventory.spec.ts`, `reports.spec.ts`, `repeat-order.spec.ts` y el autotest `catalog-api.spec.ts`).
- **CI de los PR fusionados** (#45, #46, #47, #48 y #49): 10 de 10 checks en verde cada uno (calidad, integración y cobertura, Docker, Expo Android, GitGuardian y, donde aplica, E2E con la matriz de navegadores).
- **CI de los PR:** #45 a #54 pasaron el CI completo (calidad, integración con cobertura, E2E en la matriz de navegadores, Docker y Expo) antes de fusionarse. Los merges finales de `DEV` en #51, #52 y #54, que solo resolvieron conflictos en archivos compartidos (menú, auditoría de accesibilidad, matriz de trazabilidad), se verificaron en local con `pnpm check` y las pruebas de integración. El CI completo del conjunto corre en el PR de promoción `DEV` → QA. `[completar: enlace a esa corrida]`.
- **Cobertura de servicios** (umbral por servicio de `@repo/api`): `order-repeat.service.ts` y `repeat-plan.ts` 100 %, `inventory-admin.service.ts` 100 %, módulo `catalog` 96,8 %, `reports.service.ts` 90 % de líneas (según cada PR).

### 4.4 Revisiones de código independientes

Cada PR tuvo una revisión independiente de su código, y los hallazgos se corrigieron en commits `fix(...)` del mismo PR antes de fusionarlo:

| PR       | Hallazgo principal y corrección                                                                                                                                                                                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #47      | La paginación con cursor + `skip` de Prisma saltaba una fila cuando el producto del cursor dejaba de cumplir el filtro: ahora es **paginación por clave** (nombre, id) validada con zod y las alertas leen filas y total en una transacción `REPEATABLE READ`.                               |
| #53, #54 | Los carros abandonados (cancelados desde borrador) contaban como pedidos cancelados: ahora **se excluyen de los reportes**. Las fechas se limitan a 2000–2100 (antes un año lejano desbordaba) y el formulario marca solo el campo con error.                                                |
| #49, #50 | **Concurrencia optimista** en el catálogo: la edición envía la versión cargada y responde `CONFLICT` si otro administrador cambió el producto. El **SKU duplicado se muestra junto al campo**, el precio rechaza formatos ambiguos (`19.90`) y la semilla ya no revierte productos editados. |
| #46, #48 | El aviso de «Repetir pedido» ahora **se asocia a su carrito y se borra al confirmarlo**, toma el foco al aparecer y cada cambio nombra la presentación y el tope de 99 unidades.                                                                                                             |
| #51, #52 | La navegación del encabezado pasa a otra línea a 320 px y al 200 % de zoom; el contador de alertas sale del encabezado (lo lee la región viva) y el E2E revierte su recepción para no inflar el stock.                                                                                       |

La revisión de seguridad automática de Codex no pudo completarse en #45 a #52 por el límite de uso de la cuenta; en #53 y #54 terminó sin hallazgos. `[completar: aprobación de un integrante del equipo en cada PR]`.

### 4.5 Capturas (datos sintéticos)

[`evidencia/sprint-3/`](./evidencia/sprint-3), tomadas con Playwright sobre el stack E2E local (rama de integración de `DEV` + #50, #52 y #54) con cuentas y datos sintéticos:

| Captura                                                                                                     | Muestra                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [admin-01-inventario](./evidencia/sprint-3/admin-01-inventario.png)                                         | Inventario con nivel en texto + símbolo y enlace a las alertas (HU-10)                     |
| [admin-02-ficha-stock-formulario](./evidencia/sprint-3/admin-02-ficha-stock-formulario.png)                 | Ficha de stock con el formulario de recepción y motivo                                     |
| [admin-03-recepcion-registrada-historial](./evidencia/sprint-3/admin-03-recepcion-registrada-historial.png) | Recepción registrada: aviso e historial con responsable y stock antes → después (HU-10 #1) |
| [admin-04-ajuste-negativo-rechazado](./evidencia/sprint-3/admin-04-ajuste-negativo-rechazado.png)           | Ajuste que dejaría stock negativo rechazado sin cambios (HU-10 #2)                         |
| [admin-05-alertas-stock](./evidencia/sprint-3/admin-05-alertas-stock.png)                                   | Alertas de stock: agotados primero, productos en su umbral (HU-12 #1)                      |
| [admin-06-catalogo](./evidencia/sprint-3/admin-06-catalogo.png)                                             | Catálogo del administrador con precio, stock y estado (HU-11)                              |
| [admin-07-catalogo-edicion](./evidencia/sprint-3/admin-07-catalogo-edicion.png)                             | Edición de producto y precio (HU-11 #1)                                                    |
| [admin-08-catalogo-sku-duplicado](./evidencia/sprint-3/admin-08-catalogo-sku-duplicado.png)                 | SKU duplicado informado junto al campo                                                     |
| [admin-09-reportes](./evidencia/sprint-3/admin-09-reportes.png)                                             | Reportes: unidades dispensadas, pedidos por estado y productos bajo umbral (HU-13 #1)      |
| [residente-10-detalle-repetir-pedido](./evidencia/sprint-3/residente-10-detalle-repetir-pedido.png)         | Detalle de un pedido pagado con el botón «Repetir pedido»                                  |
| [residente-11-carrito-aviso-repetir](./evidencia/sprint-3/residente-11-carrito-aviso-repetir.png)           | Carrito con el aviso de cambios: «se agregó 1 de 2 por disponibilidad» (HU-14 #1)          |

### 4.6 Diagramas

[Modelo de datos](../uml/er.puml) (`stock_movements`, `inventory_items.low_stock_threshold` y `audit_logs`), [componentes](../uml/components.puml) y [despliegue](../uml/deployment.puml); reglas, API y casos de prueba de cada módulo en las specs enlazadas en §4.1.

## 5. Métricas

| Métrica                                                    | Valor                                                     |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| Puntos comprometidos                                       | 23 (6 ítems)                                              |
| Puntos terminados según DoD (velocidad oficial)            | `[completar tras la review]` (0 al cierre del borrador)   |
| Puntos con todo su código fusionado en `DEV`               | 21 (HU-10 a HU-14)                                        |
| Criterios de aceptación del sprint con prueba automatizada | 7 de 7 (acumulado del producto: 27)                       |
| PR del sprint: fusionados / abiertos                       | 10 / 1 (#45 a #54 fusionados; #55, este informe, abierto) |
| Archivos de prueba nuevos (unitarias / integración / E2E)  | 25 / 5 / 5                                                |
| Velocidad promedio (Sprints 1 a 3)                         | `[completar]`                                             |

## 6. Revisión de riesgos (Inception §6)

Estados: **Mitigado**, **Controlado**, **Abierto** y **Materializado** (ver el [informe del Sprint 1](./sprint-1.md#6-revisión-de-riesgos-inception-6)). Solo cambian los riesgos que el Sprint 3 afectó. `[completar: actualizar en la review]`.

| ID   | Riesgo                                             | Estado     | Evidencia y acción                                                                                                                                                                                                                                                            |
| ---- | -------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | El alcance supera la capacidad del semestre        | Controlado | Entraron todas las Should/Could (HU-10 a HU-14) en un sprint de 23 puntos; el código está escrito y probado, pero la revisión y la fusión de los PR apilados son el cuello de botella. **Acción:** promover a QA y obtener la aceptación del PO antes de abrir trabajo nuevo. |
| R-02 | Sin acceso a sistemas institucionales              | Mitigado   | Sin cambios.                                                                                                                                                                                                                                                                  |
| R-03 | Requisitos basados en supuestos no validados       | Abierto    | Los criterios de HU-10 a HU-14 se refinaron como decisiones D-25 a D-31 sin una sesión registrada con el PO. `[completar: ¿el PO validó D-25..D-31?]`                                                                                                                         |
| R-04 | Pago y stock inconsistentes                        | Mitigado   | Los ajustes manuales usan el mismo bloqueo `FOR UPDATE` que el descuento por pago y rechazan el negativo antes de escribir (INV-I10).                                                                                                                                         |
| R-05 | Exposición de datos                                | Controlado | Los reportes solo muestran datos agregados, sin datos personales (D-29). La revisión de seguridad de Codex no corrió en #45 a #52 por el límite de uso. `[completar: resultado de GitGuardian y de una revisión manual]`                                                      |
| R-06 | El prototipo no es usable para adultos mayores     | Abierto    | El aviso de «Repetir pedido» es accesible (región en vivo, foco, axe). Sigue faltando la evidencia con personas del Sprint 2. `[completar]`                                                                                                                                   |
| R-07 | Estados físicos no se actualizan a tiempo          | Mitigado   | Sin cambios.                                                                                                                                                                                                                                                                  |
| R-08 | Inventario sintético no representa casos reales    | Mitigado   | Recepciones, ajustes con motivo y alertas de stock bajo ya existen (HU-10, HU-12). **Acción:** validar con un operario los motivos habituales y los umbrales por defecto.                                                                                                     |
| R-09 | Docentes sin acceso al repositorio o tablero       | Abierto    | `[completar: confirmar acceso de lectura a raztor/farmacias y Project 8 desde otra sesión]`                                                                                                                                                                                   |
| R-10 | Falta de disponibilidad de stakeholders            | Abierto    | Sin cambios: las sesiones de usabilidad y la validación con un operario siguen pendientes.                                                                                                                                                                                    |
| R-11 | El pago simulado oculta problemas reales           | Controlado | Sin cambios.                                                                                                                                                                                                                                                                  |
| R-12 | Cambios de requerimientos desestabilizan el sprint | Controlado | El alcance del sprint quedó fijo en #45 (decisiones D-25 a D-31) antes de implementar; los hallazgos de revisión se corrigieron dentro de cada PR sin agregar historias.                                                                                                      |

## 7. Aprendizajes

- **Una base común primero** (#45: acciones de auditoría, permisos y decisiones) permitió desarrollar las cinco historias en paralelo sin conflictos en los archivos compartidos.
- **PR apilados (API → interfaz)** hacen cada revisión más chica, pero dejan historias a medio fusionar: la interfaz depende de que la API se integre y de que la base del PR se actualice.
- **La revisión independiente encontró defectos reales** que las pruebas no cubrían: la fila saltada en la paginación del inventario, los carros abandonados en los reportes y la edición simultánea en el catálogo. Se corrigieron con pruebas nuevas antes de fusionar.
- **Reutilizar reglas ya probadas** (bloqueo de fila del pago para los ajustes, consulta de alertas para los reportes y schemas de `@repo/shared` en API y formularios) evitó reglas duplicadas que se contradigan.
- `[completar: aprendizajes de la forma de trabajo del equipo]`

## 8. Próximos pasos

1. Promover `DEV` → QA, revisar el incremento en el entorno de demostración y obtener la aceptación del PO de HU-10 a HU-14.
2. Ejecutar las sesiones de usabilidad pendientes (T-11) y validar con un operario los motivos de ajuste, los umbrales y los reportes.
3. Con el PO, definir el alcance de la siguiente iteración según los hallazgos y la capacidad restante del semestre.
