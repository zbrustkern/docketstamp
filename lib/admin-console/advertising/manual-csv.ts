import type { GoogleAdsDestination } from './destination';
import type { GoogleConversionCandidate } from './eligibility';
import { evaluateGoogleConversionEligibility } from './eligibility';

export interface GoogleCsvConversionRow {
  orderId: string; gclid: string; conversionName: string; conversionTime: string;
  conversionValue: number; conversionCurrency: string; transactionId: string;
}

/** Neutralizes spreadsheet formulas before CSV quoting and strips embedded line breaks. */
export function spreadsheetSafeCell(value: string | number): string {
  let text = String(value).replace(/[\r\n\t]/g, ' ').replace(/\u0000/g, '');
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildGoogleOfflineConversionCsv(rows: GoogleCsvConversionRow[]): string {
  const formulaLeading = (value: string) => /^[\s\u0000-\u001f]*[=+\-@]/.test(value);
  for (const row of rows) {
    if (!/^[A-Za-z0-9_.~-]{1,255}$/.test(row.gclid) || formulaLeading(row.gclid) || !/^[A-Za-z0-9 _.-]{1,100}$/.test(row.conversionName) || formulaLeading(row.conversionName) || !/^[a-f0-9]{40}$/.test(row.transactionId) || !Number.isFinite(Date.parse(row.conversionTime)) || !Number.isFinite(row.conversionValue) || row.conversionValue < 0 || row.conversionCurrency !== 'USD') {
      throw new Error('GOOGLE_CSV_FIELD_INVALID');
    }
  }
  const header = ['Google Click ID', 'Conversion Name', 'Conversion Time', 'Conversion Value', 'Conversion Currency', 'Order ID'];
  return [header, ...rows.map(row => [row.gclid, row.conversionName, row.conversionTime, row.conversionValue.toFixed(2), row.conversionCurrency, row.transactionId])]
    .map(cells => cells.map(spreadsheetSafeCell).join(',')).join('\r\n') + '\r\n';
}

export function eligibleGoogleCsvRow(input: GoogleConversionCandidate, destination: GoogleAdsDestination) {
  const result = evaluateGoogleConversionEligibility({ ...input, destinationApproved: destination.approved === true });
  if (!result.eligible || !('click' in result) || !result.click) return { eligible: false as const, reasons: result.reasons };
  return {
    eligible: true as const,
    row: {
      orderId: input.order.id,
      gclid: result.click.value,
      conversionName: destination.conversionName,
      conversionTime: result.eventTimestamp,
      conversionValue: result.conversionValue,
      conversionCurrency: result.currency,
      transactionId: result.transactionId,
    },
    consentGrantId: result.consentGrantId,
    consentSessionBinding: result.consentSessionBinding,
  };
}
