import type { Metadata } from 'next';
import { LetterLibraryClient } from '@/src/components/docket/LetterLibraryClient';

export const metadata: Metadata = {
  title: 'Letter Library | Prepare and Mail Letters',
  description: 'Browse available self-help letters to prepare, review, and mail through DocketStamp.',
  alternates: { canonical: '/letters' },
};

export default function LettersPage() {
  return <LetterLibraryClient />;
}
