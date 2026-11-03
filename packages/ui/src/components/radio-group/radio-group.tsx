import type { ComponentProps } from "react";
import { type KeyDownEvent, Pressable, Text as NativeText, View } from "react-native";

import { cn } from "../../lib/cn";
import { FOCUS_RING_CLASSES } from "../../lib/tones";
import { RADIO_OPTION_CLASSES, type RadioOptionVariant } from "./radio-group.variants";

export type RadioGroupProps = ComponentProps<typeof View> & {
  /** Accessible name of the group (e.g. «Modalidad de entrega»). */
  label: string;
  className?: string;
};

/** Groups `RadioOption`s so screen readers announce them as one choice. */
export function RadioGroup({ label, className, ...props }: RadioGroupProps) {
  return (
    <View
      role="radiogroup"
      aria-label={label}
      accessibilityLabel={label}
      {...props}
      className={cn("gap-2", className)}
    />
  );
}

export type RadioOptionProps = Readonly<{
  label: string;
  /** Extra line under the label (card variant only). */
  description?: string;
  selected: boolean;
  onSelect: () => void;
  /** `card`: full-width option with a radio circle; `chip`: compact pill. Defaults to `card`. */
  variant?: RadioOptionVariant;
  disabled?: boolean;
  testID?: string;
}>;

function RadioMark({ selected }: Readonly<{ selected: boolean }>) {
  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      className="mt-0.5 h-5 w-5 items-center justify-center rounded-full border-2 border-primary dark:border-primary-dark"
    >
      {selected ? (
        <View className="h-2.5 w-2.5 rounded-full bg-primary dark:bg-primary-dark" />
      ) : null}
    </View>
  );
}

type RadioOptionTextProps = Readonly<{
  label: string;
  description: string | undefined;
  selected: boolean;
  variant: RadioOptionVariant;
}>;

function RadioOptionText({ label, description, selected, variant }: RadioOptionTextProps) {
  const classes = RADIO_OPTION_CLASSES[variant];
  const isCard = variant === "card";
  return (
    <View className={isCard ? "flex-1 gap-0.5" : undefined}>
      <NativeText className={cn(classes.label, selected && classes.selectedLabel)}>
        {!isCard && selected ? `✓ ${label}` : label}
      </NativeText>
      {isCard && description !== undefined ? (
        <NativeText className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
          {description}
        </NativeText>
      ) : null}
    </View>
  );
}

/**
 * One option of a `RadioGroup`. The selected state is shown by a filled mark (card) or a ✓
 * (chip) besides color, and is exposed as `checked`. Keyboard: Enter or Space selects it.
 */
export function RadioOption({
  label,
  description,
  selected,
  onSelect,
  variant = "card",
  disabled = false,
  testID,
}: RadioOptionProps) {
  const classes = RADIO_OPTION_CLASSES[variant];
  const onKeyDown = (event: KeyDownEvent) => {
    if (event.nativeEvent.key !== " " || disabled) return;
    event.preventDefault();
    onSelect();
  };

  return (
    <Pressable
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={description === undefined ? label : `${label}. ${description}`}
      disabled={disabled}
      onPress={onSelect}
      onKeyDown={onKeyDown}
      testID={testID}
      className={cn(
        classes.container,
        selected ? classes.selected : classes.idle,
        disabled && "opacity-50",
        FOCUS_RING_CLASSES,
      )}
    >
      {variant === "card" ? <RadioMark selected={selected} /> : null}
      <RadioOptionText
        label={label}
        description={description}
        selected={selected}
        variant={variant}
      />
    </Pressable>
  );
}
