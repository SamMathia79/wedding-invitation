import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getGuestByCode, getSettings } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get('g') || '').trim();
  const [settings, guest] = await Promise.all([
    getSettings(),
    code ? getGuestByCode(code).catch(() => null) : Promise.resolve(null)
  ]);

  const accent = settings.accentColor || '#c5a059';
  const monogram = settings.monogram || 'S&R';
  const coupleEN = settings.coupleNamesEN || 'Samer & Rafca';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at center, #2d2720 0%, #12100e 100%)',
          color: '#ffffff',
          padding: '48px',
          position: 'relative',
          fontFamily: 'Georgia, serif'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            border: `2px solid ${accent}`,
            borderRadius: '28px',
            padding: '40px 60px',
            background: 'rgba(20, 18, 16, 0.58)'
          }}
        >
          <div
            style={{
              fontSize: 30,
              letterSpacing: '0.3em',
              color: accent,
              marginBottom: 14
            }}
          >
            {monogram}
          </div>

          <div
            style={{
              fontSize: 22,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#e5d5b5',
              marginBottom: 16
            }}
          >
            WEDDING INVITATION
          </div>

          <div
            style={{
              fontSize: 74,
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: 14
            }}
          >
            {coupleEN}
          </div>

          {guest ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 28px',
                borderRadius: '999px',
                background: 'rgba(197, 160, 89, 0.2)',
                border: `1px solid ${accent}`,
                color: '#f7e7c4',
                fontSize: 28,
                marginTop: 8,
                marginBottom: 18
              }}
            >
              Personal Invitation for {guest.nameEN}
            </div>
          ) : (
            <div
              style={{
                fontSize: 26,
                color: '#d8c5a0',
                marginTop: 6,
                marginBottom: 20
              }}
            >
              {settings.venueNameEN}
            </div>
          )}

          <div
            style={{
              fontSize: 28,
              letterSpacing: '0.24em',
              color: accent,
              marginTop: 6
            }}
          >
            {settings.curtainDatePill || '03 • 01 • 2027'}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630
    }
  );
}
