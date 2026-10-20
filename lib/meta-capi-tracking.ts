/** Mark CAPI delivery complete only after the provider accepted the event. */
export async function markMetaCapiTrackedAtOnSuccess(
  result: { success: boolean },
  markTrackedAt: (timestamp: number) => Promise<void>,
  now = Date.now(),
): Promise<boolean> {
  if (!result.success) return false;
  await markTrackedAt(now);
  return true;
}
