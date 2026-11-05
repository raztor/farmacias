import { Prisma, type PrismaClient } from "@repo/db";
import { DEFAULT_LOW_STOCK_THRESHOLD, isProductCategory, type ProductCategory } from "@repo/shared";

/** Catalog row with the stock data needed to compute the public availability. */
export type CatalogProductRow = {
  id: string;
  commercialName: string;
  activeIngredient: string;
  presentation: string;
  category: ProductCategory;
  priceClp: number;
  /** `inventory_items.on_hand` (0 when the product has no inventory row). */
  onHand: number;
  lowStockThreshold: number;
};

export type CatalogSearchRepoQuery = {
  /** Term already normalized with `normalizeSearchText`; `undefined` lists everything. */
  term?: string | undefined;
  category?: ProductCategory | undefined;
  /** Id of the last row of the previous page. */
  cursor?: string | undefined;
  /** Rows to fetch (callers ask for one extra row to detect the next page). */
  take: number;
};

export type CatalogRepository = {
  /**
   * Active products whose `search_text` contains every word of `term`, ordered by relevance
   * (commercial name or active ingredient starting with the term first), then commercial
   * name, then id.
   */
  search: (query: CatalogSearchRepoQuery) => Promise<CatalogProductRow[]>;
  /** The active product with that id, or `null` (missing or inactive). */
  findActiveById: (id: string) => Promise<CatalogProductRow | null>;
};

/** Unicode combining diacritical marks, stripped after NFD like `normalizeSearchText`. */
const COMBINING_MARKS_PATTERN = "[̀-ͯ]";
const NON_ALPHANUMERIC_PATTERN = "[^a-z0-9]+";

/** Escapes LIKE wildcards. Normalized terms only hold `[a-z0-9 ]`; this is defense in depth. */
export const escapeLikePattern = (text: string): string => text.replace(/[\\%_]/g, "\\$&");

/** SQL mirror of `normalizeSearchText` for a column (used only to rank, never to filter). */
const normalizedColumnSql = (column: Prisma.Sql): Prisma.Sql => Prisma.sql`btrim(regexp_replace(
  lower(regexp_replace(normalize(${column}, NFD), ${COMBINING_MARKS_PATTERN}, '', 'g')),
  ${NON_ALPHANUMERIC_PATTERN}, ' ', 'g'))`;

/**
 * Relevance rank of a product row (R-CAT-04): 0 when the commercial name or the active
 * ingredient starts with the term, 1 otherwise. `search_text` starts with the normalized
 * commercial name, so its prefix is the commercial-name prefix.
 */
const rankSql = (alias: "p" | "c", term: string | undefined): Prisma.Sql => {
  if (!term) return Prisma.sql`0`;
  const table = Prisma.raw(alias);
  const prefix = `${escapeLikePattern(term)}%`;
  const ingredient = normalizedColumnSql(Prisma.sql`${table}.active_ingredient`);
  return Prisma.sql`(CASE WHEN ${table}.search_text LIKE ${prefix} OR ${ingredient} LIKE ${prefix}
    THEN 0 ELSE 1 END)`;
};

/** Between a digit and a letter, in either order ("50mg", "losartan50"). */
const DIGIT_LETTER_BOUNDARY = /(?<=\d)(?=[a-z])|(?<=[a-z])(?=\d)/g;
const LETTERS = /^[a-z]+$/;
/** Dose units typed glued to the number ("5mg", "100mcg"): never a word of their own. */
const DOSE_UNITS: ReadonlySet<string> = new Set([
  "mg",
  "mcg",
  "ug",
  "g",
  "kg",
  "ml",
  "l",
  "ui",
  "cc",
]);
/** Shortest letter run treated as a word of its own when glued to digits ("losartan50"). */
const MIN_WORD_LETTERS = 3;

/**
 * How one word of the term matches `search_text`: any alternative, each a list of substrings
 * that must all appear. A plain word is `[["losartan"]]`.
 */
export type WordMatcher = readonly (readonly string[])[];

/** True when a segment is a word of its own ("losartan"), not a unit ("mg") nor a code ("d"). */
const isWordSegment = (segment: string): boolean =>
  LETTERS.test(segment) && !DOSE_UNITS.has(segment) && segment.length >= MIN_WORD_LETTERS;

/**
 * Matcher of one word (R-CAT-03). A word glued to a number ("losartan50") is split into
 * independent words, like typing it spaced: the name and the dose are not contiguous in
 * `search_text`. Any other digit/letter mix, a dose ("50mg", "5mg") or a code ("d3", "b12", "om3",
 * "x10"), stays one token, matched as typed or with a space at the boundary ("50 mg", "d 3"):
 * splitting it into single letters and digits would match almost the whole catalog.
 */
const wordMatcher = (word: string): WordMatcher => {
  const segments = word.replace(DIGIT_LETTER_BOUNDARY, " ").split(" ");
  if (segments.length === 1) return [[word]];
  if (segments.some(isWordSegment)) return [segments];
  return [[word], [segments.join(" ")]];
};

/** Matchers of the distinct words of a normalized term ("celecoxib 200" → two words). */
export const termMatchers = (term: string): WordMatcher[] =>
  [...new Set(term.split(" ").filter((word) => word.length > 0))].map(wordMatcher);

const containsSql = (text: string): Prisma.Sql =>
  Prisma.sql`p.search_text LIKE ${`%${escapeLikePattern(text)}%`}`;

const wordMatcherSql = (matcher: WordMatcher): Prisma.Sql =>
  Prisma.sql`AND (${Prisma.join(
    matcher.map((all) => Prisma.sql`(${Prisma.join(all.map(containsSql), " AND ")})`),
    " OR ",
  )})`;

/**
 * Every word of the term must be a substring of `search_text` (R-CAT-03). For a single word
 * this is `search_text LIKE '%term%'`; for several words it also finds "celecoxib 200" in
 * "celebrin sur celecoxib capsulas 200 mg x 10". Each LIKE can use the trigram index.
 */
const filtersSql = ({ term, category }: CatalogSearchRepoQuery): Prisma.Sql => {
  const matchers = term ? termMatchers(term) : [];
  const termFilter =
    matchers.length > 0 ? Prisma.join(matchers.map(wordMatcherSql), " ") : Prisma.empty;
  const categoryFilter = category ? Prisma.sql`AND p.category = ${category}` : Prisma.empty;
  return Prisma.sql`p.active ${termFilter} ${categoryFilter}`;
};

/** Keyset condition: rows strictly after the cursor product in (rank, name, id) order. */
const afterCursorSql = ({ term, cursor }: CatalogSearchRepoQuery): Prisma.Sql =>
  cursor
    ? Prisma.sql`WHERE (m.rank, m."commercialName", m.id) > (
        SELECT ${rankSql("c", term)}, c.commercial_name, c.id FROM products c WHERE c.id = ${cursor})`
    : Prisma.empty;

type RawCatalogRow = Omit<CatalogProductRow, "category"> & { category: string };

const toCatalogRow = ({ category, ...row }: RawCatalogRow): CatalogProductRow => {
  // products.category has a CHECK with the same closed list; anything else is corrupt data.
  if (!isProductCategory(category)) throw new Error(`Unknown product category: ${category}`);
  return { ...row, category };
};

const PRODUCT_SELECT = {
  id: true,
  commercialName: true,
  activeIngredient: true,
  presentation: true,
  category: true,
  priceClp: true,
  inventory: { select: { onHand: true, lowStockThreshold: true } },
} as const;

export const createCatalogRepository = (db: PrismaClient): CatalogRepository => ({
  search: async (query) => {
    const rows = await db.$queryRaw<RawCatalogRow[]>`
      SELECT m.id, m."commercialName", m."activeIngredient", m.presentation, m.category,
             m."priceClp", m."onHand", m."lowStockThreshold"
      FROM (
        SELECT p.id, p.commercial_name AS "commercialName",
               p.active_ingredient AS "activeIngredient", p.presentation, p.category,
               p.price_clp AS "priceClp",
               COALESCE(i.on_hand, 0) AS "onHand",
               COALESCE(i.low_stock_threshold, ${DEFAULT_LOW_STOCK_THRESHOLD}::int)
                 AS "lowStockThreshold",
               ${rankSql("p", query.term)} AS rank
        FROM products p
        LEFT JOIN inventory_items i ON i.product_id = p.id
        WHERE ${filtersSql(query)}
      ) m
      ${afterCursorSql(query)}
      ORDER BY m.rank, m."commercialName", m.id
      LIMIT ${query.take}`;
    return rows.map(toCatalogRow);
  },

  findActiveById: async (id) => {
    const row = await db.product.findFirst({ where: { id, active: true }, select: PRODUCT_SELECT });
    if (!row) return null;
    const { inventory, ...product } = row;
    return toCatalogRow({
      ...product,
      onHand: inventory?.onHand ?? 0,
      lowStockThreshold: inventory?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD,
    });
  },
});
