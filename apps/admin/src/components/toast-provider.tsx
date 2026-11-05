"use client";

import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { ToastViewport, type Toast, type ToastTone } from "./toast-viewport";

const TOAST_DURATION_MS = 5_000;
const MAX_VISIBLE_TOASTS = 3;

export type ShowToast = (toast: Readonly<{ tone: ToastTone; message: string }>) => void;

type ToastContextValue = Readonly<{ showToast: ShowToast }>;

const ToastContext = createContext<ToastContextValue | null>(null);

/** Transient notifications (success / error) rendered in a live region. */
export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const nextIdRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback<ShowToast>(
    ({ tone, message }) => {
      nextIdRef.current += 1;
      const id = nextIdRef.current;
      setToasts((current) => [...current, { id, tone, message }].slice(-MAX_VISIBLE_TOASTS));
      setTimeout(() => {
        dismiss(id);
      }, TOAST_DURATION_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext>
  );
}

/** `showToast` of the nearest `ToastProvider`. */
export function useToast(): ShowToast {
  const context = use(ToastContext);
  if (context === null) throw new Error("useToast() must be used inside <ToastProvider>");
  return context.showToast;
}
