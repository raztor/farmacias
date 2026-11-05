import { Heading, Screen, Text } from "@repo/ui";
import type { ReactNode } from "react";
import { View } from "react-native";

type AuthScreenProps = Readonly<{
  title: string;
  description: string;
  /** Help text under the form (e.g. how to get an account). */
  footerText: string;
  children: ReactNode;
}>;

/** Layout of the sign-in screen. */
export function AuthScreen(props: AuthScreenProps) {
  return (
    <Screen
      scroll
      bottomInset={false}
      contentClassName="w-full max-w-md self-center justify-center gap-8"
    >
      <View className="gap-2">
        <Heading>{props.title}</Heading>
        <Text variant="muted">{props.description}</Text>
      </View>
      {props.children}
      <Text variant="muted" className="text-center" testID="auth-footer">
        {props.footerText}
      </Text>
    </Screen>
  );
}
