import { type ComponentProps, useId } from "react";
import { TextInput, View } from "react-native";

import { useThemeColor } from "../../hooks/use-theme-color";
import { cn } from "../../lib/cn";
import { webAria } from "../../lib/web-aria";
import { Text } from "../text/text";
import { InputMessage } from "./input-message";
import { INPUT_BASE_CLASSES, INPUT_STATE_CLASSES } from "./input.variants";

export type InputProps = ComponentProps<typeof TextInput> & {
  /** Visible label, associated with the field for screen readers. */
  label?: string;
  /** Error message. Marks the field as invalid and replaces `hint`. */
  error?: string;
  /** Helper text shown under the field when there is no error. */
  hint?: string;
  className?: string;
  /** Classes for the wrapper that holds the label, field and message. */
  containerClassName?: string;
};

/** Text field with label, hint and error message. Forwards every `TextInput` prop. */
export function Input({
  label,
  error,
  hint,
  className,
  containerClassName,
  editable = true,
  ...props
}: InputProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const messageId = `${id}-message`;
  const message = error ?? hint;
  const placeholderTextColor = useThemeColor("muted-foreground");

  return (
    <View className={cn("gap-1.5", containerClassName)}>
      {label === undefined ? null : (
        <Text variant="label" nativeID={labelId}>
          {label}
        </Text>
      )}
      <TextInput
        placeholderTextColor={placeholderTextColor}
        accessibilityLabel={label}
        accessibilityHint={message}
        aria-labelledby={label === undefined ? undefined : labelId}
        {...webAria({
          "aria-describedby": message === undefined ? undefined : messageId,
          "aria-invalid": error !== undefined,
        })}
        {...props}
        editable={editable}
        accessibilityState={{ ...props.accessibilityState, disabled: !editable }}
        className={cn(
          INPUT_BASE_CLASSES,
          error === undefined ? INPUT_STATE_CLASSES.default : INPUT_STATE_CLASSES.error,
          !editable && "opacity-50",
          className,
        )}
      />
      {message === undefined ? null : (
        <InputMessage nativeID={messageId} isError={error !== undefined}>
          {message}
        </InputMessage>
      )}
    </View>
  );
}
