"use client";

import { cn } from "@repo/ui";

export type ToastTone = "success" | "error";

export type Toast = Readonly<{ id: number; tone: ToastTone; message: string }>;

const TONE_CLASSES: Readonly<Record<ToastTone, string>> = {
  success: "border-success bg-background text-foreground",
  error: "border-destructive bg-background text-destructive",
};

type ToastViewportProps = Readonly<{
  toasts: readonly Toast[];
  onDismiss: (id: number) => void;
}>;

/**
 * Stack of toasts in the bottom-right corner. Errors are announced assertively (`role="alert"`),
 * confirmations politely (`role="status"`).
 */
export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  return (
    <div
      aria-label="Notificaciones"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex items-start justify-between gap-3 rounded-md border-l-4 px-4 py-3 text-sm shadow-lg",
            TONE_CLASSES[toast.tone],
          )}
        >
          <p className="flex-1">{toast.message}</p>
          <button
            type="button"
            aria-label="Cerrar notificación"
            onClick={() => {
              onDismiss(toast.id);
            }}
            className="rounded-sm px-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
