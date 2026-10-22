import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ALL_NOTICE_CARTRIDGES, getNoticeBySlug } from '@/lib/docket/notices';
import { DocumentWorkspace } from '@/components/docket/DocumentWorkspace';
import { privatePageMetadata, publicShareMetadata, noticeShareImage } from '@/src/lib/docket/share-metadata';

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
    return privatePageMetadata(
      'Document Template Not Found',
      'The requested document-preparation template could not be located.',
    );
  }

  const description = notice.seoMeta.description || notice.shortDescription;
  return {
    ...publicShareMetadata({
      title: notice.title,
      description,
      path: `/notices/${notice.slug}`,
      image: noticeShareImage(notice.slug),
    }),
    keywords: notice.seoMeta.targetKeywords,
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
