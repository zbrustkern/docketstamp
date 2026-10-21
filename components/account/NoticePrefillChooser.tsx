"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SavedAddress, MailingAddress } from "@/lib/types";
import { useTemplateAvailability } from '@/src/hooks/useTemplateAvailability';
import { evaluateTemplateAvailability } from '@/src/lib/docket/template-policy';
import { TemplateLocationFields } from '@/src/components/docket/TemplateLocationFields';
import { stageNoticePrefill } from "@/lib/account/notice-prefill";

interface Props {
  recipient: SavedAddress;
  sender?: MailingAddress | null;
  notices: { slug: string; title: string }[];
}

export function NoticePrefillChooser({ recipient, sender, notices }: Props) {
  const router = useRouter();
  const policy = useTemplateAvailability();
  const [nexus, setNexus] = useState<Record<string, string>>({});
  const availableNotices = notices.filter(item => policy.data?.templates.some(entry => entry.slug === item.slug && entry.available));
  const [slug, setSlug] = useState(notices[0]?.slug || "");
  const [staging, setStaging] = useState(false);
  const [error, setError] = useState("");
  const notice = availableNotices.find((item) => item.slug === slug);
  const entry = notice ? policy.data?.templates.find(item => item.slug === slug) : undefined;
  const decision = entry ? evaluateTemplateAvailability(entry, nexus) : null;

  async function reviewSelectedNotice() {
    if (!notice || staging || !decision?.allowed) return;
    setStaging(true);
    setError("");
    try {
      const staged = await stageNoticePrefill({ noticeSlug: notice.slug, recipient, sender, policyNexus: nexus });
      router.push(staged.reviewUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this notice draft. Please retry.");
    } finally {
      setStaging(false);
    }
  }

  if (policy.loading) return <p role="status" className="text-sm text-stone-600">Checking available letters…</p>;
  if (policy.error) return <div><p role="alert" className="text-sm text-rose-700">{policy.error}</p><button type="button" onClick={policy.refresh} className="mt-2 text-sm text-sky-700 underline">Try again</button></div>;
  return (
    <div>
      <label className="text-xs font-medium text-stone-700">
        Choose a notice to review
        <select aria-label={`Choose notice for ${recipient.firstName} ${recipient.lastName}`} value={notice ? slug : ''} onChange={(event) => setSlug(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
          <option value="">Choose a letter</option>
          {availableNotices.map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}
        </select>
      </label>
      {entry && <div className="mt-3"><TemplateLocationFields availability={entry} values={nexus} onChange={(key, value) => setNexus(prev => ({ ...prev, [key]: value }))} light /></div>}
      {decision && !decision.allowed && <p role="status" className="mt-2 text-xs text-stone-600">{decision.message}</p>}
      {notice ? <button type="button" onClick={() => void reviewSelectedNotice()} disabled={staging || !decision?.allowed} className="mt-2 min-h-10 inline-flex w-full items-center justify-center rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-sky-500">{staging ? "Saving draft…" : "Review selected notice →"}</button> : <p className="mt-2 text-xs text-stone-500">{availableNotices.length ? 'Choose an available letter to continue.' : 'No supported notices are available.'}</p>}
      {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
