import { Button, Notice, Text, type Tone } from "@repo/ui";
import { Link } from "expo-router";

import type { PaymentOutcome } from "./payment-outcome";

type PaymentResultProps = Readonly<{
  outcome: PaymentOutcome;
  orderId: string;
  onRetry: () => void;
  onStartOver: () => void;
}>;

type ResultCopy = Readonly<{ tone: Tone; title: string; announce: "alert" | "status" }>;

const RESULT_COPY: Readonly<Record<PaymentOutcome["kind"], ResultCopy>> = {
  approved: { tone: "success", title: "Pago aprobado", announce: "status" },
  rejected: { tone: "destructive", title: "Pago rechazado", announce: "alert" },
  stock_conflict: { tone: "warning", title: "No hay stock suficiente", announce: "alert" },
  not_payable: { tone: "info", title: "Este pedido ya no admite pagos", announce: "alert" },
  failed: { tone: "destructive", title: "No pudimos procesar el pago", announce: "alert" },
  unknown: { tone: "warning", title: "No sabemos si el pago se procesó", announce: "alert" },
};

function ViewOrderButton({ orderId, primary }: Readonly<{ orderId: string; primary: boolean }>) {
  return (
    <Link href={`/order/${orderId}`} replace asChild>
      <Button variant={primary ? "primary" : "outline"} testID="payment-view-order">
        {primary ? "Ver seguimiento del pedido" : "Ver mi pedido"}
      </Button>
    </Link>
  );
}

function NextSteps({ outcome, orderId, onRetry, onStartOver }: PaymentResultProps) {
  switch (outcome.kind) {
    case "approved": {
      return <ViewOrderButton orderId={orderId} primary />;
    }
    case "rejected":
    case "failed": {
      return (
        <>
          <Button onPress={onStartOver} testID="payment-try-again">
            Intentar de nuevo
          </Button>
          <ViewOrderButton orderId={orderId} primary={false} />
        </>
      );
    }
    case "unknown": {
      return (
        <>
          <Button onPress={onRetry} testID="payment-retry">
            Reintentar
          </Button>
          <ViewOrderButton orderId={orderId} primary={false} />
        </>
      );
    }
    case "stock_conflict":
    case "not_payable": {
      return <ViewOrderButton orderId={orderId} primary />;
    }
  }
}

const STOCK_CONFLICT_HELP =
  "No se descontó nada del inventario. Puedes cancelar el pedido desde su detalle y armar uno nuevo con lo disponible, o intentarlo más tarde.";

/** Result of an attempt with what happened and how to continue (HU-05, HU-06 #2, RNF-09). */
export function PaymentResult(props: PaymentResultProps) {
  const copy = RESULT_COPY[props.outcome.kind];
  return (
    <Notice
      tone={copy.tone}
      title={copy.title}
      announce={copy.announce}
      testID={`payment-result-${props.outcome.kind}`}
    >
      <Text testID="payment-result-message">{props.outcome.message}</Text>
      {props.outcome.kind === "stock_conflict" ? <Text>{STOCK_CONFLICT_HELP}</Text> : null}
      <NextSteps {...props} />
    </Notice>
  );
}
