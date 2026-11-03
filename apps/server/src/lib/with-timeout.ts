/** Raised when an operation does not settle within its time budget. */
export class TimeoutError extends Error {
  override readonly name = "TimeoutError";
}

/**
 * Races `operation` against a timer. The operation itself is not cancelled, so only use it for
 * work that is safe to finish late (health probes, best-effort cleanup).
 */
export const withTimeout = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(message));
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    clearTimeout(timer);
  }
};
