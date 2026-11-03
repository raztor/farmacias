import { Platform } from "react-native";

/**
 * ARIA attributes that react-native-web forwards to the DOM but React Native's types do not
 * declare. Native platforms ignore them, so they are only emitted on the web.
 */
export type WebAriaProps = Readonly<{
  "aria-level"?: number;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}>;

export function webAria(props: WebAriaProps): WebAriaProps {
  return Platform.OS === "web" ? props : {};
}
