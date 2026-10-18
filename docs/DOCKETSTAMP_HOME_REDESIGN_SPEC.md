# DocketStamp Main Page Redesign Specification (`app/page.tsx`)

**Status:** Canonical Implementation Spec  
**Target Files:**
- `app/page.tsx` (Complete replacement — target `< 220` lines, zero dead marketing sections)
- `src/components/docket/InteractiveHomeWorkbench.tsx` (New — Live above-the-fold conversion & preview engine)
- `src/components/docket/HeaderDocketLookup.tsx` (New — moves post-purchase tracking into the top utility bar)
- `src/components/docket/NoticeCatalogBrowser.tsx` (Refactored — high-density 9-cartridge matrix + 38-entity 1-click routing strip)

---

## 1. Core Objectives & System Invariants

1. **Eliminate "AI Slop" SaaS Brochure Sections**: Remove the 4-box generic feature grid, the hardcoded dead `"Marcus Vance"` specimen, and the standalone 3-column bottom pricing section.
2. **Move Order Tracking Out of the Hero (`<HeaderDocketLookup />`)**: Post-purchase Docket ID lookup (`DS-2026-...`) belongs in the sticky top header bar, freeing 100% of the above-the-fold hero for new visitor conversion.
3. **"Show, Not Tell" Live Interactive Workbench (`<InteractiveHomeWorkbench />`)**:
   - Wired directly to `interpolateNotice()`, `ALL_NOTICE_CARTRIDGES`, `STATE_STATUTES`, `VERIFIED_RECIPIENTS`, `assertNonFitnessEntity()`, and `<LivePaperSheet />` (Invariant 4 WYSIWYG Parity).
   - Visitors can search/pick any of the **38 CASS-Verified Corporate Legal Departments** or **9 Notice Cartridges**, toggle the **50-State Statutory Engine** (`CA`, `NY`, `TX`, `FL`, `IL`, etc.), edit live variables, switch USPS mail tiers (`$12.95` First-Class / `$19.95` Certified / `$27.95` Certified + Return Receipt), and click any glowing Amber DocuSign `[ REQUIRED ]` tag on the 8.5" x 11" sheet to launch `/notices/[slug]?...` with all state pre-hydrated.
   - Typing a prohibited `NAICS 713940` fitness entity (`Equinox`, `Planet Fitness`, `gym`) into the Omnibox visibly demonstrates the runtime compliance guardrail (`assertNonFitnessEntity()`), while hardware OEMs (`Withings`, `Garmin`, `Sonos`, `LG`, `Samsung`, `Tesla`) route cleanly.
4. **High-Density All-Products & 38-Entity Dispatch Matrix (`<NoticeCatalogBrowser />`)**:
   - Displays all 9 deterministic cartridges with statutory citations, field counts, recommended USPS tier pricing, a `"Load in Workbench ↑"` preview button, and a direct `"Draft & Dispatch →"` workspace link.
   - Displays all 38 pre-verified corporate legal recipients grouped by category (`Credit Bureaus`, `Debt Collectors`, `Home Security & Services`, `Telecom & Insurance`, `Tech & Hardware Legal`) as 1-click deep-link chips (`href="/notices/[slug]?recipientId=[id]"`).
5. **Preserve All 6 System Invariants**:
   - Hard NAICS 713940 Fitness Blocker (`assertNonFitnessEntity`)
   - UPL-Safe Administrative Form Letter Positioning (`STATUTORY_COMPLIANCE_DISCLOSURE` & `UPL_COMPLIANCE_FOOTER_TEXT`)
   - Single-Page 8.5" x 11" Geometry & USPS Clear Zones
   - WYSIWYG Dual-Render Parity (`interpolateNotice`)
   - Freeze-Before-Pay Snapshot Integrity
   - Zero Legacy Ghost Strings (`sendmynotes`, `aster & blanche`, `handwrytten` strictly absent)
