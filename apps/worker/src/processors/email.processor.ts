import { type EmailJob, type JobHandler, UnrecoverableError } from "@repo/queue";
import type { AppLogger } from "@repo/shared";

import { renderWelcomeEmail, type RenderedEmail } from "../emails";
import { isMailDeliveryError, type Mailer } from "../mailer";

export type EmailProcessorDeps = {
  mailer: Mailer;
  logger: AppLogger;
};

type EmailType = EmailJob["type"];
type EmailJobOf<T extends EmailType> = Extract<EmailJob, { type: T }>;

/**
 * One template per job type. The mapped type makes this exhaustive: adding a member to
 * `emailJobSchema` without its renderer here is a compile error.
 */
const EMAIL_RENDERERS: { [T in EmailType]: (job: EmailJobOf<T>) => RenderedEmail } = {
  welcome: (job) => renderWelcomeEmail({ name: job.name }),
};

/** Renders the email for a validated job. */
export const renderEmailJob = <T extends EmailType>(
  job: EmailJobOf<T> & { type: T },
): RenderedEmail => {
  const render: (job: EmailJobOf<T>) => RenderedEmail = EMAIL_RENDERERS[job.type];
  return render(job);
};

/**
 * Renders and delivers one email job. Transient failures are re-thrown so BullMQ retries
 * with backoff; permanent recipient rejections fail the job without retrying.
 */
export const processEmailJob = async (job: EmailJob, deps: EmailProcessorDeps): Promise<void> => {
  const message = renderEmailJob(job);
  try {
    const sent = await deps.mailer.send({ to: job.to, ...message });
    deps.logger.info({ emailType: job.type, messageId: sent.messageId }, "Email sent");
  } catch (error) {
    if (isMailDeliveryError(error) && error.permanent) {
      deps.logger.error({ err: error, emailType: job.type }, "Email permanently rejected");
      throw new UnrecoverableError(`Email "${job.type}" was permanently rejected`);
    }
    throw error;
  }
};

/** Adapts {@link processEmailJob} to the queue worker, using the job-scoped logger. */
export const createEmailProcessor =
  ({ mailer }: Pick<EmailProcessorDeps, "mailer">): JobHandler<"email"> =>
  (payload, context) =>
    processEmailJob(payload, { mailer, logger: context.logger });
