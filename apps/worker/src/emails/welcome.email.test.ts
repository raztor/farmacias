import { APP_NAME } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { escapeHtml } from "./escape-html";
import { renderWelcomeEmail } from "./welcome.email";

describe("escapeHtml", () => {
  it("escapes every HTML-significant character", () => {
    expect(escapeHtml(`<a href="x" title='y'>Tom & Jerry</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;Tom &amp; Jerry&lt;/a&gt;",
    );
  });

  it("leaves plain text and accents untouched", () => {
    expect(escapeHtml("José Muñoz")).toBe("José Muñoz");
  });

  it("escapes the ampersand of existing entities", () => {
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });
});

describe("renderWelcomeEmail", () => {
  it("renders a Spanish subject and both bodies", () => {
    const email = renderWelcomeEmail({ name: "Ana" });

    expect(email.subject).toBe(`¡Te damos la bienvenida a ${APP_NAME}!`);
    expect(email.text).toMatch(/^Hola, Ana:/);
    expect(email.text).toContain("Ya puedes iniciar sesión");
    expect(email.html).toContain('<html lang="es-CL">');
    expect(email.html).toContain("¡Hola, Ana!");
  });

  it("escapes the name in HTML but keeps it verbatim in plain text", () => {
    const name = `Bob <script>alert("x")</script> & 'co'`;
    const email = renderWelcomeEmail({ name });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain(
      "Bob &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;co&#39;",
    );
    expect(email.text).toContain(name);
  });
});
