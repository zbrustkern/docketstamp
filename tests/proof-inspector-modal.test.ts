import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const modalSource = readFileSync("components/admin/ProofInspectorModal.tsx", "utf8");

describe("ProofInspectorModal contract and usability verification", () => {
  it("renders notice HTML snapshot in an iframe using srcDoc and supports alternate frozen payload keys", () => {
    assert.match(modalSource, /srcDoc=\{documentHtml\}/);
    assert.match(modalSource, /order\.documentHtml/);
    assert.match(modalSource, /frozen_html_payload/);
  });

  it("provides explicit notice completion confirmation answering whether customer filled it out", () => {
    assert.match(modalSource, /Notice Form Fields Completed &amp; Snapshot Locked/);
    assert.match(modalSource, /hasDocumentHtml/);
    assert.match(modalSource, /Awaiting payment/);
    assert.match(modalSource, /SHA-256/);
  });

  it("guarantees modal exit navigation across header, footer, backdrop, and keyboard", () => {
    // Header close button is shrink-0 and z-20 so it is never pushed off-screen on mobile
    assert.match(modalSource, /aria-label="Close inspector"/);
    assert.match(modalSource, /shrink-0 z-20/);

    // Title and badge truncate so close button has guaranteed space
    assert.match(modalSource, /max-w-\[130px\] sm:max-w-\[220px\] truncate/);

    // Dedicated Exit Proof button in modal footer
    assert.match(modalSource, /Exit Proof/);

    // Backdrop click dismisses
    assert.match(modalSource, /if \(e\.target === e\.currentTarget\)[\s\S]*onClose\(\)/);

    // Escape key dismisses
    assert.match(modalSource, /e\.key === "Escape"[\s\S]*onClose\(\)/);
  });

  it("implements responsive scaling for 8.5x11 Lob letter geometry and standalone new tab inspection", () => {
    // 816px Lob physical layout width
    assert.match(modalSource, /816/);
    assert.match(modalSource, /1056/);
    assert.match(modalSource, /transform:\s*`scale\(\$\{fitScale\}\)`/);
    assert.match(modalSource, /handleOpenInNewTab/);
    assert.match(modalSource, /window\.open\(url,\s*"_blank"\)/);
  });

  it("provides dedicated tabs for Visual Letter Sheet, readable Notice Text & Details, and Mailing Route", () => {
    assert.match(modalSource, /Visual Letter Sheet/);
    assert.match(modalSource, /Notice Text &amp; Details/);
    assert.match(modalSource, /Mailing Route/);
    assert.match(modalSource, /parseNoticeContent/);
    assert.match(modalSource, /CASS Verified/);
  });
});
