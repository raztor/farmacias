import { emailSchema } from "@repo/shared";

/** JSON media types, the same pattern better-call (Better Auth's router) uses to parse JSON. */
const JSON_CONTENT_TYPE = /^application\/([a-z0-9.+-]*\+)?json/i;

/** Form media type better-call parses for `/sign-in/email` (its other allowed type is JSON). */
const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";

const parseBody = async (request: Request, contentType: string): Promise<unknown> => {
  if (JSON_CONTENT_TYPE.test(contentType)) return request.clone().json();
  if (contentType.includes(FORM_CONTENT_TYPE)) {
    return Object.fromEntries(new URLSearchParams(await request.clone().text()));
  }
  return null;
};

/**
 * Body of a sign-in request parsed like better-call parses it (JSON first, then urlencoded forms,
 * the only media types `/sign-in/email` accepts), without consuming the original. `null` when
 * the body is missing, malformed or of any other type (multipart is answered 415 by Better Auth).
 */
export const readRequestBody = async (request: Request): Promise<unknown> => {
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  try {
    return await parseBody(request, contentType);
  } catch {
    return null;
  }
};

/** Normalized email of a sign-in body, or `null` when Better Auth would reject it anyway. */
export const signInEmailOf = (body: unknown): string | null => {
  if (typeof body !== "object" || body === null || !("email" in body)) return null;
  const parsed = emailSchema.safeParse(body.email);
  return parsed.success ? parsed.data : null;
};
