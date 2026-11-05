import { createRouter, publicProcedure } from "../../trpc";
import { createHealthService } from "./health.service";

const healthService = createHealthService();

export const healthRouter = createRouter({
  ping: publicProcedure.query(() => healthService.ping()),
});
