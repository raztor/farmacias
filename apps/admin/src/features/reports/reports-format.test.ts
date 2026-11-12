import { describe, expect, it } from "vitest";

import {
  formatCount,
  formatReportDay,
  lowStockCaption,
  rangeLabel,
  shareText,
} from "./reports-format";

describe("reports format (es-CL)", () => {
  it("formats counts with Chilean thousands separators", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(1234)).toBe("1.234");
    expect(formatCount(1_234_567)).toBe("1.234.567");
  });

  it("shows days in Chilean order", () => {
    expect(formatReportDay("2026-11-11")).toBe("11-11-2026");
    expect(formatReportDay("hoy")).toBe("hoy");
  });

  it("describes the range used, both ends included", () => {
    expect(rangeLabel({ from: "2026-10-13", to: "2026-11-11" })).toBe(
      "Datos del 13-10-2026 al 11-11-2026, ambos incluidos (hora de Chile).",
    );
    expect(rangeLabel({ from: "2026-11-11", to: "2026-11-11" })).toBe(
      "Datos del 11-11-2026 (hora de Chile).",
    );
  });

  it("computes whole percentages, 0 % when there is nothing", () => {
    expect(shareText(1, 3)).toBe("33 %");
    expect(shareText(2, 3)).toBe("67 %");
    expect(shareText(0, 0)).toBe("0 %");
    expect(shareText(5, 5)).toBe("100 %");
  });

  it("says when the low-stock table shows only part of the list", () => {
    expect(lowStockCaption(3, 3)).not.toContain("se muestran");
    expect(lowStockCaption(200, 1500)).toContain("(se muestran 200 de 1.500)");
  });
});
