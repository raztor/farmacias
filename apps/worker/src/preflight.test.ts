import { describe, expect, it } from "vitest";

import { assertRedisDriverAvailable, type ModuleResolver } from "./preflight";

// A real lookup is not hermetic: pnpm's `.bin` shims export NODE_PATH pointing at the hoisted
// store, so `bullmq` resolves from any directory. Inject resolvers to cover both outcomes.
const missing = (missingId: string): ModuleResolver => {
  return (from, id) => {
    if (id === missingId) throw new Error(`Cannot find module '${id}' from '${from}'`);
    return `/fake/node_modules/${id}/index.js`;
  };
};

describe("assertRedisDriverAvailable", () => {
  it("passes with the real resolver when bullmq and ioredis are installed", () => {
    expect(() => {
      assertRedisDriverAvailable();
    }).not.toThrow();
  });

  it("fails with an actionable message when ioredis cannot be resolved", () => {
    expect(() => {
      assertRedisDriverAvailable("/app/dist/index.js", missing("ioredis"));
    }).toThrow(/install `ioredis`/);
  });

  it("fails with an actionable message when bullmq itself cannot be resolved", () => {
    expect(() => {
      assertRedisDriverAvailable("/app/dist/index.js", missing("bullmq"));
    }).toThrow(/install `ioredis`/);
  });
});
