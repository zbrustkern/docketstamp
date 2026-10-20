import type { Metadata } from 'next';
import { CompanyDirectoryClient } from '@/src/components/docket/CompanyDirectoryClient';

export const metadata: Metadata = {
  title: 'Pre-Addressed Corporate Recipient Directory | DocketStamp',
  description:
    'Browse 38 institutional recipient listings for credit disputes, debt validation requests, corporate cancellations, hardware warranty requests, and letters asking about arbitration opt-out procedures.',
  alternates: {
    canonical: 'https://docketstamp.com/companies',
  },
};

export default function CompaniesPage() {
  return <CompanyDirectoryClient />;
}
