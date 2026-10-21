export type Attempt<T> = { ok: true; value: T } | { ok: false };

/**
 * Runs a back-office API call. A failure is already shown to the admin by adminErrorsInterceptor:
 * the caller only needs to know whether to go on.
 */
export async function attempt<T>(call: Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await call };
  } catch {
    return { ok: false };
  }
}
