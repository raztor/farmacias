import { noopLogger, type AppLogger } from "@repo/shared";
import { UnrecoverableError } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createWorker } from "./create-worker";
import type { QueueJob } from "./job-processor";
import { isFinalFailure } from "./worker-logging";

type Listener = (...args: unknown[]) => void;

const mocks = vi.hoisted(() => {
  class FakeWorker {
    static instances: FakeWorker[] = [];
    readonly listeners = new Map<string, Listener>();
    readonly on = vi.fn((event: string, listener: Listener) => {
      this.listeners.set(event, listener);
      return this;
    });

    constructor(
      readonly name: string,
      readonly processor: unknown,
      readonly opts: Record<string, unknown>,
    ) {
      FakeWorker.instances.push(this);
    }

    emit(event: string, ...args: unknown[]): void {
      this.listeners.get(event)?.(...args);
    }
  }
  return { FakeWorker };
});

vi.mock(import("bullmq"), async (importOriginal) => ({
  ...(await importOriginal()),
  Worker: mocks.FakeWorker as never,
}));

const REDIS_URL = "rediss://default:secret@redis.example.com:6380/2";
const handler = () => Promise.resolve();

const job = (attemptsMade: number, attempts = 5): QueueJob =>
  ({ id: "7", name: "welcome", attemptsMade, opts: { attempts } }) as unknown as QueueJob;

const spyLogger = () => {
  const logger = {
    ...noopLogger,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: (): AppLogger => logger,
  };
  return logger;
};

describe("createWorker", () => {
  beforeEach(() => {
    mocks.FakeWorker.instances = [];
  });

  it("creates a BullMQ worker with blocking-safe connection options", () => {
    createWorker({ queue: "email", redisUrl: REDIS_URL, concurrency: 3, process: handler });

    const [worker] = mocks.FakeWorker.instances;
    expect(worker?.name).toBe("email");
    expect(worker?.processor).toEqual(expect.any(Function));
    expect(worker?.opts).toEqual({
      concurrency: 3,
      connection: expect.objectContaining({
        host: "redis.example.com",
        port: 6380,
        db: 2,
        password: "secret",
        tls: {},
        maxRetriesPerRequest: null,
      }) as unknown,
    });
  });

  it("defaults the concurrency to 5", () => {
    createWorker({ queue: "email", redisUrl: REDIS_URL, process: handler });
    expect(mocks.FakeWorker.instances[0]?.opts).toMatchObject({ concurrency: 5 });
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects concurrency %s", (concurrency) => {
    expect(() =>
      createWorker({ queue: "email", redisUrl: REDIS_URL, concurrency, process: handler }),
    ).toThrow(RangeError);
  });

  it("rejects unknown queues", () => {
    // @ts-expect-error -- "sms" is not a registered queue
    expect(() => createWorker({ queue: "sms", redisUrl: REDIS_URL, process: handler })).toThrow(
      'Unknown queue "sms"',
    );
  });

  it("logs retries, permanent failures and worker errors", () => {
    const logger = spyLogger();
    createWorker({ queue: "email", redisUrl: REDIS_URL, logger, process: handler });
    const worker = mocks.FakeWorker.instances[0]!;
    const smtpError = new Error("SMTP down");

    worker.emit("failed", job(1), smtpError);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: smtpError, jobId: "7", attemptsMade: 1, maxAttempts: 5 }),
      "Job failed; it will be retried",
    );

    worker.emit("failed", job(5), smtpError);
    worker.emit("failed", undefined, smtpError);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "7", attemptsMade: 5 }),
      "Job failed permanently",
    );

    worker.emit("error", new Error("READONLY"));
    expect(logger.error).toHaveBeenCalledTimes(3);
  });
});

describe("isFinalFailure", () => {
  it("is final once attempts are exhausted", () => {
    expect(isFinalFailure(job(4), new Error("x"))).toBe(false);
    expect(isFinalFailure(job(5), new Error("x"))).toBe(true);
  });

  it("is final for unrecoverable errors regardless of attempts", () => {
    expect(isFinalFailure(job(1), new UnrecoverableError("bad payload"))).toBe(true);
  });

  it("treats a missing attempts option as a single attempt", () => {
    const single = { attemptsMade: 1, opts: {} } as unknown as QueueJob;
    expect(isFinalFailure(single, new Error("x"))).toBe(true);
  });
});
