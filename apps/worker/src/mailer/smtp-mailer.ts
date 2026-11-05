import nodemailer, { type NodemailerError, type SMTPSentMessageInfo } from "nodemailer";

import { MailDeliveryError, type MailMessage, type Mailer, type SentMail } from "./mailer";

const CONNECTION_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 30_000;

/** SMTP mailer that can release its transport on shutdown. */
export type SmtpMailer = Mailer & {
  /** Closes the SMTP transport. Messages already handed to `send` are not interrupted. */
  close: () => void;
};

const isNodemailerError = (error: unknown): error is NodemailerError => error instanceof Error;

/** Only recipient rejections are permanent: auth or config errors are fixed by a redeploy. */
const isPermanentRecipientError = (error: unknown): boolean =>
  isNodemailerError(error) &&
  error.permanent === true &&
  (error.recipient !== undefined || (error.rejected?.length ?? 0) > 0);

const toSentMail = (info: SMTPSentMessageInfo): SentMail => {
  if (info.rejected.length > 0) {
    throw new MailDeliveryError("SMTP server rejected the recipient", { permanent: true });
  }
  return { messageId: info.messageId };
};

/**
 * Creates a {@link Mailer} backed by nodemailer's SMTP transport.
 *
 * @param smtpUrl - `smtp[s]://[user:pass@]host:port` (credentials percent-encoded).
 * @param from - default sender, e.g. `App <no-reply@app.local>`.
 */
export const createSmtpMailer = (smtpUrl: string, from: string): SmtpMailer => {
  const transport = nodemailer.createTransport(
    {
      url: smtpUrl,
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      greetingTimeout: GREETING_TIMEOUT_MS,
      socketTimeout: SOCKET_TIMEOUT_MS,
      // Message content never comes from files or remote URLs.
      disableFileAccess: true,
      disableUrlAccess: true,
    },
    { from },
  );

  const send = async (message: MailMessage): Promise<SentMail> => {
    let info: SMTPSentMessageInfo;
    try {
      info = await transport.sendMail(message);
    } catch (error) {
      throw new MailDeliveryError("SMTP delivery failed", {
        permanent: isPermanentRecipientError(error),
        cause: error,
      });
    }
    return toSentMail(info);
  };

  return {
    send,
    close: () => {
      transport.close();
    },
  };
};
