import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'wedding_admin_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getAdminCredentials() {
  return {
    username: process.env.ADMIN_USERNAME || 'SamRebecca2027',
    password: process.env.ADMIN_PASSWORD || 'SamRebecca@2027'
  };
}

function getSecret(): string {
  const creds = getAdminCredentials();
  return (
    process.env.ADMIN_SESSION_SECRET ||
    `samer-rafca-2027-secret-${creds.username}-${creds.password}`
  );
}

function signPayload(payloadB64: string): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest('base64url');
}

export function validateCredentials(username: string, password: string): boolean {
  const expected = getAdminCredentials();
  const userBuf = Buffer.from(username);
  const expUserBuf = Buffer.from(expected.username);
  const passBuf = Buffer.from(password);
  const expPassBuf = Buffer.from(expected.password);

  const userMatch =
    userBuf.length === expUserBuf.length &&
    crypto.timingSafeEqual(userBuf, expUserBuf);
  const passMatch =
    passBuf.length === expPassBuf.length &&
    crypto.timingSafeEqual(passBuf, expPassBuf);

  return userMatch && passMatch;
}

export function createSessionToken(username: string): string {
  const payload = JSON.stringify({
    u: username,
    exp: Date.now() + SESSION_TTL_MS
  });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const sig = signPayload(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token || !token.includes('.')) return false;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return false;

  const expectedSig = signPayload(payloadB64);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (typeof parsed.exp !== 'number' || Date.now() > parsed.exp) {
      return false;
    }
    return parsed.u === getAdminCredentials().username;
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function setAdminSessionCookie(username: string): Promise<void> {
  const cookieStore = await cookies();
  const token = createSessionToken(username);
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000)
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
