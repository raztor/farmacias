# Auditoría

> Módulo: `packages/api/src/modules/audit` · Cliente: `apps/admin` (Auditoría) · Historias: HU-06, HU-08 (transversal) · Issues: #15, #17 · Estado: Borrador v1 (Sprint 1)

## 1. Propósito

Registrar los cambios críticos de stock, estado y permisos con actor, fecha, hora, valor anterior y valor nuevo, y permitir su revisión (Inception §4.1 punto 9 “Auditoría mínima”, indicador “Trazabilidad operativa”: 100 % de transiciones con fecha, hora y actor).

## 2. Actores y roles

| Actor                                | Participa                                          |
| ------------------------------------ | -------------------------------------------------- |
| Todos los módulos que cambian estado | Escriben registros de auditoría en su transacción. |
| `admin`                              | Consulta la auditoría (`audit.list`).              |
| `operator`, `resident`               | No consultan la auditoría (`FORBIDDEN`).           |

## 3. Reglas de negocio

1. **R-AUD-01.** Cada cambio crítico escribe un `AuditLog` con `actor_id` (nulo para `system`), `actor_role`, `action`, `entity_type`, `entity_id`, `before`, `after` y `created_at`. _(RF-12, RNF-07)_
2. **R-AUD-02.** El registro se escribe **en la misma transacción** que el cambio: si el cambio se revierte, el registro también; no existe un cambio crítico confirmado sin su registro. _(RNF-07, D-22)_
3. **R-AUD-03.** Acciones auditadas (lista cerrada `as const`, en sync con el CHECK `audit_logs_action_check`). Las cinco primeras son del Must; las demás, del Sprint 3:

   | `action`                     | `entity_type` | Cuándo                                                | `before` / `after`                                                                      |
   | ---------------------------- | ------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
   | `order.transition`           | `order`       | Toda transición aplicada (incluye pago y cancelación) | `{ status, version }`                                                                   |
   | `stock.sale`                 | `product`     | Descuento por pago aprobado                           | `{ onHand }` antes / después                                                            |
   | `stock.restore`              | `product`     | Restauración por cancelación                          | `{ onHand }` antes / después                                                            |
   | `payment.stock_conflict`     | `order`       | Pago aprobado sin stock suficiente (D-09)             | `before: null`, `after: { paymentId, products: [{ productId, requested, available }] }` |
   | `user.role_change`           | `user`        | `admin.setRole`                                       | `{ role }` antes / después                                                              |
   | `stock.receipt`              | `product`     | Recepción de stock (HU-10, D-25)                      | `{ onHand }` antes / después                                                            |
   | `stock.adjustment`           | `product`     | Ajuste de stock con motivo (HU-10, D-25)              | `{ onHand }` antes / después                                                            |
   | `inventory.threshold_change` | `product`     | Cambio de umbral de stock bajo (HU-12, D-26)          | `{ lowStockThreshold }` antes / después                                                 |
   | `product.create`             | `product`     | Alta de producto (HU-11, D-28)                        | `before: null`, `after`: producto creado (incluye `priceClp`, `active`)                 |
   | `product.update`             | `product`     | Edición de producto o precio (HU-11, D-28)            | producto antes / después (incluye `priceClp`, `active`)                                 |

4. **R-AUD-04.** Los registros son de solo inserción: no existe procedimiento para editarlos ni borrarlos. _(RNF-07)_
5. **R-AUD-05.** `before`/`after` solo contienen datos de dominio sintéticos; nunca contraseñas, tokens, cookies ni datos de pago. _(RNF-06, R-05)_
6. **R-AUD-06.** Solo `admin` consulta la auditoría, filtrando por entidad; el orden es del más reciente al más antiguo. _(RNF-05, D-22)_
7. **R-AUD-07.** Las fechas se guardan en UTC y se muestran en hora de Chile. _(D-23)_

## 4. Estados y transiciones

No aplica (registros inmutables).

## 5. API

| Procedimiento | Tipo  | Acceso           | Entrada                                                                                                                  | Salida                                | Errores                                    |
| ------------- | ----- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ------------------------------------------ |
| `audit.list`  | query | `adminProcedure` | `{ entityType?: "order" \| "product" \| "user", entityId?: string, action?: AuditAction, cursor?, limit?: 1..100 = 20 }` | `{ items: AuditEntry[], nextCursor }` | `UNAUTHORIZED`, `FORBIDDEN`, `BAD_REQUEST` |

```ts
type AuditEntry = {
  id: string;
  action: AuditAction;
  entityType: "order" | "product" | "user";
  entityId: string;
  actorRole: ActorRole;
  actorName: string | null; // visible solo para admin
  before: unknown;
  after: unknown;
  createdAt: Date;
};
```

API interna (vía `index.ts`): `recordAudit(tx, entry)` — los demás módulos la llaman dentro de su transacción; `AUDIT_ACTIONS`, `type AuditAction`.

## 6. Datos

`audit_logs`: `id` PK, `actor_id` FK → `user` (nulo, `SET NULL`), `actor_role` (`CHECK` `resident | operator | admin | system`), `action` (`CHECK` de la lista), `entity_type`, `entity_id`, `before` (`jsonb`, nulo), `after` (`jsonb`, nulo), `created_at`. Índices `(entity_type, entity_id, created_at)` y `(created_at)`.

Además del `AuditLog`, la trazabilidad del pedido vive en `order_status_events` (historial visible) y la del stock en `stock_movements`; los tres se escriben juntos.

## 7. Casos de prueba

| ID      | Nivel | Caso                                                                                          | Criterio cubierto                  | Archivo esperado                                                                      |
| ------- | ----- | --------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------- |
| AUD-U01 | unit  | `audit.list`: filtros y paginación con repo falso                                             | R-AUD-06                           | `packages/api/src/modules/audit/audit.service.test.ts`                                |
| AUD-U02 | unit  | Router: `operator` y `resident` → `FORBIDDEN`                                                 | R-AUD-06                           | `packages/api/src/modules/audit/audit.router.test.ts`                                 |
| AUD-I01 | int   | Pago aprobado y transición escriben `order.transition` y `stock.sale` en la misma transacción | HU-06 #1, HU-08 #1, RNF-07         | `packages/api/src/modules/audit/audit.int.test.ts`                                    |
| AUD-I02 | int   | Si la transacción falla, no queda registro de auditoría                                       | R-AUD-02                           | `packages/api/src/modules/payments/payments.int.test.ts` (prueba «is all or nothing») |
| AUD-I03 | int   | `stock_conflict` deja `payment.stock_conflict` con los productos                              | HU-06 #2                           | `packages/api/src/modules/payments/payments.int.test.ts`                              |
| AUD-I04 | int   | Recorrido de pedidos de prueba: 100 % de transiciones con fecha, hora y actor                 | indicador “Trazabilidad operativa” | `packages/api/src/modules/audit/audit.int.test.ts`                                    |

## 8. Trazabilidad

| Requisito | Historia     | Reglas                       | Pruebas                   |
| --------- | ------------ | ---------------------------- | ------------------------- |
| RF-12     | HU-06, HU-08 | R-AUD-01..03                 | AUD-I01, AUD-I03, AUD-I04 |
| RNF-05    | —            | R-AUD-06                     | AUD-U02                   |
| RNF-06    | —            | R-AUD-05                     | revisión de código        |
| RNF-07    | HU-06, HU-08 | R-AUD-01, R-AUD-02, R-AUD-04 | AUD-I01, AUD-I02          |
