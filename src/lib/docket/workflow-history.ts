export type WorkspaceWorkflowStep = 'details' | 'review' | 'delivery' | 'payment';

const WORKFLOW_STEPS = new Set<WorkspaceWorkflowStep>(['details', 'review', 'delivery', 'payment']);
const HISTORY_MARKER = 'docketstampWorkflow';
const SAFE_CONTEXT_KEYS = new Set(['recipientId', 'tier', 'serviceLevel', 'focus', 'source']);

export function parseWorkflowStep(value: unknown): WorkspaceWorkflowStep | null {
  return typeof value === 'string' && WORKFLOW_STEPS.has(value as WorkspaceWorkflowStep)
    ? value as WorkspaceWorkflowStep
    : null;
}

export function resolveHydratedStageId(queryStageId: string | null, retainedStageId: string | null, dismissed: boolean): string | null {
  return dismissed ? null : queryStageId || retainedStageId;
}

export function workflowHistoryState(step: WorkspaceWorkflowStep): Record<string, unknown> {
  return { [HISTORY_MARKER]: step };
}

function safeContextValue(key: string, value: string): boolean {
  if (key === 'tier' || key === 'serviceLevel') {
    return ['first_class', 'certified', 'certified_return_receipt'].includes(value);
  }
  if (key === 'source') return ['home_chooser', 'companies_directory'].includes(value);
  if (key === 'recipientId') return /^[a-zA-Z0-9_-]{1,96}$/.test(value);
  if (key === 'focus') return /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(value);
  return false;
}

/** Preserve only non-sensitive routing context. Prefills and stage bearer tokens
 * are consumed by hydration before the first history write and then removed. */
export function safeWorkflowUrl(currentUrl: string, step?: WorkspaceWorkflowStep): string {
  const url = new URL(currentUrl, 'http://localhost');
  const safe = new URLSearchParams();
  for (const key of SAFE_CONTEXT_KEYS) {
    const value = url.searchParams.get(key);
    if (value && safeContextValue(key, value)) safe.set(key, value);
  }
  const nextStep = step || parseWorkflowStep(url.searchParams.get('workflow') || '');
  if (nextStep && nextStep !== 'details') safe.set('workflow', nextStep);
  const query = safe.toString();
  return `${url.pathname}${query ? `?${query}` : ''}`;
}

/** Replace the current URL after hydration while retaining Next.js router state. */
export function sanitizeWorkflowLocation(): void {
  if (typeof window === 'undefined') return;
  const url = safeWorkflowUrl(window.location.href);
  window.history.replaceState(window.history.state, '', url);
}

export function workflowStepFromHistoryState(state: unknown): WorkspaceWorkflowStep | null {
  if (!state || typeof state !== 'object') return null;
  return parseWorkflowStep((state as Record<string, unknown>)[HISTORY_MARKER]);
}

/** Keeps workflow entries free of customer fields, access capabilities, and payment credentials. */
export function writeWorkflowHistory(step: WorkspaceWorkflowStep, replace = false): void {
  if (typeof window === 'undefined') return;
  const url = safeWorkflowUrl(window.location.href, step);
  const method = replace ? 'replaceState' : 'pushState';
  const state = window.history.state && typeof window.history.state === 'object'
    ? { ...window.history.state, ...workflowHistoryState(step) }
    : workflowHistoryState(step);
  window.history[method](state, '', url);
}

export function resolveHistoryNavigation(
  requested: WorkspaceWorkflowStep,
  readiness: { checkoutReady: boolean; paymentReady: boolean }
): WorkspaceWorkflowStep {
  if (requested === 'payment') {
    if (readiness.paymentReady) return 'payment';
    return readiness.checkoutReady ? 'delivery' : 'review';
  }
  if (requested === 'delivery' && !readiness.checkoutReady) return 'review';
  return requested;
}
