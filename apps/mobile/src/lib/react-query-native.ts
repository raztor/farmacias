import { focusManager, onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";
import { AppState } from "react-native";

let configured = false;

/**
 * Connects TanStack Query to React Native (there are no `window` focus/online events on native):
 * queries refetch when the app returns to the foreground and pause while the device is offline.
 * Idempotent; call it once at startup.
 */
export function setupReactQueryNative(): void {
  if (configured) return;
  configured = true;

  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener("change", (status) => {
      setFocused(status === "active");
    });
    return () => {
      subscription.remove();
    };
  });

  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(state.isConnected !== false);
    });
    return () => {
      subscription.remove();
    };
  });
}
