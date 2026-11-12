# Reportes operativos

> Módulo: `packages/api/src/modules/reports` · Cliente: `apps/admin` (Reportes) · Historia: HU-13 · Requisitos: RF-16, RNF-05, RNF-06 · Issue: #22 · Estado: v1 (Sprint 3)

## 1. Propósito

Dar al administrador del programa una vista agregada de la operación del prototipo: cuántas unidades se dispensaron, cómo se distribuyen los pedidos por estado y qué productos están bajo su umbral de stock (HU-13, D-29). Son consultas de solo lectura sobre datos sintéticos; no exportan archivos ni muestran datos de personas.

## 2. Actores y roles

| Actor                  | Participa                                                                   |
| ---------------------- | --------------------------------------------------------------------------- |
| `admin`                | Abre «Reportes» en el backoffice y consulta `reports.summary`.              |
| `operator`, `resident` | No ven el ítem «Reportes» y la API les responde `FORBIDDEN` (D-31).         |
| (anónimo)              | La API responde `UNAUTHORIZED`; el backoffice redirige al inicio de sesión. |

## 3. Reglas de negocio

1. **R-REP-01. Unidades dispensadas.** Suma de `order_lines.quantity` de los pedidos **dispensados** en el rango: su estado actual es `delivered` y su evento de estado `→ delivered` (`order_status_events.created_at`) cae dentro del rango. En la máquina de estados (§4.6, [order-status](./order-status.md)) tanto el retiro (`ready_for_pickup → delivered`) como el despacho (`in_transit → delivered`) terminan en `delivered`, que es terminal y se alcanza una sola vez: «entregado o retirado» es exactamente ese estado. `not_delivered` y `cancelled` no cuentan. Se informa además la cantidad de pedidos entregados y el ranking de los 10 productos con más unidades (empates por id de producto). _(RF-16, D-29)_
2. **R-REP-02. Pedidos por estado.** Cantidad de pedidos **colocados** en el rango (`orders.created_at`, que el trigger re-sella al confirmar, R-DAT-11), agrupados por su estado **actual**. Se listan los 9 estados distintos de `draft` en el orden de `ORDER_STATUSES`, con cero cuando no hay pedidos; los borradores (carros) no se cuentan. _(RF-16, D-29)_
3. **R-REP-03. Rango en días de Chile.** El rango son dos días calendario inclusivos (`from`, `to`, formato `AAAA-MM-DD`) en `America/Santiago`. La API lo transforma en el intervalo UTC semiabierto `[inicio de from, inicio del día siguiente a to)`. Chile cambia la hora a medianoche: un día puede empezar a la 01:00 (septiembre) o tener dos medianoches (abril); el inicio de un día es siempre su primer instante. _(D-23, D-29)_
4. **R-REP-04. Rango por defecto y límites.** Sin `to`, se usa el día de hoy en Chile; sin `from`, los 30 días que terminan en `to` (por defecto: últimos 30 días, hoy incluido). `from ≤ to` y el rango abarca como máximo 366 días (un año, incluso bisiesto). Se valida con zod cuando llegan ambos extremos y en el servicio después de completar los que faltan; un rango inválido responde `BAD_REQUEST` con el mensaje del campo y `reason: "INVALID_RANGE"`. _(D-29)_
5. **R-REP-05. Bordes del rango.** Un pedido colocado o entregado a las 23:59:59.999 de Chile pertenece a ese día; uno a las 00:00 del día siguiente, al siguiente (no se usa la medianoche UTC). _(D-23)_
6. **R-REP-06. Productos bajo umbral.** Es la misma lista de alertas de [inventario](./inventory.md) (D-27, `inventory.alerts`): productos activos con `on_hand ≤ low_stock_threshold`, agotados primero, hasta 200 filas y el total exacto. El módulo reutiliza el servicio de inventario (no duplica la consulta) y la lista refleja el estado **actual**: no depende del rango. _(RF-15, RF-16, D-27)_
7. **R-REP-07. Solo agregados.** La respuesta contiene solo cifras agregadas y datos de productos; nunca nombres, correos, direcciones ni identificadores de personas. _(RNF-06, D-29)_
8. **R-REP-08. Solo administración.** `reports.summary` usa `adminProcedure`; el ítem «Reportes» del backoffice se muestra con `can(role, "reports", "read")` y la página repite el chequeo. _(RNF-05, D-31)_
9. **R-REP-09. Consistencia.** Las tres consultas de unidades dispensadas (suma, pedidos y ranking) se leen en una transacción `REPEATABLE READ`, de modo que los totales cuadran entre sí.

## 4. Estados y transiciones

No aplica (consultas de solo lectura). Los estados contados son los de [order-status](./order-status.md).

## 5. API

| Procedimiento     | Tipo  | Acceso           | Entrada                                      | Salida           | Errores                                    |
| ----------------- | ----- | ---------------- | -------------------------------------------- | ---------------- | ------------------------------------------ |
| `reports.summary` | query | `adminProcedure` | `{ from?: "AAAA-MM-DD", to?: "AAAA-MM-DD" }` | `ReportsSummary` | `UNAUTHORIZED`, `FORBIDDEN`, `BAD_REQUEST` |

```ts
type ReportsSummary = {
  range: { from: string; to: string }; // rango usado (con valores por defecto), días de Chile
  dispensed: {
    units: number;
    orders: number;
    // máx. 10, de más a menos unidades
    topProducts: {
      productId: string;
      sku: string;
      name: string;
      presentation: string;
      units: number;
    }[];
  };
  ordersByStatus: { items: { status: OrderStatus; count: number }[]; total: number }; // 9 estados, sin draft
  lowStock: AlertsResult; // = inventory.alerts
};
```

Consultas: Prisma `aggregate` / `groupBy` / `count` con filtros por relación (`events: { some: { toStatus: "delivered", createdAt } }`), sin SQL interpolado. Índices usados: `order_status_events (order_id, created_at)`, `orders (created_at)`, `order_lines (product_id)`.

## 6. Interfaz (backoffice)

Página `apps/admin/src/app/(admin)/reports/page.tsx`, feature `apps/admin/src/features/reports`:

- Filtro de rango con dos campos de fecha («Desde», «Hasta») en la URL (`?from=&to=`), con `FilterForm`. Una fecha inválida o un rango invertido se informa (`role="alert"`) y se muestran los últimos 30 días; el límite de un año lo informa la API.
- Una región por reporte (encabezado `h2`): tarjetas `StatCard` con los totales y tablas HTML con `caption` y celdas `th scope`. Los números se formatean en es-CL; el estado del pedido se muestra con texto y símbolo, y la situación de stock como texto («Agotado», «Bajo umbral»).
- Una región viva anuncia el rango usado («Datos del 13-10-2026 al 11-11-2026, ambos incluidos (hora de Chile)»).

## 7. Casos de prueba

| ID      | Nivel | Caso                                                                                                       | Criterio cubierto            | Archivo                                                                                                             |
| ------- | ----- | ---------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| REP-U01 | unit  | Días calendario, inicio del día en Chile (verano, invierno y cambios de hora), rango por defecto y límites | R-REP-03..05                 | `packages/api/src/modules/reports/reports-range.test.ts`                                                            |
| REP-U02 | unit  | Servicio con repositorio falso: tres secciones, rango pedido, ceros, rango inválido sin consultar          | R-REP-01, 02, 04, 06         | `packages/api/src/modules/reports/reports.service.test.ts`                                                          |
| REP-U03 | unit  | Router: anónimo `UNAUTHORIZED`; `operator` y `resident` `FORBIDDEN`; rango inválido `BAD_REQUEST`          | R-REP-04, R-REP-08           | `packages/api/src/modules/reports/reports.router.test.ts`                                                           |
| REP-U04 | unit  | Admin: lectura del rango desde la URL, entrada de la API y formato es-CL                                   | R-REP-03, R-REP-04           | `apps/admin/src/features/reports/reports-filters.test.ts`, `apps/admin/src/features/reports/reports-format.test.ts` |
| REP-U05 | unit  | «Reportes» visible solo para `admin`                                                                       | R-REP-08                     | `apps/admin/src/lib/nav-items.test.ts`                                                                              |
| REP-I01 | int   | Unidades de pedidos entregados en el rango (retiro y despacho); excluye entregados fuera y no entregados   | HU-13 #1, R-REP-01           | `packages/api/src/modules/reports/reports.int.test.ts`                                                              |
| REP-I02 | int   | Pedidos colocados en el rango por estado, sin borradores ni pedidos anteriores                             | HU-13 #1, R-REP-02           | `packages/api/src/modules/reports/reports.int.test.ts`                                                              |
| REP-I03 | int   | Medianoche de Santiago como borde del día (23:59:59.999 vs 00:00)                                          | R-REP-05                     | `packages/api/src/modules/reports/reports.int.test.ts`                                                              |
| REP-I04 | int   | Rango por defecto (últimos 30 días) y productos bajo umbral (activos, agotados primero)                    | HU-13 #1, R-REP-04, R-REP-06 | `packages/api/src/modules/reports/reports.int.test.ts`                                                              |
| REP-I05 | int   | Router sobre PostgreSQL: admin recibe el resumen, operador `FORBIDDEN`                                     | R-REP-08                     | `packages/api/src/modules/reports/reports.int.test.ts`                                                              |
| REP-E01 | e2e   | El admin abre «Reportes» y ve las tres secciones con números no negativos; filtra por un día               | HU-13 #1                     | `apps/e2e/src/admin/reports.spec.ts`                                                                                |
| REP-E02 | e2e   | Un operador no ve el ítem ni los reportes y la API responde `FORBIDDEN`                                    | R-REP-08                     | `apps/e2e/src/admin/reports.spec.ts`                                                                                |
| REP-A01 | a11y  | Pantalla «Reportes» sin violaciones graves de axe y sin desplazamiento horizontal al 200 %                 | RNF-01, RNF-02               | `apps/e2e/src/a11y/admin/screens.spec.ts`                                                                           |

## 8. Trazabilidad

| Requisito | Historia | Reglas           | Pruebas                             |
| --------- | -------- | ---------------- | ----------------------------------- |
| RF-16     | HU-13    | R-REP-01..06, 09 | REP-U01, U02, REP-I01..I04, REP-E01 |
| RNF-05    | HU-13    | R-REP-08         | REP-U03, U05, REP-I05, REP-E02      |
| RNF-06    | HU-13    | R-REP-07         | revisión de código (tipo de salida) |
| RNF-01/02 | HU-13    | §6               | REP-A01                             |
