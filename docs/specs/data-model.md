# Modelo de datos

> Paquete: `packages/db` (Prisma 7 + PostgreSQL 18) · Tareas: T-01 (#24), T-02 (#25) · Estado: Borrador v1 (Sprint 1)

## 1. Propósito

Persistir catálogo, inventario, pedidos, pagos simulados, historial de estados y auditoría con restricciones en la base de datos que hagan imposibles los estados inválidos aunque falle una validación de la aplicación: stock nunca negativo (RNF-08), un único borrador por persona, un único pago aprobado por pedido y trazabilidad de cada cambio (RF-12, RNF-07).

## 2. Actores y roles

No aplica: el modelo no expone procedimientos. Los módulos de `@repo/api` acceden a él solo desde sus `*.repository.ts`.

## 3. Reglas del modelo

1. **R-DAT-01.** Tablas y columnas en `snake_case`; ids `TEXT` con UUID v7 (`@default(uuid(7))`, ordenables por fecha de creación), igual que las tablas de Better Auth. Fechas `timestamptz(3)` en UTC (D-23). Dinero en CLP como `Int`.
2. **R-DAT-02.** Estados, modalidades, categorías, motivos, roles de actor y acciones de auditoría se guardan como `TEXT` con `CHECK` (sin `enum` de Prisma ni de PostgreSQL). Las listas `as const` viven en `@repo/shared` (`src/domain`) y deben coincidir con los `CHECK` de la migración.
3. **R-DAT-03.** Stock: `inventory_items.on_hand >= 0` (`CHECK`). El descuento atómico es `UPDATE inventory_items SET on_hand = on_hand - $q, version = version + 1 WHERE product_id = $p AND on_hand >= $q` (0 filas = sin stock).
4. **R-DAT-04.** Un borrador por persona: índice único parcial `orders_one_draft_per_resident (resident_id) WHERE status = 'draft'`.
5. **R-DAT-05.** Un pago aprobado por pedido: índice único parcial `payments_one_approved_per_order (order_id) WHERE status = 'approved'`; `payments.idempotency_key` es `UNIQUE`.
6. **R-DAT-06.** Código legible del pedido `P-000001` desde la secuencia `order_code_seq` (función `next_order_code()`, default de `orders.code`). Nunca se trunca: después de `P-999999` sigue `P-1000000`. Puede haber saltos (transacciones revertidas).
7. **R-DAT-07.** Coherencia del pedido: fuera de `draft`/`cancelled` la modalidad es obligatoria; con `delivery` son obligatorios sector, referencia de dirección y alias de contacto; con otra modalidad (o sin modalidad) no hay datos de despacho.
8. **R-DAT-08.** Líneas: `quantity` 1..99, `unit_price_clp > 0`, `line_total_clp = quantity * unit_price_clp`, única por `(order_id, product_id)`.
9. **R-DAT-09.** Kardex (`stock_movements`): `delta <> 0`, `quantity_after = quantity_before + delta`, ambas `>= 0`; `sale` resta, `cancellation_restore`/`receipt` suman; `sale` y `cancellation_restore` llevan `order_id`.
10. **R-DAT-10.** Historial y auditoría son de solo inserción. `order_status_events.note` ≤ 200 caracteres; `from_status` es nulo solo si se registra la creación del pedido.

### Decisiones

- **Listas en `@repo/shared`, no en `@repo/db`.** Los clientes (admin y app) necesitan estados, etiquetas y categorías, y no pueden importar `@repo/db` en runtime (cliente Prisma solo Node). `@repo/db` todavía no declara `@repo/shared` como dependencia, por eso el seed recibe `buildSearchText` por parámetro y repite la lista de categorías en `SEED_CATEGORIES` (una prueba la compara con el `CHECK` de la migración).
- **Ediciones a mano mínimas.** Prisma 7.10 expresa `pg_trgm` (preview `postgresqlExtensions`), el índice GIN `gin_trgm_ops` y los índices únicos parciales (preview `partialIndexes`). Solo la secuencia/función del código y los `CHECK` se agregan a mano, marcados `HAND EDIT` en el SQL. Prisma no modela `CHECK`, así que `migrate diff` ni los crea ni los borra.
- **Cuidado con los índices únicos parciales en Prisma.** Prisma agrega `residentId` a `OrderWhereUniqueInput` y `orderId` a `PaymentWhereUniqueInput`. Al consultar por ellos siempre se agrega el filtro del índice (`status: "draft"` / `status: "approved"`); nunca `findUnique({ where: { residentId } })` a secas.

## 4. Estados y transiciones

Los valores permitidos están en la base (`CHECK`); las transiciones válidas las decide la máquina de estados ([Estados del pedido](./order-status.md)).

## 5. API

`@repo/db` exporta (ver `packages/db/src/index.ts`): `createPrismaClient`, `Prisma`, `type PrismaClient`, los tipos de cada modelo (`Product`, `InventoryItem`, `StockMovement`, `Order`, `OrderLine`, `OrderStatusEvent`, `Payment`, `AuditLog` y los de Better Auth) y el seed del catálogo: `seedCatalog(db, { buildSearchText, products? })`, `buildCatalogProducts()`, `CATALOG_CATEGORIES`, `SEED_CATEGORIES`.

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

Índices para las consultas de las specs: bandeja `orders (status, fulfillment, created_at)` y `orders (created_at)`; mis pedidos `orders (resident_id, created_at)`; historial `order_status_events (order_id, created_at)`; kardex `stock_movements (product_id, created_at)`, `(order_id)`, `(payment_id)`; pagos `payments (order_id, created_at)`; auditoría `audit_logs (entity_type, entity_id, created_at)` y `(created_at)`; catálogo `products (category, commercial_name)`, `(commercial_name)` y GIN trigram sobre `search_text`. Toda FK tiene índice.

### Seed del catálogo (T-02)

`packages/db/src/seed/`: módulo de datos puro (un archivo por categoría) que genera **200 productos sintéticos** con la distribución del informe (cardiovascular 52, salud mental 44, analgésicos 28, suplementos 18, digestivo 16, otros 42), los principios más demandados (pregabalina 75/150 mg, melatonina 3 mg, multivitamínico, celecoxib 200 mg, losartán 50 mg, escitalopram 10/20 mg), marca inventada + versión genérica de laboratorio inventado, precios CLP terminados en 90 y stock determinista (≈ 6 % agotado, ≈ 10 % bajo ≤ 5, el resto 8..150). SKU estable `CAT-COD-B1`/`G1`.

`seedCatalog(db, { buildSearchText: buildProductSearchText })` es idempotente: upsert por `sku` en una transacción; crea la fila de inventario solo si falta y **nunca reinicia el stock** de un producto existente (el stock cambia solo por movimientos). Las cuentas preinscritas y los pedidos de demostración los crea el script de seed del server (`pnpm db:seed`).

### Migraciones

```bash
docker compose -p farmacias -f docker-compose.yml up -d postgres
DATABASE_URL=postgresql://app:app@localhost:5432/farmacias_dev pnpm --filter @repo/db db:migrate   # desarrollo
pnpm db:deploy                                                                                       # producción / CI
```

## 7. Casos de prueba

| ID      | Nivel | Caso                                                                                              | Criterio cubierto            | Archivo                                                    |
| ------- | ----- | ------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------- |
| DAT-U01 | unit  | Listas `as const` iguales a los `CHECK`, sin duplicados, etiquetas completas, guardas             | R-DAT-02                     | `packages/shared/src/domain/domain.test.ts`                |
| DAT-U02 | unit  | `normalizeSearchText` quita tildes/mayúsculas/puntuación, idempotente                             | HU-01, RF-01                 | `packages/shared/src/domain/normalize-search-text.test.ts` |
| DAT-U03 | unit  | Seed: ≥ 200 productos, proporción por categoría, SKU únicos, precios válidos, stock 0/bajo/normal | T-02                         | `packages/db/src/seed/catalog-data.test.ts`                |
| DAT-U04 | unit  | Seed: categorías del seed = `products_category_check` de la migración                             | R-DAT-02                     | `packages/db/src/seed/catalog-data.test.ts`                |
| DAT-U05 | unit  | Generador: precio de góndola, hash estable, stock nunca negativo, intercalado marca/genérico      | T-02                         | `packages/db/src/seed/catalog-generator.test.ts`           |
| DAT-I01 | int   | Stock negativo rechazado por `CHECK`; descuento condicional sin stock afecta 0 filas              | R-DAT-03, RNF-08             | `packages/db/src/schema-constraints.int.test.ts`           |
| DAT-I02 | int   | Código `P-NNNNNN` creciente; segundo borrador rechazado                                           | R-DAT-04, R-DAT-06           | `packages/db/src/schema-constraints.int.test.ts`           |
| DAT-I03 | int   | Estado/modalidad/despacho, líneas, pagos (clave y aprobado único), kardex, auditoría, nota ≤ 200  | R-DAT-05, R-DAT-07..R-DAT-10 | `packages/db/src/schema-constraints.int.test.ts`           |
| DAT-I04 | int   | `seedCatalog` dos veces: mismos conteos, sin duplicados y sin reiniciar stock; búsqueda trigram   | T-02                         | `packages/db/src/seed/seed-catalog.int.test.ts`            |

Las pruebas de `@repo/db` usan `node:test` vía `tsx --test` (el paquete no declara Vitest). Las de integración crean una base aislada `farmacias_it_*`, aplican `prisma migrate deploy` y la borran al terminar; se omiten si falta `TEST_DATABASE_URL`:

```bash
TEST_DATABASE_URL=postgresql://app:app@localhost:5432/app pnpm --filter @repo/db test
```

## 8. Trazabilidad

| Requisito     | Historia     | Reglas                       | Pruebas                   |
| ------------- | ------------ | ---------------------------- | ------------------------- |
| RF-01, RF-02  | HU-01        | R-DAT-02, seed               | DAT-U02, DAT-U03, DAT-I04 |
| RF-04, RF-05  | HU-03, HU-04 | R-DAT-04, R-DAT-07, R-DAT-08 | DAT-I02, DAT-I03          |
| RF-07, RNF-08 | HU-05, HU-06 | R-DAT-03, R-DAT-05           | DAT-I01, DAT-I03          |
| RF-09, RF-11  | HU-07, HU-09 | R-DAT-06, índices            | DAT-I02                   |
| RF-12, RNF-07 | HU-08        | R-DAT-09, R-DAT-10           | DAT-I03                   |
| RNF-06        | —            | seed sintético               | DAT-U03                   |
