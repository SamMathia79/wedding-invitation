import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { isAdminAuthenticated } from '@/lib/auth';
import { saveSettings } from '@/lib/db';
import { WeddingSettings } from '@/lib/types';

const ALLOWED_SLOTS = new Set<keyof WeddingSettings>([
  'bgCurtain',
  'bgHero',
  'bgWelcome',
  'bgLocation',
  'bgGift',
  'bgVenue',
  'ogImage',
  'musicUrl'
]);

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif'
]);

const AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/webm'
]);

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-80);
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const slotRaw = String(formData.get('slot') || '').trim() as keyof WeddingSettings;
    const autoSave = formData.get('autoSave') !== 'false';

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'No file uploaded.' }, { status: 400 });
    }

    const isAudioSlot = slotRaw === 'musicUrl';
    const allowedSet = isAudioSlot ? AUDIO_TYPES : IMAGE_TYPES;
    const ext = path.extname(file.name).toLowerCase();
    const validByExt = isAudioSlot
      ? ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext)
      : ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'].includes(ext);

    if (!allowedSet.has(file.type) && !validByExt) {
      return NextResponse.json(
        {
          ok: false,
          error: isAudioSlot
            ? 'Unsupported audio format. Please upload MP3, WAV, M4A, AAC, or OGG.'
            : 'Unsupported image format. Please upload JPG, PNG, WebP, AVIF, or GIF.'
        },
        { status: 400 }
      );
    }

    const safeName = `${Date.now()}-${sanitizeFilename(file.name || (isAudioSlot ? 'music.mp3' : 'photo.jpg'))}`;
    let publicUrl = '';

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`wedding/${safeName}`, file, {
        access: 'public',
        addRandomSuffix: false
      });
      publicUrl = blob.url;
    } else if (process.env.VERCEL) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'BLOB_READ_WRITE_TOKEN is not configured yet on Vercel. Connect Vercel Blob in Project Settings -> Storage, or paste an external URL.'
        },
        { status: 400 }
      );
    } else {
      // Local development fallback -> save into public/uploads/
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      await fs.mkdir(uploadsDir, { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(path.join(uploadsDir, safeName), buffer);
      publicUrl = `/uploads/${safeName}`;
    }

    let settings: WeddingSettings | undefined;
    if (autoSave && ALLOWED_SLOTS.has(slotRaw)) {
      settings = await saveSettings({ [slotRaw]: publicUrl });
    }

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      slot: slotRaw,
      settings
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
