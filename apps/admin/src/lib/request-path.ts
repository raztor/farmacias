import { headers } from "next/headers";

import { safeRedirectPath } from "./safe-redirect";

/**
 * Request header set by `proxy.ts` with the requested path (+ query), so server layouts, which
 * do not receive the pathname, can send the user back to it after signing in.
 */
export const REQUEST_PATH_HEADER = "x-request-path";

/** Path of the current request (sanitized), or the backoffice home when unknown. */
export async function getRequestPath(): Promise<string> {
  return safeRedirectPath((await headers()).get(REQUEST_PATH_HEADER));
}
