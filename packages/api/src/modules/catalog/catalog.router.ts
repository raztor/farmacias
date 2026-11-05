import { createRouter, publicProcedure } from "../../trpc";
import { productByIdInput, searchCatalogInput } from "./catalog.schema";
import { createCatalogServiceFromDeps } from "./catalog.service";

/** Public on purpose (HU-01 #3): the catalog is browsable without a session. */
const catalogProcedure = publicProcedure.use(({ ctx, next }) =>
  next({ ctx: { catalogService: createCatalogServiceFromDeps(ctx.deps) } }),
);

export const catalogRouter = createRouter({
  search: catalogProcedure
    .input(searchCatalogInput)
    .query(({ ctx, input }) => ctx.catalogService.search(input)),

  byId: catalogProcedure
    .input(productByIdInput)
    .query(({ ctx, input }) => ctx.catalogService.byId(input.id)),
});
