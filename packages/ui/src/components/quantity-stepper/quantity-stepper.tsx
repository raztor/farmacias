import { Text as NativeText, View } from "react-native";

import { cn } from "../../lib/cn";
import { Button } from "../button/button";
import { canDecrease, canIncrease, clampQuantity } from "./quantity-stepper.logic";

export type QuantityStepperProps = Readonly<{
  value: number;
  onChange: (value: number) => void;
  /** Largest allowed value (e.g. units available). */
  max: number;
  /** Smallest allowed value. Defaults to 1. */
  min?: number;
  /** What is being counted, used in the accessible names (e.g. the product name). */
  itemLabel: string;
  disabled?: boolean;
  className?: string;
  testID?: string;
}>;

/**
 * «−  n  +» quantity control bounded by `[min, max]`. Each button has its own accessible name,
 * the value is announced politely when it changes, and the buttons are 44 px touch targets.
 */
export function QuantityStepper({
  value,
  onChange,
  max,
  min = 1,
  itemLabel,
  disabled = false,
  className,
  testID,
}: QuantityStepperProps) {
  const bounds = { min, max };
  const change = (delta: number) => {
    onChange(clampQuantity(value + delta, bounds));
  };

  return (
    <View
      role="group"
      aria-label={`Cantidad de ${itemLabel}`}
      accessibilityLabel={`Cantidad de ${itemLabel}`}
      testID={testID}
      className={cn("flex-row flex-wrap items-center gap-3", className)}
    >
      <Button
        variant="outline"
        className="min-w-11 px-3"
        accessibilityLabel={`Quitar una unidad de ${itemLabel}`}
        disabled={disabled || !canDecrease(value, bounds)}
        onPress={() => {
          change(-1);
        }}
        testID={testID === undefined ? undefined : `${testID}-decrease`}
      >
        −
      </Button>
      <NativeText
        aria-live="polite"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${String(value)} ${value === 1 ? "unidad" : "unidades"}`}
        testID={testID === undefined ? undefined : `${testID}-value`}
        className="min-w-8 text-center text-lg font-semibold text-foreground dark:text-foreground-dark"
      >
        {value}
      </NativeText>
      <Button
        variant="outline"
        className="min-w-11 px-3"
        accessibilityLabel={`Agregar una unidad de ${itemLabel}`}
        disabled={disabled || !canIncrease(value, bounds)}
        onPress={() => {
          change(1);
        }}
        testID={testID === undefined ? undefined : `${testID}-increase`}
      >
        +
      </Button>
    </View>
  );
}
