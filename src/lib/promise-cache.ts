/**
 * Cache a long-lived promise, but drop it if it rejects so the next caller
 * retries instead of receiving the same failure forever.
 *
 * The naive form is the bug this exists to prevent:
 *
 *     if (!cached) cached = connect();   // ← a rejected promise is still truthy
 *     return cached;
 *
 * `cached` now holds a rejected promise for the life of the process. Every later
 * call gets that same rejection without ever attempting to connect again — so a
 * single failure at container start becomes a permanent outage that only a
 * redeploy clears. That matters most on a long-lived host (Railway) where the
 * process is not recreated per request the way it is on Vercel.
 *
 * Pure and dependency-free so the retry behaviour is unit-testable without a
 * network or a database.
 */
export function cacheUntilRejected<T>(
  read: () => Promise<T> | undefined,
  write: (value: Promise<T> | undefined) => void,
  start: () => Promise<T>
): Promise<T> {
  const cached = read();
  if (cached) return cached;

  // Attach the reset before storing, so a synchronous rejection cannot leave a
  // poisoned entry behind.
  const pending = start().catch((err) => {
    write(undefined); // ปลดล็อกให้คำขอถัดไปเริ่มเชื่อมใหม่
    throw err; // คำขอนี้ยังล้มเหลวตามเดิม — ไม่กลบ error
  });

  write(pending);
  return pending;
}
