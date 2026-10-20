import type { SavedAddress, MailingAddress } from "@/lib/types";

export interface NoticePrefillInput {
  noticeSlug: string;
  recipient?: SavedAddress | null;
  sender?: MailingAddress | null;
}

/** Build the canonical notice-review URL with supported explicit field hydration. */
export function buildNoticePrefillUrl({ noticeSlug, recipient, sender }: NoticePrefillInput): string {
  const params = new URLSearchParams();
  params.set("source", "account-address-book");
  const fields: Record<string, string | undefined> = {
    recipientFormalName: recipient ? `${recipient.firstName} ${recipient.lastName}`.trim() : undefined,
    recipientAddressLine1: recipient?.street1,
    recipientAddressLine2: recipient?.street2,
    recipientCity: recipient?.city,
    recipientState: recipient?.state,
    recipientZip: recipient?.zip,
    senderFullName: sender ? `${sender.firstName} ${sender.lastName}`.trim() : undefined,
    senderAddressLine1: sender?.street1,
    senderAddressLine2: sender?.street2,
    senderCity: sender?.city,
    senderState: sender?.state,
    senderZip: sender?.zip,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value?.trim()) params.set(`field.${key}`, value.trim());
  }
  return `/notices/${encodeURIComponent(noticeSlug)}?${params.toString()}`;
}
