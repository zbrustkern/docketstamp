import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ALL_NOTICE_CARTRIDGES, getNoticeBySlug } from '@/lib/docket/notices';
import { DocumentWorkspace } from '@/components/docket/DocumentWorkspace';
import { getPublicTemplateAvailability } from '@/lib/template-policy-store';

export const dynamic = 'force-dynamic';

interface NoticePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return ALL_NOTICE_CARTRIDGES.map((notice) => ({
    slug: notice.slug,
  }));
}

export async function generateMetadata({ params }: NoticePageProps): Promise<Metadata> {
  const { slug } = await params;
  const notice = getNoticeBySlug(slug);

  if (!notice) {
    return {
      title: 'Notice Not Found | DocketStamp',
      description: 'The requested statutory notice template could not be located.',
    };
  }

  return {
    title: `${notice.title} | USPS Mail`,
    description: notice.seoMeta.description || notice.shortDescription,
    keywords: notice.seoMeta.targetKeywords,
    alternates: {
      canonical: `https://docketstamp.com/notices/${notice.slug}`,
    },
    openGraph: {
      title: `${notice.title} | DocketStamp`,
      description: notice.seoMeta.description || notice.shortDescription,
      url: `https://docketstamp.com/notices/${notice.slug}`,
      siteName: 'DocketStamp',
      type: 'article',
    },
  };
}

export default async function NoticePage({ params }: NoticePageProps) {
  const { slug } = await params;
  const notice = getNoticeBySlug(slug);

  if (!notice) {
    notFound();
  }

  try {
    const availability = await getPublicTemplateAvailability();
    const entry = availability.templates.find((candidate) => candidate.slug === notice.slug);
    if (!entry?.available) {
      return <main className="mx-auto max-w-xl px-6 py-16 text-center"><h1 className="text-2xl font-semibold">This notice is temporarily unavailable</h1><p className="mt-3 text-slate-600">Please return to the notice catalog or try again later.</p></main>;
    }
  } catch {
    return <main className="mx-auto max-w-xl px-6 py-16 text-center"><h1 className="text-2xl font-semibold">Availability check unavailable</h1><p className="mt-3 text-slate-600">Please try again later.</p></main>;
  }

  return <DocumentWorkspace slug={notice.slug} />;
}
