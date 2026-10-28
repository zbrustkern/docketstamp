import { NextResponse } from 'next/server';
import { getAllNotices, DOCKET_PRICING_TIERS } from '@/src/lib/docket/notices';
import { getAllVerifiedRecipients } from '@/src/lib/docket/data/verified-recipients';
import { getPublicTemplateAvailability } from '@/lib/template-policy-store';

export const dynamic = 'force-dynamic';

function generateLlmsTxt(availabilityBySlug: Map<string, { requiresResidence: boolean; requiresProperty: boolean; available: boolean }>): string {
  const notices = getAllNotices();
  const recipients = getAllVerifiedRecipients();

  const noticesListMarkdown = notices
    .map((n, idx) => {
      const fieldsList = (n.fields || [])
        .map(
          (f) =>
            `    - \`${f.key}\` (${f.inputType}${f.maxLength ? `, max ${f.maxLength} chars` : ''}): "${f.label}" | DocuSign Tag: [${f.docusignTagLabel}]${f.helperText ? ` — ${f.helperText}` : ''}${f.options ? ` | Options: ${f.options.map((o) => `"${o.value}"`).join(', ')}` : ''}`
        )
        .join('\n');

      return `### Document Template ${idx + 1}: ${n.title}
- **Slug**: \`${n.slug}\`
- **Category**: \`${n.category}\`
- **Document Header**: "${n.documentHeaderTitle}"
- **Recommended USPS Tier**: \`${n.recommendedTier}\` (${DOCKET_PRICING_TIERS[n.recommendedTier]?.formattedPrice || '$19.95'})
- **Recipient Selection**: ${n.recipientMode.startsWith('manual') ? 'Enter recipient details manually and confirm the correct recipient and submission channel.' : 'A directory suggestion may be selected; confirm the correct recipient and any required submission channel.'}
- **Description**: ${n.shortDescription}
- **Current availability**: ${availabilityBySlug.get(n.slug)?.available ? 'enabled under current policy' : 'currently unavailable or policy check required'}
- **Location inputs**: ${availabilityBySlug.get(n.slug)?.requiresResidence ? 'consumerResidenceState required by current geography rules' : 'no residence state currently required'}; ${availabilityBySlug.get(n.slug)?.requiresProperty ? 'propertyState required by current geography rules' : 'no property state currently required'}
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

  return `# DocketStamp: Document Preparation and USPS Mailing Service

> **Core Architectural Invariant**: "Agents stage, humans sign and pay."
> AI agents (Claude, ChatGPT, cursor agents, local CLI tools) can stage partially or fully populated document requests using user-provided facts, without payment credentials.
> The agent delivers a 1-Tap Review Link to the human user: \`https://docketstamp.com/notices/[slug]?stage=DS-STAGE-XXXXXX\`.
> The human user reviews the rendered letter, adopts an electronic signature, and completes payment before a USPS mailing order is submitted. Provider and USPS events are reported separately when available.

---

## 1. Template Scope and Limitations
- **UPL Compliance**: DocketStamp is an automated self-help document preparation and USPS mailing utility, NOT a law firm, and does not provide legal representation or legal advice. Templates are standardized administrative instruments using facts supplied by the user.
- **Strict Conflict-of-Interest Exclusion (NAICS 713940)**: DocketStamp excludes gyms, health clubs, fitness centers, and fitness membership billing disputes (NAICS 713940). Staged requests referencing gyms or fitness clubs will be rejected with HTTP 400 (\`CONFLICT_OF_INTEREST\`). A listed company or address does not confirm that a particular legal or contract-required channel is supported.
- **Current template availability**: Check \`GET https://docketstamp.com/api/docket/availability\` before staging. Availability can change; server staging and checkout enforce the current policy. When requested, provide \`consumerResidenceState\` as the consumer's explicitly declared residence; for tenant notices, \`propertyState\` identifies the rental property. Neither state is inferred from postal addresses or IP.

---

## 2. USPS Mailing Options & Pricing
1. **Standard First-Class Mail (\`first_class\`)**: $12.95
   - Document record and tracking information when provided.
2. **USPS Certified Mail® (\`certified\`)**: $19.95
   - USPS Certified Mail tracking number and USPS status records when available.
3. **USPS Certified Mail® + Return Receipt (\`certified_return_receipt\`)**: $27.95
   - Electronic Return Receipt request; a USPS record is shown if returned.

---

## 3. 1-Tap Review URL & Pre-fill Syntax
Agents can direct human users to interactive notice workspaces via two methods:

### Method A: Staged Draft Review Link (Recommended)
\`https://docketstamp.com/notices/{slug}?stage={stageId}\`
Example: \`https://docketstamp.com/notices/product-complaint-refund-request?stage=DS-STAGE-84A19F\`

### Method B: Direct URL Query Parameter Pre-fill
\`https://docketstamp.com/notices/{slug}?recipientId={recipientId}&tier={tier}&field.{fieldKey}={value}\`
Example: \`https://docketstamp.com/notices/product-complaint-refund-request?recipientId=leg_wth&tier=certified_return_receipt&field.productOrServiceName=Withings+Body+Smart+Scale\`

---

## 4. Staged Draft REST API
- **Stage Draft**: \`POST https://docketstamp.com/api/docket/stage\`
  - Headers: \`Content-Type: application/json\`
  - Body:
\`\`\`json
{
  "noticeSlug": "product-complaint-refund-request",
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
    "disputeTriggerCategory": "Feature became unavailable or requires an additional payment",
    "factualSummary": "The feature I used is no longer available without an additional monthly payment.",
    "requestedResolutionAmount": "$99.95"
  },
  "recommendedTier": "certified_return_receipt"
}
\`\`\`
  - Response (201 Created):
\`\`\`json
{
  "stageId": "DS-STAGE-84A19F",
  "noticeSlug": "product-complaint-refund-request",
  "reviewUrl": "https://docketstamp.com/notices/product-complaint-refund-request?stage=DS-STAGE-84A19F",
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
  1. \`list_docket_notices\`: Lists all document templates, descriptions, and field schemas.
  2. \`search_verified_recipients\`: Searches recipient address suggestions by brand name or category. A result does not establish the required legal or contractual submission channel.
  3. \`stage_certified_notice\`: Validates inputs, creates staged draft, and returns review link.

---

## 6. Compiled Letter Catalog (${notices.length} Templates; consult current availability before staging)

${noticesListMarkdown}

---

## 7. Recipient Address Suggestions (${recipients.length} Entries)

| ID | Brand Name | Category | Recipient Name | Location | Recommended Tier | Identification Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${recipientsTableRows}
`;
}

export async function GET() {
  let availabilityBySlug: Map<string, { requiresResidence: boolean; requiresProperty: boolean; available: boolean }>;
  try {
    const availability = await getPublicTemplateAvailability();
    availabilityBySlug = new Map(availability.templates.map((entry) => [entry.slug, entry]));
  } catch {
    return new NextResponse('DocketStamp availability is temporarily unavailable; retry discovery before preparing a letter.\n', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  const body = generateLlmsTxt(availabilityBySlug);
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
