import type { AppLogger } from "@repo/shared";

import { retryOnUniqueViolation } from "../../lib/transactions";
import { lineTotalClp, orderTotalClp } from "./order-totals";
import { toOrderDraft } from "./order-views";
import { orderNotFoundError, orderNotRepeatableError } from "./orders.errors";
import type { DraftRecord, OrdersRepository, OrdersTx } from "./orders.repository";
import type { RepeatInput, RepeatResult } from "./orders.schema";
import type { RepeatSourceRecord } from "./order-repeat.repository";
import { planRepeat, type RepeatAddition } from "./repeat-plan";

export type RepeatService = {
  /** HU-14: adds a previous order's products to the caller's draft (D-30, R-ORD-16). */
  repeat: (command: RepeatInput & { residentId: string }) => Promise<RepeatResult>;
};

/** Another resident's order answers like a missing one (D-10); a draft is not repeatable. */
const findOwnSource = async (
  tx: OrdersTx,
  orderId: string,
  residentId: string,
): Promise<RepeatSourceRecord> => {
  const source = await tx.findRepeatSource(orderId);
  if (source?.residentId !== residentId) throw orderNotFoundError();
  if (source.status === "draft") throw orderNotRepeatableError();
  return source;
};

/** Writes the planned lines at the current catalog price, then the new total and version. */
const writeAdditions = async (
  tx: OrdersTx,
  draft: DraftRecord,
  source: RepeatSourceRecord,
  additions: readonly RepeatAddition[],
): Promise<void> => {
  const written = additions.map(({ productId, quantity }) => {
    const priceClp = source.lines.find((line) => line.productId === productId)?.priceClp ?? 0;
    return { productId, quantity, unitPriceClp: priceClp };
  });
  for (const line of written) {
    await tx.saveLine({ orderId: draft.id, ...line, lineTotalClp: lineTotalClp(line) });
  }
  const touched = new Set(written.map((line) => line.productId));
  const kept = draft.lines.filter((line) => !touched.has(line.productId));
  await tx.updateDraft(draft.id, { totalClp: orderTotalClp([...kept, ...written]) });
};

export const createRepeatService = ({
  repo,
  logger,
}: {
  repo: OrdersRepository;
  logger: AppLogger;
}): RepeatService => ({
  // The draft may be created here, racing other first additions: retried once (R-ORD-01).
  repeat: async ({ residentId, orderId }) => {
    const result = await retryOnUniqueViolation(() =>
      repo.transaction(async (tx): Promise<RepeatResult> => {
        const source = await findOwnSource(tx, orderId, residentId);
        const existing = await tx.lockDraft(residentId);
        const { additions, changes } = planRepeat(
          source.lines,
          source.lines,
          existing?.lines ?? [],
        );
        // Nothing to add: never create an empty draft just to report the changes.
        if (additions.length === 0) {
          return { draft: existing ? toOrderDraft(existing) : null, changes };
        }
        const draft = existing ?? (await tx.createDraft(residentId));
        await writeAdditions(tx, draft, source, additions);
        return { draft: toOrderDraft(await tx.loadDraft(draft.id)), changes };
      }),
    );
    logger.info(
      { orderId, draftId: result.draft?.id ?? null, changes: result.changes.length },
      "Order repeated into the draft",
    );
    return result;
  },
});
