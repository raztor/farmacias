import { describe, expect, it } from "vitest";

import { describeConnection, parseRedisUrl } from "./redis-url";

describe("parseRedisUrl", () => {
  it("parses a local URL with defaults", () => {
    expect(parseRedisUrl("redis://localhost:6379")).toEqual({
      host: "localhost",
      port: 6379,
      db: 0,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
    });
  });

  it("defaults the port to 6379", () => {
    expect(parseRedisUrl("redis://cache.internal").port).toBe(6379);
  });

  it("reads username, password and db index", () => {
    const options = parseRedisUrl("redis://app:s3cret@redis.example.com:6380/4");
    expect(options).toMatchObject({
      host: "redis.example.com",
      port: 6380,
      db: 4,
      username: "app",
      password: "s3cret",
    });
    expect(options.tls).toBeUndefined();
  });

  it("supports a password without username", () => {
    const options = parseRedisUrl("redis://:only-pass@localhost");
    expect(options.password).toBe("only-pass");
    expect(options).not.toHaveProperty("username");
  });

  it("decodes percent-encoded credentials", () => {
    const options = parseRedisUrl("redis://user%40corp:p%40ss%3Aw%2Frd@localhost");
    expect(options.username).toBe("user@corp");
    expect(options.password).toBe("p@ss:w/rd");
  });

  it("enables TLS for rediss://", () => {
    const options = parseRedisUrl("rediss://default:token@eu1-redis.upstash.io:6379");
    expect(options.tls).toEqual({});
    expect(options.host).toBe("eu1-redis.upstash.io");
  });

  it("strips brackets from IPv6 hosts", () => {
    expect(parseRedisUrl("redis://[::1]:6379").host).toBe("::1");
  });

  it("uses BullMQ's required worker settings", () => {
    const options = parseRedisUrl("redis://localhost:6379", "worker");
    expect(options.maxRetriesPerRequest).toBeNull();
    expect(options.enableOfflineQueue).toBe(true);
  });

  it("makes producers fail fast while Redis is unavailable", () => {
    const options = parseRedisUrl("redis://localhost:6379", "producer");
    expect(options.enableOfflineQueue).toBe(false);
    expect(options.maxRetriesPerRequest).toBe(3);
  });

  it.each([
    ["an empty string", ""],
    ["a non-URL", "localhost:6379"],
    ["another protocol", "http://localhost:6379"],
    ["a non-numeric db", "redis://localhost:6379/cache"],
    ["a negative db", "redis://localhost:6379/-1"],
    ["a nested path", "redis://localhost:6379/1/2"],
  ])("rejects %s", (_label, url) => {
    expect(() => parseRedisUrl(url)).toThrow(/^Invalid Redis URL/);
  });

  it("never leaks the password in error messages", () => {
    expect(() => parseRedisUrl("redis://user:hunter2@localhost/abc")).toThrow(
      expect.not.objectContaining({ message: expect.stringContaining("hunter2") as unknown }),
    );
  });
});

describe("describeConnection", () => {
  it("omits credentials", () => {
    const described = describeConnection(parseRedisUrl("rediss://u:p@host:7000/2"));
    expect(described).toEqual({ host: "host", port: 7000, db: 2, tls: true });
  });
});
