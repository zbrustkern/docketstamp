import type { Metadata } from 'next';
import { CompanyDirectoryClient } from '@/src/components/docket/CompanyDirectoryClient';

export const metadata: Metadata = {
  title: 'Pre-Addressed Corporate Recipient Directory | DocketStamp',
  description:
    'Browse 38 verified institutional notice recipients for credit disputes, debt validation requests, corporate cancellations, and hardware warranty or arbitration opt-out notices.',
  alternates: {
    canonical: 'https://docketstamp.com/companies',
  },
};

export default function CompaniesPage() {
  return <CompanyDirectoryClient />;
}
