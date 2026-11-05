/** Output of every email template: subject plus plain-text and HTML bodies. */
export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};
