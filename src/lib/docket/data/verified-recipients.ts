/**
 * Pre-Verified Corporate & Agency Institutional Recipient Registry
 *
 * 30+ Standardized, USPS-verified corporate legal notice and dispute addresses
 * for credit reporting agencies, debt validation buyers/collectors, and non-fitness
 * service providers (telecom, security, warranty, insurance, pest control).
 *
 * CRITICAL COMPLIANCE DIRECTIVE:
 * Strict Conflict-of-Interest Exclusion: Under NO circumstances may DocketStamp include
 * templates, pre-verified corporate addresses, or search results for gyms, health clubs,
 * fitness studios, or fitness membership billing (NAICS 713940).
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_SPEC.md (§3.1, §5)
 * - docs/DESIGN_SYSTEM.md (§1)
 */

import { VerifiedRecipientEntity } from '../types';
import { assertNotFitnessEntity } from '../guardrails';

export const VERIFIED_RECIPIENTS: VerifiedRecipientEntity[] = [
  // ============================================================================
  // 1. THE BIG 4 CREDIT REPORTING AGENCIES (FCRA § 611 / 15 U.S.C. § 1681i)
  // ============================================================================
  {
    id: 'bureau-equifax',
    name: 'Equifax Information Services LLC',
    department: 'Consumer Dispute Center',
    category: 'CREDIT_BUREAU',
    naicsCode: '561450',
    address: {
      name: 'Equifax Information Services LLC',
      company: 'Consumer Dispute Center',
      address_line1: 'P.O. Box 740256',
      address_city: 'Atlanta',
      address_state: 'GA',
      address_zip: '30374-0256',
      address_country: 'US',
    },
    statutoryReference: '15 U.S.C. § 1681i (FCRA § 611)',
    notes: 'Include full legal name, DOB, SSN (last 4), proof of current address, and disputed account numbers.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'bureau-experian',
    name: 'Experian',
    department: 'National Consumer Dispute Center',
    category: 'CREDIT_BUREAU',
    naicsCode: '561450',
    address: {
      name: 'Experian',
      company: 'National Consumer Dispute Center',
      address_line1: 'P.O. Box 4500',
      address_city: 'Allen',
      address_state: 'TX',
      address_zip: '75013',
      address_country: 'US',
    },
    statutoryReference: '15 U.S.C. § 1681i (FCRA § 611)',
    notes: 'Include full legal name, current and prior addresses (2 years), report dispute reference number if available.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'bureau-transunion',
    name: 'TransUnion Consumer Solutions',
    department: 'Consumer Dispute Center',
    category: 'CREDIT_BUREAU',
    naicsCode: '561450',
    address: {
      name: 'TransUnion Consumer Solutions',
      company: 'Consumer Dispute Center',
      address_line1: 'P.O. Box 2000',
      address_city: 'Chester',
      address_state: 'PA',
      address_zip: '19016-2000',
      address_country: 'US',
    },
    statutoryReference: '15 U.S.C. § 1681i (FCRA § 611)',
    notes: 'Disputes processed within statutory 30-day window upon physical receipt.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'bureau-innovis',
    name: 'Innovis Consumer Assistance',
    department: 'Dispute Department',
    category: 'CREDIT_BUREAU',
    naicsCode: '561450',
    address: {
      name: 'Innovis Consumer Assistance',
      company: 'Dispute Department',
      address_line1: 'P.O. Box 530088',
      address_city: 'Atlanta',
      address_state: 'GA',
      address_zip: '30353-0088',
      address_country: 'US',
    },
    statutoryReference: '15 U.S.C. § 1681i (FCRA § 611)',
    notes: 'Secondary consumer credit reporting agency; includes utility and mortgage data.',
    verifiedAt: '2026-10-14',
  },

  // ============================================================================
  // 2. TOP DEBT COLLECTORS & BUYERS (FDCPA 15 U.S.C. § 1692g Validation)
  // ============================================================================
  {
    id: 'debt-pra',
    name: 'Portfolio Recovery Associates, LLC',
    department: 'Disputes & Validation Department',
    category: 'COLLECTION_AGENCY',
    naicsCode: '561440',
    address: {
      name: 'Portfolio Recovery Associates, LLC',
      company: 'Disputes & Debt Validation Dept',
      address_line1: '120 Corporate Blvd',
      address_city: 'Norfolk',
      address_state: 'VA',
      address_zip: '23502',
      address_country: 'US',
    },
    statutoryReference: '15 U.S.C. § 1692g (FDCPA § 809)',
    notes: 'Largest U.S. debt buyer. Cease collection activities upon receipt pending verification.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'debt-midland',
    name: 'Midland Credit Management, Inc.',
    department: 'Consumer Support & Disputes',
    category: 'COLLECTION_AGENCY',
    naicsCode: '561440',
    address: {
      name: 'Midland Credit Management, Inc.',
      company: 'Consumer Support Division',
      address_line1: 'P.O. Box 939069',
      address_city: 'San Diego',
      address_state: 'CA',
      address_zip: '92193-9069',
      address_country: 'US',
    },
    statutoryReference: '15 U.S.C. § 1692g (FDCPA § 809)',
    notes: 'Subsidiary of Encore Capital Group. Include MCM 12-digit account number.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'debt-erc',
    name: 'Enhanced Recovery Company, LLC (ERC)',
    department: 'Compliance and Legal Notices',
    category: 'COLLECTION_AGENCY',
    naicsCode: '561440',
    address: {
      name: 'Enhanced Recovery Company, LLC',
      company: 'Compliance / Dispute Operations',
      address_line1: '8014 Bayberry Rd',
      address_city: 'Jacksonville',
      address_state: 'FL',
      address_zip: '32256',
      address_country: 'US',
    },
    statutoryReference: '15 U.S.C. § 1692g (FDCPA § 809)',
    notes: 'Telecom and utility third-party collection agency.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'debt-cavalry',
    name: 'Cavalry Portfolio Services, LLC',
    department: 'Consumer Disputes & Verification',
    category: 'COLLECTION_AGENCY',
    naicsCode: '561440',
    address: {
      name: 'Cavalry Portfolio Services, LLC',
      company: 'Consumer Disputes Dept',
      address_line1: '500 Summit Lake Dr Ste 400',
      address_city: 'Valhalla',
      address_state: 'NY',
      address_zip: '10595',
      address_country: 'US',
    },
    statutoryReference: '15 U.S.C. § 1692g (FDCPA § 809)',
    notes: 'Consumer credit card debt purchaser.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'debt-tsi',
    name: 'Transworld Systems Inc. (TSI)',
    department: 'Dispute Resolution Center',
    category: 'COLLECTION_AGENCY',
    naicsCode: '561440',
    address: {
      name: 'Transworld Systems Inc.',
      company: 'Dispute Resolution Center',
      address_line1: 'P.O. Box 15618',
      address_city: 'Wilmington',
      address_state: 'DE',
      address_zip: '19850',
      address_country: 'US',
    },
    statutoryReference: '15 U.S.C. § 1692g (FDCPA § 809)',
    notes: 'Student loan, medical, and commercial third-party collection.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'debt-jefferson',
    name: 'Jefferson Capital Systems, LLC',
    department: 'Compliance and Legal Notices',
    category: 'COLLECTION_AGENCY',
    naicsCode: '561440',
    address: {
      name: 'Jefferson Capital Systems, LLC',
      company: 'Legal Notices & Dispute Dept',
      address_line1: '16 McLeland Rd',
      address_city: 'St. Cloud',
      address_state: 'MN',
      address_zip: '56303',
      address_country: 'US',
    },
    statutoryReference: '15 U.S.C. § 1692g (FDCPA § 809)',
    notes: 'Major debt buyer of charged-off consumer credit accounts.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'debt-resurgent',
    name: 'Resurgent Capital Services LP (LVNV Funding)',
    department: 'Compliance and Legal Notices',
    category: 'COLLECTION_AGENCY',
    naicsCode: '561440',
    address: {
      name: 'Resurgent Capital Services LP',
      company: 'Dispute Resolution Department',
      address_line1: 'P.O. Box 10497',
      address_city: 'Greenville',
      address_state: 'SC',
      address_zip: '29603',
      address_country: 'US',
    },
    statutoryReference: '15 U.S.C. § 1692g (FDCPA § 809)',
    notes: 'Servicer for LVNV Funding LLC and Sherman Originator accounts.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'debt-radius',
    name: 'Radius Global Solutions LLC',
    department: 'Consumer Disputes Department',
    category: 'COLLECTION_AGENCY',
    naicsCode: '561440',
    address: {
      name: 'Radius Global Solutions LLC',
      company: 'Consumer Disputes Dept',
      address_line1: 'P.O. Box 390846',
      address_city: 'Minneapolis',
      address_state: 'MN',
      address_zip: '55439',
      address_country: 'US',
    },
    statutoryReference: '15 U.S.C. § 1692g (FDCPA § 809)',
    notes: 'Third party collection agency for retail, financial, and telecom.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'debt-icsystem',
    name: 'I.C. System, Inc.',
    department: 'Disputes & Validation Dept',
    category: 'COLLECTION_AGENCY',
    naicsCode: '561440',
    address: {
      name: 'I.C. System, Inc.',
      company: 'Dispute Processing',
      address_line1: '444 Highway 96 E',
      address_city: 'St. Paul',
      address_state: 'MN',
      address_zip: '55127',
      address_country: 'US',
    },
    statutoryReference: '15 U.S.C. § 1692g (FDCPA § 809)',
    notes: 'Healthcare, telecom, and utility collections.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'debt-fncb',
    name: 'First National Collection Bureau, Inc. (FNCB)',
    department: 'Compliance and Legal Notices',
    category: 'COLLECTION_AGENCY',
    naicsCode: '561440',
    address: {
      name: 'First National Collection Bureau, Inc.',
      company: 'Disputes / Legal Dept',
      address_line1: '610 Waltham Way',
      address_city: 'Sparks',
      address_state: 'NV',
      address_zip: '89434',
      address_country: 'US',
    },
    statutoryReference: '15 U.S.C. § 1692g (FDCPA § 809)',
    notes: 'National collection agency for consumer credit.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'debt-creditcontrol',
    name: 'Credit Control, LLC',
    department: 'Consumer Inquiries & Disputes',
    category: 'COLLECTION_AGENCY',
    naicsCode: '561440',
    address: {
      name: 'Credit Control, LLC',
      company: 'Consumer Relations',
      address_line1: '5757 Phantom Dr Ste 330',
      address_city: 'Hazelwood',
      address_state: 'MO',
      address_zip: '63042',
      address_country: 'US',
    },
    statutoryReference: '15 U.S.C. § 1692g (FDCPA § 809)',
    notes: 'National consumer and commercial debt collections.',
    verifiedAt: '2026-10-14',
  },

  // ============================================================================
  // 3. TELECOM & UTILITIES WRITTEN CANCELLATIONS (Non-fitness)
  // ============================================================================
  {
    id: 'tel-comcast',
    name: 'Comcast / Xfinity',
    department: 'Customer Operations & Formal Notices',
    category: 'TELECOM',
    naicsCode: '517111',
    address: {
      name: 'Comcast Cable',
      company: 'Customer Support Notice Center',
      address_line1: '1701 John F Kennedy Blvd',
      address_city: 'Philadelphia',
      address_state: 'PA',
      address_zip: '19103',
      address_country: 'US',
    },
    notes: 'Include 16-digit account number and service address.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'tel-charter',
    name: 'Charter Communications / Spectrum',
    department: 'Formal Customer Dispute & Cancellation Dept',
    category: 'TELECOM',
    naicsCode: '517111',
    address: {
      name: 'Charter Communications',
      company: 'Spectrum Corporate Notice Processing',
      address_line1: '400 Atlantic St',
      address_city: 'Stamford',
      address_state: 'CT',
      address_zip: '06901',
      address_country: 'US',
    },
    notes: 'Include account number and billing address.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'tel-att',
    name: 'AT&T Inc.',
    department: 'Written Customer Notice & Escalations',
    category: 'TELECOM',
    naicsCode: '517111',
    address: {
      name: 'AT&T Inc.',
      company: 'Written Customer Inquiries',
      address_line1: '208 S Akard St',
      address_city: 'Dallas',
      address_state: 'TX',
      address_zip: '75202',
      address_country: 'US',
    },
    notes: 'Include AT&T BAN (Billing Account Number) and phone/service line ID.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'tel-verizon',
    name: 'Verizon Communications',
    department: 'Legal Correspondence & Written Cancellation',
    category: 'TELECOM',
    naicsCode: '517111',
    address: {
      name: 'Verizon Communications',
      company: 'Notice Correspondence Dept',
      address_line1: '1095 Avenue of the Americas',
      address_city: 'New York',
      address_state: 'NY',
      address_zip: '10036',
      address_country: 'US',
    },
    notes: 'Include account number, mobile number, and account PIN.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'tel-tmobile',
    name: 'T-Mobile USA, Inc.',
    department: 'Executive Customer Relations / Cancellation',
    category: 'TELECOM',
    naicsCode: '517112',
    address: {
      name: 'T-Mobile USA, Inc.',
      company: 'Executive Customer Relations',
      address_line1: '12920 SE 38th St',
      address_city: 'Bellevue',
      address_state: 'WA',
      address_zip: '98006',
      address_country: 'US',
    },
    notes: 'Include 9-digit account number and account holder name.',
    verifiedAt: '2026-10-14',
  },

  // ============================================================================
  // 4. HOME SECURITY CONTRACT CANCELLATIONS
  // ============================================================================
  {
    id: 'sec-adt',
    name: 'ADT Security Services',
    department: 'Contract Notice & Written Cancellation Dept',
    category: 'HOME_SECURITY',
    naicsCode: '561621',
    address: {
      name: 'ADT Security Services',
      company: 'Customer Care Operations',
      address_line1: '1501 Yamato Rd',
      address_city: 'Boca Raton',
      address_state: 'FL',
      address_zip: '33431',
      address_country: 'US',
    },
    notes: 'Provide account number, verbal cancellation password (if known), and billing address.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'sec-vivint',
    name: 'Vivint Smart Home, Inc.',
    department: 'Notice of Cancellation Processing',
    category: 'HOME_SECURITY',
    naicsCode: '561621',
    address: {
      name: 'Vivint Smart Home, Inc.',
      company: 'Legal / Cancellation Dept',
      address_line1: '4931 N 300 W',
      address_city: 'Provo',
      address_state: 'UT',
      address_zip: '84604',
      address_country: 'US',
    },
    notes: 'Requires account ID and customer signature.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'sec-simplisafe',
    name: 'SimpliSafe, Inc.',
    department: 'Written Customer Agreement Support',
    category: 'HOME_SECURITY',
    naicsCode: '561621',
    address: {
      name: 'SimpliSafe, Inc.',
      company: 'Customer Care Notices',
      address_line1: '294 Washington St Fl 9',
      address_city: 'Boston',
      address_state: 'MA',
      address_zip: '02108',
      address_country: 'US',
    },
    notes: 'Include base station serial number and primary email.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'sec-frontpoint',
    name: 'Frontpoint Security Solutions',
    department: 'Customer Cancellation Notice Dept',
    category: 'HOME_SECURITY',
    naicsCode: '561621',
    address: {
      name: 'Frontpoint Security Solutions, LLC',
      company: 'Account Notice Processing',
      address_line1: '1595 Spring Hill Rd Ste 500',
      address_city: 'Vienna',
      address_state: 'VA',
      address_zip: '22182',
      address_country: 'US',
    },
    notes: 'Requires account number and verbal passcode confirmation.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'sec-ring',
    name: 'Ring LLC / Amazon',
    department: 'Protect Subscription Services',
    category: 'HOME_SECURITY',
    naicsCode: '561621',
    address: {
      name: 'Ring LLC',
      company: 'Legal & Subscription Dept',
      address_line1: '12515 Cerise Ave',
      address_city: 'Hawthorne',
      address_state: 'CA',
      address_zip: '90250',
      address_country: 'US',
    },
    notes: 'Include registered Amazon / Ring email account.',
    verifiedAt: '2026-10-14',
  },

  // ============================================================================
  // 5. PEST CONTROL WRITTEN CANCELLATIONS
  // ============================================================================
  {
    id: 'pest-terminix',
    name: 'Terminix International',
    department: 'Service Agreement Cancellation Dept',
    category: 'PEST_CONTROL',
    naicsCode: '561710',
    address: {
      name: 'The Terminix International Company LP',
      company: 'Customer Care Operations',
      address_line1: '150 Peabody Pl',
      address_city: 'Memphis',
      address_state: 'TN',
      address_zip: '38103',
      address_country: 'US',
    },
    notes: 'Include customer agreement/account number and service property address.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'pest-orkin',
    name: 'Orkin Pest Control / Rollins, Inc.',
    department: 'Customer Contract Cancellation Dept',
    category: 'PEST_CONTROL',
    naicsCode: '561710',
    address: {
      name: 'Orkin, LLC',
      company: 'Customer Contract Department',
      address_line1: '2170 Piedmont Rd NE',
      address_city: 'Atlanta',
      address_state: 'GA',
      address_zip: '30324',
      address_country: 'US',
    },
    notes: 'Include local branch number, customer ID, and service address.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'pest-aptive',
    name: 'Aptive Environmental',
    department: 'Service Agreement Administration',
    category: 'PEST_CONTROL',
    naicsCode: '561710',
    address: {
      name: 'Aptive Environmental, LLC',
      company: 'Corporate Operations',
      address_line1: '5132 N 300 W Ste 150',
      address_city: 'Provo',
      address_state: 'UT',
      address_zip: '84604',
      address_country: 'US',
    },
    notes: 'Include customer contract ID number.',
    verifiedAt: '2026-10-14',
  },

  // ============================================================================
  // 6. HOME WARRANTY CANCELLATION
  // ============================================================================
  {
    id: 'war-ahs',
    name: 'American Home Shield',
    department: 'Customer Cancellation Operations',
    category: 'HOME_WARRANTY',
    naicsCode: '524128',
    address: {
      name: 'American Home Shield Corporation',
      company: 'Contract Review Department',
      address_line1: '889 Ridge Lake Blvd',
      address_city: 'Memphis',
      address_state: 'TN',
      address_zip: '38120',
      address_country: 'US',
    },
    notes: 'Include contract agreement number and covered property address.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'war-choice',
    name: 'Choice Home Warranty',
    department: 'Contract Review & Cancellation',
    category: 'HOME_WARRANTY',
    naicsCode: '524128',
    address: {
      name: 'Choice Home Warranty',
      company: 'Cancellation & Policy Services',
      address_line1: '1090 King Georges Post Rd Ste 502',
      address_city: 'Edison',
      address_state: 'NJ',
      address_zip: '08837',
      address_country: 'US',
    },
    notes: 'Include user policy number and cancellation reason.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'war-firstamerican',
    name: 'First American Home Warranty',
    department: 'Customer Cancellation Operations',
    category: 'HOME_WARRANTY',
    naicsCode: '524128',
    address: {
      name: 'First American Home Warranty Corporation',
      company: 'Policy Administration',
      address_line1: 'P.O. Box 7248',
      address_city: 'Santa Rosa',
      address_state: 'CA',
      address_zip: '95407',
      address_country: 'US',
    },
    notes: 'Include contract number and property address.',
    verifiedAt: '2026-10-14',
  },

  // ============================================================================
  // 7. AUTO / PROPERTY INSURANCE CANCELLATIONS (Non-fitness)
  // ============================================================================
  {
    id: 'ins-geico',
    name: 'GEICO',
    department: 'Policyholder Written Cancellation & Legal Notices',
    category: 'INSURANCE',
    naicsCode: '524126',
    address: {
      name: 'GEICO Corporation',
      company: 'Underwriting & Policy Processing',
      address_line1: '1 GEICO Blvd',
      address_city: 'Fredericksburg',
      address_state: 'VA',
      address_zip: '22412',
      address_country: 'US',
    },
    notes: 'Include policy number, effective cancellation date, and vehicle/property details.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'ins-statefarm',
    name: 'State Farm Insurance',
    department: 'Customer Policy Services & Cancellation',
    category: 'INSURANCE',
    naicsCode: '524126',
    address: {
      name: 'State Farm Mutual Automobile Insurance Company',
      company: 'Policy Services Center',
      address_line1: '1 State Farm Plaza',
      address_city: 'Bloomington',
      address_state: 'IL',
      address_zip: '61710',
      address_country: 'US',
    },
    notes: 'Include policy number and agent name/number if known.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'ins-progressive',
    name: 'Progressive Insurance',
    department: 'Customer Written Inquiries & Policy Discontinuance',
    category: 'INSURANCE',
    naicsCode: '524126',
    address: {
      name: 'Progressive Casualty Insurance Company',
      company: 'Customer Inquiries & Policy Support',
      address_line1: '6300 Wilson Mills Rd',
      address_city: 'Mayfield Village',
      address_state: 'OH',
      address_zip: '44143',
      address_country: 'US',
    },
    notes: 'Include 9-digit policy number and desired termination date.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'ins-allstate',
    name: 'Allstate Insurance',
    department: 'Policy Termination & Legal Correspondence',
    category: 'INSURANCE',
    naicsCode: '524126',
    address: {
      name: 'Allstate Insurance Company',
      company: 'Legal Notices & Policy Operations',
      address_line1: '2775 Sanders Rd',
      address_city: 'Northbrook',
      address_state: 'IL',
      address_zip: '60062',
      address_country: 'US',
    },
    notes: 'Include policy number and policyholder signature.',
    verifiedAt: '2026-10-14',
  },
  {
    id: 'ins-libertymutual',
    name: 'Liberty Mutual Insurance',
    department: 'Policy Services Written Inquiries',
    category: 'INSURANCE',
    naicsCode: '524126',
    address: {
      name: 'Liberty Mutual Insurance Company',
      company: 'Customer Policy Administration',
      address_line1: '175 Berkeley St',
      address_city: 'Boston',
      address_state: 'MA',
      address_zip: '02116',
      address_country: 'US',
    },
    notes: 'Include policy number and named insured.',
    verifiedAt: '2026-10-14',
  },
];

// Runtime guard: verify all registered recipients on module load
for (const recipient of VERIFIED_RECIPIENTS) {
  assertNotFitnessEntity(recipient);
}

/**
 * Returns all verified institutional recipients.
 */
export function getAllVerifiedRecipients(): VerifiedRecipientEntity[] {
  return VERIFIED_RECIPIENTS;
}

/**
 * Finds a verified recipient by exact ID.
 */
export function getVerifiedRecipientById(id: string): VerifiedRecipientEntity | undefined {
  return VERIFIED_RECIPIENTS.find((r) => r.id === id);
}

/**
 * Returns all verified recipients matching a specific category.
 */
export function getVerifiedRecipientsByCategory(
  category: VerifiedRecipientEntity['category']
): VerifiedRecipientEntity[] {
  return VERIFIED_RECIPIENTS.filter((r) => r.category === category);
}

/**
 * Searches the verified recipient registry while enforcing runtime conflict checks.
 */
export function searchVerifiedRecipients(
  query?: string,
  category?: VerifiedRecipientEntity['category']
): VerifiedRecipientEntity[] {
  if (!query && !category) return VERIFIED_RECIPIENTS;

  const normalized = (query || '').trim().toLowerCase();

  return VERIFIED_RECIPIENTS.filter((item) => {
    assertNotFitnessEntity(item);

    if (category && item.category !== category) {
      return false;
    }

    if (!normalized) return true;

    return (
      item.name.toLowerCase().includes(normalized) ||
      item.department.toLowerCase().includes(normalized) ||
      item.address.address_city.toLowerCase().includes(normalized) ||
      item.address.address_state.toLowerCase().includes(normalized) ||
      (item.notes && item.notes.toLowerCase().includes(normalized))
    );
  });
}
