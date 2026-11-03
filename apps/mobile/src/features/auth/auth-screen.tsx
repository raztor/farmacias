import { Heading, Screen, Text } from "@repo/ui";
import { type Href, Link } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

type AuthScreenProps = Readonly<{
  title: string;
  description: string;
  footerText: string;
  footerLinkLabel: string;
  footerHref: Href;
  children: ReactNode;
}>;

/** Shared layout of the sign-in and sign-up screens. */
export function AuthScreen(props: AuthScreenProps) {
  return (
    <Screen scroll contentClassName="justify-center gap-8">
      <View className="gap-2">
        <Heading>{props.title}</Heading>
        <Text variant="muted">{props.description}</Text>
      </View>
      {props.children}
      <View className="flex-row flex-wrap items-center justify-center gap-1">
        <Text variant="muted">{props.footerText}</Text>
        <Link href={props.footerHref} replace asChild>
          <Pressable accessibilityRole="link" hitSlop={8}>
            <Text className="text-sm font-semibold text-primary dark:text-primary-dark">
              {props.footerLinkLabel}
            </Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}
