# Luna implementation report — SPRINT-0013

## Result

Implemented the `/letters` library and six cancellation starting points using the existing notice metadata, cancellation select options, availability hook, and workspace hydration contract. The six starting points are grouped under one existing cancellation letter. Policy loading, errors, missing entries, and unavailable templates expose no start links. Existing location checks remain in the workspace.

The homepage retains its single chooser and gains a mobile-visible footer link to the library. The library route is included in the sitemap and carries both existing statutory and UPL disclosures. No guarantee that a mailed letter cancels a service or achieves another requested result is made.

## Changed paths

- `src/lib/docket/letter-library.ts`
- `src/components/docket/LetterLibraryClient.tsx`
- `app/letters/page.tsx`
- `app/page.tsx` (footer navigation link only)
- `app/sitemap.ts`
- `tests/letter-library.test.ts`
- `.delivery/runs/2026-10-21-letter-library/luna-implementation-report.md`

## Checks run

- `node --import tsx --test tests/letter-library.test.ts tests/s2-chooser-and-routing.test.ts tests/s3-homepage-composition.test.ts tests/template-availability-client.test.ts` — passed, 54 tests.
- `npm run test:template-governance` — passed, 26 tests.
- `npx tsc --noEmit` — passed.
- `git diff --check` — passed.

## Ordered-list layout adjustment

Changed the four-step list to use inside markers and padded, bordered list items so each number stays within its own responsive grid cell. The semantic ordered list and mobile single-column flow remain intact.

Rechecks:

- `node --import tsx --test tests/letter-library.test.ts tests/s3-homepage-composition.test.ts` — passed, 28 tests.
- `npx tsc --noEmit` — passed.
- `git diff --check` — passed.
- Protected source hash comparison against `protected-files.json` — all protected hashes match baseline.

Focused tests cover all six option-derived values, exact one-parameter URLs, rejection of unknown presets, hydration into the existing editable select, canonical availability filtering, and the existing location policy gate. Browser viewport and interactive policy-state verification remain for the coordinator's independent verification step; no deployment, payment, or dispatch was performed.

## Coordinator-requested UI polish

Updated the cancellation group to customer-facing wording (“Cancellation starting points” / “Choose what you want to cancel”) and shortened the availability note to explain that some letters may require additional information or a location check. Added a prominent “Browse letters” link beside “Browse the directory” in the existing homepage callout, with stacked full-width links on small screens. The footer link, chooser, directory link, and legacy anchors remain.

Rechecks after polish:

- `node --import tsx --test tests/letter-library.test.ts tests/s3-homepage-composition.test.ts` — passed, 28 tests.
- `npx tsc --noEmit` — passed.
- `git diff --check` — passed.
