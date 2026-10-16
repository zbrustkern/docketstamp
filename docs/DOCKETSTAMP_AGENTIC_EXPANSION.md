# DOCKETSTAMP PHASE 2: CONSUMER TECH BACKLASH CARTRIDGES & AGENTIC API SPEC

## 1. GUARDRAIL REFINEMENT (HARDWARE OEM vs. FITNESS CLUBS)
- **Rule Update for `src/lib/docket/guardrails.ts`:** `assertNonFitnessEntity()` strictly blocks `NAICS 713940` physical gym, health club, and studio memberships (Equinox, Planet Fitness, LA Fitness, Crunch, Orangetheory, ABC Fitness, etc.). It MUST ALLOW consumer electronics and connected hardware manufacturers (e.g., Withings Inc., Garmin, Ecobee, LG, Samsung, Canon, Sonos) so users can send hardware warranty, privacy, and arbitration notices.

---

## 2. NEW VERIFIED GENERAL COUNSEL / LEGAL RECIPIENTS (`category: 'tech_hardware_legal'`)
Append these 8 high-volume corporate legal departments to `src/lib/docket/data/verified-recipients.ts`:

| `id` | `brandName` | `formalRecipientLine` | `addressLine1` | `city` | `state` | `zip` | `recommendedTier` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `leg_wth` | Withings | Withings Inc. — Legal & Consumer Dispute Dept. | 225 Franklin Street, Floor 26 | Boston | MA | 02110 | `certified_return_receipt` |
| `leg_ecb` | Ecobee | Generac / ecobee Inc. — Legal Department | 207 Queens Quay West, Suite 600 | Toronto / US Agent: Waukesha | WI | 53189 | `certified_return_receipt` |
| `leg_lg` | LG Electronics | LG Electronics USA, Inc. — Attn: Legal Dept. (Arbitration/Disputes) | 111 Sylvan Avenue | Englewood Cliffs | NJ | 07632 | `certified_return_receipt` |
| `leg_sam` | Samsung Electronics | Samsung Electronics America, Inc. — Office of the General Counsel | 85 Challenger Road | Ridgefield Park | NJ | 07660 | `certified_return_receipt` |
| `leg_cnn` | Canon USA | Canon U.S.A., Inc. — Legal Division & Consumer Affairs | One Canon Park | Melville | NY | 11747 | `certified` |
| `leg_sns` | Sonos | Sonos, Inc. — Legal Department | 301 Coromar Drive | Goleta | CA | 93117 | `certified_return_receipt` |
| `leg_rku` | Roku | Roku, Inc. — General Counsel & Arbitration Opt-Out | 1173 Coleman Avenue | San Jose | CA | 95110 | `certified` |
| `leg_tsl` | Tesla | Tesla, Inc. — Legal Department (Consumer Disputes) | 1 Tesla Road | Austin | TX | 78725 | `certified_return_receipt` |

---

## 3. DETERMINISTIC CARTRIDGES #07, #08 & #09

### Cartridge 07: `07-pre-arbitration-dispute.ts`
- **Slug:** `pre-arbitration-notice-of-dispute-and-refund-request`
- **Category:** `cancellation` (or `consumer_rights`)
- **Title:** `Pre-Arbitration Notice of Dispute & Feature Paywall Refund Request`
- **Document Header:** `FORMAL PRE-ARBITRATION NOTICE OF DISPUTE AND REFUND REQUEST`
- **RE Line:** `RE: Mandatory Pre-Arbitration Notice of Dispute — {{productOrServiceName}} ({{accountOrSerialIdentifier}})`
- **Recommended Tier:** `certified_return_receipt` (`$27.95`)
- **Recipient Mode:** `verified_or_manual_corp`
- **Fields:**
  - `productOrServiceName` (`text`, max 60, Tag: `PRODUCT / DEVICE NAME`)
  - `accountOrSerialIdentifier` (`text`, max 45, Tag: `SERIAL / ACCOUNT ID`)
  - `purchaseDate` (`date`, Tag: `PURCHASE DATE`)
  - `disputeTriggerCategory` (`select`:
      - `"Post-Purchase Removal or Paywalling of Advertised Feature"`
      - `"Unilateral Modification of Material Terms of Service"`
      - `"Injection of Unsolicited Commercial Advertisements on Hardware"`
      - `"Breach of Express or Implied Hardware/Software Functionality"`,
      Tag: `DISPUTE BASIS`)
  - `factualSummary` (`textarea_short`, max 200, Tag: `FACTUAL STATEMENT`)
  - `requestedResolutionAmount` (`currency`, Tag: `REFUND AMOUNT REQUESTED`)
- **Deterministic Body Prose:**
  1. `PLEASE TAKE NOTICE that the undersigned consumer, {{senderFullName}}, hereby submits this formal written Pre-Arbitration Notice of Dispute pursuant to the mandatory informal dispute resolution provisions of the governing Terms of Service for {{productOrServiceName}} (Account/Device Identifier: {{accountOrSerialIdentifier}}, acquired on {{purchaseDate}}).`
  2. `NATURE OF DISPUTE: {{disputeTriggerCategory}}. Specifically: {{factualSummary}}`
  3. `This post-purchase modification or restriction materially diminishes the core functionality and bargained-for value of {{productOrServiceName}} as represented at the time of purchase.`
  4. `REQUESTED RESOLUTION: To resolve this matter amicably prior to the filing of formal consumer arbitration or small claims proceedings, please remit a full refund/settlement in the amount of {{requestedResolutionAmount}} (or confirm permanent restoration of the affected functionality without recurring fees) to {{senderFullName}} at {{senderFullAddress}} within thirty (30) days of receipt of this notice.`

---

### Cartridge 08: `08-arbitration-opt-out.ts`
- **Slug:** `30-day-mandatory-arbitration-opt-out-notice`
- **Title:** `30-Day Mandatory Arbitration & Class-Action Waiver Opt-Out Notice`
- **Document Header:** `FORMAL WRITTEN NOTICE OF OPT-OUT FROM ARBITRATION AND CLASS WAIVER`
- **RE Line:** `RE: Timely Notice of Opt-Out from Mandatory Arbitration — {{productOrPlatformName}} ({{accountIdentifier}})`
- **Recommended Tier:** `certified` (`$19.95`)
- **Recipient Mode:** `verified_or_manual_corp`
- **Fields:**
  - `productOrPlatformName` (`text`, max 60, Tag: `COMPANY / PLATFORM NAME`)
  - `accountIdentifier` (`text`, max 60, Tag: `ACCOUNT EMAIL OR SERIAL #`)
  - `termsEffectiveOrPurchaseDate` (`date`, Tag: `TERMS / PURCHASE DATE`)
- **Deterministic Body Prose:**
  1. `PLEASE TAKE NOTICE that the undersigned consumer and account holder, {{senderFullName}}, hereby exercises the right to formally opt out of the mandatory binding arbitration provision and class-action waiver set forth in the Terms of Service or User Agreement governing {{productOrPlatformName}} (accepted or effective on {{termsEffectiveOrPurchaseDate}}).`
  2. `ACCOUNT & DEVICE IDENTIFICATION: Consumer Name: {{senderFullName}} | Registered Account / Email / Device Identifier: {{accountIdentifier}} | Registered Mailing Address: {{senderFullAddress}}.`
  3. `Please record this timely postmarked election in my permanent account file confirming that I retain all rights to resolve disputes before a court or regulatory agency of competent jurisdiction, and mail written confirmation of this opt-out registration to {{senderFullAddress}}.`

---

### Cartridge 09: `09-biometric-privacy-deletion.ts`
- **Slug:** `statutory-health-and-biometric-data-deletion-demand`
- **Title:** `Statutory Health, Biometric & Telemetry Data Erasure Demand`
- **Document Header:** `STATUTORY NOTICE OF CONSENT REVOCATION AND DATA ERASURE DEMAND`
- **RE Line:** `RE: Statutory Data Erasure & Revocation of Consent — Account: {{accountEmailOrId}}`
- **Recommended Tier:** `certified` (`$19.95`)
- **Recipient Mode:** `verified_or_manual_corp`
- **Fields:**
  - `accountEmailOrId` (`text`, max 60, Tag: `ACCOUNT EMAIL / ID`)
  - `deviceOrAppCategory` (`select`:
      - `"Connected Health & Biometric Sensor Device"`
      - `"Smart Home & Environmental Telemetry Appliance"`
      - `"Connected Vehicle & Location Telemetry System"`
      - `"Cloud Application & Consumer Profile Account"`,
      Tag: `DEVICE / DATA CATEGORY`)
  - `applicablePrivacyFramework` (`select`:
      - `"Applicable State Consumer Data & Biometric Privacy Statutes (including CCPA/CPRA, MHMDA, TDPSA, and BIPA)"`
      - `"General Consumer Data Protection & Revocation of Processing Consent"`,
      Tag: `STATUTORY BASIS`)
- **Deterministic Body Prose:**
  1. `PLEASE TAKE NOTICE that the undersigned consumer, {{senderFullName}}, hereby revokes all prior consent for the collection, secondary profiling, AI training ingestion, or marketing solicitation derived from my {{deviceOrAppCategory}} associated with Account Identifier {{accountEmailOrId}}.`
  2. `Pursuant to {{applicablePrivacyFramework}}, I formally request the complete and permanent deletion of all personal, telemetry, health, and biometric records linked to {{accountEmailOrId}} across your production databases, analytics warehouses, and third-party data processors.`
  3. `Please immediately cease all promotional communications tied to my device usage and mail written certification confirming complete data erasure to {{senderFullAddress}} within the applicable statutory response period.`

---

## 4. AGENTIC HANDOFF & STAGED DRAFT ARCHITECTURE

### 4.1 Core Design Principle ("Agents Stage, Humans Sign & Pay")
External AI agents (Claude, ChatGPT, browser agents, local CLI tools) must NEVER require an API key, OAuth flow, or wallet balance to prepare a notice.
- Any agent can stage a partially or fully populated draft via URL parameters, REST (`POST /api/docket/stage`), Remote MCP (`POST /api/mcp`), or client-side WebMCP (`navigator.modelContext`).
- The agent receives a **1-Tap Review Link**: `https://docketstamp.com/notices/[slug]?stage=DS-STAGE-XXXXXX`.
- When the human opens the link on mobile/desktop, `<DocumentWorkspace />` hydrates all agent-supplied fields into crisp text on the `8.5x11` sheet, while any missing fields (e.g., sender address or `/s/` signature) glow as clickable Amber `[ REQUIRED ]` DocuSign pills right before Apple Pay checkout.

### 4.2 Four Lightweight Agent Surfaces to Build
1. **URL Query Param + Staged Draft Hydration (`useAgentHydration` hook in `<DocumentWorkspace />`):**
   - Supports direct query param pre-filling (`?recipientId=leg_wth&field.productOrServiceName=Withings+Body+Smart...`) AND server-staged hydration (`?stage=DS-STAGE-XXXXXX`).
   - Auto-advances the Guided Drawer stepper to the first remaining unfilled field (or directly to the `"Adopt Signature & Stamp"` step if all fields are present).
2. **Staged Draft REST Endpoint (`POST /api/docket/stage` & `GET /api/docket/stage/[stageId]`):**
   - Validates incoming fields against partial Notice Zod schema + `assertNonFitnessEntity()`.
   - Stores draft in DB/cache (7-day TTL) and returns `{ stageId, reviewUrl, missingRequiredFields, previewSummary, pricingTiers }`.
3. **Stateless Remote MCP Endpoint (`POST /api/mcp`):**
   - Implements JSON-RPC 2.0 Streamable HTTP MCP transport with 3 tools:
     - `list_docket_notices`: Lists all 9 Notice Cartridges and their field schemas.
     - `search_verified_recipients`: Queries `VERIFIED_RECIPIENTS` by brand name or category.
     - `stage_certified_notice`: Validates inputs, stages a draft, and returns the `reviewUrl` for the human user.
4. **Discovery Manifests (`src/app/llms.txt/route.ts` & `.well-known/openapi.json`):**
   - Machine-readable instructions for LLMs detailing all 9 notice slugs, verified recipient IDs, URL prefill syntax, and `POST /api/docket/stage` schema.