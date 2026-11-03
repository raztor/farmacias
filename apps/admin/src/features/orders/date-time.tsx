import { formatDateTime } from "./orders-format";

/** Date and time in Chile's time zone, with the exact UTC instant for assistive tech. */
export function DateTime({ value }: Readonly<{ value: Date }>) {
  return <time dateTime={value.toISOString()}>{formatDateTime(value)}</time>;
}
