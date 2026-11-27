import type { Metadata } from 'next';
import AdminClient from '@/components/AdminClient';
import { isAdminAuthenticated } from '@/lib/auth';
import { getSettings, getStorageInfo, listGuests } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Wedding Admin — Samer & Rafca',
  robots: { index: false, follow: false }
};

export default async function AdminPage() {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    return <AdminClient initialAuthenticated={false} />;
  }

  const [guests, settings] = await Promise.all([listGuests(), getSettings()]);

  return (
    <AdminClient
      initialAuthenticated={true}
      initialGuests={guests}
      initialSettings={settings}
      initialStorageInfo={getStorageInfo()}
    />
  );
}
