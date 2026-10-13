# Mild preset card refresh

Proposed October 13, 2026. Based on visual inspection of all eleven artwork files referenced by `lib/card-presets.ts`, the canonical project brief, and canonical product specifications. This is a design proposal, not an implemented change or a validated customer result.

## Direction

Keep the warmth and care, but let different occasions have different visual voices. The collection should feel curated rather than generated from one botanical template. Unity should come from considered composition, restrained palettes, readable lettering, and an emotionally appropriate tone—not from giving every card flowers and a cream background.

Replace four covers and gently revise one. Keep six covers visually unchanged for this round; any eventual geometry adjustments should preserve their artwork.

| Occasion | Current visual finding | Proposed action |
| --- | --- | --- |
| Birthday | Floral bunting reads as a garden party, with no unmistakable birthday cue. | Replace with a cheerful cut-paper cake design and “Happy Birthday.” |
| Congratulations | Clinking glasses are surrounded by holly, pine, and red berries. It reads seasonal and repeats Anniversary's circular botanical framing. | Replace with a bold graphic celebration, navy ground, large “Congrats!,” and restrained confetti. No alcohol or achievement-specific symbols. |
| Anniversary | Rose/eucalyptus wreath and ribbon suggest wedding stationery more than another year together. | Replace with a simple ribbon forming a heart and “Happy Anniversary.” |
| Sympathy & Support | Olive branch is peaceful, but the sentiment depends entirely on the occasion label. | Replace with a quiet typographic “Here for you” cover. Let the words carry care rather than inventing a vague symbolic scene. |
| Thinking of You | Dense illustrated coffee/window/journal scene; conspicuous outlines and incidental journal lettering. | Preserve the cozy coffee idea, simplify it into an atmospheric painted still life, and remove incidental writing. |
| Love & Romance | Dark oil-style roses already supply richness and a different mood. | Keep wordless. |
| Just Because | The loose wildflower bouquet is inviting and appropriately open-ended. | Keep wordless. |
| Thank You | Expansive meadow, with a welcoming sense of light and abundance. | Keep wordless for this round. |
| Halloween | Strong amber/navy contrast and an immersive lantern/harvest scene. | Keep wordless. Its atmosphere is worth preserving. |
| Christmas & Holidays | Evergreen, berries, and pinecones supply recognizable seasonal cues. | Keep this round. |
| Easter & Spring | Blossoms convey spring, even without an explicit Easter symbol. | Keep this round; do not treat it as proof of Easter recognition. |

## Should covers have words?

Yes, selectively. Recommend wording on Birthday, Congratulations, Anniversary, and Sympathy & Support. These phrases clarify the gesture and introduce typography as another design style. Keep Thinking of You wordless initially, along with the retained artwork.

“Here for you” works across bereavement and other difficult circumstances. “With sympathy” would narrow the card to loss; if that is desirable later, make it a separate variant. Avoid assurances such as “Everything happens for a reason,” “Stay strong,” or “Better days ahead,” which can impose an interpretation on someone's experience.

Cover wording is part of the printed cover image. It is separate from the sender's personal interior note and should not be placed in `defaultPrintedMessage`: the current optional greeting is combined with the pen-written interior message.

## Gemini-ready prompts

Paste one complete prompt per generation. Generate three candidates for each changed occasion before choosing a winner. These describe desired results, not guaranteed Gemini capabilities. If the requested dimensions are unavailable, compose with room for an eventual 17:22 crop. Check the actual file dimensions afterward.

The target front is 4.25 × 5.5 inches, or 17:22. A 1275 × 1650 pixel master corresponds to 300 pixels per inch at that size. Asking for “300 DPI” alone does not guarantee enough pixels. The 8% inset below is a conservative design working margin, not a verified supplier bleed requirement.

### 1. Birthday — Make a Wish

Create one finished greeting-card front as flat two-dimensional artwork, portrait 17:22, ideally 1275 × 1650 pixels or larger at the same ratio. The artwork must fill the entire image; no photographed card, mockup, envelope, table, folded edge, cast shadow, watermark, logo, or signature. Keep all lettering and essential motifs at least 8% inside every edge. Use a subtle illustrated texture, not simulated embossing or metallic foil.

Design an adult-friendly birthday card in a sophisticated cut-paper collage style. One generous, slightly irregular round birthday cake on a simple cobalt-blue pedestal, warm coral icing, exactly five slender lit candles, and a few oversized paper confetti shapes. Pale butter-yellow background with substantial breathing room. Use broad matte shapes, subtle paper grain, and crisp readable silhouettes. Cheerful and affectionate, never childish. Place the exact words “Happy Birthday” prominently above the cake in warm, dark-cobalt rounded serif lettering, comfortably readable at thumbnail size. No other text. Avoid flowers, botanical garlands, bunting, balloons, cute faces, age numerals, photorealistic food, rainbow clutter, and glossy 3D rendering. The result should immediately read as birthday, with the cake as the dominant visual cue.

### 2. Congratulations — A Big Moment

Create one finished greeting-card front as flat two-dimensional artwork, portrait 17:22, ideally 1275 × 1650 pixels or larger at the same ratio. The artwork must fill the entire image; no photographed card, mockup, envelope, table, folded edge, cast shadow, watermark, logo, or signature. Keep all lettering and essential motifs at least 8% inside every edge. Use a subtle illustrated texture, not simulated embossing or metallic foil.

Design an energetic, sophisticated graphic congratulations card. Deep midnight-navy background; oversized warm-ivory humanist sans-serif lettering reading exactly “Congrats!” on one generous line, with no additional text. Make the lettering the clear focal point. Place a small number of asymmetrical coral, ochre, and pale-blue starbursts and confetti strokes around it, leaving generous space. Use restrained screen-print-style grain and clean flat shapes. Personal, exuberant, and suitable for many happy milestones, rather than a corporate award. Avoid floral wreaths, greenery, champagne, hands, holly, pine, berries, graduation caps, babies, houses, trophies, wedding imagery, metallic effects, and children's-party clip art. It should be unmistakably distinct from a romantic anniversary card and from a birthday cake card.

### 3. Anniversary — Another Year Together

Create one finished greeting-card front as flat two-dimensional artwork, portrait 17:22, ideally 1275 × 1650 pixels or larger at the same ratio. The artwork must fill the entire image; no photographed card, mockup, envelope, table, folded edge, cast shadow, watermark, logo, or signature. Keep all lettering and essential motifs at least 8% inside every edge. Use a subtle illustrated texture, not simulated embossing or metallic foil.

Design a tender, understated anniversary card in a minimal ink-and-gouache illustration style. Warm ivory background. One continuous deep-burgundy ribbon curves into a large open heart in the upper-middle area, its two tails resting together below. The ribbon must have an elegant, believable continuous path and restrained shading, not ornate curls. Place the exact words “Happy Anniversary” beneath the heart in generous, readable burgundy serif lettering. No additional text. Use dusty-rose accents sparingly and abundant negative space. Intimate and enduring, appropriate both for a partner and for celebrating another couple. Avoid flowers, wreaths, champagne, confetti, wedding rings, brides, grooms, dates, year counts, gendered silhouettes, shiny satin rendering, and glitter. The result should feel like celebrating love that continues, not a wedding invitation or Valentine's novelty.

### 4. Sympathy & Support — Here for You

Create one finished greeting-card front as flat two-dimensional artwork, portrait 17:22, ideally 1275 × 1650 pixels or larger at the same ratio. The artwork must fill the entire image; no photographed card, mockup, envelope, table, folded edge, cast shadow, watermark, logo, or signature. Keep all lettering and essential motifs at least 8% inside every edge. Use a subtle illustrated texture, not simulated embossing or metallic foil.

Design a quiet, compassionate typography-led card suitable for bereavement, illness, or a difficult time. Pale dove-blue background with extremely subtle fine grain. Center the exact words “Here for you” over two lines, “Here” above “for you,” in large, warm charcoal serif lettering with open spacing and substantial negative space. A fine charcoal rectangular rule may frame the composition, positioned well inside the edges and lighter than the lettering. No pictorial illustration and no other text. The warmth should come from humane letterforms, spacing, and softness rather than decoration. Avoid flowers, olive branches, sunsets, birds, candles, crosses, angels, religious imagery, hearts, decorative flourishes, motivational slogans, funeral-black styling, and low-contrast pale lettering. It must feel attentive and personal, not clinical, cheerful, or like a corporate condolence template.

### 5. Thinking of You — A Quiet Cup

Create one finished greeting-card front as flat two-dimensional artwork, portrait 17:22, ideally 1275 × 1650 pixels or larger at the same ratio. The painting must fill the entire image; do not depict the artwork on a physical card. No mockup, envelope, folded edge, watermark, logo, or signature. Keep the essential subject at least 8% inside every edge.

Paint a quiet, intimate still life in an understated contemporary oil-painting style. One softly irregular blue-gray ceramic coffee cup on a warm wooden surface beside a window, with gentle late-afternoon light and a muted suggestion of green outside. Show only a narrow part of the window; keep the cup the clear focal point. Palette of muted slate blue, warm honey, soft cream, and restrained olive. Use believable cup proportions, soft edges, broad economical brushwork, and subtle tonal depth. Cozy and reflective, with room to breathe. Not a detailed storybook scene. No text anywhere, no notebook, journal, pencil, flowers, patterned coaster, faces, cartoon outlines, oversized steam curls, ornate window frame, or photographic rendering. The result should feel like an ordinary moment that reminded someone of a friend.

## Typography fallback

Inspect every generated phrase letter by letter. If the artwork is good but lettering fails, regenerate the same composition with no text and a clean reserved area, then add the exact wording in a layout editor. Do not accept distorted lettering as painterly charm. Maintain an editable artwork-only master for later changes. Do not add extra slogans to fill space.

## Validation criteria

These are proposed acceptance thresholds, not measured findings. Use ten personal senders unfamiliar with the design brief for a lightweight comparison. Show old and new artwork in randomized order, without occasion labels; do not introduce the cards using their intended occasions.

1. **Occasion recognition:** After a five-second view of each final cover, at least 8/10 identify Birthday, Congratulations, and Anniversary correctly. At most 1/10 mistakes Anniversary for a wedding announcement or Congratulations for Christmas. Accept broad milestone interpretations for Congratulations.
2. **Support clarity and sensitivity:** At least 8/10 describe the support card as care, comfort, or being there for someone. Separately ask whether they would send it after a bereavement, during illness, and during a difficult personal period; record responses for each scenario. Any report that it dismisses grief or imposes religion deserves review before approval. Participants need not disclose personal experiences.
3. **A visibly broader collection:** Show the full eleven-card set. At least 8/10 agree that it offers several distinct styles rather than variations of one floral style. Birthday, Congratulations, Anniversary, and Support must remain easy to distinguish in a grayscale contact sheet through composition and lettering, not only color.
4. **Preserved quality:** At least 8/10 rate the revised collection 4/5 or higher for “I would feel good sending a card from this collection.” Compare this with their rating of the original collection. Ask whether any revised cover feels cheap, childish, corporate, or out of place; recurring comments from three or more people trigger revision. Founder approval remains required for taste and occasion suitability.
5. **A calmer Thinking of You:** At least 8/10 call the revised version warm or thoughtful, and no more than 2/10 describe it as cartoony or childish. Compare old and new directly after the initial independent impressions.
6. **Mobile readability:** Inspect actual previews at 160–180 pixels wide and in the gallery at 320- and 390-pixel viewport widths. At least 9/10 can read each cover phrase without zooming. Selection badges must not cover words or essential subjects. Check the expanded preview too.
7. **Artwork and print gates:** Exact spelling; no accidental text, signatures, watermarks, malformed objects, or physical-card mockups. Verify actual pixel dimensions and 17:22 crop without stretching. Inspect exported artwork at full resolution and make an ordinary local print at 4.25 × 5.5 inches to assess readable lettering, dark detail, and pale backgrounds. This is a useful proof, not confirmation of supplier output or stock. Verify supplier bleed/safe-area requirements before final fulfillment assets are approved.
8. **Preservation gate:** The six retained designs receive no aesthetic overhaul. If reframing is needed for correct geometry, compare before and after to ensure their essential subjects and the founder's preferred qualities survive.

The application has some 5:7 gallery/preview framing despite the verified 17:22 product format. Validate the generated masters, actual previews, and final cover output independently; a correct master does not guarantee a correct crop in the current UI. Do not automatically regenerate liked artwork merely to change dimensions.

## Scope and rollout

Start with Birthday, Congratulations, and Anniversary candidates, then Support, then Thinking of You. Judge the whole collection before final selection; isolated attractive images can still make a repetitive catalog. Preserve the existing files and use new filenames when approved replacements are eventually installed.

This proposal does not replace assets, change site behavior, or run fulfillment. These design checks can establish recognition, readability, tone, and variety. They cannot establish a conversion improvement. Independent customer conversions remain zero at the canonical baseline; any later commercial evaluation needs eligible-session and customer-order measurement that excludes founder tests.
