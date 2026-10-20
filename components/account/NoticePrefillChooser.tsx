"use client";

import { useState } from "react";
import Link from "next/link";
import type { SavedAddress, MailingAddress } from "@/lib/types";
import { buildNoticePrefillUrl } from "@/lib/account/notice-prefill";

interface Props {
  recipient: SavedAddress;
  sender?: MailingAddress | null;
  notices: { slug: string; title: string }[];
}

export function NoticePrefillChooser({ recipient, sender, notices }: Props) {
  const [slug, setSlug] = useState(notices[0]?.slug || "");
  const notice = notices.find((item) => item.slug === slug);
  return (
    <div>
      <label className="text-xs font-medium text-stone-700">
        Choose a notice to review
        <select aria-label={`Choose notice for ${recipient.firstName} ${recipient.lastName}`} value={slug} onChange={(event) => setSlug(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
          {notices.map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}
        </select>
      </label>
      {notice ? <Link href={buildNoticePrefillUrl({ noticeSlug: notice.slug, recipient, sender })} className="mt-2 min-h-10 inline-flex w-full items-center justify-center rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500">Review selected notice →</Link> : <p className="mt-2 text-xs text-stone-500">No supported notices are available.</p>}
    </div>
  );
}
