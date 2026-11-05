import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable } from "react-native";

import { useThemeColor } from "../../hooks/use-theme-color";
import { cn } from "../../lib/cn";
import { ButtonLabel } from "./button-label";
import {
  BUTTON_BASE_CLASSES,
  BUTTON_LABEL_BASE_CLASSES,
  BUTTON_SIZE_STYLES,
  BUTTON_VARIANT_STYLES,
  type ButtonSize,
  type ButtonVariant,
} from "./button.variants";

export type ButtonProps = Omit<ComponentProps<typeof Pressable>, "children"> & {
  /** Visual style. Defaults to `primary`. */
  variant?: ButtonVariant;
  /** Height, padding and font size. Defaults to `md` (44 px, the minimum touch target). */
  size?: ButtonSize;
  /** Shows a spinner, disables presses and announces the button as busy. */
  loading?: boolean;
  className?: string;
  /** Extra classes for the text label (only applied when `children` is text). */
  labelClassName?: string;
  children: ReactNode;
};

/** Accessible pressable button with variants, sizes and a loading state. */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  labelClassName,
  accessibilityState,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled === true || loading;
  const variantStyle = BUTTON_VARIANT_STYLES[variant];
  const sizeStyle = BUTTON_SIZE_STYLES[size];
  const spinnerColor = useThemeColor(variantStyle.spinner);

  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: isDisabled, busy: loading }}
      aria-disabled={isDisabled}
      aria-busy={loading}
      disabled={isDisabled}
      className={cn(
        BUTTON_BASE_CLASSES,
        variantStyle.container,
        sizeStyle.container,
        isDisabled && "opacity-50",
        className,
      )}
    >
      {loading ? <ActivityIndicator size="small" color={spinnerColor} /> : null}
      <ButtonLabel
        className={cn(
          BUTTON_LABEL_BASE_CLASSES,
          variantStyle.label,
          sizeStyle.label,
          labelClassName,
        )}
      >
        {children}
      </ButtonLabel>
    </Pressable>
  );
}
