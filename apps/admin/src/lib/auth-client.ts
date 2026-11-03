import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client. Requests go to the current origin (`/api/auth/*`), which Next.js rewrites
 * to the API, so the session cookie is first-party and there is no CORS in the browser.
 */
export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? undefined : window.location.origin,
});

export type AuthClientSession = typeof authClient.$Infer.Session;
