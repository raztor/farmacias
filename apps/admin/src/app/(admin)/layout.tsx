import { APP_NAME } from "@repo/shared";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  AdminNav,
  ForbiddenScreen,
  SignOutButton,
  getAdminAccess,
  getRequestPath,
  signInPathFor,
} from "./_deps";

type AdminLayoutProps = Readonly<{ children: ReactNode }>;

/**
 * Guards every backoffice page: the session and an operational role (`operator` or `admin`) are
 * verified against the API on each request (the proxy only checks that a cookie exists).
 * Residents get the "Sin acceso" page.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const access = await getAdminAccess();
  if (access.status === "signed-out") redirect(signInPathFor(await getRequestPath()));
  if (access.status === "forbidden") return <ForbiddenScreen email={access.session.user.email} />;

  return (
    <div className="flex flex-1 flex-col">
      <a
        href="#contenido"
        className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Saltar al contenido
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-row items-center gap-6">
            <Link href="/" className="text-lg font-semibold text-primary">
              {APP_NAME} · Admin
            </Link>
            <AdminNav role={access.role} />
          </div>
          <div className="flex flex-row items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {access.session.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 focus:outline-none"
      >
        {children}
      </main>
    </div>
  );
}
