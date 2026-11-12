import { adminProcedure, createRouter, publicProcedure } from "../../trpc";
import {
  adminListProductsInput,
  createProductInput,
  updateProductInput,
} from "./catalog-admin.schema";
import { createCatalogAdminServiceFromDeps } from "./catalog-admin.service";
import { productByIdInput, searchCatalogInput } from "./catalog.schema";
import { createCatalogServiceFromDeps } from "./catalog.service";

/** Public on purpose (HU-01 #3): the catalog is browsable without a session. */
const catalogProcedure = publicProcedure.use(({ ctx, next }) =>
  next({ ctx: { catalogService: createCatalogServiceFromDeps(ctx.deps) } }),
);

/** Catalog maintenance (HU-11, D-28, D-31 `catalog: write`): admin only. */
const catalogAdminProcedure = adminProcedure.use(({ ctx, next }) =>
  next({ ctx: { catalogAdmin: createCatalogAdminServiceFromDeps(ctx.deps, ctx.logger) } }),
);

export const catalogRouter = createRouter({
  search: catalogProcedure
    .input(searchCatalogInput)
    .query(({ ctx, input }) => ctx.catalogService.search(input)),

  byId: catalogProcedure
    .input(productByIdInput)
    .query(({ ctx, input }) => ctx.catalogService.byId(input.id)),

  adminList: catalogAdminProcedure
    .input(adminListProductsInput)
    .query(({ ctx, input }) => ctx.catalogAdmin.list(input)),

  adminById: catalogAdminProcedure
    .input(productByIdInput)
    .query(({ ctx, input }) => ctx.catalogAdmin.byId(input.id)),

  create: catalogAdminProcedure
    .input(createProductInput)
    .mutation(({ ctx, input }) =>
      ctx.catalogAdmin.create({ ...input, actorId: ctx.user.id, actorRole: ctx.role }),
    ),

  update: catalogAdminProcedure
    .input(updateProductInput)
    .mutation(({ ctx, input }) =>
      ctx.catalogAdmin.update({ ...input, actorId: ctx.user.id, actorRole: ctx.role }),
    ),
});
