import { createServer } from "node:net";

import { describe, expect, it } from "vitest";

import { MailDeliveryError } from "./mailer";
import { createSmtpMailer } from "./smtp-mailer";

/** Reserves a free port and releases it, so nothing is listening there. */
const unusedPort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      server.close(() => {
        resolve(port);
      });
    });
  });

describe("createSmtpMailer", () => {
  it("wraps connection failures in a transient MailDeliveryError", async () => {
    const port = await unusedPort();
    const mailer = createSmtpMailer(`smtp://127.0.0.1:${String(port)}`, "App <no-reply@app.local>");

    const error: unknown = await mailer
      .send({ to: "ana@example.cl", subject: "Hola", text: "Hola", html: "<p>Hola</p>" })
      .catch((caught: unknown) => caught);
    mailer.close();

    expect(error).toBeInstanceOf(MailDeliveryError);
    expect((error as MailDeliveryError).permanent).toBe(false);
    expect((error as MailDeliveryError).cause).toBeInstanceOf(Error);
  });
});
