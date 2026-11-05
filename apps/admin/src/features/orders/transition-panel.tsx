"use client";

import type { OperationsOrderDetail } from "@repo/api";

import { TransitionButtons } from "./transition-buttons";
import { TransitionConfirm } from "./transition-confirm";
import { useTransitionPanel } from "./use-transition-panel";

type TransitionPanelProps = Readonly<{ order: OperationsOrderDetail }>;

/**
 * "Registrar avance" (HU-08): one button per transition the API allows for this role and
 * modality — never any other — each going through {@link TransitionConfirm}, which states the
 * status and sends the version seen when the transition was picked (see
 * {@link useTransitionPanel}). Errors, including "the order changed meanwhile", stay in the panel.
 */
export function TransitionPanel({ order }: TransitionPanelProps) {
  const { titleRef, actions, view, error, isPending, select, confirm, close } =
    useTransitionPanel(order);

  return (
    <section aria-labelledby="transition-title" className="flex flex-col gap-3">
      <h2
        id="transition-title"
        ref={titleRef}
        tabIndex={-1}
        className="text-xl font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Registrar avance
      </h2>
      {error === null ? null : (
        <p
          role="alert"
          className="rounded-md border border-destructive p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {view.kind === "confirm" ? (
        <TransitionConfirm
          order={{ code: order.code, status: view.selection.status }}
          action={view.action}
          pending={isPending}
          onConfirm={(note) => {
            confirm(view.selection, note);
          }}
          onCancel={close}
        />
      ) : (
        <TransitionButtons status={order.status} actions={actions} onSelect={select} />
      )}
    </section>
  );
}
