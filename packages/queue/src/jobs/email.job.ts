import { emailSchema, nameSchema } from "@repo/shared";
import { z } from "zod";

/** Sent once right after a user signs up. */
export const welcomeEmailJobSchema = z.object({
  type: z.literal("welcome"),
  to: emailSchema,
  name: nameSchema,
});

/**
 * Payload of the `email` queue. Discriminated by `type`, so adding a new email
 * means adding a new member here (and handling it in the worker's exhaustive switch).
 */
export const emailJobSchema = z.discriminatedUnion("type", [welcomeEmailJobSchema]);

export type WelcomeEmailJob = z.output<typeof welcomeEmailJobSchema>;
export type EmailJob = z.output<typeof emailJobSchema>;
export type EmailJobInput = z.input<typeof emailJobSchema>;
