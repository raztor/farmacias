# Informe Sprint 1 · Sprint Review

> **Borrador** preparado con datos del repositorio y del tablero al 3 de noviembre de 2026. Los campos `[completar]` los llena el equipo en la review. Tarea T-07 ([#30](https://github.com/raztor/farmacias/issues/30)).

| Campo              | Valor                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Proyecto           | Sistema de gestión y trazabilidad para la Farmacia Comunitaria de Peñalolén (TICS331, segundo semestre 2026)                      |
| Equipo             | Better Name Pending: David Almonacid, Martin Soto, Enrique Larrain, Benjamin Muñoz y Javier Vicencio                              |
| Product Owner      | Gino Pietro Bencini Muñoz                                                                                                         |
| Fechas del sprint  | `[completar: inicio – término]`                                                                                                   |
| Fecha de la review | `[completar]` · Asistentes: `[completar]`                                                                                         |
| Repositorio        | <https://github.com/raztor/farmacias> · rama `feat/sprint-1-mvp` · PR borrador [#37](https://github.com/raztor/farmacias/pull/37) |
| Tablero            | [GitHub Project 8](https://github.com/users/raztor/projects/8) (filtro _Sprint = Sprint 1_)                                       |
| Video              | `[completar: enlace]` · guion en [sprint-1-guion-video.md](./sprint-1-guion-video.md)                                             |

## 1. Objetivo del sprint

> Una persona inscrita puede **buscar un medicamento, iniciar sesión, armar su pedido, elegir retiro o despacho simulado y pagarlo de forma simulada**, y el stock se descuenta **una sola vez y en la misma operación** que valida el pago. Todo sobre una base técnica verificable: modelo de datos, datos sintéticos, roles, specs, CI con PostgreSQL real y entorno de demostración.

Cubre los objetivos OE-02 y OE-03 del Inception y prepara OE-06 y OE-07.

## 2. Historias y tareas comprometidas

Puntos según el campo _Estimate_ del tablero. «Estado en el tablero» es el valor al 3 de noviembre de 2026.

| ID    | Título                                       | Pts | MoSCoW | Estado en el tablero | Estado real del trabajo                                                       | Issue                                                |
| ----- | -------------------------------------------- | --: | ------ | -------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| HU-01 | Buscar medicamentos                          |   3 | Must   | In progress          | Implementada; criterios cubiertos por pruebas                                 | [#10](https://github.com/raztor/farmacias/issues/10) |
| HU-02 | Iniciar sesión                               |   3 | Must   | In progress          | Implementada; criterios cubiertos por pruebas                                 | [#11](https://github.com/raztor/farmacias/issues/11) |
| HU-03 | Preparar pedido                              |   5 | Must   | In progress          | Implementada; criterios cubiertos por pruebas                                 | [#12](https://github.com/raztor/farmacias/issues/12) |
| HU-04 | Seleccionar modalidad y confirmar            |   3 | Must   | In progress          | Implementada; criterios cubiertos por pruebas                                 | [#13](https://github.com/raztor/farmacias/issues/13) |
| HU-05 | Ejecutar pago simulado                       |   5 | Must   | In progress          | Implementada; criterios cubiertos por pruebas                                 | [#14](https://github.com/raztor/farmacias/issues/14) |
| HU-06 | Descontar inventario                         |   8 | Must   | In progress          | Implementada; criterios cubiertos por pruebas de concurrencia                 | [#15](https://github.com/raztor/farmacias/issues/15) |
| T-01  | Modelo de datos del dominio y migraciones    |   5 | Must   | In progress          | Implementada                                                                  | [#24](https://github.com/raztor/farmacias/issues/24) |
| T-02  | Datos sintéticos de demostración (seed)      |   3 | Must   | In progress          | Implementada (200 productos, cuentas y pedidos de demo)                       | [#25](https://github.com/raztor/farmacias/issues/25) |
| T-03  | Roles, permisos y cuentas preinscritas       |   3 | Must   | In progress          | Implementada                                                                  | [#26](https://github.com/raztor/farmacias/issues/26) |
| T-04  | Specs por módulo y matriz de trazabilidad    |   3 | Must   | In progress          | Implementada (9 specs, matriz, UML)                                           | [#27](https://github.com/raztor/farmacias/issues/27) |
| T-05  | CI con pruebas de integración sobre Postgres |   3 | Must   | In progress          | Implementada; falta la primera corrida en CI con el dominio                   | [#28](https://github.com/raztor/farmacias/issues/28) |
| T-06  | Entorno de demostración con contenedores     |   2 | Must   | In review            | Stack en contenedores verificado; falta cargar el seed del dominio en la demo | [#29](https://github.com/raztor/farmacias/issues/29) |
| T-07  | Informe y video Sprint 1 review              |   2 | Must   | In progress          | Informe y guion listos; falta grabar el video                                 | [#30](https://github.com/raztor/farmacias/issues/30) |

**Comprometido:** 13 ítems, **48 puntos** (historias 27 + tareas 21), todos Must.

### Completadas y pendientes según la Definition of Done

La DoD del Inception (§11.2) exige revisión de código, despliegue en demo y aceptación del PO. Al cierre de este borrador:

| Grupo                                             | Ítems                    | Puntos | Qué falta                                                                              |
| ------------------------------------------------- | ------------------------ | -----: | -------------------------------------------------------------------------------------- |
| Terminadas (DoD completa)                         | —                        |      0 | Ningún ítem tiene aún PR aprobado ni aceptación del PO                                 |
| Implementadas, con pruebas, a la espera de review | HU-01..HU-06, T-01..T-05 |     44 | Commit al PR #37, CI en verde, revisión del PR, despliegue en demo y aceptación del PO |
| En curso                                          | T-06 (In review), T-07   |      4 | T-06: seed del dominio en el stack de demo · T-07: grabar el video                     |

`[completar en la review]`: historias que el PO acepta y las que vuelven al backlog, con el motivo.

| Historia | ¿Aceptada por el PO? | Comentario del PO |
| -------- | -------------------- | ----------------- |
| HU-01    | `[completar]`        | `[completar]`     |
| HU-02    | `[completar]`        | `[completar]`     |
| HU-03    | `[completar]`        | `[completar]`     |
| HU-04    | `[completar]`        | `[completar]`     |
| HU-05    | `[completar]`        | `[completar]`     |
| HU-06    | `[completar]`        | `[completar]`     |

## 3. Incremento demostrable

App del residente (Expo: iOS, Android y web) y API (Fastify + tRPC) con PostgreSQL:

1. **Catálogo público** con buscador por nombre comercial o principio activo, sin importar tildes ni mayúsculas («losartan» encuentra «Losartán»), filtro por categoría y disponibilidad con ícono + texto (Disponible / Quedan pocas (N) / Sin stock). Sin sesión se ve precio y disponibilidad (HU-01).
2. **Inicio de sesión** con cuentas sintéticas preinscritas (sin registro público). Ante credenciales inválidas, mensaje genérico (HU-02).
3. **Mi pedido**: agregar con selector de cantidad acotado a la disponibilidad, quitar, subtotales y total; el servidor rechaza cantidades sobre el máximo e indica cuántas se pueden agregar (HU-03).
4. **Confirmar**: retiro en farmacia (sin dirección) o despacho simulado (sector, referencia, alias, indicaciones opcionales) con error en el campo que falta (HU-04).
5. **Pago simulado** con dos botones explícitos («Simular pago aprobado» / «Simular pago rechazado»). Aprobado → «Pago validado» y stock descontado una vez; rechazado → se informa y el stock no cambia; un reintento con la misma clave de idempotencia no descuenta dos veces (HU-05, HU-06).
6. **Base técnica**: modelo de datos con CHECK `on_hand >= 0`, migraciones, seed idempotente, roles `resident` / `operator` / `admin`, auditoría en la misma transacción, CI con integración sobre PostgreSQL 18 e imágenes de contenedor de las 5 apps.

## 4. Evidencia

### 4.1 Criterio de aceptación → prueba automatizada

Detalle completo en [`docs/traceability.md` §3](../traceability.md#3-criterio-de-aceptación--prueba).

| Historia · criterio                                           | Pruebas principales                                                                                                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HU-01 #1 coincidencias con precio y disponibilidad            | `packages/api/src/modules/catalog/catalog.int.test.ts`, `apps/e2e/src/mobile-web/catalog-search.spec.ts`, `apps/mobile/src/features/catalog/availability.test.ts`                                 |
| HU-01 #2 sin resultados, se puede modificar el término        | `catalog-search.spec.ts` («un término sin resultados lo dice y permite modificar la búsqueda»)                                                                                                    |
| HU-01 #3 sin sesión, sin datos privados                       | `packages/api/src/modules/catalog/catalog.router.test.ts`, `catalog-search.spec.ts` («busca sin sesión…»)                                                                                         |
| HU-02 #1 credenciales válidas → permisos del rol              | `packages/api/src/trpc/procedures.test.ts`, `packages/auth/src/access-control.test.ts`, `apps/admin/src/lib/admin-access.test.ts`                                                                 |
| HU-02 #2 mensaje genérico                                     | `apps/mobile/src/features/auth/auth-errors.test.ts`, `apps/admin/src/features/auth/auth-errors.test.ts`, `apps/e2e/src/*/sign-in.spec.ts`                                                         |
| HU-03 #1 cantidad válida se agrega y actualiza el resumen     | `packages/api/src/modules/orders/orders.service.test.ts`, `orders.int.test.ts`, `apps/mobile/src/features/cart/cart-limits.test.ts`, `resident-order.spec.ts`                                     |
| HU-03 #2 cantidad mayor → rechazo con máximo permitido        | `orders.service.test.ts`, `cart-limits.test.ts` (`maxAddable`, `limit_reached`)                                                                                                                   |
| HU-04 #1 retiro sin dirección                                 | `packages/api/src/modules/orders/orders.schema.test.ts`, `apps/mobile/src/features/checkout/checkout.schema.test.ts`, `resident-order.spec.ts`                                                    |
| HU-04 #2 despacho con dato faltante identifica el campo       | `orders.schema.test.ts`, `checkout.schema.test.ts`, `apps/e2e/src/mobile-web/delivery-validation.spec.ts`                                                                                         |
| HU-05 #1 aprobado → «Pago validado»                           | `packages/api/src/modules/payments/payments.int.test.ts`, `resident-order.spec.ts`, `apps/mobile/src/features/payment/payment-outcome.test.ts`                                                    |
| HU-05 #2 rechazado → inventario sin cambios                   | `payments.int.test.ts`, `apps/e2e/src/mobile-web/payment-rejected.spec.ts`                                                                                                                        |
| HU-05 #3 solicitud repetida → sin segundo descuento           | `packages/api/src/modules/payments/payments.concurrency.int.test.ts`, `payments.service.test.ts`, `apps/mobile/src/features/payment/payment-attempts.test.ts`                                     |
| HU-06 #1 pedido y stock en una sola operación                 | `payments.int.test.ts` («approved: discounts once and writes payment, movements, event and audit together», «is all or nothing…»), `inventory.int.test.ts`, `audit.int.test.ts`                   |
| HU-06 #2 último stock consumido → sin negativo, con evidencia | `payments.concurrency.int.test.ts` («20 parallel payments racing for the last 5 units: exactly 5 validated, stock 0»), `payments.int.test.ts` («stock_conflict: … evidence in payment and audit») |

### 4.2 Pruebas y CI

- **Pirámide de pruebas** (archivos en el árbol de trabajo al 3 de noviembre de 2026): 127 archivos de pruebas unitarias (`*.test.ts[x]`), 12 de integración sobre PostgreSQL real (`*.int.test.ts`) y 15 specs E2E de Playwright (`apps/e2e/src/**/*.spec.ts`).
- **Cobertura de servicios** del API: 99,36 % de líneas en local, con umbral de 80 % en CI (comentario de [#28](https://github.com/raztor/farmacias/issues/28)).
- **Concurrencia (RNF-08):** 20 pagos en paralelo compiten por las últimas 5 unidades → exactamente 5 pedidos validados y stock final 0; claves de idempotencia duplicadas → un solo descuento.
- **CI** (`.github/workflows/ci.yml`): jobs _Calidad_ (format, dependencias, nombres, arquitectura, lint, typecheck, test, build), _Integración (PostgreSQL)_ con cobertura, _E2E_, _Docker_ (5 imágenes) y _Mobile_ (export Android). En el último commit subido al PR #37 todos los jobs de CI pasaron. El check externo **GitGuardian Security Checks** figura en _FAILURE_ y hay que revisarlo (ver R-05). `[completar: resultado de CI tras subir el trabajo del dominio]`.
- **Comandos** para reproducir en local: `pnpm check`, `pnpm test:integration` (necesita `TEST_DATABASE_URL`, ver `docs/REPO_RULES.md` §8.1) y `pnpm --filter @repo/e2e e2e:full`.

### 4.3 Capturas (datos sintéticos)

Tomadas con Playwright sobre el export web de Expo con datos del seed ([`evidencia/sprint-1/`](./evidencia/sprint-1)):

| Captura                                                                           | Muestra                                                    |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [01-catalogo-publico](./evidencia/sprint-1/01-catalogo-publico.png)               | Catálogo sin sesión con precio y disponibilidad (HU-01 #3) |
| [02-busqueda-losartan](./evidencia/sprint-1/02-busqueda-losartan.png)             | «losartan» sin tilde encuentra «Losartán» (HU-01 #1)       |
| [03-sin-resultados](./evidencia/sprint-1/03-sin-resultados.png)                   | Aviso sin resultados y «Modificar la búsqueda» (HU-01 #2)  |
| [05-login-error-generico](./evidencia/sprint-1/05-login-error-generico.png)       | Mensaje genérico ante credenciales inválidas (HU-02 #2)    |
| [07-agregado-al-pedido](./evidencia/sprint-1/07-agregado-al-pedido.png)           | Producto agregado y resumen actualizado (HU-03 #1)         |
| [09-maximo-alcanzado](./evidencia/sprint-1/09-maximo-alcanzado.png)               | Máximo disponible alcanzado (HU-03 #2)                     |
| [10-mi-pedido](./evidencia/sprint-1/10-mi-pedido.png)                             | Mi pedido con cantidades y total                           |
| [11-despacho-campo-faltante](./evidencia/sprint-1/11-despacho-campo-faltante.png) | «Indica el sector» en el campo que falta (HU-04 #2)        |
| [12-retiro-sin-direccion](./evidencia/sprint-1/12-retiro-sin-direccion.png)       | Retiro sin campos de dirección (HU-04 #1)                  |
| [13-pago-simulado](./evidencia/sprint-1/13-pago-simulado.png)                     | Pantalla de pago con los dos escenarios                    |
| [14-pago-rechazado](./evidencia/sprint-1/14-pago-rechazado.png)                   | Rechazo informado; stock sin cambios (HU-05 #2)            |
| [15-pago-aprobado](./evidencia/sprint-1/15-pago-aprobado.png)                     | «Pago validado» y confirmación (HU-05 #1)                  |
| [18-reintento-misma-clave](./evidencia/sprint-1/18-reintento-misma-clave.png)     | Reintento con la misma clave, un solo descuento (HU-05 #3) |

### 4.4 Diagramas y documentos

- UML: [modelo ER](../uml/er.puml), [estados del pedido](../uml/order-states.puml), [secuencia del pago](../uml/payment-sequence.puml), [componentes](../uml/components.puml) y [despliegue](../uml/deployment.puml); versiones Mermaid en [`docs/specs/README.md`](../specs/README.md), [`order-status.md`](../specs/order-status.md) y [`payments.md`](../specs/payments.md).
- Specs por módulo: [`docs/specs/`](../specs) · Matriz: [`docs/traceability.md`](../traceability.md) · Despliegue: [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md).

## 5. Métricas

| Métrica                                                                   | Valor                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------- |
| Puntos comprometidos                                                      | 48 (13 ítems)                                           |
| Puntos terminados según DoD (velocidad oficial)                           | `[completar tras la review]` (0 al cierre del borrador) |
| Puntos implementados con pruebas, en espera de review                     | 44                                                      |
| Criterios de aceptación Must del sprint con prueba automatizada           | 14 de 14                                                |
| Escenarios críticos de pago y stock sin stock negativo ni doble descuento | 100 % de los automatizados (indicador §3.4)             |
| Defectos críticos conocidos                                               | 0 `[confirmar en la review]`                            |

## 6. Revisión de riesgos (Inception §6)

Estados: **Mitigado** (la mitigación está implementada y probada), **Controlado** (bajo seguimiento, sin disparador activo), **Abierto** (requiere acción), **Materializado** (se activó el disparador).

| ID   | Riesgo                                             | Estado     | Evidencia y acción                                                                                                                                                                                                                                                               |
| ---- | -------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | El alcance supera la capacidad del semestre        | Controlado | Solo historias Must en los sprints; HU-10..HU-14 siguen en Backlog. Todo el trabajo está en un solo PR (#37), lo que vuelve más lenta su revisión. **Acción:** revisar el PR por módulo y aceptar las historias una a una.                                                       |
| R-02 | Sin acceso a SAP, Tesorería u otros sistemas       | Mitigado   | Pago detrás del puerto `PaymentGateway` con el adaptador `SimulatedPaymentGateway` (RNF-11); no se pidió ninguna credencial externa.                                                                                                                                             |
| R-03 | Requisitos basados en supuestos no validados       | Abierto    | Las decisiones D-06..D-23 de [`docs/specs/README.md`](../specs/README.md) siguen «pendientes de validación del PO» y en el repositorio no hay registro de una entrevista operativa (OE-01). **Acción:** validarlas con el PO en la review y agendar la entrevista. `[completar]` |
| R-04 | Pago y stock inconsistentes                        | Mitigado   | Transacción única, descuento condicional, clave de idempotencia única y CHECK `on_hand >= 0`; pruebas de concurrencia en verde (§4.2).                                                                                                                                           |
| R-05 | Exposición de datos personales o sanitarios        | Controlado | Solo datos sintéticos (seed, `.env.example` sin secretos reales, logs con redacción). El check GitGuardian del PR #37 falló. **Acción:** revisar el hallazgo, corregirlo o documentar por qué es un falso positivo. `[completar]`                                                |
| R-06 | El prototipo no es usable para adultos mayores     | Abierto    | Lenguaje simple, estados con texto + ícono y foco visible ya implementados. La auditoría de accesibilidad (T-09) y la prueba con participantes (T-11) son del Sprint 2.                                                                                                          |
| R-07 | Estados físicos no se actualizan a tiempo          | Controlado | Corresponde al Sprint 2 (HU-07, HU-08). La máquina de estados ya está implementada y probada (`order-status.machine.test.ts`).                                                                                                                                                   |
| R-08 | Inventario sintético no representa casos reales    | Controlado | El seed incluye productos agotados, con stock bajo y normal; se probaron la cancelación con reposición, el conflicto de stock y la concurrencia. Ajustes y recepciones son Should (HU-10). **Acción:** contrastar los escenarios con un operario (ver R-03).                     |
| R-09 | Docentes sin acceso al repositorio o tablero       | Abierto    | El Inception §12 informa otro repositorio (`Cornifex16/better-name-pending`) y un tablero Jira; el trabajo está en `raztor/farmacias` y GitHub Project 8. **Acción:** informar el cambio a los docentes y comprobar el acceso de lectura desde otra sesión.                      |
| R-10 | Falta de disponibilidad de stakeholders            | Abierto    | Va con R-03: no hay una validación operativa registrada. **Acción:** agendar con anticipación y registrar las preguntas pendientes en un issue. `[completar]`                                                                                                                    |
| R-11 | El pago simulado oculta problemas reales           | Controlado | El contrato del simulador está documentado en [`docs/specs/payments.md`](../specs/payments.md). **Acción:** anotar las diferencias conocidas con Webpay o Tesorería cuando se validen con un stakeholder.                                                                        |
| R-12 | Cambios de requerimientos desestabilizan el sprint | Controlado | Los refinamientos quedan en el registro de decisiones D-06..D-23; no entraron historias nuevas durante el sprint.                                                                                                                                                                |

## 7. Aprendizajes

- **Escribir las specs antes del código** (T-04) permitió que varias personas trabajaran en paralelo sobre módulos distintos con las mismas reglas, los mismos errores y los mismos nombres de prueba.
- **La consistencia de pago y stock se demuestra en una base de datos real, no con mocks.** Las pruebas de concurrencia sobre PostgreSQL ejercitan lo que una prueba unitaria no ve: carreras por las últimas unidades y claves de idempotencia duplicadas.
- **La idempotencia también importa en el cliente:** la app reutiliza la clave del intento cuando no sabe si el pago llegó (corte de conexión) y la descarta cuando la respuesta es definitiva.
- **Datos sintéticos realistas desde el día uno** (200 productos con la distribución del informe, cuentas preinscritas y pedidos de demo) hicieron la demo y las pruebas reproducibles.
- **Infraestructura compartida:** la VM de Podman es compartida con otros proyectos y se colgó una vez bajo carga; desde entonces las imágenes se construyen de a una (`docs/DEPLOYMENT.md`).
- `[completar: aprendizajes del equipo sobre la forma de trabajo (Scrum, tablero, revisiones)]`

## 8. Próximos pasos

1. Subir el trabajo al PR #37, dejar el CI en verde (incluidos los jobs de integración y E2E) y pedir la revisión.
2. Cargar el seed del dominio en el stack de demostración (T-06) y presentar ahí la review.
3. Validar con el PO las decisiones D-06..D-23 y agendar la entrevista operativa (R-03, R-10).
4. Resolver el check de GitGuardian (R-05) y el acceso de los docentes al repositorio nuevo (R-09).
5. Sprint 2: cola operativa (HU-07), avance físico (HU-08), seguimiento (HU-09) y validación del MVP (T-08..T-13), con la prueba de usabilidad de [`docs/validation/usabilidad.md`](../validation/usabilidad.md).
