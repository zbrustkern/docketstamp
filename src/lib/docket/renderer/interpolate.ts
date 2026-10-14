/**
 * Document Interpolation Engine
 *
 * Pure function: merges user form values + state statutory lookups into an
 * InterpolatedDocument AST ready for interactive React canvas preview
 * and Lob 8.5x11 physical print rendering.
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_SPEC.md (§2, §3, §5)
 * - docs/DESIGN_SYSTEM.md (§2, §3)
 */

import {
  NoticeTemplateDefinition,
  InterpolatedDocument,
  InterpolatedParagraphToken,
  DocketAddress,
  MailTierId,
} from '../types';
import { getSecurityDepositStatute } from '../data/state-statutes';
import { CLERK_DOCKET_REGISTRY_TITLE } from '../guardrails';

export interface InterpolateOptions {
  notice: NoticeTemplateDefinition;
  userValues: Record<string, string>;
  docketId?: string;
  serviceLevel?: MailTierId;
  cassStatus?: string;
  executionDate?: string;
  senderAddress?: Partial<DocketAddress>;
  recipientAddress?: Partial<DocketAddress>;
}

/**
 * Generates a standard DocketStamp docket identifier: DS-2026-XXXXX
 */
export function generateDocketId(seed?: string): string {
  if (seed && seed.startsWith('DS-')) return seed;
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 5; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `DS-2026-${rand}`;
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
    const rawState = userValues.rentalState || userValues.state || '';
    const stateCode = rawState.trim().toUpperCase();
    const statute = getSecurityDepositStatute(stateCode);

    if (statute) {
      result.statutoryCitation = statute.statutoryCitation;
      result.returnDeadlineDays = String(statute.returnDeadlineDays);
      result.penaltyClause = statute.penaltyClause;
      result.statuteSummary = statute.statuteSummary;
      result.stateName = statute.stateName;
    } else {
      result.statutoryCitation = 'Governing State Security Deposit Statute';
      result.returnDeadlineDays = '30';
      result.penaltyClause = 'Statutory damages and bad-faith penalties provided under applicable state law';
      result.statuteSummary = 'State statutory accounting and return regulations';
      result.stateName = stateCode || 'Governing Jurisdiction';
    }
  }

  return result;
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
 * Tokenizes a paragraph string into sequential text and variable tokens.
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
    const isFilled = typeof userVal === 'string' && userVal.trim().length > 0;

    tokens.push({
      type: 'variable',
      key: variableKey,
      content: isFilled ? userVal : '',
      docusignTagLabel: fieldConfig?.docusignTagLabel || variableKey.toUpperCase(),
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
    return values[key] || `[${key.toUpperCase()}]`;
  });
}

/**
 * Primary Interpolation Entrypoint
 */
export function interpolateDocument(options: InterpolateOptions): InterpolatedDocument {
  const {
    notice,
    userValues,
    docketId = generateDocketId(),
    serviceLevel = notice.recommendedTier,
    cassStatus = 'CASS ADDRESS VERIFIED',
    executionDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    senderAddress = {},
    recipientAddress = {},
  } = options;

  // 1. Merge statutory lookups with user values
  const statutoryValues = resolveStatutoryValues(notice, userValues);
  const mergedValues: Record<string, string> = {
    ...statutoryValues,
    ...userValues,
  };

  // 2. Build RE line and subject
  const reLine = replaceTokens(notice.reLineTemplate, mergedValues);

  // 3. Process paragraphs
  const parsedParagraphTokens: InterpolatedParagraphToken[][] = [];
  const rawParagraphs: string[] = [];

  for (const paragraphTemplate of notice.bodyParagraphs) {
    // Evaluate conditionals first
    const evaluated = evaluateConditionals(paragraphTemplate, mergedValues);
    if (!evaluated.trim()) continue;

    // Tokenize for interactive preview
    const tokens = tokenizeParagraph(evaluated, notice, mergedValues);
    parsedParagraphTokens.push(tokens);

    // Build raw paragraph string for print
    const rawParagraph = replaceTokens(evaluated, mergedValues);
    rawParagraphs.push(rawParagraph);
  }

  // 4. Resolve sender and recipient addresses
  const resolvedSender: DocketAddress = {
    name: senderAddress.name || userValues.tenantFullName || userValues.consumerFullName || userValues.customerFullName || '[SENDER NAME]',
    company: senderAddress.company,
    address_line1: senderAddress.address_line1 || userValues.rentalPropertyAddress || userValues.consumerAddress || userValues.customerAddress || '[SENDER ADDRESS]',
    address_line2: senderAddress.address_line2,
    address_city: senderAddress.address_city || userValues.rentalCity || '',
    address_state: senderAddress.address_state || userValues.rentalState || '',
    address_zip: senderAddress.address_zip || userValues.rentalZip || '',
    address_country: senderAddress.address_country || 'US',
  };

  const resolvedRecipient: DocketAddress = {
    name: recipientAddress.name || userValues.landlordOrManagerName || userValues.targetBureau || userValues.collectionAgencyName || userValues.serviceProviderName || '[RECIPIENT NAME]',
    company: recipientAddress.company,
    address_line1: recipientAddress.address_line1 || '[RECIPIENT ADDRESS]',
    address_line2: recipientAddress.address_line2,
    address_city: recipientAddress.address_city || '',
    address_state: recipientAddress.address_state || '',
    address_zip: recipientAddress.address_zip || '',
    address_country: recipientAddress.address_country || 'US',
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
