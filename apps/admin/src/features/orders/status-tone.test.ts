import { ORDER_STATUSES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { TONE_CLASSES, TONE_SYMBOLS, statusTone } from "./status-tone";

describe("statusTone", () => {
  it("gives every status a tone with a symbol and classes (never color only)", () => {
    for (const status of ORDER_STATUSES) {
      const tone = statusTone(status);
      expect(TONE_SYMBOLS[tone]).not.toBe("");
      expect(TONE_CLASSES[tone]).not.toBe("");
    }
  });

  it("flags failures and completions distinctly", () => {
    expect(statusTone("payment_rejected")).toBe("danger");
    expect(statusTone("not_delivered")).toBe("danger");
    expect(statusTone("delivered")).toBe("success");
    expect(statusTone("ready_for_pickup")).toBe("success");
    expect(statusTone("in_preparation")).toBe("progress");
  });
});
