/** Error raised when an operation does not settle within its time budget. */
export class TimeoutError extends Error {
  override readonly name = "TimeoutError";
}

/**
 * Races `promise` against a timer. The underlying operation is not cancelled,
 * so callers must only use it for work that is safe to complete late.
 */
export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(message));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
};
