/**
 * Values that must be produced by the renderer or server, never copied from
 * user-controlled form data. Keep this list shared by client preview and the
 * checkout lock route so both renders agree about who owns legal text.
 */
export const SERVER_DERIVED_NOTICE_KEYS = new Set([
  'docketId',
  'executionDate',
  'clerkStamp',
  'signatureBlock',
  'formalSignature',
  'senderFullAddress',
  'recipientFullAddress',
  'statuteCitation',
  'statutoryCitation',
  'statuteDeadline',
  'returnDeadlineDays',
  'returnDeadlineLabel',
  'statutoryNuance',
  'penaltyClause',
  'badFaithMultiplier',
  'itemizedDeductionsRequired',
  'statuteSummary',
  'stateName',
]);

export function omitServerDerivedNoticeValues(
  values: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => !SERVER_DERIVED_NOTICE_KEYS.has(key))
  );
}
