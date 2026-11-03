import type { ReactNode } from "react";

type DetailSectionProps = Readonly<{ id: string; title: string; children: ReactNode }>;

/** Titled section of the order detail (`<section>` labelled by its `<h2>`). */
export function DetailSection({ id, title, children }: DetailSectionProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-xl font-semibold text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
