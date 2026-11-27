import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { deleteGuest, upsertGuest } from '@/lib/db';

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const g = body.guest || {};
    if (!g.code || !g.nameEN || !g.nameAR) {
      return NextResponse.json(
        { ok: false, error: 'Code, English name, and Arabic name are required.' },
        { status: 400 }
      );
    }

    const saved = await upsertGuest({
      code: String(g.code),
      nameEN: String(g.nameEN),
      nameAR: String(g.nameAR),
      maxSeats: Number(g.maxSeats) || 2,
      status: g.status,
      attendingSeats: g.attendingSeats,
      message: g.message
    });

    return NextResponse.json({ ok: true, guest: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save guest';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const code = (req.nextUrl.searchParams.get('code') || '').trim();
  if (!code) {
    return NextResponse.json({ ok: false, error: 'Missing guest code' }, { status: 400 });
  }

  await deleteGuest(code);
  return NextResponse.json({ ok: true });
}
