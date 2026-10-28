import type { InterpolatedDocument } from '../types';

/** Conservative DocketStamp field budgets for the one-page address block. */
export const PHYSICAL_ADDRESS_LIMITS = Object.freeze({
  name: 80,
  company: 80,
  addressLine: 60,
  city: 40,
  state: 2,
  zip: 10,
});

const BODY_HEIGHT_PT = (11 - 3.35 - 0.8) * 72;
// 7in of body width is 504pt. Use conservative per-glyph upper bounds and keep
// 14.4pt of horizontal slack. Long unbroken W/CJK runs are charged at or above
// one em, while narrow prose characters use conservative class widths. This
// preserves realistic line estimates without letting wide unbroken strings
// bypass the aggregate height check.
const SAFE_WIDTH_PT = 7 * 72 - 14.4;
const PARAGRAPH_LINE_HEIGHT_PT = 9.5 * 1.5;
const PARAGRAPH_GAP_PT = 10 * 0.75;

export type PhysicalFitFailure = 'address_length' | 'body_overflow';
export interface PhysicalFitResult {
  fits: boolean;
  failure?: PhysicalFitFailure;
  estimatedHeightPt: number;
  availableHeightPt: number;
}

function graphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), (part) => part.segment);
  }
  return Array.from(text);
}

function glyphWidthEm(character: string, monospace = false): number {
  // Emoji and flag graphemes commonly occupy two ems. Joiners, variation
  // selectors and modifiers are included in their grapheme but add no width.
  if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(character)) return 2;
  if (/^[\p{Mark}\u200d\ufe0e\ufe0f\u{e0100}-\u{e01ef}]+$/u.test(character)) return 0;
  if (monospace) return 0.62;
  if (/\s/u.test(character)) return 0.3;
  if (/[MW@%&]/u.test(character)) return 1;
  if (/[A-Z]/u.test(character)) return 0.75;
  if (/[mw]/u.test(character)) return 0.95;
  if (/[a-z]/u.test(character)) return 0.65;
  if (/[0-9]/u.test(character)) return 0.65;
  if (/^[\p{P}]$/u.test(character)) return 0.5;
  if (/\p{S}/u.test(character)) return 1.25;
  return 1.15;
}

function wrappedLines(text: string, fontSizePt: number, monospace = false): number {
  const unitsPerLine = SAFE_WIDTH_PT / fontSizePt;
  const segments = text.split(/\r\n|\r|\n/);
  return segments.reduce((total, segment) => {
    const words = segment.trim().split(/\s+/u).filter(Boolean);
    if (!words.length) return total + 1;
    let lines = 1;
    let lineWidth = 0;
    for (const word of words) {
      const clusters = graphemes(word);
      const wordWidth = clusters.reduce((width, cluster) => width + glyphWidthEm(cluster, monospace), 0);
      const separatorWidth = lineWidth > 0 ? glyphWidthEm(' ', monospace) : 0;
      if (lineWidth > 0 && lineWidth + separatorWidth + wordWidth <= unitsPerLine) {
        lineWidth += separatorWidth + wordWidth;
        continue;
      }
      if (lineWidth > 0) {
        lines += 1;
        lineWidth = 0;
      }
      if (wordWidth <= unitsPerLine) {
        lineWidth = wordWidth;
        continue;
      }
      // Browser line breaking may split an overlong word. Account for each
      // wrapped fragment rather than letting a long token evade the budget.
      let fragmentWidth = 0;
      for (const cluster of clusters) {
        const clusterWidth = glyphWidthEm(cluster, monospace);
        if (fragmentWidth > 0 && fragmentWidth + clusterWidth > unitsPerLine) {
          lines += 1;
          fragmentWidth = 0;
        }
        fragmentWidth += clusterWidth;
      }
      lineWidth = fragmentWidth;
    }
    return total + lines;
  }, 0);
}

function addressFits(doc: InterpolatedDocument): boolean {
  const within = (value: string | undefined, limit: number) => !value || Array.from(value).length <= limit;
  for (const address of [doc.senderAddress, doc.recipientAddress]) {
    if (!within(address.name, PHYSICAL_ADDRESS_LIMITS.name) ||
        !within(address.company, PHYSICAL_ADDRESS_LIMITS.company) ||
        !within(address.address_line1, PHYSICAL_ADDRESS_LIMITS.addressLine) ||
        !within(address.address_line2, PHYSICAL_ADDRESS_LIMITS.addressLine) ||
        !within(address.address_city, PHYSICAL_ADDRESS_LIMITS.city) ||
        !within(address.address_state, PHYSICAL_ADDRESS_LIMITS.state) ||
        !within(address.address_zip, PHYSICAL_ADDRESS_LIMITS.zip)) return false;
  }
  return true;
}

/**
 * Deterministic conservative one-page preflight shared by the browser and the
 * server freeze boundary. It never removes or shrinks notice text; oversized
 * content is blocked so a payment intent cannot be created for a clipped letter.
 */
export function assessPhysicalFit(doc: InterpolatedDocument): PhysicalFitResult {
  if (!addressFits(doc)) {
    return { fits: false, failure: 'address_length', estimatedHeightPt: 0, availableHeightPt: BODY_HEIGHT_PT };
  }

  const titleHeight = wrappedLines(doc.headerTitle.toLocaleUpperCase('en-US'), 10.5) * (10.5 * 1.25) + 12;
  const subjectHeight = wrappedLines(doc.reLine, 8.5) * (8.5 * 1.3) + 19.5;
  const salutationHeight = wrappedLines(`TO: ${doc.recipientAddress.name || '[RECIPIENT NAME]'}`, 9.5) * (9.5 * 1.3) + 7.5;
  const paragraphHeight = doc.rawParagraphs.reduce(
    (height, paragraph) => height + wrappedLines(paragraph, 9.5) * PARAGRAPH_LINE_HEIGHT_PT + PARAGRAPH_GAP_PT,
    0,
  );
  const signatureHeight = 12 + 10.5
    + wrappedLines(doc.signatureBlock.formalSignature, 11, true) * 13.2 + 11.25
    + wrappedLines(`${doc.signatureBlock.signerName} · Executed on ${doc.signatureBlock.executionDate} · Docket ID: ${doc.docketId}`, 8) * 9.6;
  const enclosureHeight = doc.enclosuresLine ? 7.5 + wrappedLines(doc.enclosuresLine, 8.5) * (8.5 * 1.3) : 0;
  const estimatedHeightPt = titleHeight + subjectHeight + salutationHeight + paragraphHeight + signatureHeight + enclosureHeight;
  return {
    fits: estimatedHeightPt <= BODY_HEIGHT_PT,
    ...(estimatedHeightPt <= BODY_HEIGHT_PT ? {} : { failure: 'body_overflow' as const }),
    estimatedHeightPt,
    availableHeightPt: BODY_HEIGHT_PT,
  };
}

export function physicalFitCustomerMessage(failure?: PhysicalFitFailure): string {
  if (failure === 'address_length') return 'Shorten the mailing name, company, or address fields to fit this letter\'s one-page layout.';
  return 'This letter is too long for one printed page. Shorten the longest filled details, then review it again before continuing.';
}
