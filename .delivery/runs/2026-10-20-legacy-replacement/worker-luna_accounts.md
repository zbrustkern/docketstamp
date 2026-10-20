# Luna account UI delivery

Implemented the account and address-book portion of SPRINT-0007 in the isolated `accounts` clone.

- Replaced milestone/birthday cards and old `/` card-builder links with a supported notice chooser that deep-links to `/notices/[slug]` and hydrates recipient and default sender fields through the existing `field.*` URL contract.
- Added a one-time notice deadline reminder panel with explicit deadline date, IANA timezone, label, supported notice, lead-time choice, and required per-reminder consent. It lists status and delivery errors, supports update and opt-out, and treats missing/unknown readiness as disabled. The page does not send email.
- Removed automatic reminder creation from contact save and bulk import. Historical occasion data remains retained/displayed as metadata only; imports no longer show a birthday-reminder opt-in.
- Updated return-address wording and added save/import/delete error feedback. Contact save preserves existing historical occasion metadata without exposing occasion/reminder controls.
- Simplified order-history labels to avoid claiming a record is certified/dispatched or identifying an unconfirmed postal provider. No provider lookup is performed from the account page.

## Validation

- `npx tsc --noEmit --project tsconfig.app-check.json --pretty false` — passed.
- `node --import tsx --test tests/account/notice-prefill.test.ts` — passed, 2 tests. Verifies recipient/sender URL hydration and no invented recipient values.
- `node --import tsx --import ./tests/helpers/firebase-auth-test-verifier.ts --test tests/notice-deadline-reminders.test.ts tests/reminders.test.ts` — passed, 11 tests, including ownership, date/DST/leap behavior, opt-out, retry/dedup, past-deadline behavior, and no payment/postal side effects.
- `git diff --check` — passed.
- `npm run build` was attempted but blocked when `next/font` could not reach `fonts.googleapis.com` for Inter, JetBrains Mono, and Merriweather (`getaddrinfo ENOTFOUND`).
- Authenticated desktop/mobile browser interaction was not run in this isolated environment. Inputs, controls, and action buttons have visible keyboard focus and accessible labels; the notice-prefill behavior is covered by route-hydration tests.

No external scheduler was enabled and no real email, payment, or postal operation was performed. The isolated account clone does not yet contain the order lane's upcoming browser-safe provenance module; current provider labels stay conservative and report unknown when provider evidence is absent or conflicting.
