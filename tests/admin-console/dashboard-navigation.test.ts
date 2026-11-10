import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { describe, it } from "node:test";

const page = readFileSync("app/admin/page.tsx", "utf8");
const addressRetry = readFileSync("components/admin/AddressRetryModal.tsx", "utf8");

describe("admin dashboard navigation and retirement", () => {
  it("defaults to the report dashboard and keeps the requested primary navigation order", () => {
    assert.match(page, /useState<[^\n]+>\("dashboard"\)/);
    const labels = [
      "Dashboard",
      "Orders & Fulfillment",
      "System Health & Incidents",
      "Templates & Coverage",
      "Discounts & Email",
    ];
    let previous = -1;
    for (const label of labels) {
      const index = page.indexOf(`label: "${label}"`);
      assert.ok(index > previous, `${label} should follow the preceding primary tab`);
      previous = index;
    }
  });

  it("routes the old margins, measurement, experiment, and email links to retained views", () => {
    assert.match(page, /urlTab === "measurement" \|\| urlTab === "margins" \|\| urlTab === "dashboard" \|\| urlTab === "experiment"/);
    assert.match(page, /urlTab === "email"\) \{\s*setActiveTab\("discounts"\)/);
    assert.match(page, /activeTab === "dashboard"[\s\S]*?<ExecutiveReportingPanel \/>/);
    assert.match(page, /activeTab === "discounts" && <OutgoingEmailPanel \/>/);
    assert.match(page, /setActiveTab\("scenarios"\)/);
  });

  it("removes retired analytics and the unscoped spend endpoint from the admin UI", () => {
    for (const retiredName of [
      "CampaignPerformanceWidget",
      "VisitorTelemetryDashboard",
      "HighIntentCartsWidget",
      "CohortAnalytics",
      "ValuationHeuristicsWidget",
    ]) {
      assert.equal(page.includes(retiredName), false, `${retiredName} should no longer be mounted`);
    }
    assert.equal(page.includes("/api/admin/ad-spend"), false);
    assert.equal(existsSync("app/api/admin/ad-spend/route.ts"), false);
  });

  it("keeps retry and reconciliation actions aligned with their audited backend contracts", () => {
    assert.match(page, /requestId: crypto\.randomUUID\(\),\s*reason: "Operator requested a safe retry/);
    assert.match(page, /requestId: crypto\.randomUUID\(\),\s*reason: "Operator requested read-only Stripe evidence reconciliation/);
    assert.match(page, /This action does not initiate mailing/);
    assert.equal(page.includes("handleSyncLob"), false);
    assert.equal(page.includes("Sync Lob (Held"), false);
    assert.match(addressRetry, /requestId: crypto\.randomUUID\(\),/);
    assert.match(addressRetry, /reason: incidentId[\s\S]*safe retry of the frozen postal order snapshot/);
    assert.match(addressRetry, /data\.ok/);
    assert.match(addressRetry, /postal provider outcome is uncertain/i);
    assert.match(addressRetry, /does not edit the recipient address or the letter/);
    assert.equal(addressRetry.includes("updatedRecipientAddress"), false);
    assert.equal(addressRetry.includes("data.success"), false);
  });
});
