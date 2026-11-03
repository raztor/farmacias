import { useEffect, useState } from "react";

/** Search-as-you-type delay: one request per pause instead of one per keystroke. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Returns `value` once it has not changed for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs: number = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debounced;
}
