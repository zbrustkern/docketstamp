# Local draft

Create a dedicated library route, keeping the single homepage chooser intact. Use existing chooser titles/subtitles for the nine general letters and a separate group of six cancellation starting points that maps only to the existing cancellation template. No marketed claim that this creates six new templates.

Proposed code: `src/lib/docket/letter-library.ts` for the small task mapping, allowlisted URL construction, and availability-filtered catalog; `src/components/docket/LetterLibraryClient.tsx`; `app/letters/page.tsx`; small links in `app/page.tsx` and library entry in `app/sitemap.ts`.

The client uses `useTemplateAvailability`. Loading/error/global pause must expose no actionable letter links; error permits retry. A missing policy entry cannot default to available. Residence/property gates remain in the existing workspace, with no location inference in library. Canonical URLs use encoded `field.serviceTypeLabel` only for the static, exact existing six values. No recipient, state, signature, account identifier, or mailing tier is auto-selected.

Use the existing visual language and footer disclosures. Intro explains selecting a letter, filling details, reviewing/paying, and DocketStamp printing/mailing. Avoid new claims of recipient acceptance, cancellation success, statutory compliance, verification, or official endorsement. Library has one home/navigation link visible on mobile as well as desktop; do not replace or duplicate the homepage chooser.

Meaningful validation: all six links hydrate the correct existing enum and remain editable; unavailable/missing policy entries are filtered, global pause/error exposes no start links; existing notice/template digests and registry remain untouched; focus/mobile layout smoke; new targeted data/routing tests plus existing chooser, homepage, availability, and governance checks; TypeScript. Run browser smoke against local mocks only.

Primary risks: duplicate counting; a copied template losing governance; stale availability links; accidental auto-selected personal data; new page omitting disclosures; subtly changing the historical chooser URL contract. Keep the library helper separate from `buildChooserWorkspaceUrl`.
