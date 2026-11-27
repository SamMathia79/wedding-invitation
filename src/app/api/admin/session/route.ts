import { NextRequest, NextResponse } from 'next/server';
import {
  clearAdminSessionCookie,
  isAdminAuthenticated,
  setAdminSessionCookie,
  validateCredentials
} from '@/lib/auth';
import { getSettings, getStorageInfo, listGuests } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
  }

  const [guests, settings] = await Promise.all([listGuests(), getSettings()]);
  return NextResponse.json({
    ok: true,
    authenticated: true,
    guests,
    settings,
    storageInfo: getStorageInfo()
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!validateCredentials(username, password)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid username or password.' },
        { status: 401 }
      );
    }

    await setAdminSessionCookie(username);
    const [guests, settings] = await Promise.all([listGuests(), getSettings()]);

    return NextResponse.json({
      ok: true,
      authenticated: true,
      guests,
      settings,
      storageInfo: getStorageInfo()
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE() {
  await clearAdminSessionCookie();
  return NextResponse.json({ ok: true });
}
