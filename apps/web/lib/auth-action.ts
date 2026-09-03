export const AUTH_TIMEOUT_MS = 15_000;
export const AUTH_TIMEOUT_CODE = "AUTH_TIMEOUT";

export async function withAuthTimeout<T>(promise: Promise<T>, ms = AUTH_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(AUTH_TIMEOUT_CODE);
      error.name = AUTH_TIMEOUT_CODE;
      reject(error);
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function isAuthTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === AUTH_TIMEOUT_CODE;
}
