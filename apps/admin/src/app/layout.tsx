import { APP_NAME } from "@repo/shared";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { Providers } from "./providers";

const TITLE = `${APP_NAME} · Administración`;

export const metadata: Metadata = {
  title: { default: TITLE, template: `%s · ${TITLE}` },
  description: `Backoffice de ${APP_NAME} para administradores.`,
  applicationName: TITLE,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

type RootLayoutProps = Readonly<{ children: ReactNode }>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es">
      <body className="bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
