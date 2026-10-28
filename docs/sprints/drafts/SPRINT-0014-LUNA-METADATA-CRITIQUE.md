# SPRINT-0014 Luna Lane B — Cross-critique of asset plan

**Review target:** `docs/sprints/drafts/SPRINT-0014-LUNA-ASSETS-DRAFT.md`  
**Evidence reviewed:** current home, square, and cancellation preview PNGs and HTML; current notice registry; current app/public metadata image files.  
**Recommendation:** Keep the direction and bounded two/three-card approach. Resolve the concrete copy, canonical-slug, image-precedence, and dimension mismatches below before implementation.

## Strong points

The previews visibly replace the stale SendMyNotes look with the established DS mark, navy/blue/amber palette, and abstract letter/envelope illustration. The shown sheet contains only generic headings, rules, and a detail tag; it has no actual notice prose, recipient, address, docket ID, barcode, tracking record, or company branding. That keeps the document art clearly illustrative.

The home card makes the approved headline dominant. The square has its own composition and does not crop the wide design. The concise footer says “Self-help document preparation. Not a law firm. No legal advice.” This is suitable as a short brand-positioning line; it need not reproduce the full locked instrument footer, since these are marketing previews and a full legal disclosure would be unreadable at thumbnail scale.

The asset plan correctly gates implementation on the preview checkpoint and keeps asset work separate from metadata writes. Its warning that mocked previews are not actual social-scraper proof is also sound.

## Required corrections

1. **Canonical routes in the asset plan are stale aliases.** Registry canonical slugs are:
   - cancellation: `service-cancellation-request`
   - credit dispute: `credit-report-dispute-request`
   - deposit: `security-deposit-accounting-request`

   The plan currently names `written-contract-and-policy-cancellation-letter`, `fcra-credit-bureau-written-dispute-letter`, and `security-deposit-return-demand-letter`. These are accepted aliases, but metadata and route-variant maps should key to the canonical slugs. Alias requests should resolve to the same canonical image URL and metadata. “Supported alias routes” must be verified against the actual aliases in the registry, not assumed as a full route matrix.

2. **There are two stale Next metadata-file images, not just the configured public image.** `app/opengraph-image.png` and `app/twitter-image.png` are both 1200×630 copies of the obsolete SendMyNotes card. Next’s file-based convention publishes these images and can add OG/Twitter image tags independently of `app/layout.tsx`; updating `public/og-image.png` alone leaves stale tags. Include both app files in the reference/precedence audit and remove or replace both only when the approved versioned assets are ready. Also check the legacy `public/og-image.jpg` references. The source description’s “root/social metadata” should name all these sources explicitly.

3. **Square output dimensions must follow the actual approved file.** The supplied `square.png` is 1080×1080, while the plan says to produce 1200×1200 and calls the handoff an approved square master. Either approve 1080×1080 as the production square (and publish truthful 1080 metadata), or explicitly approve a new 1200×1200 export. Do not silently upscale and label the result 1200. The wide home and cancellation renders are each 1200×630.

4. **Revisit absolute cancellation wording.** “Cancel a service. Put it in writing.” is visually strong, but “Cancel a service” can read as a guaranteed outcome. SPRINT-0011 permits the action “Cancel a service or policy in writing” for the customer’s requested notice, while SPRINT-0014 explicitly bars outcome promises. Recommend “Request service cancellation in writing.” or “Ask to cancel a service.” for the image headline, preserving the preparation action and avoiding a claim that the recipient will cancel. Keep the supporting phrase “Prepare your cancellation letter. We’ll print and mail it.” if the coordinator approves it as the already-approved service positioning.

5. **Availability wording should stay conditional.** “Certified Mail available” is supported as a product option but may read as universally available. The image does not need service-specific availability copy. If retained, phrase it as “Choose an available USPS service at checkout” or use the non-availability-specific workflow. The page’s fail-closed readiness and template-availability gates remain authoritative; art should not suggest a route is enabled.

## Small-preview legibility

At 120×63, the home card’s headline and DS mark remain the first readable elements; the explanatory line becomes small, as expected. At 120×120, the square headline and DS mark retain priority. The self-help line is readable at full size but not at tiny thumbnail scale; that is acceptable for a brand image as long as it remains present at full render. Do not add a requirement that every legal-positioning word be readable at 120px, which would force clutter and undermine the card. Keep QA focused on brand recognition and headline legibility at compact size, and inspect the full-size images for the concise statement.

## Plan adjustments

- Map only canonical slugs in the route variant manifest: cancellation `service-cancellation-request`, credit `credit-report-dispute-request`, deposit `security-deposit-accounting-request`. Keep aliases as incoming paths that normalize to those mappings.
- Add `app/opengraph-image.png` to the asset-precedence/removal list alongside `app/twitter-image.png`; both current files are stale. Audit active references to `public/og-image.png` and `.jpg` before replacement/deletion.
- Resolve the square’s source/output dimensions before specifying metadata. Keep all declared image dimensions and MIME types exact.
- Confirm route-specific copy against SPRINT-0011 and SPRINT-0014: cancellation remains a request, and availability wording does not imply all templates/services are enabled.
- The proposed initial scope can remain modest: shared home-wide and square images plus the cancellation-specific wide variant if the user approves route variants. Credit/deposit art can be deferred; no need to invent more image work solely because the matrix mentions it.
- Extend the head-tag check to assert there are no stale `/opengraph-image.png` or `/twitter-image.png` tags and that alias routes canonicalize to the current registry slug.

No source edits or implementation were made in this review.
