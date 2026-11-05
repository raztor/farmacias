# Seguimiento del pedido

> Módulo: `packages/api/src/modules/tracking` · Cliente: `apps/mobile` (Mis pedidos) · Historias: HU-09 · Issues: #18 · Estado: Borrador v1 (Sprint 1)

## 1. Propósito

Que la persona consulte el estado actual y el historial cronológico de **su** pedido desde la aplicación, sin recurrir a WhatsApp (Inception §4.5 paso 10, OE-05).

## 2. Actores y roles

| Actor               | Puede                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| `resident` dueño    | Listar sus pedidos y ver el detalle y la línea de tiempo de cada uno.      |
| Otro `resident`     | Nada sobre pedidos ajenos (`NOT_FOUND`, D-10).                             |
| `operator`, `admin` | Usan [Operación](./operations.md); estos procedimientos son de residentes. |

## 3. Reglas de negocio

1. **R-TRK-01.** El detalle de un pedido propio muestra el estado actual (etiqueta en español con texto e ícono, no solo color), código, modalidad, líneas, total y la **secuencia cronológica** de estados (ascendente por `created_at`). _(RF-11, HU-09 criterio 1, RNF-01)_
2. **R-TRK-02.** Cada hito de la línea de tiempo muestra estado, fecha y hora (hora de Chile, D-23), el rol del actor en lenguaje simple («Tú», «Sistema», «Farmacia») y la nota si existe. **Nunca** muestra nombre, correo ni identificador del funcionario. _(RF-11, RF-12, RNF-06, D-19)_
3. **R-TRK-03.** Un pedido de otra cuenta, o inexistente, responde `NOT_FOUND` con el mismo mensaje («No encontramos ese pedido.»); así el sistema deniega el acceso sin revelar si el pedido existe. _(HU-09 criterio 2, RNF-05, D-10)_
4. **R-TRK-04.** «Mis pedidos» lista solo los pedidos propios **no borradores**, del más reciente al más antiguo, con paginación por cursor. El borrador se ve en «Mi pedido» ([Pedidos](./orders.md)). _(RF-11, D-20)_
5. **R-TRK-05.** El listado es mínimo (código, estado, modalidad, total, fecha) y sirve para llegar al detalle; el historial ampliado de pedidos (Should §4.2) y repetir un pedido (HU-14, Could) no se construyen. _(D-20)_
6. **R-TRK-06.** El 100 % de los pedidos de prueba muestra su historial completo: toda transición aplicada tiene su evento (R-OST-07). _(indicador “Visibilidad del estado”, D-05)_

## 4. Estados y transiciones

Solo lectura. Usa `statusLabel` de [Estados del pedido](./order-status.md).

## 5. API

Ambos son `residentProcedure` (sin sesión `UNAUTHORIZED`; otro rol `FORBIDDEN`). Se publican en el espacio `orders.*` del router raíz para que el cliente tenga una sola superficie de pedidos; la implementación vive en el módulo `tracking`.

| Procedimiento   | Tipo  | Entrada                                   | Salida                                 | Errores                    |
| --------------- | ----- | ----------------------------------------- | -------------------------------------- | -------------------------- |
| `orders.mine`   | query | `{ cursor?: string, limit?: 1..50 = 20 }` | `{ items: MyOrderItem[], nextCursor }` | `BAD_REQUEST`              |
| `orders.detail` | query | `{ id: string }`                          | `MyOrderDetail`                        | `BAD_REQUEST`, `NOT_FOUND` |

```ts
type MyOrderItem = {
  id: string;
  code: string;
  status: OrderStatus;
  statusLabel: string;
  fulfillment: "pickup" | "delivery" | null; // null solo si se canceló un borrador sin modalidad
  totalClp: number;
  createdAt: Date;
  updatedAt: Date;
};

type MyOrderDetail = MyOrderItem & {
  version: number;
  lines: {
    productId: string;
    commercialName: string;
    presentation: string;
    quantity: number;
    unitPriceClp: number;
    lineTotalClp: number;
  }[];
  delivery: {
    sector: string;
    addressReference: string;
    contactAlias: string;
    instructions: string | null;
  } | null;
  timeline: {
    status: OrderStatus;
    label: string;
    actorRole: ActorRole;
    note: string | null;
    at: Date;
  }[];
};
```

Implementado así en `packages/api/src/root.ts`: `orders: createRouter({ ...ordersProcedures, ...trackingProcedures })`, por lo que los clientes usan `orders.mine` y `orders.detail` (no existe un espacio `tracking.*`).

## 6. Datos

Lee `orders` (filtrado siempre por `resident_id = sesión.user.id`), `order_lines` y `order_status_events` (índice `(order_id, created_at)`); nunca une con `user` para la línea de tiempo.

## 7. Casos de prueba

| ID      | Nivel | Caso                                                                                                                                                            | Criterio cubierto  | Archivo esperado                                             |
| ------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------ |
| TRK-U01 | unit  | Mapeo de línea de tiempo: orden ascendente, etiquetas en español, sin datos del actor                                                                           | HU-09 #1, R-TRK-02 | `packages/api/src/modules/tracking/tracking.service.test.ts` |
| TRK-U02 | unit  | Pedido de otra cuenta → `NOT_FOUND` con el mismo mensaje que uno inexistente                                                                                    | HU-09 #2           | `packages/api/src/modules/tracking/tracking.service.test.ts` |
| TRK-U03 | unit  | `mine` excluye borradores, ordena del más reciente y pagina                                                                                                     | R-TRK-04           | `packages/api/src/modules/tracking/tracking.service.test.ts` |
| TRK-U04 | unit  | Cliente: helper de línea de tiempo (rol → «Tú»/«Sistema»/«Farmacia», fecha en hora de Chile)                                                                    | R-TRK-02           | `apps/mobile/src/features/orders/order-status-view.test.ts`  |
| TRK-U05 | unit  | Cliente: al cambiar la persona con sesión (otra cuenta, sesión expirada o revocada) se vacía la caché de pedidos y carrito, también la del contador de la barra | HU-09 #2, D-10     | `apps/mobile/src/lib/session-cache.test.ts`                  |
| TRK-I01 | int   | Pedido con varias transiciones: `detail` devuelve todos los eventos en orden                                                                                    | HU-09 #1, R-TRK-06 | `packages/api/src/modules/tracking/tracking.int.test.ts`     |
| TRK-I02 | int   | Residente B consulta pedido de A → `NOT_FOUND`                                                                                                                  | HU-09 #2           | `packages/api/src/modules/tracking/tracking.int.test.ts`     |
| TRK-E01 | e2e   | Tras pagar, el detalle muestra «Pago validado» y la línea de tiempo                                                                                             | HU-09 #1           | `apps/e2e/src/mobile-web/resident-order.spec.ts`             |
| TRK-E02 | e2e   | Residente no puede abrir el pedido de otra cuenta                                                                                                               | HU-09 #2           | `apps/e2e/src/mobile-web/access-denied.spec.ts`              |

## 8. Trazabilidad

| Requisito | Historia | Reglas                 | Pruebas                            |
| --------- | -------- | ---------------------- | ---------------------------------- |
| RF-11     | HU-09    | R-TRK-01, R-TRK-04..06 | TRK-U01, TRK-U03, TRK-I01, TRK-E01 |
| RF-12     | HU-09    | R-TRK-02               | TRK-U01, TRK-U04                   |
| RNF-05    | HU-09    | R-TRK-03               | TRK-U02, TRK-I02, TRK-E02          |
| RNF-06    | HU-09    | R-TRK-02               | TRK-U01                            |
