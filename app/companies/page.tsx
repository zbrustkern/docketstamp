import type { Metadata } from 'next';
import { CompanyDirectoryClient } from '@/src/components/docket/CompanyDirectoryClient';
import { publicShareMetadata } from '@/src/lib/docket/share-metadata';

export const metadata: Metadata = publicShareMetadata({
  title: 'Pre-Addressed Corporate Recipient Directory',
  description:
    'Browse recipient listings for consumer document-preparation requests. Verify the recipient and address for your situation before preparing a letter.',
  path: '/companies',
});

export default function CompaniesPage() {
  return <CompanyDirectoryClient />;
}
