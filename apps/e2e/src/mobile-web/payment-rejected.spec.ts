import type { Page } from "@playwright/test";

import { expect, openSignedIn, projectSlot, test } from "../support/fixtures.ts";
import {
  PRODUCT_LANES,
  pickProduct,
  placePickupOrder,
  residentOrder,
  stockOf,
} from "../support/orders-api.ts";

type PayAttempt = Readonly<{ scenario: string; idempotencyKey: string }>;

const KEY = /"idempotencyKey":"([^"]+)"/;
const SCENARIO = /"scenario":"([^"]+)"/;

/**
 * Records every `payments.pay` request the app sends (httpBatchLink body). When `loseNextApprove`
 * is called, the next approved attempt still reaches the API, but the app gets a 503 instead of
 * the answer: a lost response, so the app cannot know whether the payment went through.
 */
async function watchPayments(page: Page) {
  const attempts: PayAttempt[] = [];
  let loseApprove = false;
  await page.route(
    (url) => url.pathname.includes("payments.pay"),
    async (route) => {
      const body = route.request().postData() ?? "";
      const attempt = {
        scenario: SCENARIO.exec(body)?.[1] ?? "?",
        idempotencyKey: KEY.exec(body)?.[1] ?? "?",
      };
      attempts.push(attempt);
      if (!loseApprove || attempt.scenario !== "approve") return route.continue();
      loseApprove = false;
      await route.fetch();
      return route.fulfill({ status: 503, contentType: "text/plain", body: "Service Unavailable" });
    },
  );
  return {
    attempts,
    loseNextApprove: () => {
      loseApprove = true;
    },
  };
}

/**
 * HU-05 #2 and #3 / RF-08, D-11, D-12: a rejected simulated payment says so and never touches the
 * inventory; every new attempt after a rejection sends a new idempotency key; when the answer of
 * an approved attempt is lost, «Reintentar» sends the same key and the API replays the result
 * without discounting twice. Stock and status are verified through the API, not the UI.
 */
test.describe("mobile-web: pago rechazado y reintentos (HU-05 #2 #3, RF-08)", () => {
  test("informa el rechazo sin tocar el stock; reintenta con clave nueva y, si se pierde la respuesta, «Reintentar» reusa la clave sin descontar dos veces", async ({
    page,
    publicApi,
    newResident,
  }, testInfo) => {
    const resident = await newResident("pago rechazado");
    const product = await pickProduct(publicApi, {
      index: PRODUCT_LANES.rejectedPayment + projectSlot(testInfo),
    });
    const stockBefore = await stockOf(publicApi, product.id);
    const order = await placePickupOrder(resident.api, product.id, 2);
    expect(order.status).toBe("pending_payment");
    const payments = await watchPayments(page);

    await test.step("rechazo: mensaje, stock sin cambios y opción de pagar de nuevo", async () => {
      await openSignedIn(page, `/pay/${order.id}`, resident);
      await page.getByTestId("pay-reject").click();
      await expect(page.getByTestId("payment-result-rejected")).toContainText("Pago rechazado");
      expect(await stockOf(publicApi, product.id)).toBe(stockBefore);
      expect((await residentOrder(resident.api, order.id)).status).toBe("payment_rejected");

      await page.getByTestId("payment-view-order").click();
      await expect(page.getByTestId("order-status")).toContainText("Pago rechazado");
      await expect(page.getByTestId("order-go-to-pay")).toContainText("Intentar el pago de nuevo");
    });

    await test.step("segundo rechazo desde el pedido e «Intentar de nuevo»", async () => {
      await page.getByTestId("order-go-to-pay").click();
      await page.getByTestId("pay-reject").click();
      await expect(page.getByTestId("payment-result-rejected")).toBeVisible();
      await page.getByTestId("payment-try-again").click();
      await expect(page.getByTestId("pay-approve")).toBeVisible();
    });

    await test.step("pago aprobado con la respuesta perdida y «Reintentar»", async () => {
      payments.loseNextApprove();
      await page.getByTestId("pay-approve").click();
      await expect(page.getByTestId("payment-result-unknown")).toBeVisible();
      await page.getByTestId("payment-retry").click();
      await expect(page.getByTestId("payment-result-approved")).toContainText("Pago aprobado");
    });

    // Rejections: a new key each; approved attempt and its retry: one key, sent twice.
    const [firstReject, secondReject, approve, retry] = payments.attempts;
    expect(payments.attempts.map((attempt) => attempt.scenario)).toEqual([
      "reject",
      "reject",
      "approve",
      "approve",
    ]);
    expect(new Set([firstReject, secondReject, approve].map((a) => a?.idempotencyKey)).size).toBe(
      3,
    );
    expect(retry?.idempotencyKey).toBe(approve?.idempotencyKey);
    // Discounted once (2 units), validated once.
    expect(await stockOf(publicApi, product.id)).toBe(stockBefore - 2);
    const after = await residentOrder(resident.api, order.id);
    expect(after.status).toBe("payment_validated");
    expect(after.timeline.filter((status) => status === "payment_validated")).toHaveLength(1);
  });
});
