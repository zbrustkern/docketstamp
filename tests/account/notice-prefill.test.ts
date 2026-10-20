import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildNoticePrefillUrl } from "../../lib/account/notice-prefill";
import { resolveInitialWorkspaceDraft } from "../../src/lib/docket/draft-recovery";
import { getNoticeBySlug } from "../../src/lib/docket/notices";
import type { SavedAddress, MailingAddress } from "../../lib/types";

const recipient: SavedAddress = {
  id: "person-1", label: "Tenant", firstName: "Ari", lastName: "Example",
  street1: "123 Main St", street2: "Apt 4", city: "Madison", state: "WI", zip: "53703", country: "USA",
};
const sender: MailingAddress = {
  firstName: "Casey", lastName: "Writer", street1: "9 Oak Ave", street2: "Unit 2",
  city: "Chicago", state: "IL", zip: "60601", country: "USA",
};

describe("account notice prefill", () => {
  it("uses the supported notice route and hydrates exact recipient and sender fields", () => {
    const url = buildNoticePrefillUrl({ noticeSlug: "tenant-repair-and-maintenance-notice", recipient, sender });
    assert.ok(url.startsWith("/notices/tenant-repair-and-maintenance-notice?"));
    const [pathname, query] = url.split("?");
    assert.equal(pathname, "/notices/tenant-repair-and-maintenance-notice");
    const notice = getNoticeBySlug(pathname.split("/").at(-1)!);
    assert.ok(notice);
    const resolved = resolveInitialWorkspaceDraft({ notice, searchParams: new URLSearchParams(query) });
    assert.equal(resolved.userValues.recipientFormalName, "Ari Example");
    assert.equal(resolved.userValues.recipientAddressLine1, "123 Main St");
    assert.equal(resolved.userValues.recipientAddressLine2, "Apt 4");
    assert.equal(resolved.userValues.recipientCity, "Madison");
    assert.equal(resolved.userValues.recipientState, "WI");
    assert.equal(resolved.userValues.recipientZip, "53703");
    assert.equal(resolved.userValues.senderFullName, "Casey Writer");
    assert.equal(resolved.userValues.senderAddressLine1, "9 Oak Ave");
    assert.equal(resolved.userValues.senderAddressLine2, "Unit 2");
    assert.equal(resolved.userValues.senderCity, "Chicago");
  });

  it("does not invent recipient fields when a notice is chosen without an address", () => {
    const url = buildNoticePrefillUrl({ noticeSlug: "tenant-repair-and-maintenance-notice" });
    const [, query] = url.split("?");
    const notice = getNoticeBySlug("tenant-repair-and-maintenance-notice");
    assert.ok(notice);
    const resolved = resolveInitialWorkspaceDraft({ notice, searchParams: new URLSearchParams(query) });
    assert.equal(resolved.userValues.recipientFormalName, undefined);
    assert.equal(resolved.userValues.recipientAddressLine1, undefined);
  });
});
