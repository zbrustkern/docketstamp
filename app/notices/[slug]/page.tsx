import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ALL_NOTICE_CARTRIDGES, getNoticeBySlug } from '@/lib/docket/notices';
import { DocumentWorkspace } from '@/components/docket/DocumentWorkspace';

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
    title: `${notice.title} | USPS Certified Mail Dispatch | DocketStamp`,
    description: notice.seoMeta.description || notice.shortDescription,
    keywords: notice.seoMeta.targetKeywords,
    alternates: {
      canonical: `https://docketstamp.com/notices/${notice.slug}`,
    },
    openGraph: {
      title: `${notice.title} | DocketStamp Official Dispatch`,
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

  return <DocumentWorkspace slug={notice.slug} />;
}
