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
 * Guards every backoffice page: the session and the `admin` role are verified against the API
 * on each request (the proxy only checks that a cookie exists).
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const access = await getAdminAccess();
  if (access.status === "signed-out") redirect(signInPathFor(await getRequestPath()));
  if (access.status === "forbidden") return <ForbiddenScreen email={access.session.user.email} />;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-row items-center gap-6">
            <Link href="/" className="text-lg font-semibold text-primary">
              {APP_NAME} · Admin
            </Link>
            <AdminNav />
          </div>
          <div className="flex flex-row items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {access.session.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
