import { NextResponse } from 'next/server';
import { getAllNotices, DOCKET_PRICING_TIERS } from '@/src/lib/docket/notices';
import { getAllVerifiedRecipients } from '@/src/lib/docket/data/verified-recipients';

export const dynamic = 'force-dynamic';

function generateLlmsTxt(): string {
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

      return `### Cartridge ${idx + 1}: ${n.title}
- **Slug**: \`${n.slug}\`
- **Category**: \`${n.category}\`
- **Document Header**: "${n.documentHeaderTitle}"
- **Recommended USPS Tier**: \`${n.recommendedTier}\` (${DOCKET_PRICING_TIERS[n.recommendedTier]?.formattedPrice || '$19.95'})
- **Recipient Mode**: \`${n.recipientMode}\`
- **Description**: ${n.shortDescription}
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
> AI agents (Claude, ChatGPT, cursor agents, local CLI tools) can stage partially or fully populated formal statutory notices without an API key, OAuth flow, or payment credentials.
> The agent delivers a 1-Tap Review Link to the human user: \`https://docketstamp.com/notices/[slug]?stage=DS-STAGE-XXXXXX\`.
> The human user reviews the rendered 8.5x11 physical letter, adopts an electronic signature, and executes payment via Apple Pay or credit card for physical USPS postal dispatch.

---

## 1. Statutory Guardrails & Compliance Disclosures
- **UPL Compliance**: DocketStamp is an automated self-help document preparation and USPS postal dispatch utility, NOT a law firm, and does not provide legal representation or legal advice. All notice cartridges are deterministic form instruments where factual parameters are supplied by the user or staging agent.
- **Strict Conflict-of-Interest Exclusion (NAICS 713940)**: DocketStamp strictly excludes gyms, health clubs, fitness centers, and fitness membership billing disputes (NAICS 713940). Staged requests referencing gyms or fitness clubs will be rejected with HTTP 400 (\`CONFLICT_OF_INTEREST\`). Connected hardware, consumer electronics, and home appliance manufacturers (Withings, Garmin, Ecobee, LG, Samsung, Canon, Sonos, Roku, etc.) ARE fully supported.

---

## 2. Dispatch Tiers & USPS Pricing
1. **Standard First-Class Mail (\`first_class\`)**: $12.95
   - Official Clerk's Docket Stamp registry recording & USPS IMb barcode tracking.
2. **USPS Certified Mail® (\`certified\`)**: $19.95
   - USPS Certified Mail tracking number, electronic proof of acceptance, admissible in court.
3. **USPS Certified Mail® + Return Receipt (\`certified_return_receipt\`)**: $27.95
   - Electronic Return Receipt (ERR) green card signature proof. Legally conclusive delivery date verification.

---

## 3. 1-Tap Review URL & Pre-fill Syntax
Agents can direct human users to interactive notice workspaces via two methods:

### Method A: Staged Draft Review Link (Recommended)
\`https://docketstamp.com/notices/{slug}?stage={stageId}\`
Example: \`https://docketstamp.com/notices/pre-arbitration-notice-of-dispute-and-refund-request?stage=DS-STAGE-84A19F\`

### Method B: Direct URL Query Parameter Pre-fill
\`https://docketstamp.com/notices/{slug}?recipientId={recipientId}&tier={tier}&field.{fieldKey}={value}\`
Example: \`https://docketstamp.com/notices/pre-arbitration-notice-of-dispute-and-refund-request?recipientId=leg_wth&tier=certified_return_receipt&field.productOrServiceName=Withings+Body+Smart+Scale\`

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

## 6. Official Statutory Notice Cartridge Catalog (${notices.length} Active Cartridges)

${noticesListMarkdown}

---

## 7. Pre-Verified Institutional Recipients Registry (${recipients.length} Verified Recipients)

| ID | Brand Name | Category | Formal Legal Recipient Line | Location | Recommended Tier | Required Identifiers Hint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${recipientsTableRows}
`;
}

export async function GET() {
  const body = generateLlmsTxt();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
