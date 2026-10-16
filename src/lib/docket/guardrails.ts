/**
 * DocketStamp System Guardrails & Statutory Disclosures
 *
 * 1. Strict Conflict-of-Interest Exclusion (NAICS 713940)
 *    Under NO circumstances may DocketStamp include templates, landing pages,
 *    SEO keywords, or pre-verified corporate addresses for gyms, health clubs,
 *    fitness studios, or fitness membership billing (NAICS 713940).
 *
 * 2. UPL-Safe Form Letter Positioning
 *    DocketStamp is an automated self-help document preparation and USPS postal dispatch utility,
 *    NOT a law firm. All templates are deterministic form instruments where the user
 *    selects factual parameters. No open-ended AI legal advice.
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md (§1, §5.2)
 * - ARCHITECTURE.md
 */

export const FORBIDDEN_FITNESS_NAICS = '713940';

export const FORBIDDEN_FITNESS_PATTERNS = [
  /\bequinox\b/i,
  /\bplanet\s*fitness\b/i,
  /\bla\s*fitness\b/i,
  /\bcrunch\s*(fitness)?\b/i,
  /\borange\s*theory\b/i,
  /\borangetheory\b/i,
  /\bymca\b/i,
  /\banytime\s*fitness\b/i,
  /\bgold'?s\s*gym\b/i,
  /\b24\s*hour\s*fitness\b/i,
  /\blifetime\s*fitness\b/i,
  /\blife\s*time\s*athletic\b/i,
  /\bf45(\s*training)?\b/i,
  /\bpure\s*barre\b/i,
  /\bbarre\b/i,
  /\bsoulcycle\b/i,
  /\babc\s*fitness\b/i,
  /\babc\s*financial\b/i,
  /\bgym\s*membership\b/i,
  /\bgym\b/i,
  /\bfitness\s+(club|center|studio|facility|franchise|international)\b/i,
  /\b(club|center|studio|gym)\s+fitness\b/i,
  /\bhealth\s*club\b/i,
  /\bworkout\s*(facility|center|studio|club|gym)\b/i,
  /\bcrossfit\b/i,
  /\bpilates\b/i,
  /\byoga\s*studio\b/i,
  /\bboxing\s*gym\b/i,
  /\bclimbing\s*gym\b/i,
  /\bathletic\s*club\b/i,
  /\bsports\s*club\b/i,
  /\bswim\s*club\b/i,
  /\bpersonal\s*training\b/i,
];

export const HARDWARE_OEM_ALLOWLIST_PATTERNS = [
  /\bwithings\b/i,
  /\bgarmin\b/i,
  /\becobee\b/i,
  /\blg(\s+electronics|\s+usa)?\b/i,
  /\bsamsung(\s+electronics)?\b/i,
  /\bcanon(\s+usa)?\b/i,
  /\bsonos\b/i,
  /\broku\b/i,
  /\btesla\b/i,
  /\bfitbit\b/i,
  /\bapple\b/i,
  /\bgoogle\b/i,
  /\bwhoop\b/i,
  /\boura\b/i,
];

export const FORBIDDEN_FITNESS_KEYWORDS = [
  'gym',
  'fitness club',
  'fitness center',
  'fitness studio',
  'health club',
  'workout facility',
  'crossfit',
  'pilates',
  'equinox',
  'planet fitness',
  'la fitness',
  'anytime fitness',
  'gold\'s gym',
  'crunch fitness',
  'orange theory',
  'orangetheory',
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

export class ConflictOfInterestError extends Error {
  public code = 'CONFLICT_OF_INTEREST_FITNESS_EXCLUSION';
  constructor(message = 'This recipient or contract category (Fitness / Health Clubs) is not supported on DocketStamp.') {
    super(message);
    this.name = 'ConflictOfInterestError';
  }
}

// Backward-compatible alias for existing test suites
export const FitnessEntityProhibitedError = ConflictOfInterestError;

/**
 * Runtime guard that verifies an entity is NOT a gym, fitness center, or recreational club (NAICS 713940).
 * Throws ConflictOfInterestError if a conflict is detected.
 * Strictly blocks physical gym/health-club facilities while permitting consumer electronics
 * and connected hardware OEMs/products (Withings, Garmin, Ecobee, LG, Samsung, Canon, Sonos, Roku, Tesla, etc.).
 */
export function assertNonFitnessEntity(
  input: string | Record<string, unknown>,
  naicsCode?: string
): void {
  let serialized = '';
  let entityNaics = naicsCode;

  if (typeof input === 'string') {
    serialized = input;
  } else if (input && typeof input === 'object') {
    const obj = input as Record<string, any>;
    if (obj.naicsCode) entityNaics = String(obj.naicsCode);
    if (obj.naics) entityNaics = String(obj.naics);
    serialized = JSON.stringify(input);
  }

  // Strict NAICS 713940 check (Fitness and Recreational Sports Centers)
  if (entityNaics && entityNaics.trim() === FORBIDDEN_FITNESS_NAICS) {
    throw new ConflictOfInterestError(
      `Compliance Policy Exclusion: Matches prohibited fitness entity category (NAICS 713940). DocketStamp strictly excludes gym and fitness membership dispatch.`
    );
  }

  const isHardwareOem = HARDWARE_OEM_ALLOWLIST_PATTERNS.some((p) => p.test(serialized));

  for (const pattern of FORBIDDEN_FITNESS_PATTERNS) {
    if (pattern.test(serialized)) {
      // If an allowed hardware OEM or product is referenced, only block if it also explicitly
      // matches a known physical fitness chain or facility
      const isExplicitGymChain = [
        /\bequinox\b/i,
        /\bplanet\s*fitness\b/i,
        /\bla\s*fitness\b/i,
        /\bcrunch\s*(fitness)?\b/i,
        /\borange\s*theory\b/i,
        /\borangetheory\b/i,
        /\bymca\b/i,
        /\banytime\s*fitness\b/i,
        /\bgold'?s\s*gym\b/i,
        /\b24\s*hour\s*fitness\b/i,
        /\blifetime\s*fitness\b/i,
        /\blife\s*time\s*athletic\b/i,
        /\bf45(\s*training)?\b/i,
        /\bpure\s*barre\b/i,
        /\bsoulcycle\b/i,
        /\babc\s*fitness\b/i,
        /\babc\s*financial\b/i,
        /\bgym\s*membership\b/i,
      ].some((chain) => chain.test(serialized));

      if (isHardwareOem && !isExplicitGymChain) {
        continue;
      }

      throw new ConflictOfInterestError(
        `Compliance Policy Exclusion: Input matches prohibited fitness entity category (NAICS 713940). DocketStamp strictly excludes gym and fitness membership dispatch.`
      );
    }
  }
}

export const assertNotFitnessEntity = assertNonFitnessEntity;

/**
 * Checks if a name or entity represents a prohibited fitness entity without throwing.
 */
export function isFitnessEntity(
  input: string | Record<string, unknown>,
  naicsCode?: string
): boolean {
  try {
    assertNonFitnessEntity(input, naicsCode);
    return false;
  } catch {
    return true;
  }
}

/**
 * Exact UPL Statutory Compliance Footer specified in §1 Invariant 2 & §5.2.
 */
export const UPL_COMPLIANCE_FOOTER_TEXT = (docketId: string): string =>
  `DOCKET RECORD & DISPATCH CERTIFICATION: Prepared and dispatched via DocketStamp.com (Docket ID: ${docketId}). DocketStamp is an automated self-help document preparation and USPS postal dispatch utility, not a law firm, and does not provide legal representation or legal advice.`;

/**
 * Mandatory UPL statutory disclosure text.
 */
export const UPL_COMPLIANCE_DISCLOSURE =
  'DocketStamp is an automated self-help document preparation and USPS postal dispatch utility, not a law firm, and does not provide legal representation or legal advice. All templates are deterministic form instruments based on user-provided factual parameters. Use of DocketStamp is subject to our Terms of Service and Privacy Policy.';

export const STATUTORY_COMPLIANCE_DISCLOSURE = UPL_COMPLIANCE_DISCLOSURE;

export const UPL_SHORT_BADGE =
  'SELF-HELP DOCUMENT DISPATCH UTILITY • NOT LEGAL ADVICE';

export const CLERK_DOCKET_REGISTRY_TITLE =
  'DOCKETSTAMP™ OFFICIAL DISPATCH REGISTRY';
