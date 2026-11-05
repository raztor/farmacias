import { createLogger, type Logger } from "@repo/observability";

import { env } from "./env";
import { SERVICE_NAME } from "./service";

/** Process-wide structured logger (JSON lines; pretty-printed only in development). */
export const logger: Logger = createLogger({
  service: SERVICE_NAME,
  level: env.LOG_LEVEL,
  environment: env.NODE_ENV,
  pretty: env.NODE_ENV === "development",
});
