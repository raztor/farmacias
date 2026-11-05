"use client";

import { useRouter } from "next/navigation";
import type { ReactNode, SubmitEvent } from "react";

import { compactSearch } from "../lib/search-params";

type FilterFormProps = Readonly<{
  /** Page the filters apply to (its URL receives the filters as query parameters). */
  action: string;
  /** Accessible name of the search landmark. */
  label: string;
  className?: string;
  children: ReactNode;
}>;

/**
 * GET form whose fields become the page's query parameters, so filters are shareable and
 * survive reloads. With JavaScript it navigates client-side and drops blank fields; without it
 * the browser submits the same GET request (progressive enhancement).
 */
export function FilterForm({ action, label, className, children }: FilterFormProps) {
  const router = useRouter();

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(`${action}${compactSearch(new FormData(event.currentTarget).entries())}`);
  };

  return (
    <form
      role="search"
      aria-label={label}
      method="get"
      action={action}
      onSubmit={onSubmit}
      className={className}
    >
      {children}
    </form>
  );
}
