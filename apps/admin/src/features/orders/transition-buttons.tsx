"use client";

import type { OperatorTarget } from "@repo/api";
import type { OrderStatus } from "@repo/shared";
import { Button } from "@repo/ui";

import { statusLabel } from "./orders-format";
import type { TransitionAction } from "./transition-actions";

type TransitionButtonsProps = Readonly<{
  status: OrderStatus;
  actions: readonly TransitionAction[];
  onSelect: (to: OperatorTarget) => void;
}>;

/** One button per allowed transition, or why there is none for the current status. */
export function TransitionButtons({ status, actions, onSelect }: TransitionButtonsProps) {
  if (actions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay cambios de estado que puedas registrar para un pedido «{statusLabel(status)}».
      </p>
    );
  }
  return (
    <div className="flex flex-row flex-wrap gap-3">
      {actions.map((action) => (
        <Button
          key={action.to}
          variant={action.destructive ? "destructive" : "primary"}
          onPress={() => {
            onSelect(action.to);
          }}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
