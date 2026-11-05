import { APP_NAME } from "@repo/shared";
import type { ReactNode } from "react";

type AuthLayoutProps = Readonly<{ children: ReactNode }>;

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-1">
        <span className="text-lg font-semibold text-primary">{APP_NAME}</span>
        <span className="text-sm text-muted-foreground">Administración</span>
      </div>
      {children}
    </main>
  );
}
