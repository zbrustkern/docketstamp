import { NextResponse } from 'next/server';
import { getAllNotices, DOCKET_PRICING_TIERS } from '@/src/lib/docket/notices';
import { getAllVerifiedRecipients } from '@/src/lib/docket/data/verified-recipients';
import { getPublicTemplateAvailability } from '@/lib/template-policy-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function generateLlmsTxt(): Promise<string> {
  const availability = await getPublicTemplateAvailability();
  const availabilityBySlug = new Map(availability.templates.map((entry) => [entry.slug, entry]));
  const available = new Set(availability.templates.filter((entry) => entry.available).map((entry) => entry.slug));
  const notices = getAllNotices().filter((notice) => available.has(notice.slug));
  const recipients = getAllVerifiedRecipients();

  const noticesListMarkdown = notices
    .map((n, idx) => {
      const fieldsList = (n.fields || [])
        .map(
          (f) =>
            `    - \`${f.key}\` (${f.inputType}${f.maxLength ? `, max ${f.maxLength} chars` : ''}): "${f.label}" | DocuSign Tag: [${f.docusignTagLabel}]${f.helperText ? ` — ${f.helperText}` : ''}${f.options ? ` | Options (display label; submit the exact value): ${f.options.map((o) => `"${o.label}" (value: "${o.value}")`).join(', ')}` : ''}`
        )
        .join('\n');

      return `### Cartridge ${idx + 1}: ${n.title}
- **Slug**: \`${n.slug}\`
- **Category**: \`${n.category}\`
- **Document Header**: "${n.documentHeaderTitle}"
- **Recommended USPS Tier**: \`${n.recommendedTier}\` (${DOCKET_PRICING_TIERS[n.recommendedTier]?.formattedPrice || '$19.95'})
- **Recipient Mode**: \`${n.recipientMode}\`
- **Description**: ${n.shortDescription}
- **Availability location inputs**: ${availabilityBySlug.get(n.slug)?.requiresResidence ? 'consumerResidenceState required by current geography rules' : 'no residence state currently required'}; ${availabilityBySlug.get(n.slug)?.requiresProperty ? 'propertyState required by current geography rules' : 'no property state currently required'}
- **Fields**:
${fieldsList || '    - (No specific dynamic fields)'}
`;
    })
    .join('\n');

  const recipientsTableRows = recipients
    .map(
      (r) =>
        `| \`${r.id}\` | ${r.brandName} | \`${r.category}\` | ${r.formalRecipientLine} | ${r.city}, ${r.state} ${r.zip} | \`${r.recommendedTier}\` | ${r.requiredIdentifiersHint} |`
    )
    .join('\n');

  return `# DocketStamp: Autonomous Agentic Postal Notice & Physical USPS Dispatch System

> **Core Architectural Invariant**: "Agents stage, humans sign and pay."
> AI agents (Claude, ChatGPT, cursor agents, local CLI tools) can stage partially or fully populated formal letters without an API key, OAuth flow, or payment credentials.
> The agent delivers a 1-Tap Review Link to the human user: \`https://docketstamp.com/notices/[slug]?stage=DS-STAGE-XXXXXX\`.
> The human user reviews the rendered 8.5x11 letter, adopts an electronic signature, and completes payment for USPS postal dispatch.

---

## 1. Statutory Guardrails & Compliance Disclosures
- **UPL Compliance**: DocketStamp is an automated self-help document preparation and USPS postal dispatch utility, NOT a law firm, and does not provide legal representation or legal advice. All notice cartridges are deterministic form instruments where factual parameters are supplied by the user or staging agent.
- **Strict Conflict-of-Interest Exclusion (NAICS 713940)**: DocketStamp strictly excludes gyms, health clubs, fitness centers, and fitness membership billing disputes (NAICS 713940). Staged requests referencing gyms or fitness clubs will be rejected with HTTP 400 (\`CONFLICT_OF_INTEREST\`). Connected hardware, consumer electronics, and home appliance manufacturers (Withings, Garmin, Ecobee, LG, Samsung, Canon, Sonos, Roku, etc.) ARE fully supported.

---

## 2. Dispatch Tiers & USPS Pricing
1. **Standard First-Class Mail (\`first_class\`)**: $12.95
   - USPS First-Class Mail service and tracking.
2. **USPS Certified Mail® (\`certified\`)**: $19.95
   - USPS Certified Mail service and tracking.
3. **USPS Certified Mail® + Return Receipt (\`certified_return_receipt\`)**: $27.95
   - Includes the Return Receipt service.

---

## 3. 1-Tap Review URL & Pre-fill Syntax
Agents can direct human users to interactive notice workspaces via two methods:

### Method A: Staged Draft Review Link (Recommended)
\`https://docketstamp.com/notices/{slug}?stage={stageId}\`
Example: \`https://docketstamp.com/notices/pre-arbitration-notice-of-dispute-and-refund-request?stage=DS-STAGE-84A19F\`

### Method B: Direct URL Query Parameter Pre-fill
\`https://docketstamp.com/notices/{slug}?recipientId={recipientId}&tier={tier}&field.{fieldKey}={value}\`
Example: \`https://docketstamp.com/notices/pre-arbitration-notice-of-dispute-and-refund-request?recipientId=leg_wth&tier=certified_return_receipt&field.productOrServiceName=Withings+Body+Smart+Scale\`
Staging requests may include \`fieldValues.consumerResidenceState\` (the consumer's explicitly declared residence) and, for tenant notices, \`fieldValues.propertyState\` (the property state). These are policy facts, not recipient or sender-mailing states; include them when requested by availability checks.

---

## 4. Staged Draft REST API
- **Stage Draft**: \`POST https://docketstamp.com/api/docket/stage\`
  - Headers: \`Content-Type: application/json\`
  - Body:
\`\`\`json
{
  "noticeSlug": "pre-arbitration-notice-of-dispute-and-refund-request",
  "recipientId": "leg_wth",
  "customRecipient": {
    "name": "Withings Inc. — Legal Dept.",
    "addressLine1": "225 Franklin Street, Floor 26",
    "city": "Boston",
    "state": "MA",
    "zip": "02110"
  },
  "sender": {
    "name": "Jane Doe",
    "addressLine1": "123 Elm St",
    "city": "Austin",
    "state": "TX",
    "zip": "78701"
  },
  "fieldValues": {
    "productOrServiceName": "Withings Body Smart Scale",
    "accountOrSerialIdentifier": "SN-98234-A",
    "purchaseDate": "2025-04-12",
    "disputeTriggerCategory": "Post-Purchase Removal or Paywalling of Advertised Feature",
    "factualSummary": "Pulse wave velocity feature was moved behind a paid subscription post-purchase.",
    "requestedResolutionAmount": "$99.95"
  },
  "recommendedTier": "certified_return_receipt"
}
\`\`\`
  - Response (201 Created):
\`\`\`json
{
  "stageId": "DS-STAGE-84A19F",
  "noticeSlug": "pre-arbitration-notice-of-dispute-and-refund-request",
  "reviewUrl": "https://docketstamp.com/notices/pre-arbitration-notice-of-dispute-and-refund-request?stage=DS-STAGE-84A19F",
  "missingRequiredFields": ["senderFullName"],
  "pricingTiers": { ... },
  "expiresAt": "2026-10-23T..."
}
\`\`\`
- **Retrieve Draft**: \`GET https://docketstamp.com/api/docket/stage/{stageId}\`
  - Returns draft data, expires after 7 days (HTTP 404 once expired).

---

## 5. Remote Model Context Protocol (MCP) Server
- **Endpoint**: \`POST https://docketstamp.com/api/mcp\`
- **Protocol**: JSON-RPC 2.0 Streamable HTTP MCP
- **Tools**:
  1. \`list_docket_notices\`: Lists all Notice Cartridges, descriptions, and field schemas.
  2. \`search_verified_recipients\`: Searches pre-verified institutional recipients by brand name or category.
  3. \`stage_certified_notice\`: Validates inputs, creates staged draft, and returns review link.

---

## 6. Formal Letter Catalog (${notices.length} Active Cartridges)

${noticesListMarkdown}

---

## 7. Pre-Verified Institutional Recipients Registry (${recipients.length} Verified Recipients)

| ID | Brand Name | Category | Formal Legal Recipient Line | Location | Recommended Tier | Required Identifiers Hint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${recipientsTableRows}
`;
}

export async function GET() {
  try {
    const body = await generateLlmsTxt();
    return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
    });
  } catch {
    return new NextResponse('Availability is temporarily unavailable. Retry before staging a notice.', { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
