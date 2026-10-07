/**
 * Schedule work to run after the HTTP response is sent (Next.js `after`).
 * No-op when called outside an active request (tests, scripts, static generation).
 */
export function scheduleAfterResponse(task: () => void | Promise<void>): void {
  void import("next/server")
    .then(({ after }) => {
      try {
        after(() => {
          void Promise.resolve(task()).catch(() => undefined);
        });
      } catch {
        // `after` throws when called outside an active request (tests, scripts, static gen).
      }
    })
    .catch(() => undefined);
}
