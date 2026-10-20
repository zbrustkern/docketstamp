/**
 * Document Interpolation Engine
 *
 * Pure deterministic function: merges user form values + state statutory lookups
 * into an InterpolatedDocument AST ready for interactive React canvas preview
 * and Lob 8.5x11 physical print rendering.
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md (§1 Invariant 3 & 4, §3, §8)
 * - ARCHITECTURE.md
 */

import {
  NoticeTemplateDefinition,
  InterpolatedDocument,
  InterpolatedParagraphToken,
  DocketAddress,
  MailTierId,
  PostalAddress,
} from '../types';
import { getStateStatute } from '../data/state-statutes';
import { CLERK_DOCKET_REGISTRY_TITLE } from '../guardrails';

export interface InterpolateOptions {
  notice: NoticeTemplateDefinition;
  userValues: Record<string, string>;
  docketId?: string;
  serviceLevel?: MailTierId;
  cassStatus?: string;
  executionDate?: string;
  senderAddress?: Partial<PostalAddress | DocketAddress>;
  recipientAddress?: Partial<PostalAddress | DocketAddress>;
}

/**
 * Generates a standard DocketStamp docket identifier: DS-2026-[6 alphanumeric chars]
 */
export function generateDocketId(seed?: string, stateSuffix?: string): string {
  if (seed && seed.startsWith('DS-2026-')) return seed;
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const suffix = stateSuffix ? `-${stateSuffix.trim().toUpperCase()}` : '';
  return `DS-2026-${rand}${suffix}`;
}

/**
 * Resolves state statutory tokens if the cartridge enables state lookup.
 */
function resolveStatutoryValues(
  notice: NoticeTemplateDefinition,
  userValues: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};

  if (notice.usesStateStatuteLookup) {
    const rawState =
      userValues.leasedPremisesState ||
      userValues.vacatedPremisesState ||
      userValues.propertyState ||
      userValues.rentalState ||
      userValues.state ||
      '';
    const stateCode = rawState.trim().toUpperCase();
    const statute = getStateStatute(stateCode);

    if (statute) {
      result.statuteCitation = statute.statuteCitation;
      result.statutoryCitation = statute.statuteCitation;
      result.statuteDeadline = statute.returnDeadlineLabel;
      result.returnDeadlineDays = String(statute.returnDeadlineDays || 30);
      result.returnDeadlineLabel = statute.returnDeadlineLabel;
      result.statutoryNuance = statute.statutoryNuance;
      result.penaltyClause = statute.penaltyClause || '';
      result.statuteSummary = statute.statuteSummary || statute.statutoryNuance;
      result.propertyState = statute.stateName;
      result.stateName = statute.stateName;
    } else {
      result.statuteCitation = 'Applicable State Security Deposit Statute';
      result.statutoryCitation = 'Applicable State Security Deposit Statute';
      result.statuteDeadline = 'the statutory deadline';
      result.returnDeadlineDays = '30';
      result.returnDeadlineLabel = '30 days';
      result.statutoryNuance = 'Statutory notice period required under state residential tenancy act.';
      result.penaltyClause = 'Statutory penalties provided under applicable state law';
      result.statuteSummary = 'State residential security deposit regulations';
      result.propertyState = stateCode || 'Governing Jurisdiction';
      result.stateName = stateCode || 'Governing Jurisdiction';
    }
  }

  return result;
}

function getAddressFields(addr?: Partial<PostalAddress | DocketAddress>) {
  if (!addr) return { line1: '', line2: '', city: '', state: '', zip: '', name: '', company: '' };
  const a = addr as Record<string, string | undefined>;
  return {
    line1: a.addressLine1 || a.address_line1 || '',
    line2: a.addressLine2 || a.address_line2 || '',
    city: a.city || a.address_city || '',
    state: a.state || a.address_state || '',
    zip: a.zip || a.address_zip || '',
    name: a.name || '',
    company: a.company || '',
  };
}

/**
 * Normalizes user form values with sensible defaults and cross-cartridge aliases.
 */
function normalizeValues(
  userValues: Record<string, string>,
  senderAddress: Partial<PostalAddress | DocketAddress>,
  recipientAddress: Partial<PostalAddress | DocketAddress>,
  docketId: string,
  executionDate: string
): Record<string, string> {
  const s = getAddressFields(senderAddress);
  const senderLine1 = s.line1 || userValues.senderAddressLine1 || userValues.leasedPremisesAddress || userValues.rentalPropertyAddress || '';
  const senderCity = s.city || userValues.senderCity || userValues.rentalCity || '';
  const senderState = s.state || userValues.senderState || userValues.rentalState || '';
  const senderZip = s.zip || userValues.senderZip || userValues.rentalZip || '';

  const senderFullAddress = [senderLine1, senderCity && `${senderCity}, ${senderState} ${senderZip}`]
    .filter(Boolean)
    .join(', ');

  const r = getAddressFields(recipientAddress);
  const recipientLine1 = r.line1 || userValues.recipientAddressLine1 || '';
  const recipientCity = r.city || userValues.recipientCity || '';
  const recipientState = r.state || userValues.recipientState || '';
  const recipientZip = r.zip || userValues.recipientZip || '';

  const recipientFullAddress = [recipientLine1, recipientCity && `${recipientCity}, ${recipientState} ${recipientZip}`]
    .filter(Boolean)
    .join(', ');

  const senderFullName =
    userValues.senderFullName ||
    userValues.tenantFullName ||
    userValues.consumerFullName ||
    userValues.customerFullName ||
    s.name ||
    '';

  const recipientFormalName =
    userValues.recipientFormalName ||
    userValues.landlordOrManagerName ||
    userValues.targetBureau ||
    userValues.collectionAgencyName ||
    userValues.serviceProviderName ||
    recipientAddress.name ||
    '';

  // Cross-cartridge field aliases
  const leasedPremisesAddress =
    userValues.leasedPremisesAddress ||
    userValues.rentalPropertyAddress ||
    userValues.servicePropertyAddress ||
    '';

  const vacatedPremisesAddress =
    userValues.vacatedPremisesAddress ||
    userValues.rentalPropertyAddress ||
    leasedPremisesAddress ||
    '';

  const moveOutDate =
    userValues.moveOutDate ||
    userValues.effectiveVacateDate ||
    userValues.surrenderDate ||
    '';

  return {
    ...userValues,
    docketId,
    executionDate,
    senderFullName,
    recipientFormalName,
    senderFullAddress: senderFullAddress || '[SENDER ADDRESS]',
    recipientFullAddress: recipientFullAddress || '[RECIPIENT ADDRESS]',
    leasedPremisesAddress,
    vacatedPremisesAddress,
    moveOutDate,
    // Ensure aliases exist
    rentalPropertyAddress: leasedPremisesAddress,
    effectiveVacateDate: moveOutDate,
    surrenderDate: moveOutDate,
  };
}

/**
 * Evaluates conditional blocks in template text:
 * `{{#key}}content with {{subKey}}{{/key}}` (positive conditional)
 * `{{^key}}fallback content{{/key}}` (inverted conditional)
 */
function evaluateConditionals(text: string, mergedValues: Record<string, string>): string {
  let processed = text;

  // Inverted sections: {{^key}}...{{/key}}
  const invertedRegex = /\{\{\^([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  processed = processed.replace(invertedRegex, (_, key, content) => {
    const val = mergedValues[key];
    const isFalsy = !val || val.trim().length === 0;
    return isFalsy ? content : '';
  });

  // Positive sections: {{#key}}...{{/key}}
  const positiveRegex = /\{\{#([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  processed = processed.replace(positiveRegex, (_, key, content) => {
    const val = mergedValues[key];
    const isTruthy = !!val && val.trim().length > 0;
    return isTruthy ? content : '';
  });

  return processed;
}

/**
 * Tokenizes a paragraph string into sequential text and variable tokens for preview and drawer focus.
 */
function tokenizeParagraph(
  rawParagraph: string,
  notice: NoticeTemplateDefinition,
  mergedValues: Record<string, string>
): InterpolatedParagraphToken[] {
  const tokens: InterpolatedParagraphToken[] = [];
  const fieldMap = new Map(notice.fields.map((f) => [f.key, f]));

  const tokenRegex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(rawParagraph)) !== null) {
    const matchStart = match.index;
    const matchEnd = tokenRegex.lastIndex;
    const variableKey = match[1];

    // Push preceding text if any
    if (matchStart > lastIndex) {
      tokens.push({
        type: 'text',
        content: rawParagraph.substring(lastIndex, matchStart),
      });
    }

    const fieldConfig = fieldMap.get(variableKey);
    const userVal = mergedValues[variableKey];
    const isFilled = typeof userVal === 'string' && userVal.trim().length > 0 && !userVal.startsWith('[');

    tokens.push({
      type: 'variable',
      key: variableKey,
      content: isFilled ? userVal : '',
      docusignTagLabel: fieldConfig?.docusignTagLabel || variableKey.replace(/([A-Z])/g, ' $1').toUpperCase().trim(),
      isFilled,
    });

    lastIndex = matchEnd;
  }

  // Push trailing text
  if (lastIndex < rawParagraph.length) {
    tokens.push({
      type: 'text',
      content: rawParagraph.substring(lastIndex),
    });
  }

  return tokens;
}

/**
 * Replaces simple {{key}} placeholders in single-line strings.
 */
function replaceTokens(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    return values[key] || `[${key.replace(/([A-Z])/g, ' $1').toUpperCase().trim()}]`;
  });
}

/**
 * Primary Interpolation Entrypoint
 */
export function interpolateNotice(options: InterpolateOptions): InterpolatedDocument {
  const {
    notice,
    userValues,
    docketId = generateDocketId(undefined, userValues.propertyState || userValues.rentalState || userValues.state),
    serviceLevel = notice.recommendedTier,
    // Address verification is an operational result, not a template default. The
    // dispatch workflow may supply a confirmed status after validation; until
    // then the frozen document must not imply USPS/CASS verification occurred.
    cassStatus = 'ADDRESS VERIFICATION NOT CONFIRMED',
    executionDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    senderAddress = {},
    recipientAddress = {},
  } = options;

  // 1. Merge statutory lookups with user values
  const statutoryValues = resolveStatutoryValues(notice, userValues);
  const normalized = normalizeValues(userValues, senderAddress, recipientAddress, docketId, executionDate);

  const mergedValues: Record<string, string> = {
    ...statutoryValues,
    ...normalized,
  };

  // 2. Build RE line and subject
  const reLine = replaceTokens(notice.reLineTemplate, mergedValues);

  // 3. Process paragraphs
  const parsedParagraphTokens: InterpolatedParagraphToken[][] = [];
  const rawParagraphs: string[] = [];

  for (const paragraphTemplate of notice.bodyParagraphs) {
    const evaluated = evaluateConditionals(paragraphTemplate, mergedValues);
    if (!evaluated.trim()) continue;

    // Tokenize for interactive preview
    const tokens = tokenizeParagraph(evaluated, notice, mergedValues);
    parsedParagraphTokens.push(tokens);

    // Build raw paragraph string for print
    const rawParagraph = replaceTokens(evaluated, mergedValues);
    rawParagraphs.push(rawParagraph);
  }

  // 4. Resolve addresses
  const s = getAddressFields(senderAddress);
  const r = getAddressFields(recipientAddress);

  const resolvedSender: DocketAddress = {
    name: mergedValues.senderFullName || s.name || '[SENDER NAME]',
    company: s.company || senderAddress.company,
    address_line1: s.line1 || userValues.senderAddressLine1 || mergedValues.leasedPremisesAddress || '[SENDER ADDRESS]',
    address_line2: s.line2 || undefined,
    address_city: s.city || userValues.senderCity || userValues.rentalCity || '',
    address_state: s.state || userValues.senderState || userValues.rentalState || userValues.propertyState || '',
    address_zip: s.zip || userValues.senderZip || userValues.rentalZip || '',
    address_country: 'US',
  };

  const resolvedRecipient: DocketAddress = {
    name: mergedValues.recipientFormalName || r.name || '[RECIPIENT NAME]',
    company: r.company || recipientAddress.company,
    address_line1: r.line1 || userValues.recipientAddressLine1 || '[RECIPIENT ADDRESS]',
    address_line2: r.line2 || undefined,
    address_city: r.city || userValues.recipientCity || '',
    address_state: r.state || userValues.recipientState || '',
    address_zip: r.zip || userValues.recipientZip || '',
    address_country: 'US',
  };

  const signerName = resolvedSender.name;
  const formalSignature = `/s/ ${signerName}`;

  return {
    docketId,
    noticeDefinition: notice,
    headerTitle: notice.documentHeaderTitle,
    reLine,
    senderAddress: resolvedSender,
    recipientAddress: resolvedRecipient,
    paragraphs: parsedParagraphTokens,
    rawParagraphs,
    enclosuresLine: notice.enclosuresLine,
    clerkStamp: {
      docketId,
      registryTitle: CLERK_DOCKET_REGISTRY_TITLE,
      timestampUtc: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      serviceLevel,
      cassStatus,
    },
    signatureBlock: {
      signerName,
      formalSignature,
      executionDate,
    },
  };
}

export const interpolateDocument = interpolateNotice;
