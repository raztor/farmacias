import type { Role } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { createTestContext, createTestSession } from "../testing/fakes";
import { FORBIDDEN_MESSAGE, UNAUTHORIZED_MESSAGE } from "./guards";
import { createCallerFactory, createRouter } from "./init";
import {
  adminProcedure,
  operatorProcedure,
  protectedProcedure,
  publicProcedure,
  residentProcedure,
} from "./procedures";

/** One query per procedure kind, echoing what the guard put in the context. */
const guardsRouter = createRouter({
  public: publicProcedure.query(() => "ok"),
  protected: protectedProcedure.query(({ ctx }) => ctx.role),
  resident: residentProcedure.query(({ ctx }) => ctx.role),
  operator: operatorProcedure.query(({ ctx }) => ctx.role),
  admin: adminProcedure.query(({ ctx }) => ctx.role),
});

const createCaller = createCallerFactory(guardsRouter);

type Caller = "anonymous" | Role;
type Kind = keyof typeof guardsRouter._def.procedures;
type Outcome = "allowed" | "UNAUTHORIZED" | "FORBIDDEN";

const callerFor = async (who: Caller) =>
  createCaller(
    await createTestContext({
      session: who === "anonymous" ? null : createTestSession({ id: `${who}-1`, role: who }),
    }),
  );

const call = async (who: Caller, kind: Kind): Promise<Outcome> => {
  const caller = await callerFor(who);
  try {
    await caller[kind]();
    return "allowed";
  } catch (error) {
    const { code } = error as { code: string };
    if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return code;
    throw error;
  }
};

/** Expected outcome for every (caller, procedure kind) pair — docs/specs/README.md. */
const MATRIX: Record<Caller, Record<Kind, Outcome>> = {
  anonymous: {
    public: "allowed",
    protected: "UNAUTHORIZED",
    resident: "UNAUTHORIZED",
    operator: "UNAUTHORIZED",
    admin: "UNAUTHORIZED",
  },
  resident: {
    public: "allowed",
    protected: "allowed",
    resident: "allowed",
    operator: "FORBIDDEN",
    admin: "FORBIDDEN",
  },
  operator: {
    public: "allowed",
    protected: "allowed",
    resident: "FORBIDDEN",
    operator: "allowed",
    admin: "FORBIDDEN",
  },
  admin: {
    public: "allowed",
    protected: "allowed",
    resident: "FORBIDDEN",
    operator: "allowed",
    admin: "allowed",
  },
};

const CASES = Object.entries(MATRIX).flatMap(([who, outcomes]) =>
  Object.entries(outcomes).map(([kind, outcome]): [Caller, Kind, Outcome] => [
    who as Caller,
    kind as Kind,
    outcome,
  ]),
);

describe("procedure guards", () => {
  it.each(CASES)("%s calling a %s procedure → %s", async (who, kind, expected) => {
    await expect(call(who, kind)).resolves.toBe(expected);
  });

  it("explains in Spanish why the call was rejected", async () => {
    const anonymous = await callerFor("anonymous");
    const resident = await callerFor("resident");

    await expect(anonymous.protected()).rejects.toMatchObject({ message: UNAUTHORIZED_MESSAGE });
    await expect(resident.operator()).rejects.toMatchObject({ message: FORBIDDEN_MESSAGE });
  });

  it("exposes the effective role of the session to the procedure", async () => {
    await expect((await callerFor("operator")).operator()).resolves.toBe("operator");
    await expect((await callerFor("admin")).protected()).resolves.toBe("admin");
  });

  it("resolves Better Auth role lists and unknown roles to the effective role", async () => {
    const legacy = createTestSession({ id: "legacy-1", role: "resident" });
    legacy.user.role = "user";
    const multi = createTestSession({ id: "multi-1", role: "resident" });
    multi.user.role = "resident,operator";

    const legacyCaller = createCaller(await createTestContext({ session: legacy }));
    const multiCaller = createCaller(await createTestContext({ session: multi }));

    await expect(legacyCaller.resident()).resolves.toBe("resident");
    await expect(legacyCaller.operator()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(multiCaller.operator()).resolves.toBe("operator");
    await expect(multiCaller.resident()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses an impersonated session on every protected procedure (R-ACC-12)", async () => {
    const resident = createTestSession({ id: "res-imp-1", role: "resident" });
    resident.session.impersonatedBy = "admin-1";
    const caller = createCaller(await createTestContext({ session: resident }));

    await expect(caller.public()).resolves.toBe("ok");
    await expect(caller.protected()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.resident()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
