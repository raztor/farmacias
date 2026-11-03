import { appRouter, createTRPCContext, type ApiDependencies, type AppRouter } from "@repo/api";
import {
  fastifyTRPCPlugin,
  type CreateFastifyContextOptions,
  type FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync } from "fastify";

import type { ErrorReporter } from "../app.types";

export const TRPC_PREFIX = "/trpc";

export type TrpcPluginOptions = {
  deps: ApiDependencies;
  reportError: ErrorReporter;
};

type TrpcOptions = FastifyTRPCPluginOptions<AppRouter>["trpcOptions"];

const createTrpcOptions = ({ deps, reportError }: TrpcPluginOptions): TrpcOptions => ({
  router: appRouter,
  createContext: ({ req }: CreateFastifyContextOptions) =>
    createTRPCContext({ deps, headers: fromNodeHeaders(req.headers), requestId: req.id }),
  onError: ({ error, path, type, req }) => {
    // Expected errors (validation, auth, not found...) are part of the API contract.
    if (error.code !== "INTERNAL_SERVER_ERROR") return;
    const procedure = path ?? "unknown";
    req.log.error({ err: error.cause ?? error, procedure, type }, "tRPC procedure failed");
    reportError(error.cause ?? error, { tags: { procedure, type, requestId: req.id } });
  },
});

/** Mounts `appRouter` at `/trpc` (encapsulated: the adapter replaces the JSON body parser). */
export const trpcPlugin: FastifyPluginAsync<TrpcPluginOptions> = async (app, options) => {
  await app.register(fastifyTRPCPlugin, {
    prefix: TRPC_PREFIX,
    trpcOptions: createTrpcOptions(options),
  });
};
