import type { Locator } from "@playwright/test";

import { adminApi } from "../support/api-session.ts";
import { E2E_ACCOUNTS } from "../support/env.ts";
import { expect, signInOnAdmin, test } from "../support/fixtures.ts";
import { isRecord, trpcErrorCode } from "../support/trpc-http.ts";

/** Non-draft order statuses listed by «Pedidos por estado» (R-REP-02). */
const REPORTED_STATUS_COUNT = 9;

/** "YYYY-MM-DD" of today in Chile, the calendar the reports use (D-23). */
const todayInChile = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());

/** "1.234" (es-CL) → 1234; throws on anything that is not a formatted count. */
const parseCount = (text: string): number => {
  const digits = text.trim();
  if (!/^\d{1,3}(\.\d{3})*$/.test(digits)) throw new Error(`Not an es-CL count: "${digits}"`);
  return Number(digits.replaceAll(".", ""));
};

const expectCountCell = async (cell: Locator) => {
  expect(parseCount(await cell.innerText())).toBeGreaterThanOrEqual(0);
};

/**
 * HU-13 (D-29): operational reports for admins only. Other specs create orders at the same time,
 * so the assertions check structure and non-negative numbers, never exact totals.
 */
test.describe("admin: reportes operativos (HU-13)", () => {
  test("el administrador ve unidades dispensadas, pedidos por estado y productos bajo umbral", async ({
    page,
    playwright,
  }) => {
    const admin = await adminApi(playwright.request);
    const summary: unknown = await admin.trpc.query("reports.summary", {});
    await admin.dispose();
    const dispensed = isRecord(summary) ? summary.dispensed : null;
    const ordersByStatus = isRecord(summary) ? summary.ordersByStatus : null;
    expect(isRecord(dispensed) ? dispensed.units : null).toEqual(expect.any(Number));
    expect(isRecord(dispensed) ? Number(dispensed.units) : -1).toBeGreaterThanOrEqual(0);
    const statuses = isRecord(ordersByStatus) ? ordersByStatus.items : null;
    expect(Array.isArray(statuses) ? statuses.length : 0).toBe(REPORTED_STATUS_COUNT);

    await signInOnAdmin(page, E2E_ACCOUNTS.admin);
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await nav.getByRole("link", { name: "Reportes" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Reportes" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: /^Datos del / })).toBeVisible();

    await test.step("unidades dispensadas", async () => {
      const section = page.getByRole("region", { name: "Unidades dispensadas" });
      await expect(section).toBeVisible();
      await expect(section.getByText("Pedidos entregados", { exact: true })).toBeVisible();
      const table = section.getByRole("table");
      if ((await table.count()) > 0) {
        for (const cell of await table.locator("tbody td:last-child").all()) {
          await expectCountCell(cell);
        }
      }
    });

    await test.step("pedidos por estado (sin borradores)", async () => {
      const section = page.getByRole("region", { name: "Pedidos por estado" });
      const table = section.getByRole("table", { name: /pedidos confirmados en el rango/ });
      await expect(table.locator("tbody tr")).toHaveCount(REPORTED_STATUS_COUNT);
      await expect(table.getByRole("rowheader", { name: /Borrador/ })).toHaveCount(0);
      await expect(table.getByRole("rowheader", { name: /Entregado/ })).toBeVisible();
      for (const cell of await table.locator("tbody td:nth-of-type(1)").all()) {
        await expectCountCell(cell);
      }
      await expectCountCell(table.locator("tfoot td").first());
    });

    await test.step("productos bajo umbral", async () => {
      const section = page.getByRole("region", { name: "Productos bajo umbral" });
      await expect(section).toBeVisible();
      await expect(
        section.getByText("Situación actual del inventario", { exact: false }),
      ).toBeVisible();
    });

    await test.step("filtra por un rango de un día", async () => {
      const today = todayInChile();
      const filters = page.getByRole("search", { name: "Rango de los reportes" });
      await filters.getByLabel("Desde").fill(today);
      await filters.getByLabel("Hasta").fill(today);
      await filters.getByRole("button", { name: "Aplicar rango" }).click();
      await expect(page).toHaveURL(new RegExp(`from=${today}&to=${today}`));
      const [year, month, day] = today.split("-");
      await expect(page.getByRole("status").filter({ hasText: /^Datos del / })).toHaveText(
        `Datos del ${day ?? ""}-${month ?? ""}-${year ?? ""} (hora de Chile).`,
      );
    });

    await test.step("un rango invertido se informa y vuelve a los últimos 30 días", async () => {
      await page.goto("/reports?from=2026-11-12&to=2026-11-11");
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "La fecha «Desde» no puede ser posterior a la fecha «Hasta»." }),
      ).toBeVisible();
      await expect(page.getByRole("region", { name: "Pedidos por estado" })).toBeVisible();
      const filters = page.getByRole("search", { name: "Rango de los reportes" });
      await expect(filters.getByLabel("Desde")).toHaveAttribute("aria-invalid", "true");
      await expect(filters.getByLabel("Hasta")).toHaveAttribute("aria-invalid", "true");
    });

    await test.step("una fecha inválida marca solo su campo", async () => {
      await page.goto("/reports?from=2026-02-30");
      const filters = page.getByRole("search", { name: "Rango de los reportes" });
      await expect(filters.getByLabel("Desde")).toHaveAttribute("aria-invalid", "true");
      await expect(filters.getByLabel("Hasta")).toHaveAttribute("aria-invalid", "false");
    });

    await test.step("un error de validación de la API no ofrece «Reintentar»", async () => {
      // More than one year after today: only the API knows "today" and answers BAD_REQUEST.
      const farEnd = `${String(Number(todayInChile().slice(0, 4)) + 2)}-06-15`;
      await page.goto(`/reports?to=${farEnd}`);
      await expect(
        page.getByRole("alert").filter({ hasText: "como máximo un año después de hoy" }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Reintentar" })).toHaveCount(0);
    });
  });

  test("un operador no puede abrir los reportes (R-REP-08)", async ({ page, operator }) => {
    expect(await trpcErrorCode(() => operator.trpc.query("reports.summary", {}))).toBe("FORBIDDEN");

    await signInOnAdmin(page, E2E_ACCOUNTS.operator);
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link", { name: "Bandeja" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Reportes" })).toHaveCount(0);

    await page.goto("/reports");
    await expect(page.getByRole("heading", { level: 1, name: "Reportes" })).toBeVisible();
    await expect(
      page.getByText("Solo los administradores del programa pueden consultar los reportes."),
    ).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Unidades dispensadas" })).toHaveCount(0);
  });
});
