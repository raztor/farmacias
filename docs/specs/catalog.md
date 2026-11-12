# Catálogo

> Módulo: `packages/api/src/modules/catalog` · Historias: HU-01, HU-11 · Issues: #10, #33 (rendimiento), #20 · Estado: v2 (Sprint 3: mantención del catálogo, D-28)

## 1. Propósito

Reemplazar el archivo Excel estático (Inception §1.2) por un buscador público de medicamentos sintéticos por **nombre comercial o principio activo**, que muestre precio y disponibilidad sin exigir sesión (OE-02).

## 2. Actores y roles

| Actor                           | Puede                                                                |
| ------------------------------- | -------------------------------------------------------------------- |
| Persona interesada              | Buscar y ver el detalle de productos activos, sin sesión.            |
| `resident`, `operator`, `admin` | Lo mismo; la sesión no cambia lo que se ve.                          |
| `admin`                         | Además, crear y editar productos, precios y su estado (HU-11, D-28). |

## 3. Reglas de negocio

1. **R-CAT-01.** La búsqueda encuentra productos por nombre comercial o principio activo (también por presentación) sin distinguir mayúsculas ni tildes: “losartan” encuentra “Losartán”. _(RF-01)_
2. **R-CAT-02.** El término se normaliza igual en cliente y servidor con `normalizeSearchText` (`@repo/shared`): minúsculas, sin tildes ni diacríticos, espacios colapsados y recortados. `products.search_text` guarda la misma normalización de `commercial_name + active_ingredient + presentation`. _(RF-01)_
3. **R-CAT-03.** Coincidencia por subcadena: **cada palabra** del término normalizado debe aparecer en `search_text` (`search_text LIKE '%palabra%'` por palabra, acelerado con índice GIN `pg_trgm`). Con una palabra equivale a `LIKE '%término%'`; con varias, “celecoxib 200” encuentra “Celebrin Sur · Celecoxib · Cápsulas 200 mg” aunque las palabras no sean contiguas. Una palabra que mezcla letras y dígitos se trata según su forma: un nombre pegado a un número (“losartan50”, letras de 3 o más que no son una unidad) se separa en palabras independientes, igual que escribirlo con espacio; una dosis (“50mg”, “5mg”) o un código corto (“d3”, “b12”, “om3”, “x10”) se mantiene como una sola palabra y coincide tal como se escribió **o** con un espacio en el límite (“50 mg”, “d 3”). Así “losartán 50mg” encuentra “50 mg”, y “d3” no se convierte en “d” + “3”, que coincidiría con casi todo el catálogo. No exige recalcular `search_text`. _(RF-01, RNF-04, RNF-01)_
4. **R-CAT-04.** Orden: primero las coincidencias que **empiezan** con el término (nombre comercial o principio activo), luego el resto; dentro de cada grupo por `commercial_name` y luego `id` (orden total, estable para el cursor). Sin término, lista todos los productos activos por nombre. _(RF-01)_
5. **R-CAT-05.** Solo se listan productos con `active = true`. Un producto inactivo no aparece en la búsqueda y `catalog.byId` responde `NOT_FOUND`. _(RF-01)_
6. **R-CAT-06.** Cada resultado muestra precio en CLP y disponibilidad. `availableQty = inventory_items.on_hand` (no hay reservas, D-08); `availability` es `out` si `availableQty = 0`, `low` si `availableQty ≤ low_stock_threshold` (por defecto 5) y `available` en otro caso. _(RF-02, D-17)_
7. **R-CAT-07.** Las respuestas del catálogo nunca incluyen datos privados (usuarios, pedidos, costos internos ni movimientos). _(RF-02, HU-01 criterio 3, RNF-06)_
8. **R-CAT-08.** Un término sin coincidencias responde una lista vacía (no un error); la interfaz informa “No encontramos resultados para «…»” y deja el término editable. _(HU-01 criterio 2, RNF-09)_
9. **R-CAT-09.** El término admite 0..100 caracteres tras recortar; `limit` 1..50 (por defecto 20). _(validación de borde)_
10. **R-CAT-10.** El 95 % de las búsquedas responde en menos de 2 s con el volumen de datos de prueba acordado (seed ≥ 200 productos y su réplica documentada en la prueba de rendimiento). _(RNF-04, D-05)_
11. **R-CAT-11.** La disponibilidad se presenta con texto e ícono (“Disponible”, “Pocas unidades”, “Agotado”), no solo con color. _(RNF-01, D-17)_

Mantención del catálogo (HU-11, Sprint 3):

12. **R-CAT-12.** Solo `admin` crea y edita productos (`catalog.create`, `catalog.update`, `catalog.adminList`, `catalog.adminById` usan `adminProcedure`; permiso `catalog: write`, D-31). Sin sesión: `UNAUTHORIZED`; `operator` o `resident`: `FORBIDDEN`. El backoffice muestra «Catálogo» solo a quien tiene `catalog: write`; un operario que abre la ruta ve el aviso de acceso solo para administradores. _(RF-14, RNF-05, D-28)_
13. **R-CAT-13.** Campos editables, validados con el schema compartido `productFieldsSchema` (`@repo/shared`, el mismo del formulario): `sku` (3..32, letras, números y guiones, se guarda en mayúsculas, único), `commercialName` y `activeIngredient` (1..120), `presentation` (1..200), `category` (lista cerrada `PRODUCT_CATEGORIES`), `priceClp` (entero 1..9.999.999) y `active`. La edición envía el producto completo. Un SKU ya usado responde `CONFLICT` («Ya existe un producto con ese SKU.») sin escribir nada. _(RF-14, D-28)_
14. **R-CAT-14.** No se borran productos: se desactivan (`active = false`). Un producto inactivo sale de la búsqueda pública y de `catalog.byId` (R-CAT-05), pero sigue en el listado del administrador y puede reactivarse. Un producto nuevo parte con su fila de inventario en `on_hand = 0` y `low_stock_threshold = DEFAULT_LOW_STOCK_THRESHOLD` (5); el stock se registra después con una recepción (HU-10). _(RF-14, D-28, D-26)_
15. **R-CAT-15.** El cambio se refleja de inmediato en el catálogo público: `search_text` se recalcula en cada alta y edición con `buildProductSearchText`, igual que el seed (R-CAT-02). `catalog.adminList` lista activos e inactivos por nombre comercial, con filtro de estado (`all` · `active` · `inactive`) y por texto: cada palabra normalizada debe aparecer en `search_text` o en el SKU. _(RF-14)_
16. **R-CAT-16.** Cada alta escribe `product.create` (`before: null`, `after`: producto) y cada edición `product.update` (producto antes / después: `sku`, nombres, presentación, categoría, `priceClp`, `active`), en la **misma transacción** que el cambio y con la fila del producto bloqueada (`FOR UPDATE`) para que el «antes» sea exacto. Guardar sin cambios no escribe ni audita. _(RF-12, RNF-07, D-22, D-28)_
17. **R-CAT-17.** Un cambio de precio no altera pedidos ya confirmados: cada línea guarda su `unit_price_clp` (D-16); los borradores toman el precio vigente al confirmar (R-ORD-11). _(D-16, D-28)_

Categorías terapéuticas (lista cerrada, `as const`): `cardiovascular`, `salud-mental`, `analgesicos`, `suplementos`, `digestivo`, `otros`.

## 4. Estados y transiciones

Un producto solo tiene dos estados, que cambia el administrador en cualquier sentido con `catalog.update` (R-CAT-14):

| Estado     | Catálogo público                       | Listado admin | Se puede pedir |
| ---------- | -------------------------------------- | ------------- | -------------- |
| `activo`   | Visible (con su disponibilidad)        | Sí            | Sí             |
| `inactivo` | Oculto (`search` y `byId` → NOT_FOUND) | Sí            | No             |

No existe el borrado.

## 5. API

| Procedimiento    | Tipo  | Acceso  | Entrada                                                                                          | Salida                                                    | Errores                                           |
| ---------------- | ----- | ------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------- |
| `catalog.search` | query | público | `{ q?: string (trim, 0..100), category?: ProductCategory, cursor?: string, limit?: 1..50 = 20 }` | `{ items: ProductSummary[], nextCursor: string \| null }` | `BAD_REQUEST` (entrada inválida)                  |
| `catalog.byId`   | query | público | `{ id: string }`                                                                                 | `ProductSummary`                                          | `BAD_REQUEST`, `NOT_FOUND` (no existe o inactivo) |

Mantención (HU-11, solo `admin`; sin sesión `UNAUTHORIZED`, otros roles `FORBIDDEN`):

| Procedimiento       | Tipo     | Entrada                                                                                                         | Salida                                                  | Errores                                            |
| ------------------- | -------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| `catalog.adminList` | query    | `{ q?: string (trim, 0..100), status?: "all" \| "active" \| "inactive" = "all", cursor?, limit?: 1..100 = 20 }` | `{ items: AdminProduct[], nextCursor: string \| null }` | `BAD_REQUEST`                                      |
| `catalog.adminById` | query    | `{ id: string }`                                                                                                | `AdminProduct` (activo o no)                            | `BAD_REQUEST`, `NOT_FOUND`                         |
| `catalog.create`    | mutation | `ProductFields` (R-CAT-13)                                                                                      | `AdminProduct` (`onHand: 0`, umbral por defecto)        | `BAD_REQUEST`, `CONFLICT` (SKU usado)              |
| `catalog.update`    | mutation | `{ id: string } & ProductFields`                                                                                | `AdminProduct`                                          | `BAD_REQUEST`, `NOT_FOUND`, `CONFLICT` (SKU usado) |

```ts
type ProductFields = {
  sku: string; // mayúsculas, único
  commercialName: string;
  activeIngredient: string;
  presentation: string;
  category: ProductCategory;
  priceClp: number; // entero > 0
  active: boolean;
};
type AdminProduct = ProductFields & {
  id: string;
  onHand: number;
  lowStockThreshold: number;
  updatedAt: Date;
};
```

`ProductSummary`:

```ts
type ProductSummary = {
  id: string;
  commercialName: string;
  activeIngredient: string;
  presentation: string;
  category: ProductCategory;
  priceClp: number;
  availableQty: number;
  availability: "available" | "low" | "out";
};
```

API interna para otros módulos (vía `index.ts`): ninguna. Pedidos lee precio y disponibilidad a través de su propio repositorio y del módulo de inventario.

Backoffice (`apps/admin/src/features/catalog`, rutas `/catalog`, `/catalog/new`, `/catalog/[id]`): tabla con precio en CLP, stock y estado en texto («Activo» / «Inactivo»), búsqueda y filtro de estado; formulario validado con el mismo schema, categoría en un `select` nativo, casilla «Producto activo» y avisos de éxito o error.

## 6. Datos

`products`: `id` PK, `sku` UNIQUE, `commercial_name`, `active_ingredient`, `presentation`, `category` (texto con `CHECK` de la lista cerrada), `price_clp` (`Int`, `CHECK > 0`), `active` (`boolean`, por defecto `true`), `search_text` (normalizado; índice GIN `gin_trgm_ops`), `created_at`, `updated_at`.

Disponibilidad: `inventory_items` (ver [Inventario](./inventory.md)), relación 1:1 por `product_id`.

Seed (T-02, #25): ≥ 200 productos sintéticos con la distribución del informe (cardiovascular ~26 %, salud mental ~22 %, analgésicos ~14 %, suplementos ~9 %, digestivo ~8 %, otros ~21 %), incluye los principios más demandados (pregabalina 75/150 mg, melatonina 3 mg, multivitamínico, celecoxib 200 mg, losartán 50 mg, escitalopram 10/20 mg), precios CLP realistas, algunos con stock 0, algunos con stock bajo (≤ 5) y la mayoría normal. Idempotente (upsert por `sku`).

## 7. Casos de prueba

| ID      | Nivel | Caso                                                                                                                                                                                                                 | Criterio cubierto  | Archivo esperado                                                                                                                                                                     |
| ------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CAT-U01 | unit  | `normalizeSearchText` quita tildes, mayúsculas y espacios extra                                                                                                                                                      | HU-01 #1           | `packages/shared/src/domain/normalize-search-text.test.ts`                                                                                                                           |
| CAT-U02 | unit  | Schema de entrada: término > 100 caracteres y `limit` fuera de rango → `BAD_REQUEST`                                                                                                                                 | R-CAT-09           | `packages/api/src/modules/catalog/catalog.schema.test.ts`                                                                                                                            |
| CAT-U03 | unit  | Servicio con repositorio falso: mapeo de disponibilidad `available`/`low`/`out` en los bordes                                                                                                                        | HU-01 #1           | `packages/api/src/modules/catalog/catalog.service.test.ts`                                                                                                                           |
| CAT-U04 | unit  | Término sin coincidencias → `items: []`, `nextCursor: null`                                                                                                                                                          | HU-01 #2           | `packages/api/src/modules/catalog/catalog.service.test.ts`                                                                                                                           |
| CAT-U05 | unit  | Paginación: `nextCursor` presente solo si hay más resultados                                                                                                                                                         | R-CAT-04           | `packages/api/src/modules/catalog/catalog.service.test.ts`                                                                                                                           |
| CAT-U06 | unit  | Router sin sesión: `catalog.search` responde (no `UNAUTHORIZED`) y no expone campos privados                                                                                                                         | HU-01 #3           | `packages/api/src/modules/catalog/catalog.router.test.ts`                                                                                                                            |
| CAT-I01 | int   | Sobre el seed real: “losartan” encuentra “Losartán”; búsqueda por principio y por nombre                                                                                                                             | HU-01 #1           | `packages/api/src/modules/catalog/catalog.int.test.ts`                                                                                                                               |
| CAT-I02 | int   | Prefijo primero, luego subcadena; orden estable entre páginas                                                                                                                                                        | R-CAT-04           | `packages/api/src/modules/catalog/catalog.int.test.ts`                                                                                                                               |
| CAT-I03 | int   | Producto inactivo no aparece; `byId` → `NOT_FOUND`                                                                                                                                                                   | R-CAT-05           | `packages/api/src/modules/catalog/catalog.int.test.ts`                                                                                                                               |
| CAT-I04 | int   | Dosis sin espacio: “Losartán 50mg” y “losartan50” devuelven lo mismo que “losartan 50 mg”; “celecoxib 200mg” solo 200 mg; “d3” devuelve solo productos con D3 y “om3” nada (no se corta en letras y dígitos sueltos) | HU-01 #1, R-CAT-03 | `packages/api/src/modules/catalog/catalog.int.test.ts`, `packages/api/src/modules/catalog/catalog.repository.test.ts`                                                                |
| CAT-P01 | perf  | p95 de `catalog.search` < 2 s con el volumen acordado (p50/p95/p99 informados)                                                                                                                                       | RNF-04             | `packages/api/src/scripts/catalog-search-perf/catalog-search.perf.int.test.ts` + `docs/validation/rendimiento-buscador.md`                                                           |
| CAT-E01 | e2e   | Búsqueda anónima en la web de la app muestra precio y disponibilidad con texto (en `catalog-search.spec.ts`, por un principio activo con tilde escrito sin tildes y en mayúsculas, R-CAT-02)                         | HU-01 #1, #3       | `apps/e2e/src/mobile-web/resident-order.spec.ts`, `apps/e2e/src/mobile-web/catalog-search.spec.ts`                                                                                   |
| CAT-E02 | e2e   | Término sin resultados muestra el mensaje y permite editar el término                                                                                                                                                | HU-01 #2           | `apps/e2e/src/mobile-web/catalog-search.spec.ts`                                                                                                                                     |
| CAT-U07 | unit  | Schema compartido del producto: precio entero > 0, textos obligatorios, categoría cerrada, SKU normalizado; todo el seed es válido; formulario admin (precio con puntos, activo)                                     | R-CAT-13           | `packages/shared/src/schemas/product.schema.test.ts`, `packages/api/src/modules/catalog/catalog-admin.schema.test.ts`, `apps/admin/src/features/catalog/product-form.schema.test.ts` |
| CAT-U08 | unit  | Servicio de mantención con repositorio falso: `search_text`, inventario inicial 0 / 5, auditoría `product.create` / `product.update` antes / después, sin cambios no audita, SKU duplicado → `CONFLICT`, `NOT_FOUND` | HU-11 #1           | `packages/api/src/modules/catalog/catalog-admin.service.test.ts`                                                                                                                     |
| CAT-U09 | unit  | Router: los cuatro procedimientos de mantención responden `UNAUTHORIZED` sin sesión y `FORBIDDEN` a `operator` y `resident`; entrada inválida → `BAD_REQUEST` sin tocar la base                                      | HU-11 #2           | `packages/api/src/modules/catalog/catalog-admin.router.test.ts`, `apps/admin/src/lib/nav-items.test.ts`                                                                              |
| CAT-I05 | int   | Alta: stock 0, umbral 5, `search_text` del seed, fila `product.create`; aparece al instante en `catalog.search`                                                                                                      | HU-11 #1           | `packages/api/src/modules/catalog/catalog-admin.int.test.ts`                                                                                                                         |
| CAT-I06 | int   | Cambio de precio: se ve en `catalog.byId` y deja una fila `product.update` con el precio antes / después; guardar igual no audita                                                                                    | HU-11 #1           | `packages/api/src/modules/catalog/catalog-admin.int.test.ts`                                                                                                                         |
| CAT-I07 | int   | SKU duplicado (alta o edición) → `CONFLICT` sin escrituras ni auditoría                                                                                                                                              | R-CAT-13           | `packages/api/src/modules/catalog/catalog-admin.int.test.ts`                                                                                                                         |
| CAT-I08 | int   | Desactivar: sale de la búsqueda pública y `byId` → `NOT_FOUND`; sigue en `adminList` (filtros por nombre, SKU, estado y cursor)                                                                                      | R-CAT-14, R-CAT-15 | `packages/api/src/modules/catalog/catalog-admin.int.test.ts`                                                                                                                         |
| CAT-I09 | int   | Pedido confirmado conserva su precio tras el cambio; el borrador toma el nuevo al confirmar                                                                                                                          | R-CAT-17           | `packages/api/src/modules/catalog/catalog-admin.int.test.ts`                                                                                                                         |
| CAT-E03 | e2e   | El administrador crea un producto, edita su precio y lo desactiva desde el backoffice; el catálogo público lo refleja                                                                                                | HU-11 #1           | `apps/e2e/src/admin/catalog.spec.ts`, `apps/e2e/src/a11y/admin/screens.spec.ts`                                                                                                      |
| CAT-E04 | e2e   | Operario sin «Catálogo» en el menú, con aviso de acceso en las rutas; API `FORBIDDEN` a operario y residente, `UNAUTHORIZED` sin sesión                                                                              | HU-11 #2           | `apps/e2e/src/admin/catalog.spec.ts`                                                                                                                                                 |

## 8. Trazabilidad

| Requisito | Historia | Reglas             | Pruebas                                |
| --------- | -------- | ------------------ | -------------------------------------- |
| RF-01     | HU-01    | R-CAT-01..05       | CAT-U01, CAT-I01..04, CAT-E01          |
| RF-02     | HU-01    | R-CAT-06, R-CAT-07 | CAT-U03, CAT-U06, CAT-E01              |
| RNF-01    | HU-01    | R-CAT-11           | auditoría de accesibilidad (T-09, #32) |
| RNF-04    | HU-01    | R-CAT-03, R-CAT-10 | CAT-P01 (T-10, #33)                    |
| RNF-06    | HU-01    | R-CAT-07           | CAT-U06                                |
| RNF-09    | HU-01    | R-CAT-08           | CAT-U04, CAT-E02                       |
| RF-14     | HU-11    | R-CAT-12..17       | CAT-U07..09, CAT-I05..09, CAT-E03..04  |
| RNF-05    | HU-11    | R-CAT-12           | CAT-U09, CAT-E04                       |
