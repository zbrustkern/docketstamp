import assert from "node:assert/strict";
import test from "node:test";
import {
  absolutePublicUrl,
  getPublicOrigin,
  noticeShareImage,
  privatePageMetadata,
  publicShareMetadata,
  SHARE_IMAGES,
  HOME_SHARE_DESCRIPTION,
} from "../src/lib/docket/share-metadata";
import { ALL_NOTICE_CARTRIDGES } from "../src/lib/docket/notices";

test("metadata origin respects configured environment origin and rejects malformed values", () => {
  assert.equal(getPublicOrigin("https://staging.docketstamp.com/nested/path"), "https://staging.docketstamp.com");
  assert.equal(getPublicOrigin("http://localhost:3000"), "http://localhost:3000");
  assert.equal(getPublicOrigin("javascript:alert(1)"), "https://docketstamp.com");
  assert.equal(getPublicOrigin("not a URL"), "https://docketstamp.com");
  assert.equal(absolutePublicUrl("/companies", "https://staging.docketstamp.com"), "https://staging.docketstamp.com/companies");
});

test("every canonical notice maps to a static route image with accurate card dimensions", () => {
  assert.equal(ALL_NOTICE_CARTRIDGES.length, 9);
  for (const { slug } of ALL_NOTICE_CARTRIDGES) {
    const image = noticeShareImage(slug);
    assert.equal(image.path, `/share/v1/${slug}.png`);
    assert.equal(image.width, 1200);
    assert.equal(image.height, 630);
    assert.ok(image.alt.startsWith("Prepare and mail"));
  }
  assert.deepEqual(SHARE_IMAGES.square, {
    path: "/share/v1/square.png",
    width: 1080,
    height: 1080,
    alt: "DocketStamp formal letter preparation and USPS mailing service.",
  });
  assert.equal(noticeShareImage("old-alias").path, SHARE_IMAGES.home.path);
});

test("public metadata emits complete absolute OG and Twitter image fields without duplicate suffix", () => {
  const metadata = publicShareMetadata({
    title: "Make it formal. We’ll print and mail it.",
    description: HOME_SHARE_DESCRIPTION,
    path: "/",
  });
  assert.deepEqual(metadata.title, { absolute: "Make it formal. We’ll print and mail it. | DocketStamp" });
  assert.deepEqual(metadata.alternates?.canonical, "https://docketstamp.com/");
  assert.deepEqual(metadata.openGraph?.images, [{
    url: "https://docketstamp.com/share/v1/home.png",
    width: 1200,
    height: 630,
    alt: SHARE_IMAGES.home.alt,
    type: "image/png",
  }]);
  assert.deepEqual(metadata.twitter, {
    card: "summary_large_image",
    title: "Make it formal. We’ll print and mail it. | DocketStamp",
    description: HOME_SHARE_DESCRIPTION,
    images: [{ url: "https://docketstamp.com/share/v1/home.png", alt: SHARE_IMAGES.home.alt }],
  });
});

test("private metadata is neutral, non-indexable, and does not contain record identifiers", () => {
  const metadata = privatePageMetadata("Order Record", "View order information.");
  const serialized = JSON.stringify(metadata);
  assert.deepEqual(metadata.robots, { index: false, follow: false, nocache: true });
  assert.equal(metadata.alternates?.canonical, null);
  assert.equal(serialized.includes("DS-2026-123456"), false);
  assert.equal(serialized.includes("alice@example.com"), false);
});
