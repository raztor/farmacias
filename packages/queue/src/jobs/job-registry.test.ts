import { describe, expect, expectTypeOf, it } from "vitest";

import { QUEUE_NAME_VALUES, isQueueName } from "../queue-names";
import { emailJobSchema, type EmailJob } from "./email.job";
import { JOB_SCHEMAS, parseJobPayload, summarizeIssues, type JobPayload } from "./job-registry";

describe("JOB_SCHEMAS", () => {
  it("registers a schema for every queue", () => {
    expect(Object.keys(JOB_SCHEMAS).sort()).toEqual([...QUEUE_NAME_VALUES].sort());
  });

  it("maps queue names to their payload types", () => {
    expectTypeOf<JobPayload<"email">>().toEqualTypeOf<EmailJob>();
  });
});

describe("emailJobSchema", () => {
  it("normalizes a welcome job", () => {
    expect(
      emailJobSchema.parse({ type: "welcome", to: "  ANA@Example.CL ", name: " Ana " }),
    ).toEqual({ type: "welcome", to: "ana@example.cl", name: "Ana" });
  });

  it("rejects unknown job types", () => {
    const result = emailJobSchema.safeParse({ type: "newsletter", to: "a@b.cl", name: "A" });
    expect(result.success).toBe(false);
  });

  it("strips unknown keys", () => {
    expect(
      emailJobSchema.parse({ type: "welcome", to: "a@b.cl", name: "A", extra: true }),
    ).not.toHaveProperty("extra");
  });
});

describe("parseJobPayload", () => {
  it("returns the validated payload", () => {
    const result = parseJobPayload("email", { type: "welcome", to: "a@b.cl", name: "Ana" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ type: "welcome", to: "a@b.cl", name: "Ana" });
  });

  it("reports invalid fields without their values", () => {
    const result = parseJobPayload("email", { type: "welcome", to: "secret-not-an-email" });
    expect(result.success).toBe(false);
    const issues = summarizeIssues(result.error!);
    expect(issues.map((issue) => issue.path)).toEqual(["to", "name"]);
    expect(JSON.stringify(issues)).not.toContain("secret-not-an-email");
  });
});

describe("isQueueName", () => {
  it("accepts known queue names only", () => {
    expect(isQueueName("email")).toBe(true);
    expect(isQueueName("sms")).toBe(false);
    expect(isQueueName(42)).toBe(false);
  });
});
