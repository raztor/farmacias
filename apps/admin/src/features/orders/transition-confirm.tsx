"use client";

import type { OperationsOrderDetail } from "@repo/api";
import { useEffect, useRef, useState, type KeyboardEvent, type SubmitEvent } from "react";

import { buttonClasses } from "../../components/button-link";
import {
  confirmationMessage,
  transitionNoteSchema,
  type TransitionAction,
} from "./transition-actions";
import { TransitionNoteField } from "./transition-note-field";

type TransitionConfirmProps = Readonly<{
  order: Pick<OperationsOrderDetail, "code" | "status">;
  action: TransitionAction;
  pending: boolean;
  onConfirm: (note: string | undefined) => void;
  onCancel: () => void;
}>;

/**
 * Confirmation step of a transition (R-OPS-10): states the change, accepts an optional note
 * (stored in the history) and only then calls the API. Focus moves to the step's title;
 * Escape or "Volver" cancels without changing anything.
 */
export function TransitionConfirm(props: TransitionConfirmProps) {
  const { order, action, pending, onConfirm, onCancel } = props;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = transitionNoteSchema.safeParse(note);
    setNoteError(parsed.success ? null : (parsed.error.issues[0]?.message ?? "Revisa la nota."));
    if (parsed.success) onConfirm(parsed.data);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape" && !pending) onCancel();
  };

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      aria-labelledby="transition-confirm-title"
      className="flex flex-col gap-4 rounded-lg border-2 border-primary bg-accent p-4"
    >
      <h3
        id="transition-confirm-title"
        ref={titleRef}
        tabIndex={-1}
        className="text-lg font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Confirmar: {action.label}
      </h3>
      <p className="text-base text-foreground">
        {confirmationMessage(order.code, order.status, action.to)}
      </p>
      <TransitionNoteField value={note} error={noteError} onChange={setNote} />
      <div className="flex flex-row flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={buttonClasses(
            "primary",
            action.destructive ? "bg-destructive text-destructive-foreground" : undefined,
          )}
        >
          {pending ? "Registrando…" : `Sí, ${action.label.toLowerCase()}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className={buttonClasses("outline")}
        >
          Volver
        </button>
      </div>
    </form>
  );
}
