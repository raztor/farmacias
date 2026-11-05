# Informe Sprint 2 · Sprint Review

> **Borrador** preparado con datos del repositorio y del tablero al 3 de noviembre de 2026. Los campos `[completar]` los llena el equipo al cerrar el sprint. Tarea T-13 ([#36](https://github.com/raztor/farmacias/issues/36)).

| Campo              | Valor                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Proyecto           | Sistema de gestión y trazabilidad para la Farmacia Comunitaria de Peñalolén (TICS331, segundo semestre 2026)                      |
| Equipo             | Better Name Pending: David Almonacid, Martin Soto, Enrique Larrain, Benjamin Muñoz y Javier Vicencio                              |
| Product Owner      | Gino Pietro Bencini Muñoz                                                                                                         |
| Fechas del sprint  | `[completar: inicio – término]`                                                                                                   |
| Fecha de la review | `[completar]` · Asistentes: `[completar]`                                                                                         |
| Repositorio        | <https://github.com/raztor/farmacias> · rama `feat/sprint-1-mvp` · PR borrador [#37](https://github.com/raztor/farmacias/pull/37) |
| Tablero            | [GitHub Project 8](https://github.com/users/raztor/projects/8) (filtro _Sprint = Sprint 2_)                                       |
| Video              | `[completar: enlace]` · guion en [sprint-2-guion-video.md](./sprint-2-guion-video.md)                                             |

## 1. Objetivo del sprint

> El personal autorizado **opera la cola de pedidos y registra el avance físico** (preparación, retiro, despacho y entrega) con fecha, hora y actor, y la persona inscrita **sigue su pedido** sin usar canales externos. El MVP se **valida** con pruebas E2E, accesibilidad, rendimiento, navegadores y una prueba de usabilidad con participantes.

Cubre los objetivos OE-04, OE-05 y OE-06 del Inception y cierra los indicadores de éxito de §3.4.

## 2. Historias y tareas comprometidas

El trabajo del Sprint 2 se adelantó en paralelo dentro del mismo PR #37. «Estado en el tablero» es el valor al 3 de noviembre de 2026.

| ID    | Título                                            | Pts | MoSCoW | Estado en el tablero | Estado real del trabajo                                              | Issue                                                |
| ----- | ------------------------------------------------- | --: | ------ | -------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| HU-07 | Consultar la cola operativa                       |   5 | Must   | In progress          | Implementada; criterios cubiertos por pruebas                        | [#16](https://github.com/raztor/farmacias/issues/16) |
| HU-08 | Registrar avance físico                           |   5 | Must   | In progress          | Implementada; criterios cubiertos por pruebas                        | [#17](https://github.com/raztor/farmacias/issues/17) |
| HU-09 | Consultar seguimiento                             |   3 | Must   | In progress          | Implementada; criterios cubiertos por pruebas                        | [#18](https://github.com/raztor/farmacias/issues/18) |
| T-08  | Pruebas E2E del flujo crítico                     |   3 | Must   | In progress          | 52/52 en local (Chromium y WebKit); falta la corrida de CI           | [#31](https://github.com/raztor/farmacias/issues/31) |
| T-09  | Auditoría de accesibilidad y legibilidad          |   2 | Must   | In progress          | Cero defectos críticos; 4 defectos encontrados y corregidos          | [#32](https://github.com/raztor/farmacias/issues/32) |
| T-10  | Prueba de rendimiento del buscador                |   2 | Must   | In progress          | p95 = 6,31 ms con 2.000 productos (meta < 2 s)                       | [#33](https://github.com/raztor/farmacias/issues/33) |
| T-11  | Prueba de usabilidad con participantes            |   3 | Must   | In progress          | Kit listo; **faltan las sesiones con participantes**                 | [#34](https://github.com/raztor/farmacias/issues/34) |
| T-12  | Compatibilidad de navegadores y diseño responsivo |   2 | Should | In progress          | Matriz configurada; Firefox, Chrome y Edge de marca pendientes de CI | [#35](https://github.com/raztor/farmacias/issues/35) |
| T-13  | Informe y video Sprint 2 review                   |   2 | Must   | In progress          | Informe y guion listos; falta grabar el video                        | [#36](https://github.com/raztor/farmacias/issues/36) |

**Comprometido:** 9 ítems, **27 puntos** (historias 13 + tareas 14); 25 Must y 2 Should (T-12).

### Completadas y pendientes según la Definition of Done

| Grupo                                             | Ítems                                 | Puntos | Qué falta                                                                                               |
| ------------------------------------------------- | ------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------- |
| Terminadas (DoD completa)                         | —                                     |      0 | Ningún ítem tiene aún PR aprobado ni aceptación del PO                                                  |
| Implementadas, con pruebas, a la espera de review | HU-07, HU-08, HU-09, T-08, T-09, T-10 |     20 | Commit al PR #37, CI en verde, revisión, despliegue en demo y aceptación del PO                         |
| En curso                                          | T-12                                  |      2 | Anotar el resultado de Firefox, Chrome y Edge de marca tras la primera corrida de CI del PR             |
| Requieren personas                                | T-11, T-13                            |      5 | T-11: sesiones con participantes ([usabilidad.md](../validation/usabilidad.md)) · T-13: grabar el video |

`[completar en la review]`:

| Historia | ¿Aceptada por el PO? | Comentario del PO |
| -------- | -------------------- | ----------------- |
| HU-07    | `[completar]`        | `[completar]`     |
| HU-08    | `[completar]`        | `[completar]`     |
| HU-09    | `[completar]`        | `[completar]`     |

## 3. Incremento demostrable

Backoffice (Next.js) para operario y administrador, y seguimiento en la app del residente:

1. **Bandeja** (operario y admin): pedidos más antiguos primero, filtros por estado (varios a la vez), modalidad y código, filtros en la URL y «Cargar más pedidos». El estado se muestra con texto + símbolo. Un residente que intenta entrar ve «Sin acceso» y el API responde `FORBIDDEN` (HU-07).
2. **Detalle del pedido y avance físico**: líneas, datos sintéticos de despacho e historial. Solo se ofrecen las transiciones permitidas para ese estado y modalidad, cada una con confirmación y nota opcional. Si otro funcionario cambió el pedido, se avisa y se recarga (control de versión) (HU-08).
3. **Usuarios y Auditoría** (solo admin): cambio de rol auditado y registro de auditoría filtrable («Pago validado → En preparación», «Stock 10 → 8»).
4. **Mis pedidos y línea de tiempo** (residente): estado actual y secuencia cronológica con quién hizo cada cambio («Tú», «Sistema», «Farmacia»), sin datos personales del funcionario. El pedido de otra cuenta responde «No encontramos ese pedido» (HU-09).
5. **Validación del MVP**: suite E2E de un comando, auditoría de accesibilidad automatizada, prueba de rendimiento del buscador y matriz de navegadores.

## 4. Evidencia

### 4.1 Criterio de aceptación → prueba automatizada

| Historia · criterio                                          | Pruebas principales                                                                                                                                                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HU-07 #1 filtro por estado o modalidad                       | `packages/api/src/modules/operations/operations.int.test.ts` («filters by status, fulfillment and code; drafts excluded; oldest first (#1)»), `apps/admin/src/features/orders/queue-filters.test.ts`, `apps/e2e/src/admin/operator-flow.spec.ts` |
| HU-07 #2 sin rol operativo → acceso denegado                 | `operations.int.test.ts` («rejects residents with FORBIDDEN…»), `operations.router.test.ts`, `apps/admin/src/lib/admin-access.test.ts`, `apps/e2e/src/admin/access-denied.spec.ts`                                                               |
| HU-08 #1 transición registrada con fecha, hora y actor       | `operations.int.test.ts` («records the new state with date, time, actor and audit (#1)»), `audit.int.test.ts`, `operator-flow.spec.ts`                                                                                                           |
| HU-08 #2 transición no permitida → rechazo y conserva estado | `packages/api/src/modules/order-status/order-status.machine.test.ts`, `operations.int.test.ts` («rejects an invalid move with CONFLICT and keeps the previous state (#2)», «lets exactly one of several concurrent transitions … win»)           |
| HU-09 #1 estado actual y secuencia cronológica               | `packages/api/src/modules/tracking/tracking.int.test.ts` (TRK-I01), `apps/mobile/src/features/orders/order-status-view.test.ts`, `apps/e2e/src/mobile-web/resident-order.spec.ts`                                                                |
| HU-09 #2 pedido de otra cuenta → acceso denegado             | `tracking.int.test.ts` (TRK-I02, `NOT_FOUND` igual que un pedido inexistente), `apps/e2e/src/mobile-web/access-denied.spec.ts`                                                                                                                   |

### 4.2 Indicadores de éxito del MVP (Inception §3.4)

| Indicador                        | Meta                                                         | Resultado                                                                                                                 | Fuente                                                                                              |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Tiempo de respuesta del buscador | 95 % < 2 s                                                   | ✅ p95 = 6,31 ms con 2.000 productos; 46,17 ms con 20.000                                                                 | [rendimiento-buscador.md](../validation/rendimiento-buscador.md)                                    |
| Visibilidad del estado           | 100 % de pedidos de prueba con historial visible             | ✅ en las pruebas automatizadas (TRK-I01, `resident-order.spec.ts`)                                                       | [#18](https://github.com/raztor/farmacias/issues/18)                                                |
| Consistencia pedido-stock        | 100 % de escenarios críticos sin negativo ni doble descuento | ✅ en los escenarios automatizados (`payments.concurrency.int.test.ts`, `payments.int.test.ts`)                           | [#15](https://github.com/raztor/farmacias/issues/15)                                                |
| Trazabilidad operativa           | 100 % de transiciones con fecha, hora y actor                | ✅ en las pruebas (`audit.int.test.ts`, `operations.int.test.ts`); `[completar: revisión manual de auditoría en la demo]` | [#17](https://github.com/raztor/farmacias/issues/17)                                                |
| Éxito en tareas de usabilidad    | ≥ 80 % completa búsqueda, pedido y seguimiento sin ayuda     | ⏳ `[completar con los resultados de las sesiones]`                                                                       | [usabilidad.md](../validation/usabilidad.md) · [#34](https://github.com/raztor/farmacias/issues/34) |
| Accesibilidad                    | Cero defectos críticos                                       | ✅ axe sin violaciones en 12 pantallas; flujos completos solo con teclado; zoom 200 % sin scroll horizontal               | [accesibilidad.md](../validation/accesibilidad.md)                                                  |

### 4.3 Pruebas y CI

- **E2E** ([e2e.md](../validation/e2e.md)): 52 de 52 ejecuciones en verde contra el stack real (10 pruebas de la app del residente × 4 navegadores/dispositivos + 6 del admin × 2 motores), y 88 de 88 con `--repeat-each=2`. Comando: `pnpm --filter @repo/e2e e2e:full`.
- **Accesibilidad** ([accesibilidad.md](../validation/accesibilidad.md)): 4 de 4 pruebas (`apps/e2e/src/a11y`), 69 de 69 pares de contraste (`packages/ui/src/lib/contrast.test.ts`).
- **Navegadores** ([navegadores.md](../validation/navegadores.md)): Chromium y WebKit en escritorio, Pixel 7 e iPhone 15 en local; Firefox, Chrome y Edge de marca en el job `e2e` de CI. `[completar: resultado de la primera corrida de CI]`.
- **CI**: además de lo del Sprint 1, el job _E2E_ levanta el stack completo y publica la matriz de navegadores en el resumen. `[completar: enlace a la corrida de CI del commit final]`.

### 4.4 Capturas (datos sintéticos)

[`evidencia/sprint-2/`](./evidencia/sprint-2):

| Captura                                                                                                     | Muestra                                                        |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [admin-02-resident-forbidden](./evidencia/sprint-2/admin-02-resident-forbidden.png)                         | Residente sin acceso al backoffice (HU-07 #2)                  |
| [admin-03-operator-queue](./evidencia/sprint-2/admin-03-operator-queue.png)                                 | Bandeja del operario                                           |
| [admin-04-filter-status](./evidencia/sprint-2/admin-04-filter-status.png)                                   | Filtro por estado (HU-07 #1)                                   |
| [admin-05-filter-fulfillment](./evidencia/sprint-2/admin-05-filter-fulfillment.png)                         | Filtro por modalidad (HU-07 #1)                                |
| [admin-07-order-detail-payment-validated](./evidencia/sprint-2/admin-07-order-detail-payment-validated.png) | Detalle con solo las transiciones permitidas (HU-08 #2)        |
| [admin-08-confirm-step](./evidencia/sprint-2/admin-08-confirm-step.png)                                     | Confirmación con nota opcional                                 |
| [admin-09-order-delivered-history](./evidencia/sprint-2/admin-09-order-delivered-history.png)               | Historial con fecha, hora y actor hasta «Entregado» (HU-08 #1) |
| [admin-10-stale-version](./evidencia/sprint-2/admin-10-stale-version.png)                                   | Aviso cuando otro funcionario cambió el pedido                 |
| [admin-12-admin-users](./evidencia/sprint-2/admin-12-admin-users.png)                                       | Usuarios y roles (solo admin)                                  |
| [admin-13-admin-audit](./evidencia/sprint-2/admin-13-admin-audit.png)                                       | Registro de auditoría                                          |
| [residente-20-mis-pedidos](./evidencia/sprint-2/residente-20-mis-pedidos.png)                               | Mis pedidos                                                    |
| [residente-16-detalle-linea-de-tiempo](./evidencia/sprint-2/residente-16-detalle-linea-de-tiempo.png)       | Línea de tiempo con el estado actual (HU-09 #1)                |
| [residente-19-pedido-ajeno-denegado](./evidencia/sprint-2/residente-19-pedido-ajeno-denegado.png)           | Pedido de otra cuenta: «No encontramos ese pedido» (HU-09 #2)  |
| [residente-21-reflow-320px](./evidencia/sprint-2/residente-21-reflow-320px.png)                             | Sin scroll horizontal a 320 px (RNF-02)                        |
| [residente-22-teclado-foco-visible](./evidencia/sprint-2/residente-22-teclado-foco-visible.png)             | Foco visible con teclado (RNF-01)                              |
| [admin-11-skip-link-focus](./evidencia/sprint-2/admin-11-skip-link-focus.png)                               | «Saltar al contenido» con foco visible (RNF-01)                |
| [admin-01-sign-in-invalid](./evidencia/sprint-2/admin-01-sign-in-invalid.png)                               | Mensaje genérico en el admin (HU-02 #2)                        |

### 4.5 Diagramas

[Estados del pedido](../uml/order-states.puml) (transiciones físicas de HU-08), [componentes](../uml/components.puml) y [despliegue](../uml/deployment.puml); tabla de transiciones T1..T17 en [`docs/specs/order-status.md`](../specs/order-status.md).

## 5. Métricas

| Métrica                                                   | Valor                                                   |
| --------------------------------------------------------- | ------------------------------------------------------- |
| Puntos comprometidos                                      | 27 (9 ítems)                                            |
| Puntos terminados según DoD (velocidad oficial)           | `[completar tras la review]` (0 al cierre del borrador) |
| Puntos implementados con pruebas, a la espera de review   | 20                                                      |
| Criterios de aceptación Must del sprint con prueba        | 6 de 6 (MVP completo: 20 de 20)                         |
| Ejecuciones E2E en verde                                  | 52 de 52 (local)                                        |
| p95 del buscador (2.000 productos)                        | 6,31 ms                                                 |
| Violaciones de axe en pantallas críticas                  | 0                                                       |
| Participantes de usabilidad / éxito sin ayuda / SUS medio | `[completar]`                                           |
| Velocidad promedio (Sprint 1 + Sprint 2)                  | `[completar]`                                           |

## 6. Revisión de riesgos (Inception §6)

Estados: **Mitigado**, **Controlado**, **Abierto** y **Materializado** (ver el [informe del Sprint 1](./sprint-1.md#6-revisión-de-riesgos-inception-6)). `[completar: actualizar en la review]`.

| ID   | Riesgo                                             | Estado     | Evidencia y acción                                                                                                                                                                                                       |
| ---- | -------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R-01 | El alcance supera la capacidad del semestre        | Controlado | Las 9 historias Must están implementadas; las Should/Could siguen fuera. **Acción:** cerrar la revisión del PR #37 antes de abrir trabajo nuevo.                                                                         |
| R-02 | Sin acceso a sistemas institucionales              | Mitigado   | Sin cambios: pago simulado detrás de un puerto.                                                                                                                                                                          |
| R-03 | Requisitos basados en supuestos no validados       | Abierto    | `[completar: ¿se validaron D-06..D-23 y el flujo con un operario?]`                                                                                                                                                      |
| R-04 | Pago y stock inconsistentes                        | Mitigado   | Además, las transiciones usan control de versión: de varias transiciones concurrentes solo una gana (`operations.int.test.ts`).                                                                                          |
| R-05 | Exposición de datos                                | Controlado | La línea de tiempo del residente no muestra datos del funcionario; las sesiones de usabilidad usan solo cuentas sintéticas. `[completar: resultado de la revisión de GitGuardian]`                                       |
| R-06 | El prototipo no es usable para adultos mayores     | Abierto    | La accesibilidad automatizada está cumplida (cero defectos críticos). Falta la evidencia con personas: si menos del 80 % completa las tareas sin ayuda, el riesgo se materializa. `[completar]`                          |
| R-07 | Estados físicos no se actualizan a tiempo          | Mitigado   | Bandeja con vista «Por gestionar» y orden FIFO; solo se ofrecen transiciones permitidas. **Acción:** validar con un operario que el flujo calza con la operación real.                                                   |
| R-08 | Inventario sintético no representa casos reales    | Controlado | Cancelar desde «Pago validado» repone stock; desde «No entregado» no lo hace (D-02, probado). Ajustes manuales siguen en HU-10 (Should).                                                                                 |
| R-09 | Docentes sin acceso al repositorio o tablero       | Abierto    | `[completar: confirmar acceso de lectura a raztor/farmacias, Project 8 y el video desde otra sesión]`                                                                                                                    |
| R-10 | Falta de disponibilidad de stakeholders            | Abierto    | Las sesiones de usabilidad dependen de conseguir participantes. **Acción:** agendar las sesiones con al menos una semana de anticipación (ver el plan de reclutamiento en [usabilidad.md](../validation/usabilidad.md)). |
| R-11 | El pago simulado oculta problemas reales           | Controlado | Sin cambios.                                                                                                                                                                                                             |
| R-12 | Cambios de requerimientos desestabilizan el sprint | Controlado | Los hallazgos de usabilidad entran como issues nuevos al backlog y el PO los prioriza; no se agregan al sprint en curso.                                                                                                 |

## 7. Aprendizajes

- **Una sola máquina de estados para todos:** el backoffice ofrece solo las transiciones que la máquina permite para el actor, así la interfaz no puede ofrecer un cambio inválido y el API igual lo rechaza.
- **La auditoría de accesibilidad automatizada encontró defectos reales** (4: 3 serios para axe y 1 de contraste de componentes), que se corrigieron antes de la review. Revisar temprano cuesta menos que hacerlo al final.
- **Datos propios por prueba E2E** (residentes y pedidos creados por API, productos separados por spec) permitieron correr la suite en paralelo y repetida sin falsos negativos.
- **No todo se puede verificar en local:** Firefox no arranca en macOS 27 y se cubre en CI; los resultados de CI deben quedar anotados en la documentación.
- `[completar: aprendizajes de las sesiones de usabilidad y de la forma de trabajo del equipo]`

## 8. Próximos pasos

1. Ejecutar las sesiones de usabilidad (T-11) y convertir los hallazgos en issues priorizados por el PO.
2. Subir el trabajo al PR #37, dejar el CI en verde (incluidos Firefox, Chrome y Edge) y obtener la aprobación y la aceptación del PO.
3. Desplegar el MVP en el entorno de demostración con el seed del dominio.
4. Con el PO, decidir si entran historias Should (HU-10 a HU-12) en la siguiente iteración, según los hallazgos y la capacidad.
