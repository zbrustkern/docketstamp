# Frozen implementation contract — SPRINT-0012

This contract is coordinator-owned. Workers may propose a correction before changing cross-worker shapes.

## Pure module: src/lib/docket/template-policy.ts

Export these types and constants without server imports:

```ts
export type GeoRule = { mode: 'all' | 'allowlist' | 'blocklist'; states: string[] };
export type ReviewStatus = 'unreviewed' | 'in_review' | 'approved' | 'hold';
export type TemplateSource = {
  kind: 'original' | 'official_sample' | 'official_guidance';
  title: string; url: string; jurisdiction: string; retrievedAt: string;
  reuseStatus: 'unverified' | 'permitted' | 'restricted'; notes: string;
};
export type TemplateReview = {
  status: ReviewStatus; reviewer: string; reviewedAt: string | null;
  reviewBy: string | null; evidenceUrl: string; notes: string;
  contentDigest: string | null;
};
export type TemplateSettings = {
  enabled: boolean; requireCurrentReview: boolean;
  residence: GeoRule; property: GeoRule; sources: TemplateSource[];
};
export type TemplatePolicy = TemplateSettings & { review: TemplateReview };
export type GlobalTemplatePolicy = {
  enabled: boolean; requireCurrentReview: boolean;
  residence: GeoRule; property: GeoRule;
};
export type TemplatePolicyDocument = {
  schemaVersion: 1; revision: number; environment: 'local'|'staging'|'production';
  global: GlobalTemplatePolicy; templates: Record<string, TemplatePolicy>;
  updatedAt: string | null; updatedBy: string | null;
};
export type PolicyNexus = { consumerResidenceState?: string; propertyState?: string };
export type PublicTemplateAvailability = {
  slug: string; title: string; category: string; contentDigest: string;
  available: boolean; reasonCode: string | null; reason: string | null;
  requiresResidence: boolean; requiresProperty: boolean;
  residenceRules: GeoRule[]; propertyRules: GeoRule[];
};
export type AvailabilityDecision = {
  allowed: boolean; code: string; message: string; requiredFields: string[];
};
export type PublicAvailabilityResponse = { revision: number; templates: PublicTemplateAvailability[] };
export type AdminTemplateCatalogEntry = {
  slug: string; title: string; category: string; contentDigest: string;
  documentHeaderTitle: string; reLineTemplate: string; bodyParagraphs: string[];
  fields: { key: string; label: string; inputType: string; helperText?: string; options?: {label:string;value:string}[]; maxLength?:number }[];
  policy: TemplatePolicy; availability: PublicTemplateAvailability;
  reviewCurrent: boolean;
};
export type TemplateAuditSummary = {
  auditId: string; revision: number; occurredAt: string; actorId: string;
  reason: string; action: string; targetId: string;
};
export type AdminTemplatesResponse = {
  policy: TemplatePolicyDocument; templates: AdminTemplateCatalogEntry[];
  canManage: boolean; complianceFooter: string; recentChanges: TemplateAuditSummary[];
};
```

Export `US_STATE_CODES` (50 states + DC), `evaluateTemplateAvailability(entry: PublicTemplateAvailability, nexus: PolicyNexus): AvailabilityDecision`. Reject invalid explicitly supplied codes; if a relevant rule has restrictions, missing state returns `LOCATION_REQUIRED` and named required fields. All-rule needs no state. Empty allowlist denies all. Property rules only included for tenant templates. Available=false denies before location; no recipient state inputs. Public errors use a fixed friendly message/code, never private review notes.

## Server: lib/template-policy-store.ts (backend owner)

Implement policy persistence, catalog/content hashing and transactional gates. You may split into server files. Export `getPublicTemplateAvailability(): Promise<PublicAvailabilityResponse>` and shared gate/store helpers. Hash the serialized meaningful current notice definition/field options/required schema, exact footer, applicable state citation data and an explicit rendering-policy revision. Document bumping that revision for relevant interpolation mapping changes. Do not put server hashing in client bundle.

Global/per-template enabled, review hold, then required-current-review gate, then all residence/property rules. Requirements combine with OR; allow rules intersect; global deny always wins. Review dates must be valid; expiry is not silently extended. Missing policy doc uses explicit existing-nine migration defaults, future templates disabled. Read/parse errors fail closed. No client cache on authoritative gate.

## HTTP

`GET /api/admin/console/templates`: `AdminTemplatesResponse`, no-store, reports.read. `canManage` reflects real controls.manage permission. Current content/body shown to authorized admin only; no legal prose mutation.

`POST /api/admin/console/templates`: controls.manage, proper human Origin checks; strict schema:

```ts
type Common = { requestId: string; reason: string; expectedRevision: number };
type Mutation =
 | (Common & { action: 'set_global'; global: GlobalTemplatePolicy })
 | (Common & {
     action: 'set_template'; slug: string; expectedContentDigest: string;
     settings: TemplateSettings;
     // Omitted unless operator explicitly chooses to record/update a review.
     review?: { status: ReviewStatus; reviewer: string; reviewBy: string | null; evidenceUrl: string; notes: string };
   });
```

Server preserves existing review when review is omitted; when supplied it stamps `reviewedAt`, current verified digest and audit actor itself. Approved requires nonempty reviewer/evidence and a future reviewBy date. Evidence URL accepts only https/http; original source may have an empty URL if clearly original; external source entries require valid https/http. Bound all lists/strings and reject unknown slugs/states/actions/extra fields. A review recorded by an operator isn't automatically a lawyer approval.

Atomic policy CAS+audit+idempotency receipt. Same actor/request/payload replay returns success without another policy revision; different payload same key or stale revision returns409. Successful response `{ success: true, revision: number, auditId: string, duplicate?: boolean }`; client reloads GET. Error `{error: string, code: string}` with meaningful401/403/400/409/503. Persist immutable audit before/after and bounded recent summary history; can return history from bounded embedded policy-associated metadata while full audit remains separate.

`GET /api/docket/availability`: `PublicAvailabilityResponse`, no-store/dynamic. No review/source/private audit notes. Optional query not required; clients evaluate with shared pure function. Backend discovery uses same projection.

## Nexus transport / coordinator client ownership

Use reserved `userValues.consumerResidenceState` and `userValues.propertyState` on lock; `fieldValues` equivalent for stage/REST/MCP/WebMCP. These are policy facts outside printed schema. `propertyState` is already the deposit citation field and must be one authoritative value. No extra top-level nexus required and no incompatible existing schema replacement. Expose reserved policy fields and location-required errors in agent discovery; parse full values at gate before Zod may strip extras. Stage store preserves them explicitly. URL hydration/draft recovery must carry them; coordinator owns client changes.

Coordinator wraps DocumentWorkspace in a location/availability gate before loading editing UI when required. It fetches policy (fail closed), uses existing draft/URL propertyState if explicit, asks only missing residence/property via select, and passes collected nexus as initialValues. Client gate is helpful UI, server lock revalidates. Review/availability failures show helpful unavailable UI and retry on transport failure. Already-open pages may become stale; lock remains authoritative. Home chooser/discovery should hide paused templates after loading policy and never offer a disabled default sample as available.

## Work ownership

Backend worker: pure module, server store/APIs, stage creation/retrieval+MCP, lock-and-intent+order decision type, server notice page, llms/OpenAPI/sitemap/discovery, backend tests. Own exact new HTTP contract above. No admin component, no customer components/hooks, no main ledger/spec changes.

Admin worker: `src/components/admin/TemplateGovernancePanel.tsx`, new direct admin route if useful, and narrow nav insertion in `app/admin/page.tsx`; UI tests. Import pure types; do not edit policy/store/server API files. Full current source body/fields and footer viewer, global and per-template controls with accessible label/input pairs, save confirmation/reason, readonly permissions, conflict/error handling. Do not add prose editor. Isolated clone.

Coordinator: customer components/hooks/home integration, research/spec addenda/run/ledger, final merge and validation. Disjoint clones, one writer per checkout.

## Critique clarifications

`reviewCurrent` is true only for approved status, matching current server digest, valid nonfuture reviewedAt, valid future reviewBy and required reviewer/evidence. Evaluate dates on server. Admin must distinguish revision0 migration defaults from a saved policy; neither status is legal clearance.

Staged retrieval accepts explicit query `consumerResidenceState`/`propertyState` after the customer location gate, merges them into a copy of staged policy facts (no stored mutation), and rechecks current policy. This lets an old stage missing newly-required nexus be resumed after the customer answers. Reject conflicting supplied deposit property-state declarations; do not silently replace the original propertyState. Returned draft may include confirmed residence/missing property additions so hydration is consistent; later lock uses current policy again. Coordinator's hydration fetch supplies the gate's declared policy fields.
