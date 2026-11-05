import { initTRPC } from "@trpc/server";
import superjson from "superjson";

import type { TRPCContext } from "./context";
import { formatError } from "./error-formatter";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter: formatError,
});

export const createRouter = t.router;
export const createMiddleware = t.middleware;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;
