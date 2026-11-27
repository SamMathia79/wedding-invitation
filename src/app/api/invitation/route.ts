import { NextRequest, NextResponse } from 'next/server';
import { getGuestByCode, getSettings } from '@/lib/db';
import { RSVP_DEADLINE_ISO } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const code = (req.nextUrl.searchParams.get('g') || '').trim();
    const [settings, guest] = await Promise.all([
      getSettings(),
      code ? getGuestByCode(code) : Promise.resolve(null)
    ]);

    return NextResponse.json({
      ok: true,
      guest,
      settings,
      deadline: RSVP_DEADLINE_ISO
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
