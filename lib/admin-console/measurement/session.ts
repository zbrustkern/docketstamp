'use client';
const LEGACY_SESSION_KEY = 'smn_telemetry_session';
const KEY = 'docketstamp_telemetry_session_v1';
const LAST = 'docketstamp_session_activity_v2';
let memoryId: string | undefined;
let memoryAt = 0;
const newId = () => `sess_${crypto.randomUUID()}`;
export function getBusinessSessionId(rotate = false): string {
  const now = Date.now();
  try {
    const prior = sessionStorage.getItem(KEY) || sessionStorage.getItem(LEGACY_SESSION_KEY);
    const at = Number(sessionStorage.getItem(LAST));
    const id = !rotate && prior && (!at || now - at < 30 * 60000) ? prior : newId();
    sessionStorage.setItem(KEY, id);
    sessionStorage.setItem(LAST, String(now));
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
    memoryId = id; memoryAt = now;
    return id;
  } catch {
    if (rotate || !memoryId || now - memoryAt >= 30 * 60000) memoryId = newId();
    memoryAt = now;
    return memoryId;
  }
}
