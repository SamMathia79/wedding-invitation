import type { Metadata } from 'next';
import InvitationClient from '@/components/InvitationClient';
import { getGuestByCode, getSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ g?: string }>;
}

export async function generateMetadata({
  searchParams
}: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const code = (params.g || '').trim();
  const [settings, guest] = await Promise.all([
    getSettings(),
    code ? getGuestByCode(code) : Promise.resolve(null)
  ]);

  const coupleEN = settings.coupleNamesEN || 'Samer & Rafca';
  const coupleAR = settings.coupleNamesAR || 'سامر ورفقا';

  const title = guest
    ? `Invitation for ${guest.nameEN} — ${coupleEN} | دعوة خاصة لـ ${guest.nameAR}`
    : `${coupleEN} — Wedding Invitation | دعوة زفاف ${coupleAR}`;

  const description = guest
    ? `Dear ${guest.nameEN}, we joyfully invite you to celebrate our wedding on ${settings.weddingDateEN} at ${settings.venueNameEN}. Please confirm before ${settings.rsvpDeadlineEN} • يسرّنا دعوتكم لمشاركتنا فرحتنا يوم ${settings.weddingDateAR}`
    : `We joyfully invite you to celebrate our wedding on ${settings.weddingDateEN} at ${settings.venueNameEN} • يسرّنا دعوتكم لمشاركتنا فرحتنا يوم ${settings.weddingDateAR}`;

  const ogImageUrl = settings.ogImage
    ? settings.ogImage
    : code
      ? `/api/og?g=${encodeURIComponent(code)}`
      : '/api/og';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${coupleEN} Wedding Invitation`
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl]
    }
  };
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const code = (params.g || '').trim();
  const [settings, guest] = await Promise.all([
    getSettings(),
    code ? getGuestByCode(code) : Promise.resolve(null)
  ]);

  return (
    <InvitationClient
      initialSettings={settings}
      initialGuest={guest}
      initialCode={code}
    />
  );
}
