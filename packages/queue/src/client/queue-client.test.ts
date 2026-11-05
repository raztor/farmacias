import { isAppError, noopLogger, type AppLogger } from "@repo/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_JOB_OPTIONS } from "./job-options";
import { createQueueClient } from "./queue-client";

const mocks = vi.hoisted(() => {
  class FakeQueue {
    static instances: FakeQueue[] = [];
    readonly add = vi.fn((name: string) => Promise.resolve({ id: `job-${name}` }));
    readonly on = vi.fn();
    readonly close = vi.fn(() => Promise.resolve());
    readonly info = vi.fn(() => Promise.resolve("redis_version:8.0.0"));
    readonly getBackend = vi.fn(() => ({ client: Promise.resolve({ info: this.info }) }));

    constructor(
      readonly name: string,
      readonly opts: Record<string, unknown>,
    ) {
      FakeQueue.instances.push(this);
    }
  }
  return { FakeQueue };
});

vi.mock(import("bullmq"), () => ({ Queue: mocks.FakeQueue }) as never);

const REDIS_URL = "redis://user:pass@localhost:6379/1";
const welcome = { type: "welcome", to: "ANA@example.cl", name: "Ana" } as const;

const onlyQueue = () => {
  expect(mocks.FakeQueue.instances).toHaveLength(1);
  return mocks.FakeQueue.instances[0]!;
};

const spyLogger = (): AppLogger & { error: ReturnType<typeof vi.fn> } => {
  const logger = { ...noopLogger, error: vi.fn(), child: () => logger };
  return logger;
};

describe("createQueueClient", () => {
  beforeEach(() => {
    mocks.FakeQueue.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not open any connection until first use", () => {
    createQueueClient({ redisUrl: REDIS_URL });
    expect(mocks.FakeQueue.instances).toHaveLength(0);
  });

  it("rejects an invalid REDIS_URL immediately", () => {
    expect(() => createQueueClient({ redisUrl: "http://localhost" })).toThrow(/Invalid Redis URL/);
  });

  it("enqueues validated payloads with default retry options", async () => {
    const client = createQueueClient({ redisUrl: REDIS_URL, prefix: "bnp" });
    const job = await client.enqueue("email", welcome);

    expect(job).toEqual({ id: "job-welcome", queue: "email", name: "welcome" });
    const queue = onlyQueue();
    expect(queue.name).toBe("email");
    expect(queue.opts).toMatchObject({
      prefix: "bnp",
      connection: { host: "localhost", db: 1, username: "user", password: "pass" },
    });
    expect(queue.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(queue.add).toHaveBeenCalledWith(
      "welcome",
      { type: "welcome", to: "ana@example.cl", name: "Ana" },
      DEFAULT_JOB_OPTIONS,
    );
  });

  it("lets callers override job options", async () => {
    const client = createQueueClient({ redisUrl: REDIS_URL });
    await client.enqueue("email", welcome, { attempts: 1, delay: 1000, jobId: "welcome:u1" });

    expect(onlyQueue().add).toHaveBeenCalledWith("welcome", expect.anything(), {
      ...DEFAULT_JOB_OPTIONS,
      attempts: 1,
      delay: 1000,
      jobId: "welcome:u1",
    });
  });

  it("reuses one queue instance per queue name", async () => {
    const client = createQueueClient({ redisUrl: REDIS_URL });
    await client.enqueue("email", welcome);
    await client.enqueue("email", welcome);
    expect(onlyQueue().add).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid payloads before touching Redis", async () => {
    const logger = spyLogger();
    const client = createQueueClient({ redisUrl: REDIS_URL, logger });

    // @ts-expect-error -- a welcome email requires the recipient's name
    const pending = client.enqueue("email", { type: "welcome", to: "ana@example.cl" });

    await expect(pending).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === "INTERNAL",
    );
    expect(mocks.FakeQueue.instances).toHaveLength(0);
    expect(logger.error).toHaveBeenCalledWith(
      { queue: "email", issues: [expect.objectContaining({ path: "name" })] },
      "Rejected invalid job payload",
    );
  });

  it("rejects payloads of another job type at compile time and runtime", async () => {
    const client = createQueueClient({ redisUrl: REDIS_URL });
    // @ts-expect-error -- "reset-password" is not a registered email job
    const pending = client.enqueue("email", { type: "reset-password", to: "a@b.cl", name: "A" });
    await expect(pending).rejects.toThrow('Invalid job payload for queue "email"');
  });

  it("rejects unknown queue names", async () => {
    const client = createQueueClient({ redisUrl: REDIS_URL });
    // @ts-expect-error -- "sms" is not a registered queue
    await expect(client.enqueue("sms", { type: "welcome" })).rejects.toThrow('Unknown queue "sms"');
  });

  it("wraps Redis failures in an AppError", async () => {
    const logger = spyLogger();
    const client = createQueueClient({ redisUrl: REDIS_URL, logger });
    await client.ping();
    onlyQueue().add.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(client.enqueue("email", welcome)).rejects.toMatchObject({
      name: "AppError",
      code: "INTERNAL",
      cause: new Error("ECONNREFUSED"),
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ queue: "email", jobName: "welcome" }),
      "Failed to enqueue job",
    );
  });

  it("times out when Redis does not answer", async () => {
    vi.useFakeTimers();
    const client = createQueueClient({ redisUrl: REDIS_URL, timeoutMs: 100 });
    await client.ping();
    onlyQueue().add.mockReturnValueOnce(new Promise(() => undefined));

    const pending = client.enqueue("email", welcome);
    const assertion = expect(pending).rejects.toMatchObject({
      cause: { name: "TimeoutError" },
    });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });

  it("pings Redis through the queue connection", async () => {
    const client = createQueueClient({ redisUrl: REDIS_URL });
    await expect(client.ping()).resolves.toBe(true);
    expect(onlyQueue().info).toHaveBeenCalledOnce();
  });

  it("reports an unreachable Redis as unhealthy instead of throwing", async () => {
    const client = createQueueClient({ redisUrl: REDIS_URL });
    await client.ping();
    onlyQueue().info.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(client.ping()).resolves.toBe(false);
  });

  it("closes every queue and refuses new work afterwards", async () => {
    const client = createQueueClient({ redisUrl: REDIS_URL });
    await client.enqueue("email", welcome);
    await client.close();

    expect(onlyQueue().close).toHaveBeenCalledOnce();
    await expect(client.enqueue("email", welcome)).rejects.toThrow("Queue client is closed");
    await expect(client.ping()).resolves.toBe(false);
  });
});
