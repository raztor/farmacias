import type { ReactNode } from "react";

import { TABLE_CELL_CLASSES, TABLE_HEADER_CLASSES } from "../../components/form-styles";

type ReportSectionProps = Readonly<{
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}>;

/** One report: a level-2 heading that names the landmark, a short explanation and its content. */
export function ReportSection({ id, title, description, children }: ReportSectionProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-xl font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export const NUMBER_HEADER_CLASSES = `${TABLE_HEADER_CLASSES} text-right`;
export const NUMBER_CELL_CLASSES = `${TABLE_CELL_CLASSES} text-right tabular-nums`;
export const ROW_HEADER_CLASSES = `${TABLE_CELL_CLASSES} text-left font-medium`;

/**
 * Scrollable table box. `relative` keeps the `sr-only` caption inside the scroll box, so it never
 * widens the page at 200 % zoom (WCAG 1.4.10, same fix as the users table).
 */
export function ReportTable({
  caption,
  children,
}: Readonly<{ caption: string; children: ReactNode }>) {
  return (
    <div className="relative overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}
