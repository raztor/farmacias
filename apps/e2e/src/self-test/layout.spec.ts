import { expect, test } from "@playwright/test";

import { ZOOM_200_VIEWPORT } from "../support/a11y.ts";
import { clippedBoxes, horizontalOverflow, reflowProblems } from "../support/layout.ts";

/**
 * Self-test of the RNF-02 reflow check on synthetic pages (no stack). The base styles copy what
 * the resident app renders on the web: the Expo template (`html, body, #root` at full height,
 * `body { overflow: hidden }`), react-native-web views (flex column, `min-width: 0`) and a
 * vertical `ScrollView` (`overflow-x: hidden; overflow-y: auto`).
 */
const RN_WEB_BASE = `
  html, body { height: 100%; margin: 0; }
  body { overflow: hidden; }
  #root { display: flex; height: 100%; flex: 1; }
  .view { display: flex; flex-direction: column; flex-shrink: 0; min-width: 0; min-height: 0;
    position: relative; box-sizing: border-box; }
  .scroll { flex: 1 1 0; overflow-x: hidden; overflow-y: auto; }
  .row { flex-direction: row; }
  .wrap { flex-wrap: wrap; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip-path: inset(50%); white-space: nowrap; border-width: 0; }
`;

const screen = (body: string) => `<!doctype html><html><head><style>${RN_WEB_BASE}</style></head>
  <body><div id="root"><div class="view" style="flex: 1">
    <div class="view scroll" data-testid="app-screen"><div class="view">${body}</div></div>
  </div></div></body></html>`;

test.use({ viewport: ZOOM_200_VIEWPORT });

test.describe("reflujo a 200 % (RNF-02): verificación de la propia comprobación", () => {
  test("detecta una fila que el ScrollView de RN-web recorta aunque el documento no crezca", async ({
    page,
  }) => {
    await page.setContent(
      screen(`<div class="view row" data-testid="cart-line">
        <div class="view" style="width: 1200px">Losartán 50 mg · 2 unidades · $5.990</div>
      </div>`),
    );

    // The document never gets wider: this is why the old document-only check could not fail.
    expect(await horizontalOverflow(page)).toBe(0);
    const problems = await reflowProblems(page);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('data-testid="app-screen"');
    expect(problems[0]).toContain("overflow-x: hidden");
    expect(problems[0]).toContain("560 px recortados");
    expect(problems[0]).toContain("sobresale <div> «Losartán 50 mg");
  });

  test("acepta contenido que se reacomoda, campos con texto largo y textos solo para lectores", async ({
    page,
  }) => {
    await page.setContent(
      screen(`<div class="view row wrap">
        ${'<div class="view" style="width: 200px">Tarjeta</div>'.repeat(6)}
      </div>
      <input value="${"una búsqueda muy larga ".repeat(20)}" style="width: 100%; box-sizing: border-box" />
      <h2 class="sr-only">${"Encabezado solo para lectores de pantalla ".repeat(10)}</h2>
      <a href="#main" class="sr-only" style="padding: 8px 16px">Saltar al contenido</a>
      <span class="sr-only" style="clip-path: none; clip: rect(0, 0, 0, 0); padding: 0 24px">
        ${"Estado: Pago validado ".repeat(5)}
      </span>`),
    );

    expect(await reflowProblems(page)).toEqual([]);
  });

  test("permite que una tabla de datos se desplace en su caja, pero no otro contenido", async ({
    page,
  }) => {
    await page.setContent(`<!doctype html><html><body style="margin: 0">
      <div style="overflow-x: auto" data-testid="queue">
        <table style="width: 1000px"><tr><td>Pedido FC-0001</td></tr></table>
      </div>
      <div style="overflow-x: auto" data-testid="filters">
        <div style="width: 1000px">Filtros</div>
      </div>
    </body></html>`);

    const problems = await clippedBoxes(page);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('data-testid="filters"');
    expect(problems[0]).toContain("scroll horizontal");
  });

  test("también informa el scroll horizontal del documento", async ({ page }) => {
    await page.setContent(`<!doctype html><html><body style="margin: 0">
      <div style="width: 900px">Demasiado ancho</div></body></html>`);

    expect(await reflowProblems(page)).toEqual(["documento: 260 px de scroll horizontal"]);
  });
});
