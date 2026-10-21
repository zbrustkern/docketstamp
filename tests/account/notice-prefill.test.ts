import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { SavedAddress, MailingAddress } from "../../lib/types";
import { NoticePrefillStageError, stageNoticePrefill } from "../../lib/account/notice-prefill";

const origin = "https://docketstamp.com";
const slug = "pre-arbitration-notice-of-dispute-and-refund-request";
const canonicalSlug = "product-complaint-refund-request";
const stageId = `DS-STAGE-${"A1".repeat(16)}`;
const recipient: SavedAddress = {
  id: "fixture-recipient", label: "Fixture", firstName: "Riley", lastName: "Sample",
  street1: "123 Example St", street2: "Unit 4", city: "Madison", state: "WI", zip: "53703", country: "USA",
};
const sender: MailingAddress = {
  firstName: "Casey", lastName: "Sample", street1: "9 Example Ave", street2: "Suite 2",
  city: "Chicago", state: "IL", zip: "60601", country: "USA",
};

test("account prefill stages address fields in POST body and returns an opaque same-site review URL", async () => {
  const oldMock = process.env.USE_MOCK_FIRESTORE;
  const oldAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  process.env.USE_MOCK_FIRESTORE = "true";
  process.env.NEXT_PUBLIC_APP_URL = origin;
  try {
    const { POST: stagePost } = await import("../../app/api/docket/stage/route");
    const { GET: stageGet } = await import("../../app/api/docket/stage/[stageId]/route");
    let postedUrl = "";
    let postedBody: Record<string, unknown> | undefined;

    const staged = await stageNoticePrefill({ noticeSlug: slug, recipient, sender }, {
      origin,
      fetchImpl: async (url, init) => {
        postedUrl = String(url);
        postedBody = JSON.parse(String(init?.body));
        return stagePost(new NextRequest(`${origin}/api/docket/stage`, {
          method: "POST", headers: init?.headers, body: init?.body,
        }));
      },
    });

    assert.equal(postedUrl, "/api/docket/stage");
    assert.deepEqual(postedBody, {
      noticeSlug: canonicalSlug,
      customRecipient: {
        name: "Riley Sample", addressLine1: "123 Example St", addressLine2: "Unit 4",
        city: "Madison", state: "WI", zip: "53703",
      },
      sender: {
        name: "Casey Sample", addressLine1: "9 Example Ave", addressLine2: "Suite 2",
        city: "Chicago", state: "IL", zip: "60601",
      },
      fieldValues: {
        recipientFormalName: "Riley Sample", recipientAddressLine1: "123 Example St",
        recipientAddressLine2: "Unit 4", recipientCity: "Madison", recipientState: "WI", recipientZip: "53703",
        senderFullName: "Casey Sample", senderAddressLine1: "9 Example Ave", senderAddressLine2: "Suite 2",
        senderCity: "Chicago", senderState: "IL", senderZip: "60601",
      },
    });
    assert.equal(staged.stageId.startsWith("DS-STAGE-"), true);
    assert.equal(staged.reviewUrl, `/notices/${canonicalSlug}?stage=${staged.stageId}`);
    const navigated = new URL(staged.reviewUrl, origin);
    assert.equal(navigated.origin, origin);
    assert.equal(navigated.pathname, `/notices/${canonicalSlug}`);
    assert.deepEqual([...navigated.searchParams.keys()], ["stage"]);
    assert.doesNotMatch(staged.reviewUrl, /Riley|Sample|Example|Madison|53703|60601/);

    const retrieval = await stageGet(new NextRequest(`${origin}/api/docket/stage/${staged.stageId}`), {
      params: Promise.resolve({ stageId: staged.stageId }),
    });
    assert.equal(retrieval.status, 200);
    const hydrated = await retrieval.json();
    assert.equal(hydrated.stageId, staged.stageId);
    assert.deepEqual(hydrated.fieldValues, postedBody.fieldValues);
    assert.deepEqual(hydrated.customRecipient, postedBody.customRecipient);
    assert.deepEqual(hydrated.sender, postedBody.sender);
    assert.equal(hydrated.reviewUrl, `${origin}${staged.reviewUrl}`);
  } finally {
    if (oldMock === undefined) delete process.env.USE_MOCK_FIRESTORE; else process.env.USE_MOCK_FIRESTORE = oldMock;
    if (oldAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = oldAppUrl;
  }
});

test("stage API rejection preserves the selected notice and address values for retry", async () => {
  let capturedBody = "";
  const fetchImpl: typeof fetch = async (_url, init) => {
    capturedBody = String(init?.body);
    return Response.json({ error: "Draft storage is temporarily unavailable." }, { status: 503 });
  };
  const original = { noticeSlug: slug, recipient, sender };
  await assert.rejects(stageNoticePrefill(original, { origin, fetchImpl }), /Draft storage is temporarily unavailable/);
  assert.deepEqual(JSON.parse(capturedBody), {
    noticeSlug: canonicalSlug,
    customRecipient: { name: "Riley Sample", addressLine1: "123 Example St", addressLine2: "Unit 4", city: "Madison", state: "WI", zip: "53703" },
    sender: { name: "Casey Sample", addressLine1: "9 Example Ave", addressLine2: "Suite 2", city: "Chicago", state: "IL", zip: "60601" },
    fieldValues: {
      recipientFormalName: "Riley Sample", recipientAddressLine1: "123 Example St", recipientAddressLine2: "Unit 4",
      recipientCity: "Madison", recipientState: "WI", recipientZip: "53703", senderFullName: "Casey Sample",
      senderAddressLine1: "9 Example Ave", senderAddressLine2: "Suite 2", senderCity: "Chicago", senderState: "IL", senderZip: "60601",
    },
  });
  assert.deepEqual(original, { noticeSlug: slug, recipient, sender });
});

test("invalid stage IDs and unexpected returned routes are rejected", async () => {
  const makeFetch = (data: unknown): typeof fetch => async () => Response.json(data, { status: 201 });
  await assert.rejects(stageNoticePrefill({ noticeSlug: slug, recipient }, {
    origin, fetchImpl: makeFetch({ stageId: "DS-STAGE-123", noticeSlug: slug, reviewUrl: `${origin}/notices/${slug}?stage=DS-STAGE-123` }),
  }), (error: unknown) => error instanceof NoticePrefillStageError && /response was invalid/.test(error.message));

  for (const reviewUrl of [
    `https://attacker.example/notices/${canonicalSlug}?stage=${stageId}`,
    `${origin}/notices/another-notice?stage=${stageId}`,
    `${origin}/notices/${canonicalSlug}?stage=${stageId}&field.recipientAddressLine1=private`,
  ]) {
    await assert.rejects(stageNoticePrefill({ noticeSlug: slug, recipient }, {
      origin, fetchImpl: makeFetch({ stageId, noticeSlug: canonicalSlug, reviewUrl }),
    }), (error: unknown) => error instanceof NoticePrefillStageError && /unexpected review route/.test(error.message));
  }
});
