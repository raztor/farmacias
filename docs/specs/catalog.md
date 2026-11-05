# Catálogo

> Módulo: `packages/api/src/modules/catalog` · Historias: HU-01 · Issues: #10, #33 (rendimiento) · Estado: Borrador v1 (Sprint 1)

## 1. Propósito

Reemplazar el archivo Excel estático (Inception §1.2) por un buscador público de medicamentos sintéticos por **nombre comercial o principio activo**, que muestre precio y disponibilidad sin exigir sesión (OE-02).

## 2. Actores y roles

| Actor                           | Puede                                                     |
| ------------------------------- | --------------------------------------------------------- |
| Persona interesada              | Buscar y ver el detalle de productos activos, sin sesión. |
| `resident`, `operator`, `admin` | Lo mismo; la sesión no cambia lo que se ve.               |

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

Categorías terapéuticas (lista cerrada, `as const`): `cardiovascular`, `salud-mental`, `analgesicos`, `suplementos`, `digestivo`, `otros`.

## 4. Estados y transiciones

No aplica: el catálogo es de solo lectura en el Must. La mantención de productos y precios es HU-11 (Should).

## 5. API

| Procedimiento    | Tipo  | Acceso  | Entrada                                                                                          | Salida                                                    | Errores                                           |
| ---------------- | ----- | ------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------- |
| `catalog.search` | query | público | `{ q?: string (trim, 0..100), category?: ProductCategory, cursor?: string, limit?: 1..50 = 20 }` | `{ items: ProductSummary[], nextCursor: string \| null }` | `BAD_REQUEST` (entrada inválida)                  |
| `catalog.byId`   | query | público | `{ id: string }`                                                                                 | `ProductSummary`                                          | `BAD_REQUEST`, `NOT_FOUND` (no existe o inactivo) |

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

## 6. Datos

`products`: `id` PK, `sku` UNIQUE, `commercial_name`, `active_ingredient`, `presentation`, `category` (texto con `CHECK` de la lista cerrada), `price_clp` (`Int`, `CHECK > 0`), `active` (`boolean`, por defecto `true`), `search_text` (normalizado; índice GIN `gin_trgm_ops`), `created_at`, `updated_at`.

Disponibilidad: `inventory_items` (ver [Inventario](./inventory.md)), relación 1:1 por `product_id`.

Seed (T-02, #25): ≥ 200 productos sintéticos con la distribución del informe (cardiovascular ~26 %, salud mental ~22 %, analgésicos ~14 %, suplementos ~9 %, digestivo ~8 %, otros ~21 %), incluye los principios más demandados (pregabalina 75/150 mg, melatonina 3 mg, multivitamínico, celecoxib 200 mg, losartán 50 mg, escitalopram 10/20 mg), precios CLP realistas, algunos con stock 0, algunos con stock bajo (≤ 5) y la mayoría normal. Idempotente (upsert por `sku`).

## 7. Casos de prueba

| ID      | Nivel | Caso                                                                                                                                                                                                                 | Criterio cubierto  | Archivo esperado                                                                                                           |
| ------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| CAT-U01 | unit  | `normalizeSearchText` quita tildes, mayúsculas y espacios extra                                                                                                                                                      | HU-01 #1           | `packages/shared/src/domain/normalize-search-text.test.ts`                                                                 |
| CAT-U02 | unit  | Schema de entrada: término > 100 caracteres y `limit` fuera de rango → `BAD_REQUEST`                                                                                                                                 | R-CAT-09           | `packages/api/src/modules/catalog/catalog.schema.test.ts`                                                                  |
| CAT-U03 | unit  | Servicio con repositorio falso: mapeo de disponibilidad `available`/`low`/`out` en los bordes                                                                                                                        | HU-01 #1           | `packages/api/src/modules/catalog/catalog.service.test.ts`                                                                 |
| CAT-U04 | unit  | Término sin coincidencias → `items: []`, `nextCursor: null`                                                                                                                                                          | HU-01 #2           | `packages/api/src/modules/catalog/catalog.service.test.ts`                                                                 |
| CAT-U05 | unit  | Paginación: `nextCursor` presente solo si hay más resultados                                                                                                                                                         | R-CAT-04           | `packages/api/src/modules/catalog/catalog.service.test.ts`                                                                 |
| CAT-U06 | unit  | Router sin sesión: `catalog.search` responde (no `UNAUTHORIZED`) y no expone campos privados                                                                                                                         | HU-01 #3           | `packages/api/src/modules/catalog/catalog.router.test.ts`                                                                  |
| CAT-I01 | int   | Sobre el seed real: “losartan” encuentra “Losartán”; búsqueda por principio y por nombre                                                                                                                             | HU-01 #1           | `packages/api/src/modules/catalog/catalog.int.test.ts`                                                                     |
| CAT-I02 | int   | Prefijo primero, luego subcadena; orden estable entre páginas                                                                                                                                                        | R-CAT-04           | `packages/api/src/modules/catalog/catalog.int.test.ts`                                                                     |
| CAT-I03 | int   | Producto inactivo no aparece; `byId` → `NOT_FOUND`                                                                                                                                                                   | R-CAT-05           | `packages/api/src/modules/catalog/catalog.int.test.ts`                                                                     |
| CAT-I04 | int   | Dosis sin espacio: “Losartán 50mg” y “losartan50” devuelven lo mismo que “losartan 50 mg”; “celecoxib 200mg” solo 200 mg; “d3” devuelve solo productos con D3 y “om3” nada (no se corta en letras y dígitos sueltos) | HU-01 #1, R-CAT-03 | `packages/api/src/modules/catalog/catalog.int.test.ts`, `packages/api/src/modules/catalog/catalog.repository.test.ts`      |
| CAT-P01 | perf  | p95 de `catalog.search` < 2 s con el volumen acordado (p50/p95/p99 informados)                                                                                                                                       | RNF-04             | `packages/api/src/scripts/catalog-search-perf/catalog-search.perf.int.test.ts` + `docs/validation/rendimiento-buscador.md` |
| CAT-E01 | e2e   | Búsqueda anónima en la web de la app muestra precio y disponibilidad con texto (en `catalog-search.spec.ts`, por un principio activo con tilde escrito sin tildes y en mayúsculas, R-CAT-02)                         | HU-01 #1, #3       | `apps/e2e/src/mobile-web/resident-order.spec.ts`, `apps/e2e/src/mobile-web/catalog-search.spec.ts`                         |
| CAT-E02 | e2e   | Término sin resultados muestra el mensaje y permite editar el término                                                                                                                                                | HU-01 #2           | `apps/e2e/src/mobile-web/catalog-search.spec.ts`                                                                           |

## 8. Trazabilidad

| Requisito | Historia | Reglas             | Pruebas                                |
| --------- | -------- | ------------------ | -------------------------------------- |
| RF-01     | HU-01    | R-CAT-01..05       | CAT-U01, CAT-I01..04, CAT-E01          |
| RF-02     | HU-01    | R-CAT-06, R-CAT-07 | CAT-U03, CAT-U06, CAT-E01              |
| RNF-01    | HU-01    | R-CAT-11           | auditoría de accesibilidad (T-09, #32) |
| RNF-04    | HU-01    | R-CAT-03, R-CAT-10 | CAT-P01 (T-10, #33)                    |
| RNF-06    | HU-01    | R-CAT-07           | CAT-U06                                |
| RNF-09    | HU-01    | R-CAT-08           | CAT-U04, CAT-E02                       |
