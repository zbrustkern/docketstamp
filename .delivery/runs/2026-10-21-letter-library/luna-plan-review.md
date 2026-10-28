# Luna planning critique — letter library

## Feasibility

The proposed `/letters` page is feasible within the stated boundary. `ALL_NOTICE_CARTRIDGES` and `CHOOSER_LETTERS` already define the nine compiled notices and their customer-facing chooser metadata. `/api/docket/availability` and `useTemplateAvailability()` provide the current policy-backed discovery state. The cancellation template's `serviceTypeLabel` select options are the authoritative six choices, and `resolveInitialWorkspaceDraft()` already accepts `field.<key>` query values while preserving the existing workspace validation and policy gates.

The opportunity scan supports this as discovery and fulfillment convenience only. It explicitly separates existing products and recipient inventory from legal clearance, and says dispatch does not itself establish that cancellation or another requested outcome occurred. The library must describe the six items as starting points within one existing cancellation letter, rather than as six templates or company-specific procedures.

## Corrections to carry into implementation

- Derive the six task values and labels from the cancellation template's existing `serviceTypeLabel` field options, or assert exact equality against that field. Do not retype a second authoritative enum. Each link must set only `field.serviceTypeLabel`; do not reuse the homepage chooser URL builder if it can add a recipient, tier, or other selection.
- Build the nine-letter list from canonical chooser metadata and intersect it with the availability response. Require an explicit matching response entry with `available === true`; a missing entry, malformed response, request error, or loading state must leave the page without start links. A globally paused policy will therefore produce no actionable entries. Keep retry on request/response errors.
- Treat the six cancellation tasks as six ways to start the same canonical `service-cancellation-request` notice. Do not count them as separate templates or add them to the nine-notice count. Avoid a fixed “9 available” claim because policy can change; derive counts from the currently listed notices and label cancellation tasks separately.
- Availability discovery is not the location decision. A currently enabled notice may still require a residence or property state. Do not infer location or imply eligibility on `/letters`; navigating to the existing workspace must retain its location gate and all server-side checks.
- Make the home entry visible at mobile widths. The existing desktop header navigation is hidden below `lg`; a link only there would miss the mobile acceptance criterion. Keep the existing chooser intact and add a concise browse entry in a visible home section or footer.
- Reuse the mandatory self-help and UPL disclosures on the new page. Describe the customer path as completing the form, reviewing/signing, paying, and DocketStamp preparing and mailing the selected letter. Do not say the letter itself cancels service, that a recipient will accept it, or that it establishes legal compliance.
- Preserve the exact six existing field values, editable select behavior, template body/schema, canonical slug, template policy, and chooser URL contract. No recipient, tier, personal data, policy state, registry, or notice copy should change.

## Acceptance refinements

1. For each of the six existing option values, the library link targets `/notices/service-cancellation-request` and contains exactly one query parameter: `field.serviceTypeLabel=<encoded exact option value>`.
2. Hydrating each link preselects the matching existing select choice, which remains editable; all other form values and tier selection remain governed by normal draft-recovery behavior.
3. The general list contains only canonical chooser notices with a matching current availability record marked available. Missing entries are filtered; loading and fetch/parse failure show no start links, with retry for failure. An all-paused response has no actionable links. Conditional geography remains enforced by the workspace.
4. Six cancellation entry points are clearly grouped as existing cancellation-letter starting points and are excluded from notice/template totals. Counts reflect the visible availability-filtered list rather than a hard-coded nine.
5. `/letters` is reachable from a home link visible on mobile and desktop; the existing homepage chooser continues to work as before.
6. The new page carries both existing mandatory disclosure strings and makes no result, acceptance, legal-clearance, or recipient-verification promise.
7. Review the diff to confirm the notice registry, schemas, prose, policy, recipient data, and existing chooser route builder remain unchanged. Local checks should cover route rendering, all six query values/hydration, policy loading/error/missing-entry/all-paused states, and mobile access. Do not deploy.

## Main implementation risk

The key failure mode is presenting the six select choices as six independent products or letting an availability response omission fall through as available. Keep the view-model small and explicit, preserve the current workspace as the only preparation path, and fail closed at discovery.
