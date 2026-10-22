# SPRINT-0014 Luna Asset Lane Report

**Checkout:** `/private/tmp/docketstamp-share-release-20261022`
**Scope:** versioned share cards, legacy OG fallbacks, reproducible card/icon source, existing icon surfaces
**Release status:** assets complete; metadata integration and deployment remain with coordinator/metadata lane.

## Outputs

Copied approved artwork byte-identically: `home.png` (`1200×630`), `square.png` (`1080×1080`), and cancellation to `/share/v1/service-cancellation-request.png` (`1200×630`). The approved source hashes match those files exactly. The other eight route cards are rendered from the finite copy manifest and shared source stylesheet.

| Canonical route / use | Public image | Size | Bytes | SHA-256 | Alt text |
|---|---|---:|---:|---|---|
| Home | `/share/v1/home.png` | 1200×630 | 97,669 | `05b44b127ef40dfd6ac597f3e214ff134ebdd99f5b3dc7fe7c0daf4d4d484cab` | DocketStamp share card: Make it formal. We’ll print and mail it. |
| Square companion | `/share/v1/square.png` | 1080×1080 | 116,191 | `d97d269da3469ef405612d82d8a03e5c4fa3e72021fe1d91e2ecd2bf459f42e4` | DocketStamp square share card: Make it formal. We’ll print and mail it. |
| tenant-notice-of-intent-to-vacate | `/share/v1/tenant-notice-of-intent-to-vacate.png` | 1200×630 | 100,152 | `4e1442b113a4b6c2403a409a0babe13215a7aeddeedfc7332c66423be73b170b` | DocketStamp move-out notice preparation card |
| security-deposit-accounting-request | `/share/v1/security-deposit-accounting-request.png` | 1200×630 | 104,002 | `b7d2f8133b1172fac72a25ecf530a9241400477c4f1d9f3f6103a8b630bad44f` | DocketStamp security deposit demand letter preparation card |
| tenant-repair-and-maintenance-notice | `/share/v1/tenant-repair-and-maintenance-notice.png` | 1200×630 | 102,460 | `03560ba1fe3519cf9392d57470cd7bde8cfb9296a294d99595aae13cf53244ea` | DocketStamp tenant repair request preparation card |
| credit-report-dispute-request | `/share/v1/credit-report-dispute-request.png` | 1200×630 | 100,140 | `8eb8d0ae05291f3142b7a31caacd029c775affb021d8b1a4be3ea04475fd4a62` | DocketStamp credit-report dispute letter preparation card |
| debt-dispute-information-request | `/share/v1/debt-dispute-information-request.png` | 1200×630 | 102,552 | `e0b74dc5cef9163a42550dfb2ffba5a3090abbe57ffdbc0ec84efc63bfc0106e` | DocketStamp debt dispute and verification request preparation card |
| service-cancellation-request | `/share/v1/service-cancellation-request.png` | 1200×630 | 105,909 | `b2decfde5fa1a44be6347f94b8f4ccf026df11998f8d450678b52f155dd015b8` | DocketStamp service or policy cancellation letter preparation card |
| product-complaint-refund-request | `/share/v1/product-complaint-refund-request.png` | 1200×630 | 108,696 | `d28e5fe319d81c79735c8d1f5c393f6f0db8d9260df26b0f5b229de2bfca20bb` | DocketStamp product complaint and refund request preparation card |
| arbitration-opt-out-procedure-request | `/share/v1/arbitration-opt-out-procedure-request.png` | 1200×630 | 105,709 | `966874ab3bf994401972b00386f6a73bc313fe951ad31df2fb37e5848d0fef0e` | DocketStamp arbitration procedure information request preparation card |
| personal-data-deletion-request | `/share/v1/personal-data-deletion-request.png` | 1200×630 | 103,761 | `5c411b6c0fea9711581ce06947942656bcbd72ee8e8822f9ce6caa7b0e9db534` | DocketStamp personal data deletion request preparation card |

The arbitration card reads **“Ask about arbitration / opt-out procedures.”** It describes an information request and does not promise that an opt-out is available, timely, or effective. All route cards use the approved “Certified Mail available” line and the concise self-help/not-a-law-firm disclosure.

## Existing icon replacements

| Existing surface | Dimensions | MIME | SHA-256 |
|---|---:|---|---|
| `app/icon.png` | 512×512 | `image/png` | `7783ab5b5153c24a850abf43306ed43fb14d3ccbf4479b95282cfc8c7e5627c3` |
| `app/apple-icon.png` | 180×180 | `image/png` | `a49afba0e7bdb4aa2776a1cc56625d90a0adf969bb2fb4d84f351fdf317a6996` |
| `public/icon-192.png` | 192×192 | `image/png` | `a48aa998202a1a45c0236c7c00ad0ea08a098b8de839edeca6642518ed6bf68d` |
| `public/icon-512.png` | 512×512 | `image/png` | `7783ab5b5153c24a850abf43306ed43fb14d3ccbf4479b95282cfc8c7e5627c3` |
| `public/apple-touch-icon.png` | 180×180 | `image/png` | `a49afba0e7bdb4aa2776a1cc56625d90a0adf969bb2fb4d84f351fdf317a6996` |
| `public/apple-touch-icon-precomposed.png` | 180×180 | `image/png` | `a49afba0e7bdb4aa2776a1cc56625d90a0adf969bb2fb4d84f351fdf317a6996` |
| `public/favicon-32x32.png` | 32×32 | `image/png` | `5a693ab78d77429b142c53826716e20dcf5168dd4ebcd64e1c39b60073a4a860` |
| `app/favicon.ico` | 32×32 | `image/x-icon` | `adee6bbd1881d93536ffc7bc0edd0be03123ac9e6fcc06c090096e456e94eefd` |

`app/favicon.ico` is now a valid ICO directory containing one 32×32 PNG icon payload; the prior file was a PNG with an `.ico` extension. The blue `#0284C7` DS monogram uses JetBrains Mono, white lettering, and the existing rounded-square mark. App and public icon filenames are unchanged.

## Legacy fallback and source mapping

| Legacy fallback | Dimensions / MIME | Bytes | SHA-256 |
|---|---|---:|---|
| `/og-image.png` | 1200×630 / `image/png` | 97,669 | `05b44b127ef40dfd6ac597f3e214ff134ebdd99f5b3dc7fe7c0daf4d4d484cab` |
| `/og-image.jpg` | 1200×630 / `image/jpeg` | 61,108 | `1247dc4ba651a0f30a300b0d90f32c472349c957ccfc12d6b27c27d7c2baba32` |

The fallback PNG matches the approved home PNG byte-for-byte. The JPEG is a deterministic quality-90 conversion of that same approved source. New card paths are immutable under `/share/v1/`; `public/share/v1/manifest.json` maps canonical slugs, alt text, dimensions, MIME type, byte sizes, and full hashes.

Reproducible source files are `scripts/render-share-assets.mjs`, `assets/share/card-copy.json`, `assets/share/card.css`, `assets/share/icon-source.svg`, and the approved PNGs under `assets/share/approved/`. The renderer accepts `PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE_PATH`, `SHARE_ASSET_OUTPUT_DIR`, and `SHARE_CONTACT_SHEET_PATH`; it contains no hard-coded workstation paths. Source fonts and license/provenance are in `assets/share/fonts/` and `assets/share/fonts/licenses/`.

## Verification

- Ran the deterministic renderer in headless Chrome using the local Playwright runtime. It verified loaded Inter, Merriweather and JetBrains Mono fonts, 1200×630 viewports, no document overflow, bounded headline/support text, and generated PNG dimensions/types. All eight rendered route variants passed; home/square/cancellation preserved their approved source hashes.
- Inspected the full share-card contact sheet at `.delivery/share-previews/contact-sheet.png` and icon contact sheet at `.delivery/share-previews/icon-contact-sheet.png`. The card set has consistent composition, legible headlines, abstract document art, no recipient or customer/order data, and no government/court marks. The arbitration variant was checked individually after the copy adjustment.
- `file` confirmed all public/app PNG dimensions, JPEG fallback, and a valid Windows ICO container. A binary header check confirmed ICO reserved/type/count, 32×32 dimensions, and embedded PNG signature.
- Confirmed equality for approved home → versioned home and legacy public PNG, approved square → versioned square, and approved cancellation → cancellation route card; source/output SHA-256 values match.
- No application tests/build or hosted checks were run by the asset lane. No metadata files, Next social convention images, manifest copy, ledger, or deployment targets were modified. No customer/order data or mail/payment operations were involved.

## External license provenance

Bundled fonts: Inter, Merriweather and JetBrains Mono, each under SIL Open Font License 1.1. Corresponding full license files and copyright notices are included in `assets/share/fonts/licenses/`; upstream sources: [Inter](https://github.com/rsms/inter/blob/master/LICENSE.txt), [Merriweather](https://github.com/SorkinType/Merriweather/blob/master/OFL.txt), [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt).

## Review artifacts

- [Share card contact sheet](.delivery/share-previews/contact-sheet.png)
- [App icon contact sheet](.delivery/share-previews/icon-contact-sheet.png)
- [Asset manifest](public/share/v1/manifest.json)
- [Font provenance and licenses](assets/share/FONTS.md)
