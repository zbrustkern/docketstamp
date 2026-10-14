/**
 * DocketStamp Deterministic Notice Template Registry
 *
 * Defines the initial 6-notice catalog with Zod field schemas,
 * DocuSign-style inline variable tokens, and deterministic "Mad-Libs" form letter renderers.
 *
 * UPL Safe Harbor: DocketStamp is a self-help document preparation utility, NOT a law firm.
 * All notices are deterministic form letters where the user selects factual parameters.
 * No open-ended AI legal advice.
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_SPEC.md (§3.2, §5)
 * - docs/DESIGN_SYSTEM.md (§1, §4)
 */

import { z } from "zod";
import { UspsServiceLevel } from "@/lib/fulfillment/lob";
import { getSecurityDepositStatute } from "@/lib/data/state-statutes";

export type NoticeId =
  | "tenant-vacate-notice"
  | "security-deposit-demand"
  | "repair-maintenance-demand"
  | "fcra-credit-dispute"
  | "fdcpa-debt-validation"
  | "service-cancellation";

export type NoticeFieldType =
  | "text"
  | "date"
  | "currency"
  | "select"
  | "textarea"
  | "state"
  | "zip";

export interface NoticeFieldDefinition {
  id: string;
  label: string;
  placeholder: string;
  type: NoticeFieldType;
  required: boolean;
  helpText?: string;
  options?: { label: string; value: string }[];
  inputMode?: "text" | "numeric" | "decimal" | "email";
  autoComplete?: string;
}

export interface NoticeVariableToken {
  tokenKey: string;
  fieldId: string;
  displayTag: string; // e.g. "REQUIRED: MOVE-OUT DATE"
  sampleValue: string;
}

export interface RenderedNotice {
  title: string;
  docketSubtitle: string;
  governingCitation: string;
  senderBlock: string;
  recipientBlock: string;
  formalSubject: string;
  bodyParagraphs: string[];
  statutoryDemandClause: string;
  executionBlock: string;
  statutoryComplianceDisclosure: string;
}

export interface NoticeTemplate {
  id: NoticeId;
  title: string;
  shortTitle: string;
  badge: string;
  category: "TENANT_RIGHTS" | "CREDIT_AND_DEBT" | "CONSUMER_CONTRACTS";
  governingCitation: string;
  statutoryWindow: string; // e.g. "30-Day Mandatory Response Window"
  recommendedServiceLevel: UspsServiceLevel;
  fields: NoticeFieldDefinition[];
  schema: z.ZodObject<any>;
  tokens: NoticeVariableToken[];
  render: (data: Record<string, string>, metadata?: { docketId?: string; dateStr?: string }) => RenderedNotice;
}

export const STATUTORY_COMPLIANCE_DISCLOSURE =
  "DocketStamp is an automated document preparation and USPS postal dispatch platform, not a law firm, and does not provide legal advice, legal opinions, or legal representation. The documents, statutory citations, and forms provided are self-help resources prepared according to user-selected factual parameters. Use of DocketStamp does not create an attorney-client relationship. If you require legal advice or representation for a specific situation, consult a licensed attorney in your jurisdiction.";

// ============================================================================
// 1. TENANT NOTICE OF INTENT TO VACATE / LEASE NON-RENEWAL
// ============================================================================
const TenantVacateSchema = z.object({
  tenantFullName: z.string().min(2, "Tenant name is required"),
  landlordOrManagerName: z.string().min(2, "Landlord or management name is required"),
  rentalPropertyAddress: z.string().min(5, "Rental property address is required"),
  unitNumber: z.string().optional(),
  rentalCity: z.string().min(2, "City is required"),
  rentalState: z.string().length(2, "2-letter state code is required"),
  rentalZip: z.string().min(5, "ZIP code is required"),
  currentLeaseEndDate: z.string().min(4, "Lease end date is required"),
  effectiveVacateDate: z.string().min(4, "Vacate date is required"),
  forwardingAddress: z.string().min(5, "Forwarding address is required"),
  inspectionRequested: z.string().default("yes"),
});

const TenantVacateTemplate: NoticeTemplate = {
  id: "tenant-vacate-notice",
  title: "Tenant Notice of Intent to Vacate & Lease Non-Renewal",
  shortTitle: "Notice of Intent to Vacate",
  badge: "Residential Tenancy",
  category: "TENANT_RIGHTS",
  governingCitation: "Uniform Residential Landlord & Tenant Act (URLTA) / State Civil Codes",
  statutoryWindow: "30-Day or 60-Day Contractual Notice Window",
  recommendedServiceLevel: "CERTIFIED",
  fields: [
    {
      id: "tenantFullName",
      label: "Tenant Full Legal Name(s)",
      placeholder: "e.g., Alex M. Rivera",
      type: "text",
      required: true,
      autoComplete: "name",
    },
    {
      id: "landlordOrManagerName",
      label: "Landlord / Property Management Entity",
      placeholder: "e.g., Summit Property Management LLC",
      type: "text",
      required: true,
    },
    {
      id: "rentalPropertyAddress",
      label: "Rental Street Address",
      placeholder: "e.g., 742 Evergreen Terrace",
      type: "text",
      required: true,
      autoComplete: "address-line1",
    },
    {
      id: "unitNumber",
      label: "Apartment / Unit # (Optional)",
      placeholder: "e.g., Apt 4B",
      type: "text",
      required: false,
    },
    {
      id: "rentalCity",
      label: "City",
      placeholder: "e.g., Los Angeles",
      type: "text",
      required: true,
    },
    {
      id: "rentalState",
      label: "State",
      placeholder: "CA",
      type: "state",
      required: true,
    },
    {
      id: "rentalZip",
      label: "ZIP Code",
      placeholder: "90001",
      type: "zip",
      required: true,
      inputMode: "numeric",
    },
    {
      id: "currentLeaseEndDate",
      label: "Current Lease Expiration Date",
      placeholder: "e.g., November 30, 2026",
      type: "date",
      required: true,
    },
    {
      id: "effectiveVacateDate",
      label: "Date You Will Surrender Keys / Vacate",
      placeholder: "e.g., November 30, 2026",
      type: "date",
      required: true,
    },
    {
      id: "forwardingAddress",
      label: "Forwarding Address for Return of Security Deposit",
      placeholder: "e.g., 1200 Grand Ave, Suite 300, Dallas, TX 75201",
      type: "text",
      required: true,
    },
  ],
  schema: TenantVacateSchema,
  tokens: [
    { tokenKey: "TENANT_NAME", fieldId: "tenantFullName", displayTag: "REQUIRED: TENANT NAME", sampleValue: "Jane Doe" },
    { tokenKey: "LANDLORD_NAME", fieldId: "landlordOrManagerName", displayTag: "REQUIRED: LANDLORD NAME", sampleValue: "Apex Management" },
    { tokenKey: "RENTAL_ADDRESS", fieldId: "rentalPropertyAddress", displayTag: "REQUIRED: RENTAL ADDRESS", sampleValue: "123 Main St, Apt 2B" },
    { tokenKey: "VACATE_DATE", fieldId: "effectiveVacateDate", displayTag: "REQUIRED: VACATE DATE", sampleValue: "November 30, 2026" },
    { tokenKey: "FORWARDING_ADDRESS", fieldId: "forwardingAddress", displayTag: "REQUIRED: FORWARDING ADDRESS", sampleValue: "PO Box 99, Austin, TX" },
  ],
  render: (data, meta) => {
    const fullUnit = data.unitNumber ? `, Unit ${data.unitNumber}` : "";
    const premise = `${data.rentalPropertyAddress || "[RENTAL ADDRESS]"}${fullUnit}, ${data.rentalCity || "[CITY]"}, ${data.rentalState || "[STATE]"} ${data.rentalZip || "[ZIP]"}`;
    const dateStr = meta?.dateStr || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    return {
      title: "FORMAL NOTICE OF INTENT TO VACATE & LEASE NON-RENEWAL",
      docketSubtitle: "STATUTORY NOTICE DELIVERED VIA USPS DISPATCH REGISTRY",
      governingCitation: "Governing Authority: Relevant State Real Property Law / Residential Tenancy Code",
      senderBlock: `${data.tenantFullName || "[TENANT FULL NAME]"}\nResident of: ${premise}`,
      recipientBlock: `${data.landlordOrManagerName || "[LANDLORD / MANAGEMENT ENTITY]"}`,
      formalSubject: `RE: Notice of Non-Renewal and Intent to Vacate Leased Premises (${premise})`,
      bodyParagraphs: [
        `Please accept this formal written instrument as official, unequivocal notice pursuant to the terms of the governing lease agreement and applicable state tenancy law that the undersigned tenant(s) will surrender possession and completely vacate the premises located at ${premise} on or before ${data.effectiveVacateDate || "[EFFECTIVE VACATE DATE]"}.`,
        `The lease term terminates on ${data.currentLeaseEndDate || "[LEASE END DATE]"}. The undersigned tenant(s) will not be renewing the tenancy and will surrender all keys and access cards on or prior to the stated effective date.`,
        `Please coordinate with the undersigned to schedule a joint move-out walk-through inspection prior to surrender. In accordance with state statutory guidelines, all remaining security deposit funds and an itemized statement of any lawful deductions must be remitted within the governing statutory return window to the following designated forwarding address:`,
        `DESIGNATED FORWARDING ADDRESS:\n${data.forwardingAddress || "[FORWARDING ADDRESS]"}`,
      ],
      statutoryDemandClause:
        "FAILURE TO RETURN THE FULL SECURITY DEPOSIT WITHIN STATUTORY TIME LIMITS FOLLOWING SURRENDER MAY SUBJECT THE LANDLORD TO STATUTORY BAD-FAITH PENALTIES AND ATTORNEY FEES UNDER APPLICABLE STATE LAW.",
      executionBlock: `/s/ ${data.tenantFullName || "[TENANT SIGNATURE]"}\n${data.tenantFullName || "[TENANT FULL NAME]"}, Tenant of Record\nExecuted: ${dateStr}`,
      statutoryComplianceDisclosure: STATUTORY_COMPLIANCE_DISCLOSURE,
    };
  },
};

// ============================================================================
// 2. STATUTORY SECURITY DEPOSIT RETURN REQUEST (50-State + DC lookup)
// ============================================================================
const SecurityDepositSchema = z.object({
  tenantFullName: z.string().min(2, "Tenant name is required"),
  landlordOrManagerName: z.string().min(2, "Landlord name is required"),
  rentalPropertyAddress: z.string().min(5, "Property address is required"),
  rentalState: z.string().length(2, "2-letter state code is required"),
  surrenderDate: z.string().min(4, "Surrender date is required"),
  depositAmount: z.string().min(1, "Deposit amount is required"),
  disputedDeductions: z.string().optional(),
  forwardingAddress: z.string().min(5, "Forwarding address is required"),
});

const SecurityDepositTemplate: NoticeTemplate = {
  id: "security-deposit-demand",
  title: "Statutory Security Deposit Return & Accounting Demand",
  shortTitle: "Security Deposit Demand",
  badge: "50-State Statutory Enforcement",
  category: "TENANT_RIGHTS",
  governingCitation: "50-State Security Deposit Protection Statutes",
  statutoryWindow: "Statutory 14 to 60-Day Window (State Specific)",
  recommendedServiceLevel: "CERTIFIED_RETURN_RECEIPT",
  fields: [
    {
      id: "tenantFullName",
      label: "Tenant Full Legal Name",
      placeholder: "e.g., Marcus Vance",
      type: "text",
      required: true,
      autoComplete: "name",
    },
    {
      id: "landlordOrManagerName",
      label: "Landlord / Management Company",
      placeholder: "e.g., Oakridge Properties Inc.",
      type: "text",
      required: true,
    },
    {
      id: "rentalPropertyAddress",
      label: "Former Leased Rental Address",
      placeholder: "e.g., 402 Pine Street, Apt 3, Austin, TX 78701",
      type: "text",
      required: true,
    },
    {
      id: "rentalState",
      label: "State Where Property is Located",
      placeholder: "TX",
      type: "state",
      required: true,
    },
    {
      id: "surrenderDate",
      label: "Date Keys Were Surrendered / Unit Vacated",
      placeholder: "e.g., September 1, 2026",
      type: "date",
      required: true,
    },
    {
      id: "depositAmount",
      label: "Total Security Deposit Amount Paid",
      placeholder: "e.g., $1,850.00",
      type: "currency",
      required: true,
      inputMode: "decimal",
    },
    {
      id: "disputedDeductions",
      label: "Itemized Deductions Disputed (if any)",
      placeholder: "e.g., Disputed $350 cleaning fee, unit was left in clean broom condition.",
      type: "textarea",
      required: false,
    },
    {
      id: "forwardingAddress",
      label: "Forwarding Address for Payment Dispatch",
      placeholder: "e.g., 8800 Research Blvd, Austin, TX 78758",
      type: "text",
      required: true,
    },
  ],
  schema: SecurityDepositSchema,
  tokens: [
    { tokenKey: "TENANT_NAME", fieldId: "tenantFullName", displayTag: "REQUIRED: TENANT NAME", sampleValue: "Marcus Vance" },
    { tokenKey: "LANDLORD_NAME", fieldId: "landlordOrManagerName", displayTag: "REQUIRED: LANDLORD NAME", sampleValue: "Oakridge Properties" },
    { tokenKey: "DEPOSIT_AMOUNT", fieldId: "depositAmount", displayTag: "REQUIRED: DEPOSIT AMOUNT", sampleValue: "$1,850.00" },
    { tokenKey: "STATE_STATUTE", fieldId: "rentalState", displayTag: "REQUIRED: JURISDICTION", sampleValue: "Tex. Prop. Code § 92.109" },
    { tokenKey: "FORWARDING_ADDRESS", fieldId: "forwardingAddress", displayTag: "REQUIRED: FORWARDING ADDRESS", sampleValue: "8800 Research Blvd, Austin, TX" },
  ],
  render: (data, meta) => {
    const stateCode = (data.rentalState || "").toUpperCase();
    const statute = getSecurityDepositStatute(stateCode);
    const citation = statute ? `${statute.statuteCitation} (${statute.stateName})` : "Applicable State Landlord-Tenant Statute";
    const deadlineDays = statute ? statute.returnDeadlineDays : 30;
    const penaltyText = statute ? statute.penaltyClause : "Statutory damages and bad-faith attorney fees under state code.";
    const dateStr = meta?.dateStr || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    return {
      title: "FORMAL DEMAND FOR RETURN OF RESIDENTIAL SECURITY DEPOSIT",
      docketSubtitle: "STATUTORY DEMAND FOR IMMEDIATE REMITTANCE & ACCOUNTING",
      governingCitation: `Statutory Citation: ${citation}`,
      senderBlock: `${data.tenantFullName || "[TENANT FULL NAME]"}\nFormer Resident: ${data.rentalPropertyAddress || "[RENTAL PROPERTY ADDRESS]"}`,
      recipientBlock: `${data.landlordOrManagerName || "[LANDLORD / MANAGEMENT COMPANY]"}`,
      formalSubject: `RE: Final Demand for Immediate Return of Security Deposit in the Amount of ${data.depositAmount || "[DEPOSIT AMOUNT]"}`,
      bodyParagraphs: [
        `This letter constitutes formal statutory demand pursuant to ${citation} for the immediate and full return of the residential security deposit in the amount of ${data.depositAmount || "[DEPOSIT AMOUNT]"} paid in connection with the lease of the premises located at ${data.rentalPropertyAddress || "[RENTAL PROPERTY ADDRESS]"}.`,
        `The undersigned vacated the premises and surrendered physical possession and keys on ${data.surrenderDate || "[SURRENDER DATE]"}. As of the date of this notice, more than the statutory limit of ${deadlineDays} calendar days has elapsed without receipt of the deposit funds or the required itemized statutory statement of deductions.`,
        data.disputedDeductions
          ? `SPECIFIC DISPUTED DEDUCTIONS:\n${data.disputedDeductions}`
          : "The premises were surrendered in excellent, clean condition, ordinary wear and tear excepted. No lawful grounds exist for withholding any portion of this deposit.",
        `Please remit the full sum of ${data.depositAmount || "[DEPOSIT AMOUNT]"} via certified check or electronic funds to the undersigned at the following address within ten (10) business days of confirmed USPS delivery:`,
        `PAYMENT REMITTANCE ADDRESS:\n${data.forwardingAddress || "[FORWARDING ADDRESS]"}`,
      ],
      statutoryDemandClause: `STATUTORY BAD-FAITH PENALTY NOTICE:\nPursuant to ${citation}, failure to promptly remit deposit funds and itemized accounting subjects the landlord to: ${penaltyText}. The undersigned reserves all rights to initiate formal legal action in small claims or civil court without further notice.`,
      executionBlock: `/s/ ${data.tenantFullName || "[TENANT SIGNATURE]"}\n${data.tenantFullName || "[TENANT FULL NAME]"}\nExecuted: ${dateStr}`,
      statutoryComplianceDisclosure: STATUTORY_COMPLIANCE_DISCLOSURE,
    };
  },
};

// ============================================================================
// 3. FORMAL TENANT REQUEST FOR ESSENTIAL REPAIRS / MAINTENANCE
// ============================================================================
const RepairDemandSchema = z.object({
  tenantFullName: z.string().min(2, "Tenant name is required"),
  landlordOrManagerName: z.string().min(2, "Landlord name is required"),
  rentalPropertyAddress: z.string().min(5, "Property address is required"),
  defectDescription: z.string().min(10, "Defect description is required"),
  priorNoticeDates: z.string().optional(),
  statutoryRemedyDeadlineDays: z.string().default("14"),
});

const RepairDemandTemplate: NoticeTemplate = {
  id: "repair-maintenance-demand",
  title: "Formal Tenant Request for Essential Repairs & Habitability Remedy",
  shortTitle: "Notice to Repair & Habitability Demand",
  badge: "Warranty of Habitability",
  category: "TENANT_RIGHTS",
  governingCitation: "Implied Warranty of Habitability / State Housing Maintenance Codes",
  statutoryWindow: "7 to 30-Day Mandatory Repair Window",
  recommendedServiceLevel: "CERTIFIED",
  fields: [
    {
      id: "tenantFullName",
      label: "Tenant Full Legal Name",
      placeholder: "e.g., David Chen",
      type: "text",
      required: true,
    },
    {
      id: "landlordOrManagerName",
      label: "Landlord / Property Manager Name",
      placeholder: "e.g., Blue Sky Residential LLC",
      type: "text",
      required: true,
    },
    {
      id: "rentalPropertyAddress",
      label: "Rental Property Address & Unit #",
      placeholder: "e.g., 550 Commonwealth Ave, Apt 12, Boston, MA 02215",
      type: "text",
      required: true,
    },
    {
      id: "defectDescription",
      label: "Description of Essential Maintenance Defect / Habitability Issue",
      placeholder: "e.g., Main heating system inoperative since Oct 10; interior temp below legal minimum of 68°F. Severe water leak under kitchen sink causing mold.",
      type: "textarea",
      required: true,
    },
    {
      id: "priorNoticeDates",
      label: "Dates of Prior Verbal / Written Notices (if any)",
      placeholder: "e.g., Telephoned maintenance Oct 11, emailed landlord Oct 12.",
      type: "text",
      required: false,
    },
    {
      id: "statutoryRemedyDeadlineDays",
      label: "Statutory Days Allowed for Remedy",
      placeholder: "14",
      type: "select",
      required: true,
      options: [
        { label: "7 Calendar Days (Urgent / Emergency)", value: "7" },
        { label: "14 Calendar Days (Standard Essential)", value: "14" },
        { label: "30 Calendar Days (General Maintenance)", value: "30" },
      ],
    },
  ],
  schema: RepairDemandSchema,
  tokens: [
    { tokenKey: "TENANT_NAME", fieldId: "tenantFullName", displayTag: "REQUIRED: TENANT NAME", sampleValue: "David Chen" },
    { tokenKey: "LANDLORD_NAME", fieldId: "landlordOrManagerName", displayTag: "REQUIRED: LANDLORD NAME", sampleValue: "Blue Sky Residential" },
    { tokenKey: "DEFECT_DETAILS", fieldId: "defectDescription", displayTag: "REQUIRED: DEFECT DESCRIPTION", sampleValue: "Heating failure / leak" },
    { tokenKey: "DEADLINE_DAYS", fieldId: "statutoryRemedyDeadlineDays", displayTag: "REQUIRED: DEADLINE DAYS", sampleValue: "14" },
  ],
  render: (data, meta) => {
    const dateStr = meta?.dateStr || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const days = data.statutoryRemedyDeadlineDays || "14";

    return {
      title: "FORMAL NOTICE OF DEFECT & DEMAND FOR ESSENTIAL REPAIRS",
      docketSubtitle: "WRITTEN HABITABILITY NOTICE UNDER STATE HOUSING CODES",
      governingCitation: "Governing Standard: Implied Warranty of Habitability & State Residential Maintenance Standards",
      senderBlock: `${data.tenantFullName || "[TENANT FULL NAME]"}\nTenant at: ${data.rentalPropertyAddress || "[RENTAL PROPERTY ADDRESS]"}`,
      recipientBlock: `${data.landlordOrManagerName || "[LANDLORD / MANAGEMENT ENTITY]"}`,
      formalSubject: `RE: Urgent Notice of Substandard Condition and Demand for Repair at ${data.rentalPropertyAddress || "[RENTAL PROPERTY ADDRESS]"}`,
      bodyParagraphs: [
        `This letter serves as formal written notice pursuant to the implied warranty of habitability and applicable state and local housing maintenance codes that substantial conditions requiring immediate repair exist at the leased premises located at ${data.rentalPropertyAddress || "[RENTAL PROPERTY ADDRESS]"}.`,
        `SPECIFIC DEFECTS REQUIRING REMEDY:\n${data.defectDescription || "[DEFECT DESCRIPTION]"}`,
        data.priorNoticeDates
          ? `PRIOR NOTICES RECORDED:\nNotice of these conditions was previously provided as follows: ${data.priorNoticeDates}. Despite prior notice, the condition remains unresolved.`
          : "These conditions directly affect the health, safety, and physical habitability of the premises.",
        `You are formally requested to cure these conditions within ${days} calendar days of confirmed USPS postal delivery of this notice. Please contact the undersigned immediately to schedule prompt contractor entry.`,
      ],
      statutoryDemandClause: `RESERVATION OF STATUTORY REMEDIES:\nIf you fail to effectuate the necessary repairs within ${days} calendar days, the undersigned reserves all rights under state law, including but not limited to repairing the condition and deducting the cost from rent, withholding rent in escrow, terminating the lease due to constructive eviction, and reporting violations to local municipal code enforcement agencies.`,
      executionBlock: `/s/ ${data.tenantFullName || "[TENANT SIGNATURE]"}\n${data.tenantFullName || "[TENANT FULL NAME]"}\nExecuted: ${dateStr}`,
      statutoryComplianceDisclosure: STATUTORY_COMPLIANCE_DISCLOSURE,
    };
  },
};

// ============================================================================
// 4. CREDIT BUREAU WRITTEN DISPUTE NOTICE (FCRA § 611)
// ============================================================================
const FcraDisputeSchema = z.object({
  consumerFullName: z.string().min(2, "Consumer name is required"),
  consumerAddress: z.string().min(5, "Address is required"),
  consumerLast4Ssn: z.string().length(4, "Last 4 of SSN is required"),
  consumerDob: z.string().min(4, "Date of birth is required"),
  targetBureau: z.string().min(2, "Target bureau is required"),
  disputedFurnisherName: z.string().min(2, "Disputed company/account is required"),
  disputedAccountNumberPartial: z.string().min(2, "Account number is required"),
  natureOfDispute: z.string().min(10, "Dispute reason is required"),
});

const FcraDisputeTemplate: NoticeTemplate = {
  id: "fcra-credit-dispute",
  title: "Credit Bureau Written Dispute Notice (FCRA § 611)",
  shortTitle: "Credit Bureau Written Dispute",
  badge: "Federal FCRA Statutory Audit",
  category: "CREDIT_AND_DEBT",
  governingCitation: "Fair Credit Reporting Act, 15 U.S.C. § 1681i (Section 611)",
  statutoryWindow: "30-Day Mandatory Federal Investigation Window",
  recommendedServiceLevel: "CERTIFIED_RETURN_RECEIPT",
  fields: [
    {
      id: "consumerFullName",
      label: "Consumer Full Legal Name",
      placeholder: "e.g., Jennifer K. Reynolds",
      type: "text",
      required: true,
      autoComplete: "name",
    },
    {
      id: "consumerAddress",
      label: "Current Mailing Address",
      placeholder: "e.g., 100 Main St, Apt 401, Denver, CO 80202",
      type: "text",
      required: true,
    },
    {
      id: "consumerLast4Ssn",
      label: "Social Security Number (Last 4 Digits Only)",
      placeholder: "1234",
      type: "text",
      required: true,
      inputMode: "numeric",
    },
    {
      id: "consumerDob",
      label: "Date of Birth (MM/DD/YYYY)",
      placeholder: "04/15/1988",
      type: "text",
      required: true,
    },
    {
      id: "targetBureau",
      label: "Credit Reporting Agency",
      placeholder: "Equifax",
      type: "select",
      required: true,
      options: [
        { label: "Equifax Information Services LLC", value: "Equifax Information Services LLC" },
        { label: "Experian Consumer Dispute Center", value: "Experian" },
        { label: "TransUnion Consumer Solutions", value: "TransUnion Consumer Solutions" },
      ],
    },
    {
      id: "disputedFurnisherName",
      label: "Creditor / Furnisher Name on File",
      placeholder: "e.g., Midland Credit Management / Chase Bank",
      type: "text",
      required: true,
    },
    {
      id: "disputedAccountNumberPartial",
      label: "Account Number (or last 4 digits)",
      placeholder: "e.g., ACCT #4812-XXXX",
      type: "text",
      required: true,
    },
    {
      id: "natureOfDispute",
      label: "Factual Basis & Details of Disputed Trade-Line",
      placeholder: "e.g., Account was paid in full on Dec 2025. Bureau is incorrectly reporting late balance. Never received 30-day notice.",
      type: "textarea",
      required: true,
    },
  ],
  schema: FcraDisputeSchema,
  tokens: [
    { tokenKey: "CONSUMER_NAME", fieldId: "consumerFullName", displayTag: "REQUIRED: CONSUMER NAME", sampleValue: "Jennifer Reynolds" },
    { tokenKey: "TARGET_BUREAU", fieldId: "targetBureau", displayTag: "REQUIRED: TARGET BUREAU", sampleValue: "Equifax" },
    { tokenKey: "DISPUTED_ACCOUNT", fieldId: "disputedFurnisherName", displayTag: "REQUIRED: CREDITOR NAME", sampleValue: "Midland Credit" },
    { tokenKey: "DISPUTE_REASON", fieldId: "natureOfDispute", displayTag: "REQUIRED: DISPUTE DETAILS", sampleValue: "Inaccurate balance" },
  ],
  render: (data, meta) => {
    const dateStr = meta?.dateStr || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    return {
      title: "FORMAL NOTICE OF DISPUTE UNDER FAIR CREDIT REPORTING ACT § 611",
      docketSubtitle: "MANDATORY 30-DAY STATUTORY REINVESTIGATION DEMAND",
      governingCitation: "15 U.S.C. § 1681i (FCRA Section 611 - Procedure in Case of Disputed Accuracy)",
      senderBlock: `${data.consumerFullName || "[CONSUMER FULL NAME]"}\n${data.consumerAddress || "[CONSUMER ADDRESS]"}\nDOB: ${data.consumerDob || "[DOB]"} | SSN: XXX-XX-${data.consumerLast4Ssn || "XXXX"}`,
      recipientBlock: `${data.targetBureau || "[CREDIT REPORTING AGENCY]"}\nConsumer Dispute Processing Operations`,
      formalSubject: `RE: Formal Dispute of Inaccurate Account Information under FCRA § 611 (${data.disputedFurnisherName || "[FURNISHER NAME]"})`,
      bodyParagraphs: [
        `This letter is a formal notice of dispute submitted pursuant to Section 611 of the Fair Credit Reporting Act, 15 U.S.C. § 1681i. The consumer credit report maintained under my identifying information contains inaccurate, incomplete, or unverified information as itemized below.`,
        `DISPUTED ITEM IDENTIFICATION:\nCreditor / Furnisher: ${data.disputedFurnisherName || "[CREDITOR NAME]"}\nAccount Identifier: ${data.disputedAccountNumberPartial || "[ACCOUNT NUMBER]"}`,
        `FACTUAL BASIS OF DISPUTE:\n${data.natureOfDispute || "[NATURE OF DISPUTE]"}`,
        `Pursuant to 15 U.S.C. § 1681i(a)(1), you are federally mandated to conduct a free and thorough reinvestigation of the disputed item, notify the furnisher within 5 business days pursuant to § 1681i(a)(2), and complete all reinvestigation procedures within thirty (30) calendar days of receipt of this notice.`,
        `If the furnisher fails to verify the accuracy of the trade-line within the statutory 30-day period, the item must be promptly deleted from my credit file pursuant to 15 U.S.C. § 1681i(a)(5).`,
      ],
      statutoryDemandClause:
        "DEMAND FOR COMPLIANCE & UPDATED CREDIT FILE:\nUpon completion of your reinvestigation, please deliver written results and an updated free copy of my consumer disclosure file to the consumer address set forth above, as required by 15 U.S.C. § 1681i(a)(6).",
      executionBlock: `/s/ ${data.consumerFullName || "[CONSUMER SIGNATURE]"}\n${data.consumerFullName || "[CONSUMER FULL NAME]"}\nExecuted: ${dateStr}`,
      statutoryComplianceDisclosure: STATUTORY_COMPLIANCE_DISCLOSURE,
    };
  },
};

// ============================================================================
// 5. 30-DAY DEBT VERIFICATION & VALIDATION REQUEST (FDCPA)
// ============================================================================
const FdcpaValidationSchema = z.object({
  consumerFullName: z.string().min(2, "Consumer name is required"),
  consumerAddress: z.string().min(5, "Consumer address is required"),
  collectionAgencyName: z.string().min(2, "Collection agency name is required"),
  debtReferenceNumber: z.string().min(2, "Debt reference number is required"),
  originalCreditor: z.string().optional(),
  disputeStatement: z.string().min(5, "Dispute statement is required"),
});

const FdcpaValidationTemplate: NoticeTemplate = {
  id: "fdcpa-debt-validation",
  title: "30-Day Debt Verification & Validation Request (FDCPA § 809)",
  shortTitle: "30-Day Debt Validation Request",
  badge: "Federal FDCPA Enforcement",
  category: "CREDIT_AND_DEBT",
  governingCitation: "Fair Debt Collection Practices Act, 15 U.S.C. § 1692g",
  statutoryWindow: "Mandatory Cease-and-Desist Pending Verification",
  recommendedServiceLevel: "CERTIFIED_RETURN_RECEIPT",
  fields: [
    {
      id: "consumerFullName",
      label: "Consumer Full Legal Name",
      placeholder: "e.g., Robert T. Miller",
      type: "text",
      required: true,
      autoComplete: "name",
    },
    {
      id: "consumerAddress",
      label: "Current Mailing Address",
      placeholder: "e.g., 2400 Peachtree Rd NW, Atlanta, GA 30305",
      type: "text",
      required: true,
    },
    {
      id: "collectionAgencyName",
      label: "Collection Agency / Debt Collector Name",
      placeholder: "e.g., Portfolio Recovery Associates LLC",
      type: "text",
      required: true,
    },
    {
      id: "debtReferenceNumber",
      label: "Collection Account / File Reference Number",
      placeholder: "e.g., PRA-9918237",
      type: "text",
      required: true,
    },
    {
      id: "originalCreditor",
      label: "Alleged Original Creditor (if known)",
      placeholder: "e.g., Citibank, N.A.",
      type: "text",
      required: false,
    },
    {
      id: "disputeStatement",
      label: "Statement of Dispute / Verification Demanded",
      placeholder: "e.g., I dispute the validity of this entire debt and the accuracy of the claimed balance. Provide proof of authority and original signed agreement.",
      type: "textarea",
      required: true,
    },
  ],
  schema: FdcpaValidationSchema,
  tokens: [
    { tokenKey: "CONSUMER_NAME", fieldId: "consumerFullName", displayTag: "REQUIRED: CONSUMER NAME", sampleValue: "Robert Miller" },
    { tokenKey: "COLLECTOR_NAME", fieldId: "collectionAgencyName", displayTag: "REQUIRED: COLLECTOR NAME", sampleValue: "Portfolio Recovery" },
    { tokenKey: "REFERENCE_NO", fieldId: "debtReferenceNumber", displayTag: "REQUIRED: ACCOUNT REF #", sampleValue: "PRA-9918237" },
  ],
  render: (data, meta) => {
    const dateStr = meta?.dateStr || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    return {
      title: "FORMAL DEMAND FOR VALIDATION OF DEBT PURSUANT TO FDCPA § 809",
      docketSubtitle: "FEDERAL CEASE-OF-COLLECTION STATUTORY DEMAND",
      governingCitation: "15 U.S.C. § 1692g (Fair Debt Collection Practices Act, Section 809)",
      senderBlock: `${data.consumerFullName || "[CONSUMER FULL NAME]"}\n${data.consumerAddress || "[CONSUMER ADDRESS]"}`,
      recipientBlock: `${data.collectionAgencyName || "[COLLECTION AGENCY NAME]"}\nCompliance & Verification Department`,
      formalSubject: `RE: Written Dispute and Demand for Debt Validation (Reference: ${data.debtReferenceNumber || "[REF NUMBER]"})`,
      bodyParagraphs: [
        `This letter serves as formal written notice pursuant to 15 U.S.C. § 1692g of the Fair Debt Collection Practices Act that the undersigned consumer disputes the validity of the alleged debt referenced under File / Account #${data.debtReferenceNumber || "[REF NUMBER]"}${data.originalCreditor ? ` allegedly originated with ${data.originalCreditor}` : ""}.`,
        `STATEMENT OF DISPUTE:\n${data.disputeStatement || "The validity and claimed amount of this alleged obligation is disputed in full."}`,
        `STATUTORY CEASE-AND-DESIST DEMAND:\nPursuant to 15 U.S.C. § 1692g(b), you are federally required to IMMEDIATELY CEASE ALL COLLECTION ACTIVITIES, including telephone calls, correspondence, and credit bureau reporting, until you obtain verification of the debt or a copy of a judgment and mail a copy of such verification to the consumer.`,
        `Please provide: (1) competent written evidence that you have lawful standing and assignment to collect this debt, (2) an itemized calculation of all principal, interest, and fees from the original creditor, and (3) a copy of the original agreement bearing the consumer's signature.`,
      ],
      statutoryDemandClause:
        "FDCPA PENALTY ADMONITION:\nFailure to cease collection activities prior to mailing verified proof constitutes a direct violation of federal law under 15 U.S.C. § 1692k, subjecting the collector to civil liability, statutory damages, and attorney fees.",
      executionBlock: `/s/ ${data.consumerFullName || "[CONSUMER SIGNATURE]"}\n${data.consumerFullName || "[CONSUMER FULL NAME]"}\nExecuted: ${dateStr}`,
      statutoryComplianceDisclosure: STATUTORY_COMPLIANCE_DISCLOSURE,
    };
  },
};

// ============================================================================
// 6. WRITTEN SERVICE & INSURANCE POLICY CANCELLATION NOTICE (Non-Fitness)
// ============================================================================
const ServiceCancellationSchema = z.object({
  customerFullName: z.string().min(2, "Customer name is required"),
  customerAddress: z.string().min(5, "Customer address is required"),
  serviceProviderName: z.string().min(2, "Service provider name is required"),
  accountOrPolicyNumber: z.string().min(2, "Account or policy number is required"),
  category: z.string().min(2, "Category is required"),
  cancellationEffectiveDate: z.string().min(4, "Effective date is required"),
  reasonForCancellation: z.string().optional(),
});

const ServiceCancellationTemplate: NoticeTemplate = {
  id: "service-cancellation",
  title: "Formal Written Service & Insurance Policy Cancellation Notice",
  shortTitle: "Written Contract Cancellation",
  badge: "Non-Fitness Contract Termination",
  category: "CONSUMER_CONTRACTS",
  governingCitation: "Uniform Commercial Code / State Written Contract Termination Standards",
  statutoryWindow: "Immediate / Contractual Written Notice Requirement",
  recommendedServiceLevel: "CERTIFIED",
  fields: [
    {
      id: "customerFullName",
      label: "Account Holder Legal Name",
      placeholder: "e.g., Sarah Jenkins",
      type: "text",
      required: true,
      autoComplete: "name",
    },
    {
      id: "customerAddress",
      label: "Billing / Service Address on File",
      placeholder: "e.g., 780 Park Place, Seattle, WA 98101",
      type: "text",
      required: true,
    },
    {
      id: "category",
      label: "Contract Type (Non-Fitness Only)",
      placeholder: "Home Security",
      type: "select",
      required: true,
      options: [
        { label: "Home Security / Alarm Service", value: "Home Security" },
        { label: "Pest Control Maintenance Service", value: "Pest Control" },
        { label: "Telecommunications / Internet / Cable", value: "Telecommunications" },
        { label: "Home Warranty Plan", value: "Home Warranty" },
        { label: "Auto / Homeowners Insurance Policy", value: "Insurance Policy" },
      ],
    },
    {
      id: "serviceProviderName",
      label: "Service Provider / Insurer Legal Name",
      placeholder: "e.g., ADT Security Services",
      type: "text",
      required: true,
    },
    {
      id: "accountOrPolicyNumber",
      label: "Account / Policy / Agreement Number",
      placeholder: "e.g., ACCT #ADT-883921",
      type: "text",
      required: true,
    },
    {
      id: "cancellationEffectiveDate",
      label: "Effective Cancellation Date",
      placeholder: "e.g., November 1, 2026",
      type: "date",
      required: true,
    },
    {
      id: "reasonForCancellation",
      label: "Reason for Termination (Optional)",
      placeholder: "e.g., Relocating residence; contract term expired; switching providers.",
      type: "textarea",
      required: false,
    },
  ],
  schema: ServiceCancellationSchema,
  tokens: [
    { tokenKey: "CUSTOMER_NAME", fieldId: "customerFullName", displayTag: "REQUIRED: CUSTOMER NAME", sampleValue: "Sarah Jenkins" },
    { tokenKey: "PROVIDER_NAME", fieldId: "serviceProviderName", displayTag: "REQUIRED: PROVIDER NAME", sampleValue: "ADT Security" },
    { tokenKey: "ACCOUNT_NO", fieldId: "accountOrPolicyNumber", displayTag: "REQUIRED: ACCOUNT / POLICY #", sampleValue: "ADT-883921" },
    { tokenKey: "EFFECTIVE_DATE", fieldId: "cancellationEffectiveDate", displayTag: "REQUIRED: EFFECTIVE DATE", sampleValue: "November 1, 2026" },
  ],
  render: (data, meta) => {
    const dateStr = meta?.dateStr || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    return {
      title: "FORMAL WRITTEN NOTICE OF CONTRACT TERMINATION & CANCELLATION",
      docketSubtitle: "REVOCATION OF RECURRING BILLING & SERVICE SURRENDER",
      governingCitation: "Governing Standard: Contractual Written Notice Terms & Applicable Consumer Protection Acts",
      senderBlock: `${data.customerFullName || "[CUSTOMER FULL NAME]"}\n${data.customerAddress || "[SERVICE ADDRESS]"}`,
      recipientBlock: `${data.serviceProviderName || "[SERVICE PROVIDER]"}\nCancellations & Client Retention Department`,
      formalSubject: `RE: Irrevocable Notice of Cancellation - ${data.category || "Service Agreement"} (Account/Policy #${data.accountOrPolicyNumber || "[ACCOUNT NUMBER]"})`,
      bodyParagraphs: [
        `Please accept this formal written instrument as unequivocal, written notice that the undersigned is terminating and cancelling all services, policies, and contracts associated with Account / Policy #${data.accountOrPolicyNumber || "[ACCOUNT NUMBER]"} effective as of ${data.cancellationEffectiveDate || "[EFFECTIVE DATE]"}.`,
        `REVOCATION OF BILLING AUTHORIZATION:\nEffective immediately upon receipt of this notice, all authorizations for recurring electronic fund transfers (EFT), credit card recurring debits, and automated clearinghouse (ACH) transactions associated with this account are permanently revoked.`,
        data.reasonForCancellation
          ? `STATED REASON FOR CANCELLATION:\n${data.reasonForCancellation}`
          : "This cancellation satisfies all contractual written notice prerequisites.",
        "Please provide written confirmation of cancellation and an accounting of any prorated unearned premiums or prepaid balance refunds to the address set forth above within ten (10) business days.",
      ],
      statutoryDemandClause:
        "PROHIBITION OF UNAUTHORIZED POST-CANCELLATION CHARGES:\nAny unauthorized post-cancellation charges or debit attempts will be contested as fraudulent billing and reported to the Consumer Financial Protection Bureau (CFPB) and applicable state licensing authorities.",
      executionBlock: `/s/ ${data.customerFullName || "[CUSTOMER SIGNATURE]"}\n${data.customerFullName || "[CUSTOMER FULL NAME]"}\nExecuted: ${dateStr}`,
      statutoryComplianceDisclosure: STATUTORY_COMPLIANCE_DISCLOSURE,
    };
  },
};

export const NOTICE_TEMPLATES: Record<NoticeId, NoticeTemplate> = {
  "tenant-vacate-notice": TenantVacateTemplate,
  "security-deposit-demand": SecurityDepositTemplate,
  "repair-maintenance-demand": RepairDemandTemplate,
  "fcra-credit-dispute": FcraDisputeTemplate,
  "fdcpa-debt-validation": FdcpaValidationTemplate,
  "service-cancellation": ServiceCancellationTemplate,
};

export function getAllNoticeTemplates(): NoticeTemplate[] {
  return Object.values(NOTICE_TEMPLATES);
}

export function getNoticeTemplate(id: string): NoticeTemplate | undefined {
  return NOTICE_TEMPLATES[id as NoticeId];
}
