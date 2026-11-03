/** A fully rendered message, ready to be delivered. */
export type MailMessage = {
  to: string;
  subject: string;
  /** Plain-text body (always sent, for clients that do not render HTML). */
  text: string;
  /** HTML body; every interpolated value must already be escaped. */
  html: string;
};

export type SentMail = {
  messageId: string;
};

/** Delivery port used by job processors. Implementations throw when delivery fails. */
export type Mailer = {
  send: (message: MailMessage) => Promise<SentMail>;
};

/**
 * Delivery failure. `permanent` is true when the server rejected the recipient for good,
 * so retrying the same message would fail again.
 */
export class MailDeliveryError extends Error {
  override readonly name = "MailDeliveryError";
  readonly permanent: boolean;

  constructor(message: string, options: { permanent: boolean; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.permanent = options.permanent;
  }
}

export const isMailDeliveryError = (error: unknown): error is MailDeliveryError =>
  error instanceof MailDeliveryError;
