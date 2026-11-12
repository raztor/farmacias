import { describe, expect, it } from "vitest";

import { validateForm } from "../../lib/form-errors";
import {
  alertsCountText,
  thresholdFormSchema,
  thresholdSavedMessage,
  thresholdValues,
} from "./threshold-form";

describe("thresholdFormSchema (HU-12, D-26)", () => {
  it.each([
    ["0", 0],
    [" 25 ", 25],
    ["999", 999],
  ])("accepts %j", (text, value) => {
    expect(thresholdFormSchema.parse({ threshold: text })).toEqual({ threshold: value });
  });

  it.each([
    ["", "Ingresa un número entero entre 0 y 999."],
    ["-1", "Ingresa un número entero entre 0 y 999."],
    ["2.5", "Ingresa un número entero entre 0 y 999."],
    ["1000", "El umbral debe ser un número entero entre 0 y 999."],
  ])("rejects %j", (text, message) => {
    const result = validateForm(thresholdFormSchema, { threshold: text });
    expect(result.success ? undefined : result.errors.threshold).toBe(message);
  });
});

describe("threshold texts", () => {
  it("starts from the current threshold and confirms the change", () => {
    expect(thresholdValues(5)).toEqual({ threshold: "5" });
    expect(thresholdSavedMessage("Zinc", 1)).toBe(
      "Umbral de Zinc actualizado: alerta con 1 unidad o menos.",
    );
  });

  it("counts the alerts", () => {
    expect(alertsCountText(0)).toBe("No hay productos con stock bajo.");
    expect(alertsCountText(1)).toBe("1 producto con stock bajo.");
    expect(alertsCountText(12)).toBe("12 productos con stock bajo.");
  });
});
