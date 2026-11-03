# Inventario

> Módulo: `packages/api/src/modules/inventory` · Historias: HU-06 · Issues: #15 · Estado: Borrador v1 (Sprint 1)

## 1. Propósito

Mantener el stock consistente con los pedidos: descontar **una sola vez** al aprobarse el pago simulado, no cambiar ante un rechazo y restaurar de forma controlada ante una cancelación autorizada, dejando registro auditable de cada cambio (Inception §4.1 punto 5, D-02, OE-03).

## 2. Actores y roles

| Actor                                 | Participa                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `system`                              | Descuento por pago aprobado (vía [Pagos](./payments.md)).                      |
| `resident` dueño, `operator`, `admin` | Restauración automática al cancelar un pedido en `payment_validated`.          |
| `operator`                            | Recepciones y ajustes con motivo: **HU-10 (Should), fuera de esta iteración**. |

## 3. Reglas de negocio

1. **R-INV-01.** El stock de cada producto es `inventory_items.on_hand`, un entero con `CHECK (on_hand >= 0)` en la BD: ninguna operación puede dejarlo negativo. _(RNF-08)_
2. **R-INV-02.** Agregar productos a un borrador o confirmarlo **no** reserva ni descuenta stock; la disponibilidad mostrada es `on_hand`. _(D-02, D-08)_
3. **R-INV-03.** El descuento ocurre solo al aprobarse el pago y dentro de su transacción, con una actualización condicional atómica por línea: `UPDATE inventory_items SET on_hand = on_hand - :q, version = version + 1, updated_at = now() WHERE product_id = :p AND on_hand >= :q`. _(RF-07, HU-06 criterio 1, RNF-08)_
4. **R-INV-04.** Las líneas se procesan en orden determinista de `product_id` para evitar interbloqueos entre pagos concurrentes. _(RNF-08)_
5. **R-INV-05.** Si alguna línea no actualiza fila (stock insuficiente), el descuento completo se revierte: nunca hay descuento parcial. El resultado informa los productos en conflicto (solicitado vs. disponible) para que Pagos registre la evidencia (D-09). _(HU-06 criterio 2)_
6. **R-INV-06.** Cada cambio de stock escribe un `StockMovement` con `delta`, `reason`, `quantity_before`, `quantity_after`, `order_id`, `payment_id` (si aplica), `actor_id` y `created_at`, en la misma transacción. _(RF-12, RNF-07)_
7. **R-INV-07.** Cancelar un pedido en `payment_validated` restaura automáticamente las cantidades descontadas (`reason = cancellation_restore`), en la misma transacción que la transición. _(§4.6, D-02)_
8. **R-INV-08.** Desde `in_preparation` no hay restauración automática; `not_delivered → cancelled` tampoco restaura. La corrección es un ajuste manual autorizado y auditable (HU-10, Should). _(§4.6, D-02, D-14)_
9. **R-INV-09.** Motivos de movimiento: `sale`, `cancellation_restore` (Must); `receipt`, `adjustment` (reservados para HU-10, Should). _(RF-12; RF-13 fuera de alcance)_
10. **R-INV-10.** Cada cambio de stock también genera `AuditLog` (`stock.sale` o `stock.restore`) con valor anterior y nuevo. _(RNF-07, D-22)_
11. **R-INV-11.** El umbral `low_stock_threshold` (por defecto 5) solo determina la etiqueta «Pocas unidades» del catálogo; las alertas de stock bajo son HU-12 (Should). _(D-17)_

## 4. Estados y transiciones

No aplica al ítem de inventario. El inventario reacciona a las transiciones T2/T4 (descuento) y T17 (restauración) de [Estados del pedido](./order-status.md).

## 5. API

Sin procedimientos tRPC en el Must. API interna (vía `index.ts`), siempre dentro de la transacción del llamador (`tx`):

| Función                                                      | Devuelve                                                                                       | Usada por          |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------ |
| `discountForOrder(tx, { orderId, paymentId, lines, actor })` | `{ ok: true, movements }` \| `{ ok: false, conflicts: { productId, requested, available }[] }` | Pagos              |
| `restoreForOrder(tx, { orderId, actor })`                    | `{ movements }` (restaura exactamente lo descontado por `sale` en ese pedido)                  | Pedidos, Operación |
| ~~`getAvailability(productIds)`~~ (no implementada, ver §9)  | `Map<productId, { onHand, lowStockThreshold }>`                                                | —                  |
| `availabilityLevel(onHand, threshold)`                       | `"available" \| "low" \| "out"` (pura)                                                         | Catálogo, Pedidos  |
| `STOCK_MOVEMENT_REASONS`, `type StockMovementReason`         | constantes `as const`                                                                          | Schemas y tipos    |

`discountForOrder` ordena las líneas por `productId` (R-INV-04). La restauración es idempotente: si ya existe un `cancellation_restore` para el pedido, no vuelve a restaurar.

## 6. Datos

- `inventory_items`: `product_id` PK/FK → `products` (`CASCADE`), `on_hand` (`Int`, `CHECK (on_hand >= 0)`), `low_stock_threshold` (`Int`, por defecto 5, `CHECK >= 0`), `version` (`Int`), `updated_at`.
- `stock_movements`: `id` PK, `product_id` FK (`RESTRICT`), `delta` (`Int`, `CHECK (delta <> 0)`), `reason` (`CHECK` de los 4 motivos), `order_id` FK (nulo), `payment_id` FK (nulo), `actor_id` FK → `user` (nulo para `system`), `quantity_before`, `quantity_after` (recomendado: `CHECK (quantity_after = quantity_before + delta AND quantity_after >= 0)`), `note` (nulo), `created_at`. Índices `(product_id, created_at)` y `(order_id)`.

## 7. Casos de prueba

| ID      | Nivel | Caso                                                                                               | Criterio cubierto  | Archivo esperado                                                     |
| ------- | ----- | -------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------- |
| INV-U01 | unit  | `availabilityLevel` en los bordes (0, umbral, umbral + 1)                                          | R-INV-11           | `packages/api/src/modules/inventory/inventory.service.test.ts`       |
| INV-U02 | unit  | `discountForOrder` ordena por `productId` y devuelve conflictos sin movimientos si falta una línea | R-INV-04, R-INV-05 | `packages/api/src/modules/inventory/inventory.service.test.ts`       |
| INV-U03 | unit  | `restoreForOrder` restaura exactamente lo vendido y es idempotente                                 | R-INV-07           | `packages/api/src/modules/inventory/inventory.service.test.ts`       |
| INV-I01 | int   | `CHECK on_hand >= 0` rechaza una actualización negativa directa                                    | R-INV-01           | `packages/api/src/testing/integration/harness.int.test.ts` (T-05)    |
| INV-I02 | int   | Descuento de varias líneas: todas o ninguna; `quantity_before/after` coherentes                    | HU-06 #1, R-INV-06 | `packages/api/src/modules/inventory/inventory.int.test.ts`           |
| INV-I03 | int   | Una línea sin stock → ninguna línea descontada                                                     | HU-06 #2, R-INV-05 | `packages/api/src/modules/inventory/inventory.int.test.ts`           |
| INV-I04 | int   | Cancelación en `payment_validated` restaura y escribe `cancellation_restore` + auditoría           | R-INV-07, R-INV-10 | `packages/api/src/modules/orders/orders.int.test.ts`                 |
| INV-I05 | int   | `not_delivered → cancelled` no modifica `on_hand`                                                  | R-INV-08           | `packages/api/src/modules/operations/operations.int.test.ts`         |
| INV-I06 | int   | Concurrencia sobre el último stock (ver PAY-I04)                                                   | HU-06 #2, RNF-08   | `packages/api/src/modules/payments/payments.concurrency.int.test.ts` |

## 8. Trazabilidad

| Requisito | Historia | Reglas                               | Pruebas                   |
| --------- | -------- | ------------------------------------ | ------------------------- |
| RF-07     | HU-06    | R-INV-02..05, R-INV-07               | INV-U02, INV-I02, INV-I03 |
| RF-08     | HU-05    | R-INV-03 (solo al aprobarse)         | PAY-I02                   |
| RF-12     | HU-06    | R-INV-06, R-INV-10                   | INV-I02, INV-I04          |
| RNF-07    | HU-06    | R-INV-06, R-INV-10                   | INV-I04, AUD-I01          |
| RNF-08    | HU-06    | R-INV-01, R-INV-03..05               | INV-I01, INV-I03, INV-I06 |
| RNF-11    | HU-06    | API interna sin dependencias de pago | INV-U02                   |

## 9. Notas de implementación (Sprint 1, PR #37)

- **Bloquear y luego descontar:** `discountForOrder` primero bloquea las filas con `SELECT … FROM inventory_items WHERE product_id IN (…) ORDER BY product_id COLLATE "C" FOR UPDATE` (orden determinista e independiente de la colación de la BD) y calcula los conflictos **antes** de modificar; si hay conflicto no se ejecuta ningún `UPDATE`. Si no, aplica el `UPDATE … WHERE on_hand >= q` condicional por línea (R-INV-03), que además protege ante cualquier escritor que no bloquee.
- **Orden global de bloqueos:** toda transacción bloquea primero el pedido y después el inventario en orden de `product_id`, por lo que pagos y cancelaciones concurrentes no se interbloquean (probado con 20 pagos multi-línea concurrentes).
- `stock.sale` y `stock.restore` guardan `before: { onHand }` y `after: { onHand, orderId }` para enlazar el cambio con su pedido.
- `getAvailability` no se implementó: Pedidos y Catálogo leen `on_hand` en su propia consulta; `availabilityLevel` sí está disponible.
