import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from './admin';

export const SESSION_COOKIE = '__session';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession(idToken: string): Promise<string> {
  const auth = adminAuth();
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SEVEN_DAYS_MS,
  });
  return sessionCookie;
}

export async function verifySession(cookieValue: string): Promise<DecodedIdToken | null> {
  try {
    const auth = adminAuth();
    const decodedCookie = await auth.verifySessionCookie(cookieValue, true);
    return decodedCookie;
  } catch {
    return null;
  }
}

export async function destroySession(uid: string): Promise<void> {
  const auth = adminAuth();
  await auth.revokeRefreshTokens(uid);
}
