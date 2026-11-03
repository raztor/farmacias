# Operación (back office)

> Módulo: `packages/api/src/modules/operations` · Cliente: `apps/admin` · Historias: HU-07, HU-08 · Issues: #16, #17 · Estado: Borrador v1 (Sprint 1)

## 1. Propósito

Dar a los funcionarios una bandeja que permita filtrar los pedidos por estado y modalidad y registrar las transiciones físicas autorizadas con fecha, hora y responsable (Inception §4.1 puntos 6 y 8, OE-04).

## 2. Actores y roles

| Actor               | Puede                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `operator`, `admin` | Ver la bandeja y el detalle de cualquier pedido no borrador; ejecutar transiciones físicas y cancelaciones operativas. |
| `resident`          | Nada en este módulo: `FORBIDDEN`.                                                                                      |
| Anónimo             | Nada: `UNAUTHORIZED`.                                                                                                  |

## 3. Reglas de negocio

1. **R-OPS-01.** La bandeja lista pedidos filtrables por uno o varios estados, por modalidad (`pickup`/`delivery`) y por código (`P-000123`, coincidencia exacta o por prefijo, sin distinguir mayúsculas). Con filtros, se muestran **solo** los pedidos que cumplen todos. _(RF-09, HU-07 criterio 1)_
2. **R-OPS-02.** Por defecto se excluyen los borradores y el orden es del más antiguo al más reciente por `created_at` (FIFO para preparar); desempate por `id`. El filtro de estados no admite `draft` (`BAD_REQUEST`) y `operations.order` / `operations.transition` sobre un borrador responden `NOT_FOUND`: el carrito es privado del residente hasta que lo confirma (la cancelación de un borrador, T14, la hace su dueño desde la app). _(RF-09, D-18)_
3. **R-OPS-03.** Cada fila muestra código, estado (texto, no solo color), modalidad, cantidad de ítems, total, fecha de creación y última actualización. No muestra datos de pago ni credenciales. _(RF-09, RNF-01, RNF-06)_
4. **R-OPS-04.** Un usuario sin rol operativo no puede abrir la bandeja ni el detalle ni ejecutar transiciones: `FORBIDDEN` en el servidor y página «Sin acceso» en el cliente. _(HU-07 criterio 2, RNF-05, D-10)_
5. **R-OPS-05.** El detalle muestra líneas, datos sintéticos de despacho (si aplica), historial completo de estados (fecha, hora, rol y nombre visible del funcionario para uso interno) y `allowedTransitions` calculadas por la máquina de estados para el rol del usuario. _(RF-09, RF-10, RF-12)_
6. **R-OPS-06.** `operations.transition` solo acepta destinos operativos: `in_preparation`, `ready_for_pickup`, `in_transit`, `delivered`, `not_delivered`, `cancelled`. Un destino de pago o de residente se rechaza en el schema (`BAD_REQUEST`). _(D-03, R-OST-04)_
7. **R-OPS-07.** Una transición permitida registra el nuevo estado con fecha, hora y actor (`OrderStatusEvent` + `AuditLog`, misma transacción). _(HU-08 criterio 1, RF-12, RNF-07)_
8. **R-OPS-08.** Una transición no permitida desde el estado actual (o por modalidad) se rechaza con `CONFLICT` y el pedido **conserva el estado anterior**. _(HU-08 criterio 2, RF-10, §4.6)_
9. **R-OPS-09.** Toda transición envía `expectedVersion`; si otro funcionario cambió el pedido antes, responde `CONFLICT` (`STALE_VERSION`) con «Este pedido cambió mientras lo revisabas. Recarga para ver su estado actual.». Con dos solicitudes simultáneas sobre la misma versión, gana exactamente una. La versión se compara (con el pedido bloqueado `FOR UPDATE`) **antes** de evaluar la transición, así quien pierde la carrera siempre recibe `STALE_VERSION` y no un `INVALID_TRANSITION` confuso. _(D-15, RNF-09)_
10. **R-OPS-10.** El cliente solo ofrece botones de `allowedTransitions`, cada uno con confirmación y nota opcional (0..200 caracteres). _(RF-10, RNF-01)_
11. **R-OPS-11.** Cancelar desde `payment_validated` restaura el stock automáticamente; desde `not_delivered` no lo restaura. _(D-02, D-14)_

## 4. Estados y transiciones

Este módulo dispara T6–T17 (salvo las del residente) de [Estados del pedido](./order-status.md).

## 5. API

Todas son `operatorProcedure` (`operator` o `admin`). Sin sesión `UNAUTHORIZED`; otro rol `FORBIDDEN`; entrada inválida `BAD_REQUEST`.

| Procedimiento           | Tipo     | Entrada                                                                                                                                                                                                                | Salida                               | Errores de negocio                                              |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `operations.queue`      | query    | `{ status?: QueueStatus[] (todo menos draft; vacío = todos), fulfillment?: "pickup" \| "delivery", q?: string (código, 0..20, solo letras/dígitos/guiones; se normaliza a mayúsculas), cursor?, limit?: 1..100 = 20 }` | `{ items: QueueItem[], nextCursor }` | —                                                               |
| `operations.order`      | query    | `{ id: string }`                                                                                                                                                                                                       | `OperationsOrderDetail`              | `NOT_FOUND`                                                     |
| `operations.transition` | mutation | `{ id: string, to: OperatorTarget, expectedVersion: int, note?: string (0..200) }`                                                                                                                                     | `OperationsOrderDetail`              | `NOT_FOUND`, `CONFLICT` (`INVALID_TRANSITION`, `STALE_VERSION`) |

```ts
type QueueItem = {
  id: string;
  code: string;
  status: OrderStatus;
  statusLabel: string;
  fulfillment: "pickup" | "delivery" | null; // null: carrito cancelado antes de elegir modalidad
  itemCount: number; // suma de unidades de las líneas
  totalClp: number;
  createdAt: Date;
  updatedAt: Date;
};

type OperationsOrderDetail = QueueItem & {
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
  history: {
    fromStatus: OrderStatus | null; // null en el evento de creación
    toStatus: OrderStatus;
    toLabel: string;
    actorRole: ActorRole;
    actorName: string | null;
    note: string | null;
    createdAt: Date;
  }[]; // del más antiguo al más reciente
  allowedTransitions: OperatorTarget[]; // máquina de estados para el rol del usuario
};
```

## 6. Datos

Lee `orders`, `order_lines`, `order_status_events` y `user` (nombre visible del actor). Índice de la bandeja: `orders(status, fulfillment, created_at)`; búsqueda por `orders.code` (UNIQUE). Escribe vía Pedidos/Inventario/Auditoría.

## 7. Casos de prueba

| ID      | Nivel | Caso                                                                                                                                                  | Criterio cubierto                | Archivo esperado                                                            |
| ------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| OPS-U01 | unit  | Schema de filtros: estados válidos, modalidad, código; `to` no operativo → `BAD_REQUEST`                                                              | R-OPS-01, R-OPS-06               | `packages/api/src/modules/operations/operations.schema.test.ts`             |
| OPS-U02 | unit  | Servicio con repo falso: filtros combinados y exclusión de borradores; orden FIFO                                                                     | HU-07 #1                         | `packages/api/src/modules/operations/operations.service.test.ts`            |
| OPS-U05 | unit  | Transiciones con el código real en memoria: válida (evento + auditoría), inválida, versión vieja, borrador, reposición solo desde `payment_validated` | HU-08 #1, #2, R-OPS-09, R-OPS-11 | `packages/api/src/modules/operations/operations-transition.service.test.ts` |
| OPS-U03 | unit  | `allowedTransitions` en el detalle según estado y modalidad                                                                                           | R-OPS-05                         | `packages/api/src/modules/operations/operations.service.test.ts`            |
| OPS-U04 | unit  | Router: `resident` → `FORBIDDEN`, anónimo → `UNAUTHORIZED` en los tres procedimientos                                                                 | HU-07 #2                         | `packages/api/src/modules/operations/operations.router.test.ts`             |
| OPS-I01 | int   | Bandeja sobre PostgreSQL: filtro por estado y por modalidad devuelve solo los correspondientes                                                        | HU-07 #1                         | `packages/api/src/modules/operations/operations.int.test.ts`                |
| OPS-I02 | int   | Transición válida registra evento con fecha, hora, actor y auditoría                                                                                  | HU-08 #1                         | `packages/api/src/modules/operations/operations.int.test.ts`                |
| OPS-I03 | int   | Transición inválida (p. ej. `payment_validated → delivered`) → `CONFLICT`, estado intacto                                                             | HU-08 #2                         | `packages/api/src/modules/operations/operations.int.test.ts`                |
| OPS-I04 | int   | Dos transiciones concurrentes con la misma `expectedVersion` → exactamente una gana                                                                   | R-OPS-09                         | `packages/api/src/modules/operations/operations.int.test.ts`                |
| OPS-E01 | e2e   | Operador: filtra la bandeja → En preparación → Listo para retiro → Entregado                                                                          | HU-07 #1, HU-08 #1               | `apps/e2e/src/admin/operator-flow.spec.ts`                                  |
| OPS-E02 | e2e   | Transición inválida no se ofrece en la interfaz                                                                                                       | HU-08 #2                         | `apps/e2e/src/admin/operator-flow.spec.ts`                                  |
| OPS-E03 | e2e   | `resident` no puede abrir la bandeja                                                                                                                  | HU-07 #2                         | `apps/e2e/src/admin/access-denied.spec.ts`                                  |

## 8. Trazabilidad

| Requisito | Historia     | Reglas                 | Pruebas                            |
| --------- | ------------ | ---------------------- | ---------------------------------- |
| RF-09     | HU-07        | R-OPS-01..03, R-OPS-05 | OPS-U01, OPS-U02, OPS-I01, OPS-E01 |
| RF-10     | HU-08        | R-OPS-06, R-OPS-08..11 | OPS-U03, OPS-I03, OPS-I04, OPS-E02 |
| RF-12     | HU-08        | R-OPS-07               | OPS-I02                            |
| RNF-05    | HU-07, HU-08 | R-OPS-04               | OPS-U04, OPS-E03                   |
| RNF-07    | HU-08        | R-OPS-07               | OPS-I02, AUD-I01                   |
