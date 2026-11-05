"use client";

import { useEffect, useState } from "react";

/** Returns `value` once it has stopped changing for `delayMs` (e.g. search-as-you-type). */
export function useDebouncedValue<TValue>(value: TValue, delayMs: number): TValue {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      clearTimeout(timeout);
    };
  }, [value, delayMs]);

  return debounced;
}
