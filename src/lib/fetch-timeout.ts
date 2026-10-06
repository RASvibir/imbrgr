export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 30_000, ...rest } = init;
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    return await fetch(url, { ...rest, signal });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      throw new Error("upstream_timeout");
    }
    throw e;
  }
}
