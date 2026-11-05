import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { reportError } from "./report-error";

/** Keeps the native splash screen visible until `useHideSplashWhenReady(true)` runs. */
export function keepSplashVisible(): void {
  SplashScreen.preventAutoHideAsync().catch((error: unknown) => {
    reportError(error, { scope: "splash.preventAutoHide" });
  });
}

/** Hides the splash screen once the first meaningful screen can render. */
export function useHideSplashWhenReady(ready: boolean): void {
  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);
}
