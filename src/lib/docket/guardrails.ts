/**
 * DocketStamp System Guardrails & Statutory Disclosures
 *
 * 1. Strict Conflict-of-Interest Exclusion (NAICS 713940)
 *    Under NO circumstances may DocketStamp include templates, landing pages,
 *    SEO keywords, or pre-verified corporate addresses for gyms, health clubs,
 *    fitness studios, or fitness membership billing (NAICS 713940).
 *
 * 2. UPL-Safe Form Letter Positioning
 *    DocketStamp is a self-help document preparation and USPS postal dispatch utility,
 *    NOT a law firm. All templates are deterministic form instruments where the user
 *    selects factual parameters. No open-ended AI legal advice.
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_SPEC.md (§3.1, §3.2)
 * - docs/DESIGN_SYSTEM.md (§1)
 */

export const FORBIDDEN_FITNESS_NAICS = '713940';

export const FORBIDDEN_FITNESS_KEYWORDS = [
  'gym',
  'fitness',
  'health club',
  'workout',
  'crossfit',
  'pilates',
  'equinox',
  'planet fitness',
  'la fitness',
  'anytime fitness',
  'gold\'s gym',
  'crunch fitness',
  'orange theory',
  '24 hour fitness',
  'f45',
  'lifetime fitness',
  'club fitness',
  'barre',
  'yoga studio',
  'boxing gym',
  'climbing gym',
  'athletic club',
  'sports club',
  'swim club',
  'personal training',
  'gym membership',
] as const;

export class FitnessEntityProhibitedError extends Error {
  public code = 'FITNESS_ENTITY_PROHIBITED';
  constructor(entityName: string) {
    super(
      `Compliance Policy Exclusion: "${entityName}" matches prohibited fitness entity category (NAICS 713940). DocketStamp strictly excludes gym and fitness membership dispatch.`
    );
    this.name = 'FitnessEntityProhibitedError';
  }
}

/**
 * Runtime guard that verifies an entity is NOT a gym, fitness center, or recreational club.
 * Throws FitnessEntityProhibitedError if a conflict is detected.
 */
/**
 * Runtime guard that verifies an entity is NOT a gym, fitness center, or recreational club.
 * Throws FitnessEntityProhibitedError if a conflict is detected.
 */
export function assertNotFitnessEntity(
  nameOrEntity: string | { name?: string; naicsCode?: string },
  naicsCode?: string
): void {
  const name = typeof nameOrEntity === 'string' ? nameOrEntity : (nameOrEntity?.name || '');
  const naics = typeof nameOrEntity === 'string' ? naicsCode : (nameOrEntity?.naicsCode || naicsCode);

  if (naics && naics.trim() === FORBIDDEN_FITNESS_NAICS) {
    throw new FitnessEntityProhibitedError(name);
  }

  const normalized = (name || '').toLowerCase().trim();
  for (const kw of FORBIDDEN_FITNESS_KEYWORDS) {
    // Word-boundary or token match to prevent false positives while catching all fitness centers
    const regex = new RegExp(`(^|\\b|\\s)${kw.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(\\b|\\s|$)`, 'i');
    if (regex.test(normalized)) {
      throw new FitnessEntityProhibitedError(name);
    }
  }
}

export const assertNonFitnessEntity = assertNotFitnessEntity;

/**
 * Checks if a name represents a prohibited fitness entity without throwing.
 */
export function isFitnessEntity(
  nameOrEntity: string | { name?: string; naicsCode?: string },
  naicsCode?: string
): boolean {
  try {
    assertNotFitnessEntity(nameOrEntity, naicsCode);
    return false;
  } catch {
    return true;
  }
}

/**
 * Mandatory 8pt UPL statutory footer disclosure displayed on every page,
 * document preview, physical print footer, and checkout step.
 */
export const UPL_COMPLIANCE_DISCLOSURE =
  'DocketStamp is a self-help document preparation and USPS postal dispatch utility, not a law firm. DocketStamp does not provide legal advice, legal representation, or lawyer referral services. All templates are deterministic form instruments based on user-provided factual parameters. Use of DocketStamp is subject to our Terms of Service and Privacy Policy.';

export const UPL_SHORT_BADGE =
  'SELF-HELP DOCUMENT DISPATCH UTILITY • NOT LEGAL ADVICE';

export const CLERK_DOCKET_REGISTRY_TITLE =
  'DOCKETSTAMP™ OFFICIAL DISPATCH REGISTRY';
