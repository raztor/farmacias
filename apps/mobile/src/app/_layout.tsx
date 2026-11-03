import "../global.css";

import { ErrorBoundary as ExpoErrorBoundary, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

import { useAuthState } from "../features/auth";
import { AppNav } from "../features/navigation";
import { Sentry, initSentry } from "../lib/sentry";
import { keepSplashVisible, useHideSplashWhenReady } from "../lib/splash";
import { useSettledOnce } from "../lib/use-settled-once";
import { AppProviders } from "../providers/app-providers";

initSentry();
keepSplashVisible();

/** Render errors in any route are reported to Sentry with the current route attached. */
export const ErrorBoundary = Sentry.wrapExpoRouterErrorBoundary(ExpoErrorBoundary);

/**
 * The catalog is public (HU-01 #3): every route is reachable without a session, and the screens
 * that need one (cart, checkout, payment, orders, account) show a sign-in prompt that comes back
 * to them afterwards (`RequireSignIn`).
 */
function RootNavigator() {
  const { isPending } = useAuthState();
  const ready = useSettledOnce(isPending);
  useHideSplashWhenReady(ready);

  // The splash screen stays visible while the stored session is restored (first load only).
  if (!ready) return null;

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <Stack screenOptions={{ headerShown: false }} />
      <AppNav />
    </View>
  );
}

function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="auto" />
      <RootNavigator />
    </AppProviders>
  );
}

export default Sentry.wrap(RootLayout);
