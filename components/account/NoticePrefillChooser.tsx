"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SavedAddress, MailingAddress } from "@/lib/types";
import { stageNoticePrefill } from "@/lib/account/notice-prefill";

interface Props {
  recipient: SavedAddress;
  sender?: MailingAddress | null;
  notices: { slug: string; title: string }[];
}

export function NoticePrefillChooser({ recipient, sender, notices }: Props) {
  const router = useRouter();
  const [slug, setSlug] = useState(notices[0]?.slug || "");
  const [staging, setStaging] = useState(false);
  const [error, setError] = useState("");
  const notice = notices.find((item) => item.slug === slug);

  async function reviewSelectedNotice() {
    if (!notice || staging) return;
    setStaging(true);
    setError("");
    try {
      const staged = await stageNoticePrefill({ noticeSlug: notice.slug, recipient, sender });
      router.push(staged.reviewUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this notice draft. Please retry.");
    } finally {
      setStaging(false);
    }
  }

  return (
    <div>
      <label className="text-xs font-medium text-stone-700">
        Choose a notice to review
        <select aria-label={`Choose notice for ${recipient.firstName} ${recipient.lastName}`} value={slug} onChange={(event) => setSlug(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
          {notices.map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}
        </select>
      </label>
      {notice ? <button type="button" onClick={() => void reviewSelectedNotice()} disabled={staging} className="mt-2 min-h-10 inline-flex w-full items-center justify-center rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-sky-500">{staging ? "Saving draft…" : "Review selected notice →"}</button> : <p className="mt-2 text-xs text-stone-500">No supported notices are available.</p>}
      {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
