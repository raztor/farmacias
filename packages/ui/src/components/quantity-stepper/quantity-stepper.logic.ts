export type StepperBounds = Readonly<{ min: number; max: number }>;

/**
 * Keeps a quantity inside `[min, max]` as an integer. When `max < min` (nothing available) the
 * result is `min`: the stepper is then disabled by `canDecrease`/`canIncrease`. Pure.
 */
export function clampQuantity(value: number, { min, max }: StepperBounds): number {
  if (!Number.isFinite(value)) return min;
  const whole = Math.trunc(value);
  return Math.max(min, Math.min(whole, Math.max(min, max)));
}

/** Whether «−» is enabled. */
export function canDecrease(value: number, { min }: StepperBounds): boolean {
  return value > min;
}

/** Whether «+» is enabled. */
export function canIncrease(value: number, { max }: StepperBounds): boolean {
  return value < max;
}
