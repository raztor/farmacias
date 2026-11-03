/** Shared classes of native form controls (labels, selects, text fields, checkboxes). */
export const FIELD_LABEL_CLASSES = "text-sm font-medium text-foreground";

export const FIELD_HINT_CLASSES = "text-xs text-muted-foreground";

export const FIELD_ERROR_CLASSES = "text-sm font-medium text-destructive";

export const FIELD_CONTROL_CLASSES =
  "h-11 rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive";

export const CHECKBOX_CLASSES =
  "h-5 w-5 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Links inside tables and text (underlined: not identified by color only). */
export const INLINE_LINK_CLASSES =
  "font-semibold text-primary underline underline-offset-4 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";

export const TABLE_HEADER_CLASSES = "px-4 py-3 text-left text-sm font-medium text-muted-foreground";

export const TABLE_CELL_CLASSES = "px-4 py-3 align-top text-sm text-foreground";
