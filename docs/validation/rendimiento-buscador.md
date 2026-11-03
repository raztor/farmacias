# Rendimiento del buscador de medicamentos

> Tarea: T-10 ([#33](https://github.com/raztor/farmacias/issues/33)) · Historia: HU-01 ([#10](https://github.com/raztor/farmacias/issues/10)) · Requisito: **RNF-04** (el 95 % de las búsquedas responde en menos de 2 s) · Spec: [catálogo](../specs/catalog.md) R-CAT-03, R-CAT-10 · Caso: CAT-P01

## Resultado

**Cumple RNF-04 con amplio margen.** Con el volumen acordado (2.000 productos: seed × 10), el **p95 de `catalog.search` fue de 6,31 ms** (meta: < 2.000 ms). Incluso con 20.000 productos (seed × 100) el p95 fue de 46,17 ms.

| Volumen                | Búsquedas medidas | p50 (ms) | p95 (ms) | p99 (ms) | Máx. (ms) | Meta p95 |
| ---------------------- | ----------------: | -------: | -------: | -------: | --------: | -------- |
| 2.000 (× 10, acordado) |               630 |     1,83 | **6,31** |     8,36 |     12,51 | ✅ < 2 s |
| 10.000 (× 50)          |               630 |     3,53 |    22,49 |    27,91 |     34,54 | ✅ < 2 s |
| 20.000 (× 100)         |               630 |     6,43 |    46,17 |    59,91 |    122,36 | ✅ < 2 s |

Fecha: 2026-11-03. Rama `feat/sprint-1-mvp` (PR [#37](https://github.com/raztor/farmacias/pull/37)).

## Volumen de datos (acordado)

- **Base:** el seed sintético del catálogo (`buildCatalogProducts()` de `@repo/db`, T-02): 200 productos con la distribución del informe (cardiovascular 52, salud mental 44, analgésicos 28, suplementos 18, digestivo 16, otros 42), con stock agotado, bajo y normal.
- **Réplica × 10 = 2.000 productos** (volumen acordado para RNF-04, D-05): `replicateCatalog(seed, 10)` (`packages/api/src/scripts/catalog-search-perf/replicate-catalog.ts`) agrega 9 variantes sintéticas de cada producto: mismo principio activo, presentación y categoría; un laboratorio inventado en el nombre comercial (“Tensivar Austral”, “Tensivar Pacífico”…); precio +3 % por variante redondeado a precio de góndola (…90); stock determinista que incluye agotados y bajos; SKU `<sku>-V<n>`. Solo datos sintéticos (RNF-06).
- Se cargan con el mismo `seedCatalog` del seed real (en lotes de 500 por el límite de 5 s de las transacciones de Prisma) y luego se ejecuta `ANALYZE products, inventory_items`, como haría el autovacuum en un entorno real.
- 2.000 productos es 10 veces el catálogo del MVP. Las corridas × 50 y × 100 se hicieron solo para ver cómo crece la latencia con el volumen.

## Método

- **Qué se mide:** el procedimiento real `catalog.search`, llamado **sin sesión** con `createCaller` de `@repo/api`, contra PostgreSQL real. Así se mide la misma ruta que una petición HTTP: validación zod de la entrada, middlewares de tRPC (log y mapeo de errores), servicio (normalización del término, paginación, disponibilidad), repositorio y la consulta SQL (filtro `LIKE` por palabra sobre `search_text`, índice GIN `pg_trgm`, orden por relevancia, cursor _keyset_). No se mide la capa HTTP (Fastify, red y serialización superjson), que agrega unos pocos milisegundos en local; frente a la meta de 2 s, el margen es de más de dos órdenes de magnitud.
- **Consultas:** 21 búsquedas por ronda, entre términos reales de vecinos y casos extremos:
  - principios y marcas: `losartan`, `LOSARTÁN` (tildes y mayúsculas), `pregabalina`, `melatonina`, `multivitaminico`, `celecoxib 200` (varias palabras), `escitalopram`, `paracetamol`, `omeprazol`, `atorvastatina`, `sertra` (palabra parcial), `tensivar` (nombre comercial), `ácido`;
  - términos muy amplios (peor caso, coinciden con casi todo el catálogo): `comprimidos`, `mg`, `a`;
  - sin resultados: `zzz inexistente`; sin término (lista completa por nombre);
  - con filtro de categoría (`pregabalina` + `salud-mental`), página de 50 (`vitamina`) y **segunda página** de `comprimidos` (cursor).
- **Rondas:** 1 ronda de calentamiento (no se cuenta) y 30 rondas medidas: 21 × 30 = **630 búsquedas** por volumen. Cada búsqueda se mide por separado con `performance.now()`.
- **Percentiles:** _nearest-rank_ sin interpolación (`latency-stats.ts`, con pruebas unitarias). Se informan p50, p95, p99 y máximo, en total y por búsqueda. La prueba exige p95 < 2.000 ms en total **y** en cada búsqueda.
- **Entorno:** Apple M3 Pro (36 GB RAM), macOS; PostgreSQL 18.6 local (Homebrew) con configuración por defecto; Node 26.5, Vitest 5.0.5, Prisma 7.10 (`@prisma/adapter-pg`); base de datos efímera creada y migrada con `prisma migrate deploy` por el arnés de integración (§8.1 de `docs/REPO_RULES.md`). Cliente y base en la misma máquina.

## Cómo reproducirlo

```bash
# PostgreSQL de desarrollo (compose) o cualquier PostgreSQL 18 donde el usuario pueda crear bases
pnpm dev:services

# Volumen acordado (× 10), 30 rondas, guarda el informe JSON
CATALOG_PERF_REPLICAS=10 CATALOG_PERF_ROUNDS=30 \
CATALOG_PERF_REPORT_FILE=/tmp/rendimiento-buscador.json \
TEST_DATABASE_URL=postgresql://app:app@localhost:5432/app \
pnpm --filter @repo/api exec vitest run --config vitest.integration.config.ts src/scripts/catalog-search-perf
```

| Variable                   | Por defecto | Uso                                               |
| -------------------------- | ----------: | ------------------------------------------------- |
| `CATALOG_PERF_REPLICAS`    |          10 | Multiplicador del catálogo (1..100).              |
| `CATALOG_PERF_ROUNDS`      |          20 | Rondas medidas (1..1000).                         |
| `CATALOG_PERF_REPORT_FILE` |           — | Ruta donde se escribe el informe JSON (opcional). |

El informe JSON trae el volumen, la versión de PostgreSQL, p50/p95/p99/máx. en total y por búsqueda, y el plan `EXPLAIN ANALYZE` de una búsqueda típica. Vitest además anota el resumen en la salida de la prueba.

**En CI** el mismo archivo corre como prueba de humo dentro de `pnpm test:integration` (job `integration`), con los valores por defecto (× 10, 20 rondas, unos 5 s): una regresión que lleve el p95 sobre 2 s deja el job en rojo.

Archivos: `packages/api/src/scripts/catalog-search-perf/` (`catalog-search.perf.int.test.ts`, `replicate-catalog.ts`, `latency-stats.ts`, `perf-config.ts` y sus pruebas unitarias).

## Detalle por búsqueda (volumen acordado, 2.000 productos)

| Búsqueda                   | Resultados (1.ª página) | p50 (ms) | p95 (ms) | p99 (ms) | Máx. (ms) |
| -------------------------- | ----------------------: | -------: | -------: | -------: | --------: |
| `losartan`                 |                      20 |     2,04 |     2,91 |     7,94 |      7,94 |
| `LOSARTÁN`                 |                      20 |     1,73 |     4,41 |     5,80 |      5,80 |
| `pregabalina`              |                      20 |     1,78 |     3,37 |     6,14 |      6,14 |
| `melatonina`               |                      20 |     1,60 |     2,58 |     4,41 |      4,41 |
| `multivitaminico`          |                      20 |     1,69 |     2,43 |     2,71 |      2,71 |
| `celecoxib 200`            |                      20 |     1,79 |     3,59 |     4,48 |      4,48 |
| `escitalopram`             |                      20 |     1,56 |     4,40 |     8,42 |      8,42 |
| `paracetamol`              |                      20 |     1,75 |     3,17 |     7,47 |      7,47 |
| `omeprazol`                |                      20 |     1,92 |     3,36 |     3,76 |      3,76 |
| `atorvastatina`            |                      20 |     1,62 |     3,27 |    10,74 |     10,74 |
| `sertra`                   |                      20 |     1,73 |     3,04 |     3,27 |      3,27 |
| `tensivar`                 |                      20 |     1,53 |     2,25 |     3,10 |      3,10 |
| `ácido`                    |                      20 |     1,58 |     2,97 |     3,15 |      3,15 |
| `comprimidos`              |                      20 |     4,25 |     7,02 |     7,41 |      7,41 |
| `mg`                       |                      20 |     4,93 |     7,69 |     9,20 |      9,20 |
| `a`                        |                      20 |     4,73 |     6,85 |     7,03 |      7,03 |
| `zzz inexistente`          |                       0 |     1,40 |     2,18 |     2,27 |      2,27 |
| (sin término)              |                      20 |     0,93 |     2,05 |     2,14 |      2,14 |
| `pregabalina` + categoría  |                      20 |     1,35 |     2,00 |     2,05 |      2,05 |
| `vitamina` (50 por página) |                      50 |     1,86 |     7,31 |     7,79 |      7,79 |
| `comprimidos` (página 2)   |                      20 |     6,15 |     9,65 |    12,51 |     12,51 |

## Análisis

- **Las búsquedas reales** (un principio activo o una marca) responden en 2–4 ms de p95 con 2.000 productos y en 8–10 ms con 20.000.
- **El peor caso son los términos muy amplios** (`mg`, `a`, `comprimidos`) y, sobre todo, la segunda página de uno de ellos: coinciden con casi todo el catálogo, así que PostgreSQL debe calcular la relevancia y ordenar todas las coincidencias antes de cortar la página. Su costo crece en forma lineal con el volumen: p95 de unos 8 ms con 2.000 productos, unos 22 ms con 10.000 y 40–70 ms con 20.000. Sigue lejos de la meta.
- **Plan de ejecución:** con estos volúmenes, PostgreSQL elige un _Seq Scan_ para `search_text LIKE '%losartan%'` (0,4 ms con 2.000 filas; 4 ms con 20.000) porque la tabla completa cabe en pocas páginas en memoria (≈ 60 y ≈ 630 páginas). El índice GIN `pg_trgm` (`products_search_text_trgm_idx`) queda disponible para cuando el catálogo crezca y el planificador lo considere más barato. No se forzó su uso.
- **Un valor aislado** de 122 ms (máximo de `pregabalina` con 20.000 productos) no se repite en otras rondas (su p95 es 7,3 ms). Lo más probable es una pausa puntual del proceso (recolector de basura de Node o del sistema operativo). No afecta el p95.

## Riesgos y límites de la medición

- Medición en local, con un solo cliente secuencial: no es una prueba de carga concurrente. Para el MVP (operación de una farmacia comunitaria) el volumen de búsquedas simultáneas esperado es bajo. Si se necesita, el siguiente paso es una prueba con concurrencia contra el endpoint HTTP desplegado (por ejemplo con k6) en el entorno de demostración.
- No incluye red ni Fastify (ver Método). En el entorno de demostración conviene repetir una muestra contra `GET /trpc/catalog.search` para confirmar.
- La latencia de los términos amplios crece con el catálogo. Si algún día supera los ~100.000 productos, las opciones son exigir al menos 2 caracteres por término o limitar la cantidad de coincidencias que se ordenan por relevancia.
