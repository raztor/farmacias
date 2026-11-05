import type { ApiDependencies } from "../../trpc";
import { createAuditRepository, type AuditRepository } from "./audit.repository";
import type { ListAuditInput, ListAuditResult } from "./audit.schema";

export type AuditService = {
  /** Audit rows filtered by entity/action, newest first (R-AUD-06). Read only (R-AUD-04). */
  list: (input: ListAuditInput) => Promise<ListAuditResult>;
};

export const createAuditService = ({ repo }: { repo: AuditRepository }): AuditService => ({
  list: async ({ limit, ...filters }) => {
    const rows = await repo.list({ ...filters, take: limit + 1 });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  },
});

export const createAuditServiceFromDeps = (deps: Pick<ApiDependencies, "db">): AuditService =>
  createAuditService({ repo: createAuditRepository(deps.db) });
