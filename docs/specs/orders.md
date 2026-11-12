# Pedidos

> Módulo: `packages/api/src/modules/orders` · Historias: HU-03, HU-04, HU-14 · Issues: #12, #13, #23 · Estado: Borrador v1 (Sprint 1) + HU-14 (Sprint 3)

## 1. Propósito

Permitir que la persona inscrita arme su pedido (productos y cantidades disponibles), elija **retiro presencial** o **despacho simulado** con datos sintéticos y lo confirme para pasar a pago (Inception §4.5 pasos 3–5, OE-03).

## 2. Actores y roles

| Actor               | Puede                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `resident` (dueño)  | Crear y editar **su** borrador, elegir modalidad, confirmar y cancelar sus pedidos permitidos y repetir un pedido anterior (HU-14). |
| `operator`, `admin` | No usan `orders.*`; cancelan desde [Operación](./operations.md).                                                                    |
| Anónimo             | Nada (debe iniciar sesión; la app vuelve al catálogo tras el inicio de sesión).                                                     |

## 3. Reglas de negocio

1. **R-ORD-01.** Cada persona tiene **a lo sumo un** pedido en `draft` (su carrito); se crea al agregar el primer producto. Restricción en BD: índice único parcial `orders(resident_id) WHERE status = 'draft'`. _(RF-04, D-16)_
2. **R-ORD-02.** Al crearse, el pedido recibe un código legible único `P-000123` (secuencia de BD) que se usa en la app, la bandeja y la búsqueda por código. _(RF-09, RF-11)_
3. **R-ORD-03.** Solo se agregan productos activos. La cantidad de cada línea es un entero entre 1 y 99 y no puede superar la disponibilidad actual (`on_hand`). Agregar un producto que ya está en el borrador **suma** a la línea existente; el resultado debe cumplir los mismos límites. _(RF-04, D-16, D-08)_
4. **R-ORD-04.** Si la cantidad supera la disponibilidad, la operación se rechaza (`CONFLICT`, `reason: "QUANTITY_EXCEEDS_AVAILABLE"`) e informa el **máximo permitido**: «Solo puedes agregar hasta N unidades de <producto>.», con `details.maxAllowed = min(on_hand, 99) − cantidad ya en el borrador`. Si ya no cabe ninguna unidad, el mensaje dice la causa real: «Ya tienes en tu pedido todas las unidades disponibles de <producto>.» cuando limita el stock, o «Ya tienes en tu pedido 99 unidades de <producto>, el máximo por producto.» cuando limita el tope por línea (`on_hand > 99`). El borrador no cambia. _(HU-03 criterio 2, RNF-09)_
5. **R-ORD-05.** Agregar, cambiar cantidad o quitar una línea devuelve el borrador completo actualizado (líneas, subtotales, total y cantidad de ítems) para refrescar el resumen. _(HU-03 criterio 1)_
6. **R-ORD-06.** El precio unitario se captura al agregar (`unit_price_clp`) y se refresca al confirmar; `line_total_clp = quantity × unit_price_clp` y `total_clp = Σ line_total_clp`, siempre calculados en el servidor en CLP enteros. El cliente nunca envía precios ni totales. _(RF-04, RF-07, D-16)_
7. **R-ORD-07.** Modalidad `pickup` (retiro presencial): no se solicita ni guarda dirección; si había datos de despacho, se borran. _(RF-05, HU-04 criterio 1, D-04)_
8. **R-ORD-08.** Modalidad `delivery` (despacho simulado): exige `sector`, `addressReference` (dirección sintética o referencia) y `contactAlias`; `instructions` es opcional. Si falta un dato obligatorio, el schema zod rechaza la operación (`BAD_REQUEST`) y `data.zodError` identifica el campo pendiente, con un mensaje por campo («Indica el sector», «Indica una referencia de dirección», «Indica un alias de contacto»). _(RF-05, HU-04 criterio 2, D-04, RNF-09)_
9. **R-ORD-09.** Los datos de despacho son sintéticos: no se piden RUT, teléfono, correo ni dirección real; la interfaz lo explica con texto de ayuda. Límites: `sector` 2..60, `addressReference` 3..120, `contactAlias` 2..60, `instructions` 0..200 caracteres. _(D-04, RNF-06)_
10. **R-ORD-10.** `orders.confirm` mueve `draft → pending_payment` solo si: hay al menos una línea (`CONFLICT`, `EMPTY_ORDER`), hay modalidad válida (`BAD_REQUEST`, `INCOMPLETE_FULFILLMENT` con `details.fields`), todos los productos siguen activos y la cantidad de cada línea no supera la disponibilidad actual (`CONFLICT`, `INSUFFICIENT_STOCK` con `details.lines`). En cualquier rechazo el pedido sigue en `draft`. _(RF-04, RF-05, §4.6)_
11. **R-ORD-11.** Al confirmar se refrescan los precios y se recalcula el total en la misma transacción que la transición; el total confirmado es el monto del pago simulado. Confirmar **no** descuenta ni reserva stock. _(D-02, D-08)_
12. **R-ORD-12.** Toda transición (confirmar, cancelar) pasa por la máquina de estados ([Estados del pedido](./order-status.md)) con _compare-and-set_ sobre estado y versión, y escribe `OrderStatusEvent` con actor `resident`. _(RF-10, RF-12, D-15)_
13. **R-ORD-13.** El dueño puede cancelar en `draft`, `pending_payment`, `payment_rejected` y `payment_validated`; en este último el stock se restaura en la misma transacción (movimiento `cancellation_restore`). Desde `in_preparation` la cancelación no está disponible. _(§4.6, D-02, D-14)_
14. **R-ORD-14.** Solo el dueño opera su pedido. Un pedido de otra cuenta (o inexistente) responde `NOT_FOUND`. _(RNF-05, D-10)_
15. **R-ORD-15.** Solo se edita el pedido en `draft`. Las operaciones de borrador (`addItem`, `setQuantity`, `removeItem`, `setFulfillment`, `confirm`) no reciben el id del pedido: siempre actúan sobre el único borrador actual de la sesión, así que un pedido confirmado, pagado o cancelado no se puede editar por construcción. Sin borrador (p. ej. una pestaña desactualizada después de confirmar), `setQuantity`, `removeItem` y `setFulfillment` responden `NOT_FOUND` (`reason: "NO_DRAFT"`) con «No tienes un pedido en preparación. Si ya lo confirmaste, revísalo en «Mis pedidos»; para comenzar otro, agrega un producto del catálogo.», sin tocar el pedido confirmado; `addItem` abre un borrador nuevo (R-ORD-01). _(§4.6, RNF-09)_
16. **R-ORD-16.** **Repetir pedido** (`orders.repeat`, HU-14): la persona elige un pedido propio en cualquier estado salvo `draft` y sus productos se **suman** a su borrador actual (que se crea si no existe, R-ORD-01), en una sola transacción. Cada cantidad se limita a `min(on_hand, 99) − cantidad ya en el borrador` (el borrador no reserva stock, D-08); los productos sin stock se omiten como `unavailable` y los inactivos como `inactive`. Las líneas escritas toman el **precio actual** del catálogo. La respuesta `{ draft, changes }` informa cada producto que no se agregó completo (`reduced`, `unavailable`, `inactive`, con `requested` y `added`); si no se pudo agregar nada no se crea un borrador vacío (`draft` puede ser `null`). Un pedido de otra cuenta o inexistente responde `NOT_FOUND` (D-10); repetir el propio borrador responde `CONFLICT` (`ORDER_NOT_REPEATABLE`). _(HU-14, D-30, D-16)_

## 4. Estados y transiciones

Este módulo dispara `draft → pending_payment` (confirmar) y las cancelaciones del dueño. La tabla completa está en [Estados del pedido](./order-status.md).

## 5. API

Todas son `residentProcedure` (sin sesión `UNAUTHORIZED`; otro rol `FORBIDDEN`). Errores de entrada: `BAD_REQUEST` con `data.zodError`.

| Procedimiento           | Tipo     | Entrada                                                                                                                    | Salida               | Errores de negocio                                                                                                                              |
| ----------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `orders.draft`          | query    | —                                                                                                                          | `OrderDraft \| null` | —                                                                                                                                               |
| `orders.addItem`        | mutation | `{ productId: string, quantity: int 1..99 }`                                                                               | `OrderDraft`         | `NOT_FOUND` (producto inexistente o inactivo), `CONFLICT` `QUANTITY_EXCEEDS_AVAILABLE`                                                          |
| `orders.setQuantity`    | mutation | `{ productId: string, quantity: int 1..99 }`                                                                               | `OrderDraft`         | `NOT_FOUND` (sin borrador: `NO_DRAFT`; sin esa línea), `CONFLICT` `QUANTITY_EXCEEDS_AVAILABLE`                                                  |
| `orders.removeItem`     | mutation | `{ productId: string }`                                                                                                    | `OrderDraft`         | `NOT_FOUND`                                                                                                                                     |
| `orders.setFulfillment` | mutation | `{ type: "pickup" }` \| `{ type: "delivery", sector, addressReference, contactAlias, instructions? }` (unión discriminada) | `OrderDraft`         | `NOT_FOUND` (sin borrador: `NO_DRAFT`), `BAD_REQUEST` (campo de despacho faltante)                                                              |
| `orders.confirm`        | mutation | `{ expectedVersion: int }`                                                                                                 | `OrderSummary`       | `NOT_FOUND`, `CONFLICT` (`EMPTY_ORDER`, `INSUFFICIENT_STOCK`, `PRODUCT_UNAVAILABLE`, `STALE_VERSION`), `BAD_REQUEST` (`INCOMPLETE_FULFILLMENT`) |
| `orders.cancel`         | mutation | `{ id: string, expectedVersion: int, note?: string (0..200) }`                                                             | `OrderSummary`       | `NOT_FOUND`, `CONFLICT` (`INVALID_TRANSITION`, `STALE_VERSION`)                                                                                 |
| `orders.repeat`         | mutation | `{ orderId: string }`                                                                                                      | `RepeatResult`       | `NOT_FOUND` (pedido de otra cuenta o inexistente), `CONFLICT` `ORDER_NOT_REPEATABLE` (es el borrador)                                           |

Las consultas de pedidos propios (`orders.mine`, `orders.detail`) están en [Seguimiento](./tracking.md).

```ts
type OrderDraft = {
  id: string;
  code: string;
  status: "draft";
  fulfillment: "pickup" | "delivery" | null;
  delivery: {
    sector: string;
    addressReference: string;
    contactAlias: string;
    instructions: string | null;
  } | null;
  lines: {
    productId: string;
    commercialName: string;
    presentation: string;
    quantity: number;
    unitPriceClp: number;
    lineTotalClp: number;
    availableQty: number;
  }[];
  itemCount: number;
  totalClp: number;
  version: number;
};

type OrderSummary = {
  id: string;
  code: string;
  status: OrderStatus;
  statusLabel: string; // etiqueta en español
  fulfillment: "pickup" | "delivery";
  totalClp: number;
  version: number;
  updatedAt: Date;
};

// orders.repeat (R-ORD-16): `draft` es null solo si no había borrador y no se agregó nada.
type RepeatResult = {
  draft: OrderDraft | null;
  changes: {
    productId: string;
    commercialName: string;
    requested: number; // unidades del pedido anterior
    added: number; // unidades sumadas al borrador (0 si se omitió)
    reason: "reduced" | "unavailable" | "inactive";
  }[];
};
```

## 6. Datos

- `orders`: `id` PK, `code` UNIQUE (secuencia), `resident_id` FK → `user` (`RESTRICT`), `status` (texto, `CHECK` de los 10 estados), `fulfillment` (`pickup | delivery`, nulo solo en `draft`), `delivery_sector`, `delivery_address_reference`, `delivery_contact_alias`, `delivery_instructions` (nulos salvo `delivery`), `total_clp` (`Int ≥ 0`), `version` (`Int`, sube en cada cambio), `created_at` (apertura del carrito mientras es borrador; al confirmar, la base lo re-sella con la hora de confirmación, R-DAT-11), `updated_at`. Índices: `(status, fulfillment, created_at)` para la bandeja, `(resident_id, created_at)` para “mis pedidos”, único parcial de borrador (R-ORD-01).
- `order_lines`: `id` PK, `order_id` FK (`CASCADE`), `product_id` FK (`RESTRICT`), `quantity` (`CHECK 1..99`), `unit_price_clp` (`CHECK > 0`), `line_total_clp`, UNIQUE `(order_id, product_id)`.

T-01 (#24) puede agrupar los datos de despacho en una columna JSON validada con zod; el contrato de la API no cambia.

## 7. Casos de prueba

| ID      | Nivel | Caso                                                                                                                                                                           | Criterio cubierto  | Archivo esperado                                                                               |
| ------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------- |
| ORD-U01 | unit  | Totales: `lineTotal = qty × price`, total = suma; enteros CLP                                                                                                                  | HU-03 #1           | `packages/api/src/modules/orders/order-totals.test.ts`                                         |
| ORD-U02 | unit  | `addItem` con cantidad válida agrega la línea y devuelve resumen actualizado                                                                                                   | HU-03 #1           | `packages/api/src/modules/orders/orders.service.test.ts`                                       |
| ORD-U03 | unit  | `addItem` sobre disponibilidad → `CONFLICT` con `maxAllowed` y mensaje con el máximo; borrador intacto                                                                         | HU-03 #2           | `packages/api/src/modules/orders/orders.service.test.ts`                                       |
| ORD-U04 | unit  | Agregar un producto existente suma cantidades y respeta 99 y disponibilidad                                                                                                    | R-ORD-03           | `packages/api/src/modules/orders/orders.service.test.ts`                                       |
| ORD-U05 | unit  | Schema de modalidad: `pickup` sin dirección es válido; `delivery` sin `sector`/`addressReference`/`contactAlias` → error en ese campo                                          | HU-04 #1, #2       | `packages/api/src/modules/orders/orders.schema.test.ts`                                        |
| ORD-U06 | unit  | `confirm`: sin líneas, sin modalidad, stock insuficiente → rechazo y sigue en `draft`; caso feliz recalcula precios                                                            | R-ORD-10, R-ORD-11 | `packages/api/src/modules/orders/orders.service.test.ts`                                       |
| ORD-U07 | unit  | Pedido de otra cuenta → `NOT_FOUND`; edición sin borrador tras confirmar → `NOT_FOUND` `NO_DRAFT` sin tocar el pedido confirmado; `addItem` abre otro borrador                 | R-ORD-14, R-ORD-15 | `packages/api/src/modules/orders/orders.service.test.ts`                                       |
| ORD-U08 | unit  | Cliente: cancelar recarga el pedido y el catálogo con cualquier respuesta; tras un `CONFLICT` (`STALE_VERSION`) el reintento usa el estado y la versión actuales               | R-ORD-12, RNF-09   | `apps/mobile/src/features/orders/order-mutations.test.ts`                                      |
| ORD-U09 | unit  | Cliente: aviso de línea sobre la disponibilidad (agotado → quitar el producto; 1 unidad en singular; N unidades)                                                               | HU-03 #2, RNF-09   | `apps/mobile/src/features/cart/cart-limits.test.ts`                                            |
| ORD-I01 | int   | Un solo borrador por persona incluso con dos `addItem` concurrentes                                                                                                            | R-ORD-01           | `packages/api/src/modules/orders/orders.int.test.ts`                                           |
| ORD-I02 | int   | Confirmar escribe evento `draft → pending_payment` con actor y no toca el stock                                                                                                | R-ORD-11, R-ORD-12 | `packages/api/src/modules/orders/orders.int.test.ts`                                           |
| ORD-I03 | int   | Cancelar en `payment_validated` restaura stock (`cancellation_restore`) + evento + auditoría                                                                                   | R-ORD-13           | `packages/api/src/modules/orders/orders.int.test.ts`                                           |
| ORD-E01 | e2e   | Flujo feliz: agregar, ver resumen, retiro sin dirección, confirmar                                                                                                             | HU-03 #1, HU-04 #1 | `apps/e2e/src/mobile-web/resident-order.spec.ts`                                               |
| ORD-E02 | e2e   | Despacho con un campo vacío: no confirma y señala el campo                                                                                                                     | HU-04 #2           | `apps/e2e/src/mobile-web/delivery-validation.spec.ts`                                          |
| ORD-U10 | unit  | `planRepeat`: completo, suma al borrador, reducido por stock, reducido por el tope de 99 con lo ya pedido, agotado, inactivo, sin cambios                                      | R-ORD-16           | `packages/api/src/modules/orders/repeat-plan.test.ts`                                          |
| ORD-U11 | unit  | `repeat`: crea o suma al borrador con precio actual, informa cambios, no crea borrador vacío, otra cuenta → `NOT_FOUND`, borrador → `CONFLICT`; rol no residente → `FORBIDDEN` | R-ORD-16, D-10     | `packages/api/src/modules/orders/order-repeat.service.test.ts`, `orders.router.test.ts`        |
| ORD-I04 | int   | Repetir tras bajar el stock (reducido) y desactivar un producto (inactivo); conserva y suma las líneas del borrador; otra cuenta → `NOT_FOUND` sin escribir                    | R-ORD-16           | `packages/api/src/modules/orders/order-repeat.int.test.ts`                                     |
| ORD-U12 | unit  | Cliente: texto de cada cambio («se agregaron 2 de 5 por disponibilidad», «agotado, no se agregó»…), título y tono del aviso; la mutación escribe el carrito y el aviso         | R-ORD-16, R-TRK-07 | `apps/mobile/src/features/orders/repeat-notice.test.ts`, `order-mutations.test.ts`             |
| ORD-E03 | e2e   | «Repetir pedido» desde el detalle abre «Mi pedido» con la línea sumada y el aviso; otra cuenta → `NOT_FOUND`, operación → `FORBIDDEN`; aviso auditado con axe                  | R-ORD-16, R-TRK-07 | `apps/e2e/src/mobile-web/repeat-order.spec.ts`, `apps/e2e/src/a11y/mobile-web/screens.spec.ts` |

## 8. Trazabilidad

| Requisito | Historia     | Reglas                           | Pruebas                                 |
| --------- | ------------ | -------------------------------- | --------------------------------------- |
| RF-04     | HU-03        | R-ORD-01..06, R-ORD-10, R-ORD-11 | ORD-U01..U04, ORD-U06, ORD-I01, ORD-E01 |
| RF-05     | HU-04        | R-ORD-07..09                     | ORD-U05, ORD-E01, ORD-E02               |
| RF-10     | HU-04        | R-ORD-12, R-ORD-13, R-ORD-15     | ORD-U07, ORD-I02, ORD-I03               |
| RNF-05    | HU-03        | R-ORD-14                         | ORD-U07                                 |
| RNF-06    | HU-04        | R-ORD-09                         | ORD-U05                                 |
| RNF-09    | HU-03, HU-04 | R-ORD-04, R-ORD-08               | ORD-U03, ORD-U05, ORD-E02               |
| RF-04     | HU-14        | R-ORD-16                         | ORD-U10..U12, ORD-I04, ORD-E03          |

## 9. Notas de implementación (Sprint 1, PR #37)

- **Servicios:** `orders.service.ts` (borrador: `draft`, `addItem`, `setQuantity`, `removeItem`, `setFulfillment`) y `order-checkout.service.ts` (`confirm`, `cancel`). Cada operación corre en una transacción que bloquea el borrador (`SELECT … FOR UPDATE`); la creación concurrente del borrador choca con el índice único parcial y se reintenta una vez (R-ORD-01, prueba ORD-I01).
- **Evento de creación:** al crear el borrador se escribe `OrderStatusEvent` con `from_status = NULL → draft`, de modo que la línea de tiempo comienza en «Borrador».
- **Versión del borrador:** cada edición incrementa `version`; `orders.confirm` exige la versión revisada y responde `STALE_VERSION` si el carrito cambió (p. ej. desde otro dispositivo).
- **R-ORD-15 por construcción:** las operaciones de borrador no reciben `orderId`; siempre actúan sobre el único borrador de la sesión. Tras confirmar, agregar un producto abre un borrador nuevo.
- **`OrderSummary.fulfillment`** es `null` solo para un borrador cancelado antes de elegir modalidad.
- **Transiciones reutilizables:** `applyTransition` y `createOrderTransitionService` (exportados por `modules/orders/index.ts`) aplican máquina de estados → _compare-and-set_ → evento → auditoría → efecto de stock. Operación y el seed los usan; nadie escribe `orders.status` por fuera.
- **Espacio `orders.*`:** el router raíz publica `createRouter({ ...ordersProcedures })`; Seguimiento agrega `mine`/`detail` esparciendo sus procedimientos en el mismo objeto.

## 10. Notas de implementación (Sprint 3, HU-14)

- **Planificación pura:** `repeat-plan.ts` (`planRepeat`) decide qué se suma y qué cambia, sin E/S; `order-repeat.service.ts` lee el pedido origen con los datos actuales del catálogo (`order-repeat.repository.ts`, sin bloqueos: D-08), bloquea el borrador y escribe las líneas en la misma transacción.
- **Cliente:** el botón «Repetir pedido» del detalle (`features/orders/repeat-order-button.tsx`) escribe el borrador devuelto en la caché de `orders.draft`, guarda los cambios en la caché de React Query (`REPEAT_NOTICE_KEY`, que se vacía con el resto al cambiar la sesión) y abre «Mi pedido», donde `RepeatOrderNotice` los muestra en un `Notice` (región en vivo) hasta que la persona pulsa «Entendido».
