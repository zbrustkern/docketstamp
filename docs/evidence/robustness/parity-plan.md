# Physical preview parity plan

1. Extract one physical layout contract for the fixed 8.5 × 11 inch sheet, stamp, USPS address/clear zones, body, signature, and footer. Reuse it in print HTML and the interactive preview.
2. Render `LivePaperSheet` as a fixed letter page scaled to the available viewport, with physical text sizes and positions that match `renderLobHtmlPayload` at every scale.
3. Keep token and address editing accessible through focusable controls that do not change document flow or measurement. Preserve truthful signature/address status and the required UPL footer.
4. Add focused renderer checks for fixed geometry, disclosures, and all-nine-template content coverage. Run meaningful offline tests and type checking; report browser/provider proof limits explicitly.
