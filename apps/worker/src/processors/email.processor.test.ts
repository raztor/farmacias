import { UnrecoverableError, type EmailJob, type JobContext } from "@repo/queue";
import { APP_NAME, noopLogger, type AppLogger } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";

import { MailDeliveryError, type MailMessage, type Mailer } from "../mailer";
import { createEmailProcessor, processEmailJob, renderEmailJob } from "./email.processor";

const createFakeMailer = (failWith?: Error) => {
  const sent: MailMessage[] = [];
  const mailer: Mailer = {
    send: (message) => {
      if (failWith) return Promise.reject(failWith);
      sent.push(message);
      return Promise.resolve({ messageId: `<${String(sent.length)}@test>` });
    },
  };
  return { mailer, sent };
};

const spyLogger = () => {
  const logger = {
    ...noopLogger,
    info: vi.fn(),
    error: vi.fn(),
    child: (): AppLogger => logger,
  };
  return logger;
};

const welcomeJob: EmailJob = { type: "welcome", to: "ana@example.cl", name: "Ana" };

describe("processEmailJob", () => {
  it("sends the welcome email to the job recipient", async () => {
    const { mailer, sent } = createFakeMailer();
    const logger = spyLogger();

    await processEmailJob(welcomeJob, { mailer, logger });

    expect(sent).toHaveLength(1);
    const [message] = sent;
    expect(message?.to).toBe("ana@example.cl");
    expect(message?.subject).toBe(`¡Te damos la bienvenida a ${APP_NAME}!`);
    expect(message?.text).toContain("Hola, Ana:");
    expect(message?.html).toContain("¡Hola, Ana!");
    expect(logger.info).toHaveBeenCalledWith(
      { emailType: "welcome", messageId: "<1@test>" },
      "Email sent",
    );
  });

  it("does not log the recipient address", async () => {
    const { mailer } = createFakeMailer();
    const logger = spyLogger();

    await processEmailJob(welcomeJob, { mailer, logger });

    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("ana@example.cl");
  });

  it("escapes the user name in the HTML body", async () => {
    const { mailer, sent } = createFakeMailer();

    await processEmailJob(
      { ...welcomeJob, name: '<img src=x onerror="alert(1)">' },
      { mailer, logger: noopLogger },
    );

    expect(sent[0]?.html).not.toContain("<img");
    expect(sent[0]?.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("re-throws transient delivery errors so BullMQ retries", async () => {
    const failure = new MailDeliveryError("SMTP delivery failed", { permanent: false });
    const { mailer } = createFakeMailer(failure);

    await expect(processEmailJob(welcomeJob, { mailer, logger: noopLogger })).rejects.toBe(failure);
  });

  it("fails without retry when the recipient is permanently rejected", async () => {
    const { mailer } = createFakeMailer(
      new MailDeliveryError("SMTP delivery failed", { permanent: true }),
    );
    const logger = spyLogger();

    await expect(processEmailJob(welcomeJob, { mailer, logger })).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(logger.error).toHaveBeenCalledOnce();
  });
});

describe("renderEmailJob", () => {
  it("renders the template that matches the job type", () => {
    const rendered = renderEmailJob(welcomeJob);

    expect(rendered.subject).toContain(APP_NAME);
    expect(rendered.text).toContain("Ana");
  });
});

describe("createEmailProcessor", () => {
  it("uses the job-scoped logger from the worker context", async () => {
    const { mailer, sent } = createFakeMailer();
    const logger = spyLogger();
    const context = { logger, job: {}, signal: undefined } as unknown as JobContext;

    await createEmailProcessor({ mailer })(welcomeJob, context);

    expect(sent).toHaveLength(1);
    expect(logger.info).toHaveBeenCalledOnce();
  });
});
