import type { SavedAddress, MailingAddress } from "@/lib/types";
import { getNoticeBySlug } from "@/src/lib/docket/notices";

export interface NoticePrefillInput {
  noticeSlug: string;
  recipient?: SavedAddress | null;
  sender?: MailingAddress | null;
  policyNexus?: { consumerResidenceState?: string; propertyState?: string };
}

export interface StagedNoticePrefill {
  stageId: string;
  /** Same-origin relative URL containing only the opaque stage ID. */
  reviewUrl: string;
}

export interface StageNoticePrefillOptions {
  fetchImpl?: typeof fetch;
  origin?: string;
}

export class NoticePrefillStageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoticePrefillStageError";
  }
}

function addressName(address: { firstName: string; lastName: string }): string {
  return `${address.firstName} ${address.lastName}`.trim();
}

/**
 * Stage saved address details through the existing durable draft API. Address
 * fields travel in the POST body and are never added to the navigated URL.
 */
export async function stageNoticePrefill(
  input: NoticePrefillInput,
  options: StageNoticePrefillOptions = {},
): Promise<StagedNoticePrefill> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.noticeSlug)) {
    throw new NoticePrefillStageError("Choose a supported notice before continuing.");
  }
  const notice = getNoticeBySlug(input.noticeSlug);
  if (!notice) throw new NoticePrefillStageError("Choose a supported notice before continuing.");
  const canonicalSlug = notice.slug;

  const recipient = input.recipient;
  const sender = input.sender;
  const fieldValues: Record<string, string> = {};
  const set = (key: string, value: string | undefined) => {
    if (value?.trim()) fieldValues[key] = value.trim();
  };
  if (recipient) {
    set("recipientFormalName", addressName(recipient));
    set("recipientAddressLine1", recipient.street1);
    set("recipientAddressLine2", recipient.street2);
    set("recipientCity", recipient.city);
    set("recipientState", recipient.state);
    set("recipientZip", recipient.zip);
  }
  if (sender) {
    set("senderFullName", addressName(sender));
    set("senderAddressLine1", sender.street1);
    set("senderAddressLine2", sender.street2);
    set("senderCity", sender.city);
    set("senderState", sender.state);
    set("senderZip", sender.zip);
  }

  set("consumerResidenceState", input.policyNexus?.consumerResidenceState);
  set("propertyState", input.policyNexus?.propertyState);

  const postalAddress = (address: SavedAddress | MailingAddress) => ({
    name: addressName(address),
    addressLine1: address.street1,
    ...(address.street2?.trim() ? { addressLine2: address.street2.trim() } : {}),
    city: address.city,
    state: address.state,
    zip: address.zip,
  });
  const payload = {
    // Send the cartridge's canonical key at this boundary even when a legacy
    // URL alias was supplied by the account UI.
    noticeSlug: canonicalSlug,
    ...(recipient ? { customRecipient: postalAddress(recipient) } : {}),
    ...(sender ? { sender: postalAddress(sender) } : {}),
    fieldValues,
  };

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl("/api/docket/stage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new NoticePrefillStageError(
      typeof data?.error === "string" ? data.error : "Could not save this notice draft. Please retry.",
    );
  }

  const stageId = data?.stageId;
  const responseSlug = data?.noticeSlug;
  const reviewUrl = data?.reviewUrl;
  if (typeof stageId !== "string" || !/^DS-STAGE-[A-F0-9]{32}$/.test(stageId) || responseSlug !== canonicalSlug || typeof reviewUrl !== "string") {
    throw new NoticePrefillStageError("The saved draft response was invalid. Please retry.");
  }

  let parsedUrl: URL;
  try {
    const origin = options.origin ?? window.location.origin;
    parsedUrl = new URL(reviewUrl, origin);
    if (parsedUrl.origin !== new URL(origin).origin) throw new Error("Unexpected origin");
  } catch {
    throw new NoticePrefillStageError("The saved draft returned an unexpected review route.");
  }

  const expectedPath = `/notices/${canonicalSlug}`;
  const params = [...parsedUrl.searchParams.entries()];
  if (parsedUrl.pathname !== expectedPath || parsedUrl.hash || params.length !== 1 || params[0][0] !== "stage" || params[0][1] !== stageId) {
    throw new NoticePrefillStageError("The saved draft returned an unexpected review route.");
  }

  return { stageId, reviewUrl: `${expectedPath}?stage=${encodeURIComponent(stageId)}` };
}
