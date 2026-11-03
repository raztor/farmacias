import "../global.css";

import { ErrorBoundary as ExpoErrorBoundary, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { useAuthState } from "../features/auth";
import { Sentry, initSentry } from "../lib/sentry";
import { keepSplashVisible, useHideSplashWhenReady } from "../lib/splash";
import { AppProviders } from "../providers/app-providers";

initSentry();
keepSplashVisible();

/** Render errors in any route are reported to Sentry with the current route attached. */
export const ErrorBoundary = Sentry.wrapExpoRouterErrorBoundary(ExpoErrorBoundary);

function RootNavigator() {
  const { isPending, isSignedIn } = useAuthState();
  useHideSplashWhenReady(!isPending);

  // The splash screen stays visible while the stored session is restored.
  if (isPending) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
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
