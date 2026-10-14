/**
 * Pre-Verified Corporate & Agency Recipient Registry
 *
 * Provides standardized, USPS-verified corporate legal notice and dispute addresses
 * for credit bureaus, debt validation entities, and non-fitness service providers.
 *
 * CRITICAL COMPLIANCE DIRECTIVE:
 * Strict Conflict-of-Interest Exclusion: Under NO circumstances may DocketStamp include
 * templates, pre-verified corporate addresses, or search results for gyms, health clubs,
 * fitness studios, or fitness membership billing (NAICS 713940).
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_SPEC.md (§3.1, §5)
 */

import { LobAddressInput } from "@/lib/fulfillment/lob";

export type RecipientCategory =
  | "CREDIT_BUREAU"
  | "COLLECTION_AGENCY"
  | "HOME_SECURITY"
  | "TELECOM"
  | "HOME_WARRANTY"
  | "INSURANCE"
  | "PEST_CONTROL";

export interface VerifiedRecipient {
  id: string;
  name: string;
  department: string;
  category: RecipientCategory;
  naicsCode: string; // Excludes 713940
  address: LobAddressInput;
  statutoryReference?: string;
  notes?: string;
  verifiedAt: string;
}

/**
 * Forbidden NAICS code for fitness and recreational sports centers.
 */
export const FORBIDDEN_FITNESS_NAICS = "713940";

const FORBIDDEN_FITNESS_KEYWORDS = [
  "gym",
  "fitness",
  "health club",
  "workout",
  "crossfit",
  "pilates",
  "equinox",
  "planet fitness",
  "la fitness",
  "anytime fitness",
  "gold's gym",
  "crunch fitness",
  "orange theory",
  "24 hour fitness",
  "f45",
  "lifetime fitness",
];

/**
 * Runtime guard asserting an entity does not violate the strict fitness conflict-of-interest exclusion.
 * Throws a fatal exception if any NAICS 713940 association or fitness keyword is detected.
 */
export function assertNotFitnessEntity(
  entity: Partial<VerifiedRecipient> | { name?: string; naicsCode?: string; category?: string }
): void {
  if (entity.naicsCode === FORBIDDEN_FITNESS_NAICS) {
    throw new Error(
      `[DocketStamp Compliance Violation] Entities under NAICS ${FORBIDDEN_FITNESS_NAICS} (Fitness and Recreational Sports Centers) are strictly prohibited.`
    );
  }

  const nameToCheck = (entity.name || "").toLowerCase();
  for (const keyword of FORBIDDEN_FITNESS_KEYWORDS) {
    if (nameToCheck.includes(keyword)) {
      throw new Error(
        `[DocketStamp Compliance Violation] Entity '${entity.name}' matches prohibited fitness conflict keyword '${keyword}'.`
      );
    }
  }
}

export const VERIFIED_RECIPIENTS: VerifiedRecipient[] = [
  // ============================================================================
  // 1. THE BIG 3 CREDIT REPORTING BUREAUS (FCRA § 611 Dispute Processing)
  // ============================================================================
  {
    id: "bureau-equifax",
    name: "Equifax Information Services LLC",
    department: "Consumer Dispute Center",
    category: "CREDIT_BUREAU",
    naicsCode: "561450", // Credit Bureaus
    address: {
      name: "Equifax Information Services LLC",
      company: "Consumer Dispute Center",
      address_line1: "P.O. Box 740256",
      address_city: "Atlanta",
      address_state: "GA",
      address_zip: "30374-0256",
    },
    statutoryReference: "15 U.S.C. § 1681i (FCRA § 611)",
    notes: "Requires consumer DOB, last 4 SSN, and specific account trade-lines disputed.",
    verifiedAt: "2026-10-14",
  },
  {
    id: "bureau-experian",
    name: "Experian",
    department: "National Consumer Dispute Center",
    category: "CREDIT_BUREAU",
    naicsCode: "561450", // Credit Bureaus
    address: {
      name: "Experian",
      company: "National Consumer Dispute Center",
      address_line1: "P.O. Box 4500",
      address_city: "Allen",
      address_state: "TX",
      address_zip: "75013",
    },
    statutoryReference: "15 U.S.C. § 1681i (FCRA § 611)",
    notes: "Requires consumer full name, current and prior addresses, and report dispute numbers.",
    verifiedAt: "2026-10-14",
  },
  {
    id: "bureau-transunion",
    name: "TransUnion Consumer Solutions",
    department: "Consumer Dispute Center",
    category: "CREDIT_BUREAU",
    naicsCode: "561450", // Credit Bureaus
    address: {
      name: "TransUnion Consumer Solutions",
      company: "Consumer Dispute Center",
      address_line1: "P.O. Box 2000",
      address_city: "Chester",
      address_state: "PA",
      address_zip: "19016-2000",
    },
    statutoryReference: "15 U.S.C. § 1681i (FCRA § 611)",
    notes: "Disputes processed within 30 days of confirmed physical delivery.",
    verifiedAt: "2026-10-14",
  },

  // ============================================================================
  // 2. HOME SECURITY CONTRACT CANCELLATIONS
  // ============================================================================
  {
    id: "sec-adt",
    name: "ADT Security Services",
    department: "Contract Notice & Written Cancellation Dept",
    category: "HOME_SECURITY",
    naicsCode: "561621", // Security Systems Services
    address: {
      name: "ADT Security Services",
      company: "Customer Care Operations",
      address_line1: "1501 Yamato Rd",
      address_city: "Boca Raton",
      address_state: "FL",
      address_zip: "33431",
    },
    notes: "Provide account number, verbal cancellation password (if known), and billing address.",
    verifiedAt: "2026-10-14",
  },
  {
    id: "sec-vivint",
    name: "Vivint Smart Home, Inc.",
    department: "Notice of Cancellation Processing",
    category: "HOME_SECURITY",
    naicsCode: "561621",
    address: {
      name: "Vivint Smart Home, Inc.",
      company: "Legal / Cancellation Dept",
      address_line1: "4931 N 300 W",
      address_city: "Provo",
      address_state: "UT",
      address_zip: "84604",
    },
    notes: "Requires account ID and customer signature.",
    verifiedAt: "2026-10-14",
  },

  // ============================================================================
  // 3. TELECOM & UTILITIES WRITTEN NOTICE
  // ============================================================================
  {
    id: "tel-comcast",
    name: "Comcast / Xfinity",
    department: "Customer Operations & Formal Notices",
    category: "TELECOM",
    naicsCode: "517111", // Wired Telecommunications Carriers
    address: {
      name: "Comcast Cable",
      company: "Customer Support Notice Center",
      address_line1: "1701 John F Kennedy Blvd",
      address_city: "Philadelphia",
      address_state: "PA",
      address_zip: "19103",
    },
    notes: "Include 16-digit account number and service address.",
    verifiedAt: "2026-10-14",
  },
  {
    id: "tel-charter",
    name: "Charter Communications / Spectrum",
    department: "Formal Customer Dispute & Cancellation Dept",
    category: "TELECOM",
    naicsCode: "517111",
    address: {
      name: "Charter Communications",
      company: "Spectrum Corporate Notice Processing",
      address_line1: "400 Atlantic St",
      address_city: "Stamford",
      address_state: "CT",
      address_zip: "06901",
    },
    notes: "Include account number and billing address.",
    verifiedAt: "2026-10-14",
  },

  // ============================================================================
  // 4. HOME WARRANTY CANCELLATION
  // ============================================================================
  {
    id: "war-ahs",
    name: "American Home Shield",
    department: "Customer Cancellation Operations",
    category: "HOME_WARRANTY",
    naicsCode: "524128", // Other Direct Property and Casualty Insurance
    address: {
      name: "American Home Shield Corporation",
      company: "Contract Review Department",
      address_line1: "889 Ridge Lake Blvd",
      address_city: "Memphis",
      address_state: "TN",
      address_zip: "38120",
    },
    notes: "Include contract agreement number and property address.",
    verifiedAt: "2026-10-14",
  },

  // ============================================================================
  // 5. PEST CONTROL CONTRACT CANCELLATION
  // ============================================================================
  {
    id: "pest-terminix",
    name: "Terminix International",
    department: "Service Agreement Cancellation Dept",
    category: "PEST_CONTROL",
    naicsCode: "561710", // Exterminating and Pest Control Services
    address: {
      name: "The Terminix International Company LP",
      company: "Customer Care Operations",
      address_line1: "150 Peabody Pl",
      address_city: "Memphis",
      address_state: "TN",
      address_zip: "38103",
    },
    notes: "Include customer agreement/account number and service property address.",
    verifiedAt: "2026-10-14",
  },
];

// Execute static initialization validation on all registered recipients
for (const recipient of VERIFIED_RECIPIENTS) {
  assertNotFitnessEntity(recipient);
}

/**
 * Searches the verified recipient registry while enforcing runtime conflict checks.
 */
export function searchVerifiedRecipients(
  query: string,
  category?: RecipientCategory
): VerifiedRecipient[] {
  if (!query && !category) return VERIFIED_RECIPIENTS;

  const normalized = query.trim().toLowerCase();

  return VERIFIED_RECIPIENTS.filter((item) => {
    // Safety check on every evaluated item
    assertNotFitnessEntity(item);

    if (category && item.category !== category) {
      return false;
    }

    if (!normalized) return true;

    return (
      item.name.toLowerCase().includes(normalized) ||
      item.department.toLowerCase().includes(normalized) ||
      item.address.address_city.toLowerCase().includes(normalized) ||
      item.address.address_state.toLowerCase().includes(normalized)
    );
  });
}
