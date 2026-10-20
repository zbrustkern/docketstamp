# Coordinator verification and remaining acceptance

The requested gpt-6-luna workers executed identity, orders/migration, reminders, accounts/history and analytics/admin in isolated local clones. Codex reviewed and integrated their commits, then independently ran the release checks. Actual cross-lane reviews are in worker-luna-final-order-review.md, worker-luna-final-analytics-review.md and worker-luna-cross-review.md. No Antigravity review is claimed.

## Passed release checks

- `npm test`: exit 0. Firebase 6/6; replacement behavioral runner 135/135, including signed concurrent/replayed/out-of-order Lob events; Meta utilities/privacy 18/18; transaction security 10/10; payment mode 26/26; docket 23/23; Stripe bootstrap 11/11; admin/account binding 22/22; unit economics, recursive legacy audit and go-live checks passed.
- `npx tsc --noEmit --incremental false`: exit 0; no additional source exclusions.
- `npm run build`: exit 0; compiled, linted, typechecked and prerendered successfully. Fonts were fetched through approved network access.
- Recursive code/config scan: 78 intentional exact compatibility matches; zero unclassified matches and zero unused exceptions. Exceptions validate owner, reason, retirement, context and maximum count. Archives preserve originals and source hashes.
- Fixture inventory and two-batch migration resume: complete, two proposed provenance annotations, two quarantines; never connected to a real database. Stored manifests contain no notice prose or personal data.
- Chrome local public account/admin/notice screens rendered. A 390px notice viewport had document width 390px. An identical duplicate favicon route was fixed. No Google authentication, signature adoption, checkout payment or customer record mutation was performed in browser QA.

## Review repairs

Adoption evidence is bound into new v2 notice payment hashes; markerless historical payment facts retain their prior shape. Resume cannot override a saved migration cursor. Order responses are explicit authorization-dependent DTOs, verified email cannot reveal another UID's bound order, and prefill posts private data before navigating to an opaque staged link. Admin grant requires verified Google identity. Exact matched historical Lob letters retain tracking without inventing missing snapshot evidence; unknown/conflicting provider references are rejected. Postal status updates transact, deduplicate and preserve terminal states, and all submitted states block redispatch.

Analytics destinations require explicit environment verification. Unsupported report filters are rejected; Meta test codes are local/staging-only; tracked timestamps require accepted sends. Server CAPI is disabled until a real first-party consent flow exists. A client body flag cannot enable it.

## Incomplete acceptance and restart instructions

- **SPRINT-0007 remains active:** authenticated account desktop/mobile keyboard walkthrough through saved recipient → staged notice → review/sign → mocked checkout has not been performed. Automated private prefill/hydration, failure/retry, account ownership, history and checkout checks pass. Use a disposable staging account and mock payment/postage; do not substitute a real purchase.
- **SPRINT-0009 remains active:** build and validate consent preferences, purpose-bound server grant issuance/revocation and server GPC enforcement before enabling CAPI; verify destination ownership separately. Follow docs/marketing-consent-readiness.md. Current delivery is safely disabled, not falsely declared complete.
- Reminder delivery is disabled and no external scheduler was created. Actual historical database inventory/apply and cross-project UID linkage are explicitly excluded, require real read-only evidence and a separately reviewed apply plan. No production release occurred.

## Integration provenance

Main integrated commits: 0a8f79c, b67f837, 64db645, b7f8c9f, 22bf6c1, 01f93b5, 1e455c8, 4eb3dbb, 453034c, 6769963, db33aad and 44f12e3. Final adoption/cursor repair 34d874e17344b041cedc51793ec61fcb19002a66 was applied by reviewed file hunks rather than cherry-picking because its isolated clone represented newly shared files as additions. Existing stronger checkpoint tests were retained and extended. Postal merge kept canonical queued-state and analytics changes; its duplicate regression fixture was updated to a complete frozen notice so it exercises the dispatch guard rather than failing earlier snapshot validation.

Exact deployed source and cloud/public verification belong in deployment.md. The authenticated browser journey and consent feature remain open even if staging rollout succeeds.

## Additional final checks

Admin contracts and reporting oracles passed. The finance oracle initially saw accumulated local mock-store records (24 obligations versus its fresh-fixture expectation of 3); rerunning in a newly created isolated temporary mock-store directory passed. This was test state contamination, not a finance code change. All 23 archived original files match their manifest SHA-256. Both online Firebase project/domain checks pass. The staging rollout and public checks passed; see deployment.md.
