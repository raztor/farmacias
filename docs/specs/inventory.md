# Inventario

> Módulo: `packages/api/src/modules/inventory` · Historias: HU-06, HU-10, HU-12 · Issues: #15, #19, #21 · Estado: v2 (Sprint 3: recepciones, ajustes y alertas de stock bajo)

## 1. Propósito

Mantener el stock consistente con los pedidos: descontar **una sola vez** al aprobarse el pago simulado, no cambiar ante un rechazo y restaurar de forma controlada ante una cancelación autorizada, dejando registro auditable de cada cambio (Inception §4.1 punto 5, D-02, OE-03). Desde el Sprint 3, el backoffice registra recepciones y ajustes con motivo (HU-10, RF-13) y muestra alertas de stock bajo con un umbral configurable por producto (HU-12, RF-15).

## 2. Actores y roles

| Actor                                 | Participa                                                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `system`                              | Descuento por pago aprobado (vía [Pagos](./payments.md)).                                                                  |
| `resident` dueño, `operator`, `admin` | Restauración automática al cancelar un pedido en `payment_validated`.                                                      |
| `operator`, `admin`                   | Recepciones, ajustes con motivo, umbral de stock bajo y alertas (HU-10, HU-12, D-25..D-27, D-31). `resident`: `FORBIDDEN`. |

## 3. Reglas de negocio

1. **R-INV-01.** El stock de cada producto es `inventory_items.on_hand`, un entero con `CHECK (on_hand >= 0)` en la BD: ninguna operación puede dejarlo negativo. _(RNF-08)_
2. **R-INV-02.** Agregar productos a un borrador o confirmarlo **no** reserva ni descuenta stock; la disponibilidad mostrada es `on_hand`. _(D-02, D-08)_
3. **R-INV-03.** El descuento ocurre solo al aprobarse el pago y dentro de su transacción, con una actualización condicional atómica por línea: `UPDATE inventory_items SET on_hand = on_hand - :q, version = version + 1, updated_at = now() WHERE product_id = :p AND on_hand >= :q`. _(RF-07, HU-06 criterio 1, RNF-08)_
4. **R-INV-04.** Las líneas se procesan en orden determinista de `product_id` para evitar interbloqueos entre pagos concurrentes. _(RNF-08)_
5. **R-INV-05.** Si alguna línea no actualiza fila (stock insuficiente), el descuento completo se revierte: nunca hay descuento parcial. El resultado informa los productos en conflicto (solicitado vs. disponible) para que Pagos registre la evidencia (D-09). _(HU-06 criterio 2)_
6. **R-INV-06.** Cada cambio de stock escribe un `StockMovement` con `delta`, `reason`, `quantity_before`, `quantity_after`, `order_id`, `payment_id` (si aplica), `actor_id` y `created_at`, en la misma transacción. _(RF-12, RNF-07)_
7. **R-INV-07.** Cancelar un pedido en `payment_validated` restaura automáticamente las cantidades descontadas (`reason = cancellation_restore`), en la misma transacción que la transición. _(§4.6, D-02)_
8. **R-INV-08.** Desde `in_preparation` no hay restauración automática; `not_delivered → cancelled` tampoco restaura. La corrección es un ajuste manual autorizado y auditable (R-INV-13). _(§4.6, D-02, D-14)_
9. **R-INV-09.** Motivos de movimiento: `sale`, `cancellation_restore` (Must, siempre con `order_id`); `receipt`, `adjustment` (HU-10, sin pedido: `order_id` nulo). _(RF-12, RF-13)_
10. **R-INV-10.** Cada cambio de stock también genera `AuditLog` (`stock.sale`, `stock.restore`, `stock.receipt` o `stock.adjustment`) con valor anterior y nuevo. _(RNF-07, D-22, D-25)_
11. **R-INV-11.** El umbral `low_stock_threshold` (por defecto 5) determina la etiqueta «Pocas unidades» del catálogo y las alertas de stock bajo del backoffice (R-INV-18). _(D-17, D-27)_
12. **R-INV-12.** Solo `operator` y `admin` consultan y modifican el inventario del backoffice (`inventory: read, adjust`); una persona inscrita recibe `FORBIDDEN` y una llamada anónima `UNAUTHORIZED` en todos los procedimientos `inventory.*`. El actor sale siempre de la sesión, nunca del input. _(D-25, D-31, RNF-05)_
13. **R-INV-13.** **Recepción** (`kind = receipt`): suma unidades, `delta > 0`. **Ajuste** (`kind = adjustment`): corrige en cualquier sentido, `delta ≠ 0`. En ambos casos la cantidad es entera y `|delta| ≤ 10.000`. _(D-25, HU-10 criterio 1)_
14. **R-INV-14.** El motivo es obligatorio: de 5 a 280 caracteres tras recortar espacios. Sin motivo válido la API responde `BAD_REQUEST` («Indica el motivo (al menos 5 caracteres).») antes de abrir la transacción. Se guarda en `stock_movements.note`. _(D-25, HU-10 criterio 2)_
15. **R-INV-15.** La recepción o el ajuste corre en **una transacción interactiva**: bloquea la fila con el mismo `SELECT … FOR UPDATE` que el descuento por pago (R-INV-04) y, si `on_hand + delta < 0`, responde `BAD_REQUEST` «El ajuste dejaría el stock en negativo.» (`reason = NEGATIVE_STOCK`) **sin modificar nada**. Si no, aplica el `UPDATE` (condicional al restar, R-INV-03), escribe un `StockMovement` (`actor_id` de la sesión, `quantity_before/after`, `note` = motivo) y la auditoría `stock.receipt` / `stock.adjustment` con `before: { onHand }` y `after: { onHand }` (entidad `product`). Si cualquier paso falla, todo se revierte. Un producto sin fila de inventario responde `NOT_FOUND`. _(D-22, D-25, RNF-07, RNF-08)_
16. **R-INV-16.** El historial de movimientos de un producto (`inventory.movements`) se lista del más reciente al más antiguo, con motivo, cantidades antes y después, nota, código del pedido (ventas y restauraciones) y responsable (`system` cuando no hay usuario; si no, el rol actual de la cuenta y su nombre). _(RF-12, HU-10)_
17. **R-INV-17.** El umbral de stock bajo es por producto, entero de 0 a 999 (por defecto 5). Lo cambia `operator` o `admin` (`inventory.setThreshold`) en una transacción que bloquea la fila y audita `inventory.threshold_change` con `before` / `after: { lowStockThreshold }`. Guardar el mismo valor no escribe nada. _(D-26, HU-12)_
18. **R-INV-18.** **Alertas de stock bajo** (`inventory.alerts`): un producto **activo** aparece cuando `on_hand ≤ low_stock_threshold`; primero los agotados y luego por unidades disponibles (y nombre). La respuesta trae el total exacto y hasta 200 filas. Es una consulta del backoffice, sin notificaciones push ni correo. _(D-27, HU-12 criterio 1)_
19. **R-INV-19.** El listado de inventario (`inventory.list`) incluye productos activos e inactivos, ordenados por nombre comercial, con búsqueda por nombre, principio activo o presentación (texto normalizado, sin tildes) o por SKU, y el filtro «Solo stock bajo» (`on_hand ≤ umbral`). Paginación por **cursor de clave** (_keyset_): el cursor es un texto opaco validado con zod que guarda la clave de orden de la última fila (nombre e id del producto; en `inventory.movements`, fecha e id del movimiento), y la página siguiente trae solo las filas estrictamente posteriores. Si la última fila deja de cumplir el filtro (por ejemplo, recibe stock), la página siguiente no se salta ninguna fila. Un cursor inválido responde `BAD_REQUEST`. _(HU-10, HU-12)_

## 4. Estados y transiciones

No aplica al ítem de inventario. El inventario reacciona a las transiciones T2/T4 (descuento) y T17 (restauración) de [Estados del pedido](./order-status.md).

## 5. API

### 5.1 Procedimientos tRPC del backoffice (`inventory.*`, `operatorProcedure`)

| Procedimiento            | Tipo     | Input                                                           | Devuelve                                                            | Reglas             |
| ------------------------ | -------- | --------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------ |
| `inventory.list`         | query    | `{ cursor?, limit?, search? (≤ 100), onlyLow? }`                | `{ items: InventoryItemView[], nextCursor }`                        | R-INV-12, R-INV-19 |
| `inventory.product`      | query    | `{ productId }`                                                 | `InventoryItemView` (`NOT_FOUND` si no existe)                      | R-INV-12           |
| `inventory.movements`    | query    | `{ productId, cursor?, limit? }`                                | `{ items: StockMovementView[], nextCursor }` (más reciente primero) | R-INV-16           |
| `inventory.adjust`       | mutation | `{ productId, kind: "receipt" \| "adjustment", delta, reason }` | `{ item, kind, delta, quantityBefore, quantityAfter }`              | R-INV-13..15       |
| `inventory.alerts`       | query    | —                                                               | `{ items: InventoryItemView[], total }` (agotados primero)          | R-INV-18           |
| `inventory.setThreshold` | mutation | `{ productId, threshold }` (entero 0..999)                      | `InventoryItemView`                                                 | R-INV-17           |

`InventoryItemView`: `productId`, `sku`, `name`, `presentation`, `active`, `onHand`, `lowStockThreshold` y `level` (`available` \| `low` \| `out`, R-INV-11). Los schemas de entrada que comparte el formulario del backoffice están en `@repo/shared` (`stockAdjustmentSchema`, `stockReasonSchema`, `lowStockThresholdSchema`).

Errores: `BAD_REQUEST` (validación del input o `NEGATIVE_STOCK`), `NOT_FOUND` (producto sin inventario), `FORBIDDEN` (`resident`) y `UNAUTHORIZED` (sin sesión).

### 5.2 API interna

API interna (vía `index.ts`), siempre dentro de la transacción del llamador (`tx`):

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

| ID      | Nivel | Caso                                                                                                                                                                             | Criterio cubierto                      | Archivo esperado                                                      |
| ------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| INV-U01 | unit  | `availabilityLevel` en los bordes (0, umbral, umbral + 1)                                                                                                                        | R-INV-11                               | `packages/api/src/modules/inventory/inventory.service.test.ts`        |
| INV-U02 | unit  | `discountForOrder` ordena por `productId` y devuelve conflictos sin movimientos si falta una línea                                                                               | R-INV-04, R-INV-05                     | `packages/api/src/modules/inventory/inventory.service.test.ts`        |
| INV-U03 | unit  | `restoreForOrder` restaura exactamente lo vendido y es idempotente                                                                                                               | R-INV-07                               | `packages/api/src/modules/inventory/inventory.service.test.ts`        |
| INV-I01 | int   | `CHECK on_hand >= 0` rechaza una actualización negativa directa                                                                                                                  | R-INV-01                               | `packages/api/src/testing/integration/harness.int.test.ts` (T-05)     |
| INV-I02 | int   | Descuento de varias líneas: todas o ninguna; `quantity_before/after` coherentes                                                                                                  | HU-06 #1, R-INV-06                     | `packages/api/src/modules/inventory/inventory.int.test.ts`            |
| INV-I03 | int   | Una línea sin stock → ninguna línea descontada                                                                                                                                   | HU-06 #2, R-INV-05                     | `packages/api/src/modules/inventory/inventory.int.test.ts`            |
| INV-I04 | int   | Cancelación en `payment_validated` restaura y escribe `cancellation_restore` + auditoría                                                                                         | R-INV-07, R-INV-10                     | `packages/api/src/modules/orders/orders.int.test.ts`                  |
| INV-I05 | int   | `not_delivered → cancelled` no modifica `on_hand`                                                                                                                                | R-INV-08                               | `packages/api/src/modules/operations/operations.int.test.ts`          |
| INV-I06 | int   | Concurrencia sobre el último stock (ver PAY-I04)                                                                                                                                 | HU-06 #2, RNF-08                       | `packages/api/src/modules/payments/payments.concurrency.int.test.ts`  |
| INV-U04 | unit  | Recepción: movimiento `receipt` y auditoría `stock.receipt` con `{ onHand }` antes y después                                                                                     | HU-10 #1, R-INV-15                     | `packages/api/src/modules/inventory/inventory-admin.service.test.ts`  |
| INV-U05 | unit  | Ajuste que dejaría stock negativo → `BAD_REQUEST` sin movimiento ni auditoría; producto inexistente → `NOT_FOUND`                                                                | HU-10 #2, R-INV-15                     | `packages/api/src/modules/inventory/inventory-admin.service.test.ts`  |
| INV-U06 | unit  | Motivo (5..280), signo de la cantidad según el tipo y umbral 0..999 (schemas compartidos)                                                                                        | HU-10 #2, R-INV-13, R-INV-14, R-INV-17 | `packages/shared/src/schemas/inventory.schema.test.ts`                |
| INV-U07 | unit  | Cambio de umbral auditado; guardar el mismo valor no escribe nada                                                                                                                | HU-12, R-INV-17                        | `packages/api/src/modules/inventory/inventory-admin.service.test.ts`  |
| INV-U08 | unit  | Alertas con nivel y total; listado paginado con búsqueda normalizada                                                                                                             | HU-12, R-INV-18, R-INV-19              | `packages/api/src/modules/inventory/inventory-admin.service.test.ts`  |
| INV-U09 | unit  | Permisos: anónimo `UNAUTHORIZED`, `resident` `FORBIDDEN` sin tocar la BD; motivo vacío rechazado antes de la transacción; actor tomado de la sesión                              | R-INV-12, R-INV-14                     | `packages/api/src/modules/inventory/inventory.router.test.ts`         |
| INV-I07 | int   | Recepción: stock, movimiento con actor y motivo, auditoría en la misma transacción e historial con responsable                                                                   | HU-10 #1, R-INV-15, R-INV-16           | `packages/api/src/modules/inventory/inventory-admin.int.test.ts`      |
| INV-I08 | int   | Ajuste negativo rechazado: stock, `version`, movimientos y auditoría intactos                                                                                                    | HU-10 #2, R-INV-15                     | `packages/api/src/modules/inventory/inventory-admin.int.test.ts`      |
| INV-I09 | int   | Si falla la auditoría se revierten el stock y el movimiento                                                                                                                      | D-22, R-INV-15                         | `packages/api/src/modules/inventory/inventory-admin.int.test.ts`      |
| INV-I10 | int   | Ajustes concurrentes con un descuento por pago: nunca stock negativo, libro coherente                                                                                            | RNF-08, R-INV-15                       | `packages/api/src/modules/inventory/inventory-admin.int.test.ts`      |
| INV-I11 | int   | Alertas: activos con `on_hand ≤ umbral`, agotados primero, borde incluido, inactivos excluidos                                                                                   | HU-12 #1, R-INV-18                     | `packages/api/src/modules/inventory/inventory-admin.int.test.ts`      |
| INV-I12 | int   | Cambio de umbral auditado (`inventory.threshold_change`) y el producto entra en las alertas                                                                                      | HU-12 #1, R-INV-17                     | `packages/api/src/modules/inventory/inventory-admin.int.test.ts`      |
| INV-I13 | int   | Listado: paginación por nombre, búsqueda sin tildes y por SKU, filtro de stock bajo                                                                                              | R-INV-19                               | `packages/api/src/modules/inventory/inventory-admin.int.test.ts`      |
| INV-I14 | int   | Paginación por clave: si el último producto de una página deja de estar bajo el umbral, la siguiente no se salta filas; historial paginado sin huecos                            | R-INV-16, R-INV-19                     | `packages/api/src/modules/inventory/inventory-pagination.int.test.ts` |
| INV-U10 | unit  | Cursores opacos: ida y vuelta (con tildes y milisegundos) y rechazo de cursores ajenos con mensaje de validación                                                                 | R-INV-19                               | `packages/api/src/modules/inventory/inventory-cursor.test.ts`         |
| INV-E01 | e2e   | Backoffice: busca el producto, registra una recepción (aviso, historial y stock) y rechaza un ajuste sin motivo y otro que dejaría stock negativo; `resident` recibe `FORBIDDEN` | HU-10 #1, #2                           | `apps/e2e/src/admin/inventory.spec.ts`                                |
| INV-E02 | e2e   | Backoffice: el umbral del producto queda en su stock actual (aviso) y el producto aparece en «Alertas de stock» como «Stock bajo»; luego se restaura el umbral                   | HU-12 #1                               | `apps/e2e/src/admin/inventory.spec.ts`                                |

## 8. Trazabilidad

| Requisito | Historia     | Reglas                               | Pruebas                           |
| --------- | ------------ | ------------------------------------ | --------------------------------- |
| RF-07     | HU-06        | R-INV-02..05, R-INV-07               | INV-U02, INV-I02, INV-I03         |
| RF-08     | HU-05        | R-INV-03 (solo al aprobarse)         | PAY-I02                           |
| RF-12     | HU-06        | R-INV-06, R-INV-10                   | INV-I02, INV-I04                  |
| RNF-07    | HU-06        | R-INV-06, R-INV-10                   | INV-I04, AUD-I01                  |
| RNF-08    | HU-06        | R-INV-01, R-INV-03..05               | INV-I01, INV-I03, INV-I06         |
| RNF-11    | HU-06        | API interna sin dependencias de pago | INV-U02                           |
| RF-13     | HU-10        | R-INV-12..16                         | INV-U04..06, INV-U09, INV-I07..10 |
| RF-15     | HU-12        | R-INV-11, R-INV-17..19               | INV-U07, INV-U08, INV-I11..13     |
| RNF-05    | HU-10, HU-12 | R-INV-12                             | INV-U09                           |

## 9. Notas de implementación (Sprint 1, PR #37)

- **Bloquear y luego descontar:** `discountForOrder` primero bloquea las filas con `SELECT … FROM inventory_items WHERE product_id IN (…) ORDER BY product_id COLLATE "C" FOR UPDATE` (orden determinista e independiente de la colación de la BD) y calcula los conflictos **antes** de modificar; si hay conflicto no se ejecuta ningún `UPDATE`. Si no, aplica el `UPDATE … WHERE on_hand >= q` condicional por línea (R-INV-03), que además protege ante cualquier escritor que no bloquee.
- **Orden global de bloqueos:** toda transacción bloquea primero el pedido y después el inventario en orden de `product_id`, por lo que pagos y cancelaciones concurrentes no se interbloquean (probado con 20 pagos multi-línea concurrentes en INV-I06: el único rechazo aceptado es `CONFLICT` `STOCK_CONFLICT` con un producto cuyo `requested` supera el `available` visto bajo bloqueo, y los pagos `stock_conflict` más los pedidos validados suman 20; un interbloqueo `40P01`/`P2034` o un timeout `P2028` hace fallar la prueba).
- `stock.sale` y `stock.restore` guardan `before: { onHand }` y `after: { onHand, orderId }` para enlazar el cambio con su pedido.
- `getAvailability` no se implementó: Pedidos y Catálogo leen `on_hand` en su propia consulta; `availabilityLevel` sí está disponible.

## 10. Notas de implementación (Sprint 3, HU-10 y HU-12)

- El módulo expone ahora un router (`inventory.router.ts`) sobre `inventory-admin.service.ts` (lógica) e `inventory-admin.repository.ts` (lecturas con Prisma y el _runner_ de transacciones). Las recepciones y ajustes reutilizan `createInventoryStore` (bloqueo `FOR UPDATE`, `increment`, `decrement` condicional, `insertMovements`): un ajuste y un pago concurrentes sobre el mismo producto se serializan en el mismo bloqueo, y el rechazo por stock negativo se decide bajo el bloqueo **antes** de cualquier escritura.
- `StockMovementInput.reason` acepta los cuatro motivos y `orderId` es nulo en `receipt` / `adjustment` (lo permite `stock_movements_order_check`; `stock_movements_direction_check` exige `delta > 0` en las recepciones).
- La auditoría guarda solo `{ onHand }` (D-25); el motivo queda en `stock_movements.note` y se ve en el historial del producto.
- El umbral se actualiza sin incrementar `version`, que cuenta solo cambios de stock.
- Las alertas filtran con una comparación entre columnas (`on_hand <= low_stock_threshold`, referencia de campo de Prisma) y cuentan el total para el contador del backoffice. Las filas y el total se leen en una transacción `REPEATABLE READ`, así que salen de la misma foto y el contador coincide con la lista.
- La paginación no usa `cursor + skip: 1` de Prisma, que se salta una fila real cuando la fila del cursor deja de cumplir el filtro: usa una condición de clave (`nombre > x OR (nombre = x AND id > y)`; en el historial, `(created_at, id)` menor, acotado al producto). `inventory-cursor.ts` no usa globales de Node porque forma parte del grafo de tipos que compilan los clientes.
