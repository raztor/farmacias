"use client";

import { useServerInsertedHTML } from "next/navigation";
import { useRef } from "react";
import { StyleSheet } from "react-native-web";

/**
 * Server-renders the style sheet that react-native-web builds while rendering (base styles of
 * `View`, `Text`, `TextInput`…), so the first paint matches the hydrated page. Tailwind classes
 * from NativeWind come from `globals.css`; this only covers react-native-web's own styles.
 */
export function ReactNativeWebStyles() {
  const insertedRef = useRef(false);

  useServerInsertedHTML(() => {
    if (insertedRef.current) return null;
    insertedRef.current = true;
    const sheet = StyleSheet.getSheet();
    return <style id={sheet.id}>{sheet.textContent}</style>;
  });

  return null;
}
