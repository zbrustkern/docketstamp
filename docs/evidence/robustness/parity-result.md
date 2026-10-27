# Physical preview parity implementation result

## Delivered

- Added [`physical-layout.ts`](../../../src/lib/docket/renderer/physical-layout.ts) as the shared source for Letter page dimensions, address-window placement, docket stamp, body rectangle, type sizes, signature, and compliance footer.
- Updated the Lob HTML shell to use that layout while leaving the 0–1.80in top area empty for Lob's configured `address_placement: 'top_first_page'`. The preview still shows clickable sender/recipient address representations in that area as an illustrative supplier overlay; local preview output does not prove Lob's final placement.
- Rebuilt `LivePaperSheet` as a fixed 8.5 × 11 inch page scaled to fit available viewport width and height. Text and content positions use the print measurements. Token and address controls remain keyboard-focusable and clickable; their visual highlights do not add padding or borders to the letter flow. Status comes from the interpolated document record.
- Added a 27-case content/geometry sweep across all nine templates and three mailing tiers using maximum field values and long identifiers. It checks Letter/page geometry, absence of customer-owned address blocks from the supplier clear zone, paragraph retention in generated HTML, and the verbatim UPL footer. Paper overflow is visible instead of clipped by CSS, so browser layout review can observe spill.

## Verification

- `tests/physical-layout-parity.test.ts` and `tests/marketing-privacy-boundary.test.ts` — 6 passed; the physical test covers 9 templates × 3 tiers (27 static content cases), including an empty Lob top-first-page address zone. These checks do not establish visual fit.
- In `tests/docket-cartridges.test.ts`, the existing maximum-length single-page geometry stress test passed. The broader suite has one unrelated template-copy assertion failure (`moveOutDate` wording).
- In `tests/wp2-verification.test.ts`, the exact Lob geometry checks passed. The broader suite also reports an existing template-copy assertion failure and a lock fixture now receiving `ADDRESS_NORMALIZATION_REVIEW_REQUIRED` because mock CASS standardized its address; the fixture needs accepted evidence or normalized address input.
- The filtered S7 run passed all three Area 7 geometry/parity subtests. Its selected run also included a checkout-tier fixture that returned 409 under the new address-review gate.
- `npx tsc --noEmit --pretty false` — passed after concurrent workspace type errors were resolved.

## Evidence limits

No browser rendering engine or local browser test renderer is installed in this workspace, so the sweep confirms generated content and CSS geometry but does not measure rendered glyph bounds or prove that every maximum-length case fits the fixed sheet. No Lob test-key proof was produced. A browser-render pass for overflow/footer visibility and a Lob test-mode proof remain the parity evidence gate; local tests are not provider acceptance evidence.
