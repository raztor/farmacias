# Modelo de datos

> Paquete: `packages/db` (Prisma 7 + PostgreSQL 18) · Tareas: T-01 (#24), T-02 (#25) · Estado: Borrador v1 (Sprint 1)

## 1. Propósito

Persistir catálogo, inventario, pedidos, pagos simulados, historial de estados y auditoría con restricciones en la base de datos que hagan imposibles los estados inválidos aunque falle una validación de la aplicación: stock nunca negativo (RNF-08), un único borrador por persona, un único pago aprobado por pedido y trazabilidad de cada cambio (RF-12, RNF-07).

## 2. Actores y roles

No aplica: el modelo no expone procedimientos. Los módulos de `@repo/api` acceden a él solo desde sus `*.repository.ts`.

## 3. Reglas del modelo

1. **R-DAT-01.** Tablas y columnas en `snake_case`; ids `TEXT` con UUID v7 (`@default(uuid(7))`, ordenables por fecha de creación), igual que las tablas de Better Auth. Fechas `timestamptz(3)` en UTC en **todas** las tablas, incluidas las de Better Auth (`user`, `session`, `account`, `verification`; migración `20261104120000_auth_timestamptz`), para que una sesión SQL en otra zona horaria compare bien con `now()` (D-23). Dinero en CLP como `Int`.
2. **R-DAT-02.** Estados, modalidades, categorías, motivos, roles de actor y acciones de auditoría se guardan como `TEXT` con `CHECK` (sin `enum` de Prisma ni de PostgreSQL). Las listas `as const` viven en `@repo/shared` (`src/domain`) y deben coincidir con los `CHECK` de la migración: `packages/db/src/schema-parity.test.ts` compara cada lista con la última definición del `CHECK` en las migraciones y `schema-parity.int.test.ts` con lo que PostgreSQL guardó (`pg_get_constraintdef`).
3. **R-DAT-03.** Stock: `inventory_items.on_hand >= 0` (`CHECK`). El descuento atómico es `UPDATE inventory_items SET on_hand = on_hand - $q, version = version + 1 WHERE product_id = $p AND on_hand >= $q` (0 filas = sin stock).
4. **R-DAT-04.** Un borrador por persona: índice único parcial `orders_one_draft_per_resident (resident_id) WHERE status = 'draft'`.
5. **R-DAT-05.** Un pago aprobado por pedido: índice único parcial `payments_one_approved_per_order (order_id) WHERE status = 'approved'`; `payments.idempotency_key` es `UNIQUE`.
6. **R-DAT-06.** Código legible del pedido `P-000001` desde la secuencia `order_code_seq` (función `next_order_code()`, default de `orders.code`). Nunca se trunca: después de `P-999999` sigue `P-1000000`. Puede haber saltos (transacciones revertidas). El código se asigna al abrir el carrito y no cambia al confirmar: es un identificador, no indica el orden de llegada (para eso está `created_at`, R-DAT-11).
7. **R-DAT-07.** Coherencia del pedido: fuera de `draft`/`cancelled` la modalidad es obligatoria; con `delivery` son obligatorios sector, referencia de dirección y alias de contacto; con otra modalidad (o sin modalidad) no hay datos de despacho.
8. **R-DAT-08.** Líneas: `quantity` 1..99, `unit_price_clp > 0`, `line_total_clp = quantity * unit_price_clp`, única por `(order_id, product_id)`.
9. **R-DAT-09.** Kardex (`stock_movements`): `delta <> 0`, `quantity_after = quantity_before + delta`, ambas `>= 0`; `sale` resta, `cancellation_restore`/`receipt` suman; `sale` y `cancellation_restore` llevan `order_id`.
10. **R-DAT-10.** Historial y auditoría son de solo inserción. `order_status_events.note` ≤ 200 caracteres; `from_status` es nulo solo si se registra la creación del pedido.
11. **R-DAT-11.** `orders.created_at` es el instante en que el pedido **se realiza**. El borrador (carrito) se convierte en el pedido, así que su `created_at` inicial es la apertura del carrito; el trigger `orders_stamp_placement` (migración `20261104120100_order_placement_time`) lo re-sella con la hora de la transacción cuando el pedido sale de `draft` hacia cualquier estado distinto de `cancelled` (la confirmación). Así la bandeja FIFO (D-18), “Mis pedidos” y la fecha de creación que ve la farmacia siguen el orden de confirmación: un carrito abierto hace días no se adelanta a pedidos confirmados antes. Un borrador cancelado conserva su fecha (nunca se realizó).

### Decisiones

- **Listas en `@repo/shared`, no en `@repo/db`.** Los clientes (admin y app) necesitan estados, etiquetas y categorías, y no pueden importar `@repo/db` en runtime (cliente Prisma solo Node). `@repo/db` depende de `@repo/shared` (`shared ← db`): el seed usa `PRODUCT_CATEGORIES` y `buildProductSearchText` de ahí, sin copias, y las pruebas de paridad comparan las listas compartidas con los `CHECK`.
- **Ediciones a mano mínimas.** Prisma 7.10 expresa `pg_trgm` (preview `postgresqlExtensions`), el índice GIN `gin_trgm_ops` y los índices únicos parciales (preview `partialIndexes`). Solo la secuencia/función del código, los `CHECK` y el trigger `orders_stamp_placement` se agregan a mano, marcados `HAND EDIT` en el SQL. Prisma no modela `CHECK` ni triggers, así que `migrate diff` ni los crea ni los borra.
- **Cuidado con los índices únicos parciales en Prisma.** Prisma agrega `residentId` a `OrderWhereUniqueInput` y `orderId` a `PaymentWhereUniqueInput`. Al consultar por ellos siempre se agrega el filtro del índice (`status: "draft"` / `status: "approved"`); nunca `findUnique({ where: { residentId } })` a secas.

## 4. Estados y transiciones

Los valores permitidos están en la base (`CHECK`); las transiciones válidas las decide la máquina de estados ([Estados del pedido](./order-status.md)).

## 5. API

`@repo/db` exporta (ver `packages/db/src/index.ts`): `createPrismaClient`, `Prisma`, `type PrismaClient`, los tipos de cada modelo (`Product`, `InventoryItem`, `StockMovement`, `Order`, `OrderLine`, `OrderStatusEvent`, `Payment`, `AuditLog` y los de Better Auth) y el seed del catálogo: `seedCatalog(db, { products? })`, `buildCatalogProducts()`, `CATALOG_CATEGORIES`.

`@repo/shared` exporta las listas y tipos: `ORDER_STATUSES`/`OrderStatus` + `ORDER_STATUS_LABELS`, `FULFILLMENT_TYPES` + `FULFILLMENT_LABELS`, `PRODUCT_CATEGORIES` + `PRODUCT_CATEGORY_LABELS`, `STOCK_MOVEMENT_REASONS`, `PAYMENT_STATUSES`, `ACTOR_ROLES`, `AUDIT_ACTIONS`, sus guardas `is*`, `ORDER_LINE_MIN_QUANTITY`/`ORDER_LINE_MAX_QUANTITY`, `DEFAULT_LOW_STOCK_THRESHOLD`, `normalizeSearchText(text)` y `buildProductSearchText(product)`.

## 6. Datos

```mermaid
erDiagram
  user ||--o{ orders : "realiza"
  user |o--o{ order_status_events : "actor"
  user |o--o{ stock_movements : "actor"
  user |o--o{ audit_logs : "actor"
  products ||--|| inventory_items : "stock"
  products ||--o{ stock_movements : "kardex"
  products ||--o{ order_lines : "se pide en"
  orders ||--o{ order_lines : "contiene"
  orders ||--o{ order_status_events : "historial"
  orders ||--o{ payments : "intentos"
  orders |o--o{ stock_movements : "origen"
  payments |o--o{ stock_movements : "origen"

  products {
    text id PK
    text sku UK
    text commercial_name
    text active_ingredient
    text presentation
    text category "CHECK lista cerrada"
    int price_clp "CHECK > 0"
    bool active
    text search_text "GIN gin_trgm_ops"
  }
  inventory_items {
    text product_id PK "FK CASCADE"
    int on_hand "CHECK >= 0"
    int low_stock_threshold "default 5"
    int version
  }
  stock_movements {
    text id PK
    text product_id FK "RESTRICT"
    int delta "CHECK <> 0"
    text reason "CHECK 4 motivos"
    text order_id FK "nulo"
    text payment_id FK "nulo"
    text actor_id FK "SET NULL"
    int quantity_before
    int quantity_after
  }
  orders {
    text id PK
    text code UK "P-000001 secuencia"
    text resident_id FK "RESTRICT"
    text status "CHECK 10 estados"
    text fulfillment "pickup o delivery"
    text delivery_sector
    text delivery_address_reference
    text delivery_contact_alias
    int total_clp "CHECK >= 0"
    int version
  }
  order_lines {
    text id PK
    text order_id FK "CASCADE"
    text product_id FK "RESTRICT"
    int quantity "CHECK 1..99"
    int unit_price_clp "CHECK > 0"
    int line_total_clp "= quantity x unit_price"
  }
  order_status_events {
    text id PK
    text order_id FK "CASCADE"
    text from_status
    text to_status
    text actor_id FK "SET NULL"
    text actor_role "CHECK"
    text note "<= 200"
  }
  payments {
    text id PK
    text order_id FK "RESTRICT"
    text idempotency_key UK
    int amount_clp "CHECK > 0"
    text status "approved, rejected, stock_conflict"
    text reference
    text failure_reason
  }
  audit_logs {
    text id PK
    text actor_id FK "SET NULL"
    text actor_role "CHECK"
    text action "CHECK AUDIT_ACTIONS"
    text entity_type
    text entity_id
    jsonb before
    jsonb after
  }
```

Índices para las consultas de las specs (en `orders`, `created_at` es el instante de confirmación, R-DAT-11): bandeja `orders (status, fulfillment, created_at)` y `orders (created_at)`; mis pedidos `orders (resident_id, created_at)`; historial `order_status_events (order_id, created_at)`; kardex `stock_movements (product_id, created_at)`, `(order_id)`, `(payment_id)`; pagos `payments (order_id, created_at)`; auditoría `audit_logs (entity_type, entity_id, created_at)` y `(created_at)`; catálogo `products (category, commercial_name)`, `(commercial_name)` y GIN trigram sobre `search_text`. Toda FK tiene índice.

### Seed del catálogo (T-02)

`packages/db/src/seed/`: módulo de datos puro (un archivo por categoría) que genera **200 productos sintéticos** con la distribución del informe (cardiovascular 52, salud mental 44, analgésicos 28, suplementos 18, digestivo 16, otros 42), los principios más demandados (pregabalina 75/150 mg, melatonina 3 mg, multivitamínico, celecoxib 200 mg, losartán 50 mg, escitalopram 10/20 mg), marca inventada + versión genérica de laboratorio inventado, precios CLP terminados en 90 y stock determinista (8 agotados = 4 %, 24 con stock bajo de 1 a 5 unidades = 12 %, el resto entre 8 y 149; 172 productos tienen 5 unidades o más, la base de los carriles de los E2E). SKU estable `CAT-COD-B1`/`G1`.

`seedCatalog(db)` es idempotente (guarda `search_text` con `buildProductSearchText` de `@repo/shared`, la misma normalización que aplica el buscador a la consulta): upsert por `sku` en una transacción que **solo inserta los productos que faltan**; un producto existente no se modifica (ni nombre, precio, categoría, estado ni `search_text`: el admin los mantiene en HU-11 con auditoría, D-28, y volver a correr el seed no revierte esos cambios). Crea la fila de inventario solo si falta y **nunca reinicia el stock** (el stock cambia solo por movimientos). Las cuentas preinscritas y los pedidos de demostración los crea el script de seed del server (`pnpm db:seed`).

### Migraciones

```bash
docker compose -p farmacias -f docker-compose.yml up -d postgres
DATABASE_URL=postgresql://app:app@localhost:5432/farmacias_dev pnpm --filter @repo/db db:migrate   # desarrollo
pnpm db:deploy                                                                                       # producción / CI
```

## 7. Casos de prueba

| ID      | Nivel | Caso                                                                                                                              | Criterio cubierto            | Archivo                                                    |
| ------- | ----- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------- |
| DAT-U01 | unit  | Listas `as const` con sus valores publicados, sin duplicados, etiquetas completas, guardas                                        | R-DAT-02                     | `packages/shared/src/domain/domain.test.ts`                |
| DAT-U02 | unit  | `normalizeSearchText` quita tildes/mayúsculas/puntuación, idempotente                                                             | HU-01, RF-01                 | `packages/shared/src/domain/normalize-search-text.test.ts` |
| DAT-U03 | unit  | Seed: ≥ 200 productos, proporción por categoría, SKU únicos, precios válidos, stock 0/bajo/normal                                 | T-02                         | `packages/db/src/seed/catalog-data.test.ts`                |
| DAT-U04 | unit  | Cada lista de `@repo/shared` = última definición de su `CHECK` en las migraciones (10 `CHECK`)                                    | R-DAT-02                     | `packages/db/src/schema-parity.test.ts`                    |
| DAT-U05 | unit  | Generador: precio de góndola, hash estable, stock nunca negativo, intercalado marca/genérico                                      | T-02                         | `packages/db/src/seed/catalog-generator.test.ts`           |
| DAT-U06 | unit  | `seedCatalog`: `search_text` con `buildProductSearchText`, conteos creados/actualizados                                           | T-02, RF-01                  | `packages/db/src/seed/seed-catalog.test.ts`                |
| DAT-I01 | int   | Stock negativo rechazado por `CHECK`; descuento condicional sin stock afecta 0 filas                                              | R-DAT-03, RNF-08             | `packages/db/src/schema-constraints.int.test.ts`           |
| DAT-I02 | int   | Código `P-NNNNNN` creciente; segundo borrador rechazado                                                                           | R-DAT-04, R-DAT-06           | `packages/db/src/schema-constraints.int.test.ts`           |
| DAT-I03 | int   | Estado/modalidad/despacho, líneas, pagos (clave y aprobado único), kardex, auditoría, nota ≤ 200                                  | R-DAT-05, R-DAT-07..R-DAT-10 | `packages/db/src/schema-constraints.int.test.ts`           |
| DAT-I04 | int   | `seedCatalog` dos veces: mismos conteos, sin duplicados y sin reiniciar stock; búsqueda sin tildes                                | T-02                         | `packages/db/src/seed/seed-catalog.int.test.ts`            |
| DAT-I05 | int   | Cada lista de `@repo/shared` = `CHECK` guardado por PostgreSQL (`pg_get_constraintdef`)                                           | R-DAT-02                     | `packages/db/src/schema-parity.int.test.ts`                |
| DAT-I06 | int   | Confirmar re-sella `created_at` (FIFO por confirmación); transiciones posteriores y borrador cancelado no                         | R-DAT-11, D-18               | `packages/db/src/order-placement.int.test.ts`              |
| DAT-I07 | int   | Toda fecha es `timestamptz(3)`; `expires_at > now()` correcto en sesión `America/Santiago`; la migración conserva los valores UTC | R-DAT-01, D-23               | `packages/db/src/auth-timestamps.int.test.ts`              |
| DAT-I08 | int   | El cliente Prisma trabaja en UTC aunque la base tenga otra zona horaria                                                           | R-DAT-01, D-23               | `packages/db/src/client-timezone.int.test.ts`              |

Las pruebas de `@repo/db` usan Vitest, como el resto del repositorio. `pnpm --filter @repo/db test` corre solo las unitarias (`vitest.config.ts` excluye `*.int.test.ts`) y nunca necesita base de datos. `pnpm --filter @repo/db test:integration` (`vitest.integration.config.ts`) corre las de integración en serie: cada archivo crea una base aislada `farmacias_it_*`, aplica `prisma migrate deploy` y la borra al terminar. Sin `TEST_DATABASE_URL` se omiten con un mensaje (en CI es un error):

```bash
TEST_DATABASE_URL=postgresql://app:app@localhost:5432/app pnpm --filter @repo/db test:integration
```

## 8. Trazabilidad

| Requisito     | Historia     | Reglas                       | Pruebas                                              |
| ------------- | ------------ | ---------------------------- | ---------------------------------------------------- |
| RF-01, RF-02  | HU-01        | R-DAT-02, seed               | DAT-U02, DAT-U03, DAT-U04, DAT-U06, DAT-I04, DAT-I05 |
| RF-04, RF-05  | HU-03, HU-04 | R-DAT-04, R-DAT-07, R-DAT-08 | DAT-I02, DAT-I03                                     |
| RF-07, RNF-08 | HU-05, HU-06 | R-DAT-03, R-DAT-05           | DAT-I01, DAT-I03                                     |
| RF-09, RF-11  | HU-07, HU-09 | R-DAT-06, R-DAT-11, índices  | DAT-I02, DAT-I06                                     |
| RF-12, RNF-07 | HU-08        | R-DAT-01, R-DAT-09, R-DAT-10 | DAT-I03, DAT-I07, DAT-I08                            |
| RNF-06        | —            | seed sintético               | DAT-U03                                              |
