'use client';
import { useCallback, useEffect, useState } from 'react';
import type { PublicAvailabilityResponse } from '@/src/lib/docket/template-policy';
import { fetchTemplateAvailability } from '@/src/lib/docket/availability-client';

/** No persistent client cache: each new preparation surface reads current policy. */
export function useTemplateAvailability() {
  const [data, setData] = useState<PublicAvailabilityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => { setLoading(true); setAttempt(value => value + 1); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchTemplateAvailability(fetch, controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch(() => {
      if (!controller.signal.aborted) { setData(null); setError('We couldn’t check letter availability. Please try again.'); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  return { data, error, loading, refresh };
}
