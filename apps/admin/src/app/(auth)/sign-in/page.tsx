import type { Metadata } from "next";

import { REDIRECT_PARAM, SignInForm, safeRedirectPath } from "../_deps";

export const metadata: Metadata = { title: "Iniciar sesión" };

type SignInPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const redirectTo = (await searchParams)[REDIRECT_PARAM];
  return (
    <SignInForm redirectTo={safeRedirectPath(typeof redirectTo === "string" ? redirectTo : null)} />
  );
}
