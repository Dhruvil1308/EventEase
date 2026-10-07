/**
 * Current time for request-time rendering. Server components call this only
 * after `await connection()`, so every request (not the build) gets a fresh value.
 */
export function requestTime() {
  return Date.now();
}
