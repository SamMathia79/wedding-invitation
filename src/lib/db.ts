import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import {
  DEFAULT_SETTINGS,
  Guest,
  RsvpStatus,
  SAMPLE_GUESTS,
  StorageInfo,
  UpsertGuestInput,
  WeddingSettings
} from './types';

function getDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    undefined
  );
}

export function getStorageInfo(): StorageInfo {
  const hasDb = Boolean(getDatabaseUrl());
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const isVercel = Boolean(process.env.VERCEL);

  return {
    database: hasDb ? 'postgres' : isVercel ? 'ephemeral-tmp' : 'local-file',
    media: hasBlob ? 'vercel-blob' : isVercel ? 'url-only' : 'local-public',
    isVercel
  };
}

// ==========================================================
// 1. POSTGRES / NEON ADAPTER (Production on Vercel)
// ==========================================================
let pgInitialized = false;

async function getSql() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) return null;
  const sql = neon(dbUrl);

  if (!pgInitialized) {
    await sql`
      CREATE TABLE IF NOT EXISTS wedding_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS wedding_guests (
        code TEXT PRIMARY KEY,
        name_en TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        max_seats INTEGER NOT NULL DEFAULT 5,
        status TEXT NOT NULL DEFAULT 'Pending',
        attending_seats INTEGER NOT NULL DEFAULT 0,
        message TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT ''
      )
    `;

    const existingCount = await sql`SELECT COUNT(*)::int AS cnt FROM wedding_guests`;
    if ((existingCount[0]?.cnt ?? 0) === 0) {
      for (const g of SAMPLE_GUESTS) {
        await sql`
          INSERT INTO wedding_guests (code, name_en, name_ar, max_seats, status, attending_seats, message, updated_at)
          VALUES (${g.code}, ${g.nameEN}, ${g.nameAR}, ${g.maxSeats}, ${g.status}, ${g.attendingSeats}, ${g.message}, ${g.updatedAt})
          ON CONFLICT (code) DO NOTHING
        `;
      }
    }
    pgInitialized = true;
  }

  return sql;
}

// ==========================================================
// 2. LOCAL JSON FILE ADAPTER (Zero-config Local Development)
// ==========================================================
interface LocalDbSchema {
  settings: Partial<WeddingSettings>;
  guests: Guest[];
}

function getLocalDbPath(): string {
  if (process.env.VERCEL) {
    return path.join('/tmp', 'wedding-db.json');
  }
  return path.join(process.cwd(), 'data', 'wedding-db.json');
}

async function readLocalDb(): Promise<LocalDbSchema> {
  const dbPath = getLocalDbPath();
  try {
    const raw = await fs.readFile(dbPath, 'utf8');
    const parsed = JSON.parse(raw) as LocalDbSchema;
    return {
      settings: parsed.settings || {},
      guests: Array.isArray(parsed.guests) ? parsed.guests : [...SAMPLE_GUESTS]
    };
  } catch {
    const initial: LocalDbSchema = {
      settings: { ...DEFAULT_SETTINGS },
      guests: [...SAMPLE_GUESTS]
    };
    await writeLocalDb(initial);
    return initial;
  }
}

async function writeLocalDb(data: LocalDbSchema): Promise<void> {
  const dbPath = getLocalDbPath();
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

// ==========================================================
// 3. PUBLIC REPOSITORY API
// ==========================================================
function normalizeStatus(status?: string): RsvpStatus {
  if (status === 'Confirmed') return 'Confirmed';
  if (status === 'Declined') return 'Declined';
  return 'Pending';
}

export async function getSettings(): Promise<WeddingSettings> {
  const sql = await getSql();
  if (sql) {
    const rows = await sql`SELECT key, value FROM wedding_settings`;
    const merged: WeddingSettings = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      const k = String(row.key) as keyof WeddingSettings;
      if (k in merged) {
        merged[k] = String(row.value ?? '');
      }
    }
    return merged;
  }

  const db = await readLocalDb();
  return {
    ...DEFAULT_SETTINGS,
    ...db.settings
  };
}

export async function saveSettings(
  updates: Partial<WeddingSettings>
): Promise<WeddingSettings> {
  const validKeys = Object.keys(DEFAULT_SETTINGS) as (keyof WeddingSettings)[];
  const filtered: Partial<WeddingSettings> = {};
  for (const key of validKeys) {
    if (updates[key] !== undefined) {
      filtered[key] = String(updates[key]).trim();
    }
  }

  const sql = await getSql();
  if (sql) {
    for (const [key, value] of Object.entries(filtered)) {
      await sql`
        INSERT INTO wedding_settings (key, value)
        VALUES (${key}, ${value ?? ''})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    }
    return getSettings();
  }

  const db = await readLocalDb();
  db.settings = {
    ...DEFAULT_SETTINGS,
    ...db.settings,
    ...filtered
  };
  await writeLocalDb(db);
  return { ...DEFAULT_SETTINGS, ...db.settings };
}

export async function listGuests(): Promise<Guest[]> {
  const sql = await getSql();
  if (sql) {
    const rows = await sql`
      SELECT code, name_en, name_ar, max_seats, status, attending_seats, message, updated_at
      FROM wedding_guests
      ORDER BY updated_at DESC, code ASC
    `;
    return rows.map((r) => ({
      code: String(r.code),
      nameEN: String(r.name_en),
      nameAR: String(r.name_ar),
      maxSeats: Number(r.max_seats) || 5,
      status: normalizeStatus(String(r.status)),
      attendingSeats: Number(r.attending_seats) || 0,
      message: String(r.message || ''),
      updatedAt: String(r.updated_at || '')
    }));
  }

  const db = await readLocalDb();
  return db.guests;
}

export async function getGuestByCode(code: string): Promise<Guest | null> {
  const clean = code.trim();
  if (!clean) return null;

  const sql = await getSql();
  if (sql) {
    const rows = await sql`
      SELECT code, name_en, name_ar, max_seats, status, attending_seats, message, updated_at
      FROM wedding_guests
      WHERE LOWER(code) = LOWER(${clean})
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      code: String(r.code),
      nameEN: String(r.name_en),
      nameAR: String(r.name_ar),
      maxSeats: Number(r.max_seats) || 5,
      status: normalizeStatus(String(r.status)),
      attendingSeats: Number(r.attending_seats) || 0,
      message: String(r.message || ''),
      updatedAt: String(r.updated_at || '')
    };
  }

  const db = await readLocalDb();
  return (
    db.guests.find((g) => g.code.trim().toLowerCase() === clean.toLowerCase()) ||
    null
  );
}

export async function upsertGuest(input: UpsertGuestInput): Promise<Guest> {
  const cleanCode = input.code.trim();
  const maxSeats = Math.max(1, Math.min(25, Number(input.maxSeats) || 5));
  const existing = await getGuestByCode(cleanCode);

  const status = input.status
    ? normalizeStatus(input.status)
    : existing?.status || 'Pending';
  const rawAttending =
    input.attendingSeats !== undefined
      ? Number(input.attendingSeats)
      : existing?.attendingSeats ?? 0;
  const attendingSeats =
    status === 'Confirmed'
      ? Math.min(Math.max(1, rawAttending || 1), maxSeats)
      : 0;
  const message =
    input.message !== undefined
      ? String(input.message).slice(0, 500)
      : existing?.message ?? '';
  const updatedAt = existing?.updatedAt || new Date().toISOString();

  const record: Guest = {
    code: existing ? existing.code : cleanCode,
    nameEN: input.nameEN.trim(),
    nameAR: input.nameAR.trim(),
    maxSeats,
    status,
    attendingSeats,
    message,
    updatedAt
  };

  const sql = await getSql();
  if (sql) {
    if (existing) {
      await sql`
        UPDATE wedding_guests
        SET name_en = ${record.nameEN},
            name_ar = ${record.nameAR},
            max_seats = ${record.maxSeats},
            status = ${record.status},
            attending_seats = ${record.attendingSeats},
            message = ${record.message}
        WHERE LOWER(code) = LOWER(${cleanCode})
      `;
    } else {
      await sql`
        INSERT INTO wedding_guests (code, name_en, name_ar, max_seats, status, attending_seats, message, updated_at)
        VALUES (${record.code}, ${record.nameEN}, ${record.nameAR}, ${record.maxSeats}, ${record.status}, ${record.attendingSeats}, ${record.message}, ${record.updatedAt})
      `;
    }
    return record;
  }

  const db = await readLocalDb();
  const idx = db.guests.findIndex(
    (g) => g.code.trim().toLowerCase() === cleanCode.toLowerCase()
  );
  if (idx >= 0) {
    db.guests[idx] = record;
  } else {
    db.guests.push(record);
  }
  await writeLocalDb(db);
  return record;
}

export async function deleteGuest(code: string): Promise<boolean> {
  const cleanCode = code.trim();
  if (!cleanCode) return false;

  const sql = await getSql();
  if (sql) {
    await sql`DELETE FROM wedding_guests WHERE LOWER(code) = LOWER(${cleanCode})`;
    return true;
  }

  const db = await readLocalDb();
  const before = db.guests.length;
  db.guests = db.guests.filter(
    (g) => g.code.trim().toLowerCase() !== cleanCode.toLowerCase()
  );
  await writeLocalDb(db);
  return db.guests.length < before;
}

export async function submitRsvp(params: {
  code?: string;
  guestName?: string;
  status: 'Confirmed' | 'Declined';
  attendingSeats: number;
  message: string;
}): Promise<
  | { ok: true; guest: Guest }
  | { ok: false; error: 'DEADLINE_PASSED' | 'NAME_REQUIRED' }
> {
  const settings = await getSettings();
  const now = new Date();
  const deadline = new Date(settings.rsvpDeadlineIso || DEFAULT_SETTINGS.rsvpDeadlineIso);
  if (now > deadline) {
    return { ok: false, error: 'DEADLINE_PASSED' };
  }

  const maxPlus = Math.max(1, Math.min(10, Number(settings.maxPlusGuests) || 4));
  const globalMaxSeats = maxPlus + 1; // 1 (self) + up to +4 = 5 total seats

  const cleanCode = String(params.code || '').trim();
  const existing = cleanCode ? await getGuestByCode(cleanCode) : null;

  const status: RsvpStatus =
    params.status === 'Confirmed' ? 'Confirmed' : 'Declined';
  const message = String(params.message || '').trim().slice(0, 500);
  const updatedAt = now.toISOString();

  // Case 1: Personalized invite (?g=code) or returning open-link guest with saved code
  if (existing) {
    const allowedMax = Math.max(existing.maxSeats || globalMaxSeats, globalMaxSeats);
    const attendingSeats =
      status === 'Confirmed'
        ? Math.min(Math.max(1, Number(params.attendingSeats) || 1), allowedMax)
        : 0;
    const providedName = String(params.guestName || '').trim();

    const updated: Guest = {
      ...existing,
      nameEN: providedName || existing.nameEN,
      nameAR: providedName || existing.nameAR,
      maxSeats: allowedMax,
      status,
      attendingSeats,
      message,
      updatedAt
    };

    const sql = await getSql();
    if (sql) {
      await sql`
        UPDATE wedding_guests
        SET name_en = ${updated.nameEN},
            name_ar = ${updated.nameAR},
            max_seats = ${updated.maxSeats},
            status = ${updated.status},
            attending_seats = ${updated.attendingSeats},
            message = ${updated.message},
            updated_at = ${updated.updatedAt}
        WHERE LOWER(code) = LOWER(${existing.code})
      `;
      return { ok: true, guest: updated };
    }

    const db = await readLocalDb();
    const idx = db.guests.findIndex(
      (g) => g.code.trim().toLowerCase() === existing.code.toLowerCase()
    );
    if (idx >= 0) {
      db.guests[idx] = updated;
      await writeLocalDb(db);
    }
    return { ok: true, guest: updated };
  }

  // Case 2: Open WhatsApp link without ?g=code — create guest record from provided name
  const guestName = String(params.guestName || '').trim();
  if (!guestName) {
    return { ok: false, error: 'NAME_REQUIRED' };
  }

  const newCode = `w-${crypto.randomBytes(3).toString('hex')}`;
  const attendingSeats =
    status === 'Confirmed'
      ? Math.min(Math.max(1, Number(params.attendingSeats) || 1), globalMaxSeats)
      : 0;

  const created: Guest = {
    code: newCode,
    nameEN: guestName,
    nameAR: guestName,
    maxSeats: globalMaxSeats,
    status,
    attendingSeats,
    message,
    updatedAt
  };

  const sql = await getSql();
  if (sql) {
    await sql`
      INSERT INTO wedding_guests (code, name_en, name_ar, max_seats, status, attending_seats, message, updated_at)
      VALUES (${created.code}, ${created.nameEN}, ${created.nameAR}, ${created.maxSeats}, ${created.status}, ${created.attendingSeats}, ${created.message}, ${created.updatedAt})
    `;
    return { ok: true, guest: created };
  }

  const db = await readLocalDb();
  db.guests.unshift(created);
  await writeLocalDb(db);
  return { ok: true, guest: created };
}
