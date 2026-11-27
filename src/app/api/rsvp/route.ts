import { NextRequest, NextResponse } from 'next/server';
import { submitRsvp } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code || '').trim();
    const guestName = String(body.guestName || '').trim();
    const status = body.status === 'Confirmed' ? 'Confirmed' : 'Declined';
    const attendingSeats = Number(body.attendingSeats) || 0;
    const message = String(body.message || '');

    const result = await submitRsvp({
      code,
      guestName,
      status,
      attendingSeats,
      message
    });

    if (!result.ok) {
      const statusCode = result.error === 'DEADLINE_PASSED' ? 403 : 400;
      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json({
      ok: true,
      status: result.guest.status,
      attendingSeats: result.guest.attendingSeats,
      guest: result.guest
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
