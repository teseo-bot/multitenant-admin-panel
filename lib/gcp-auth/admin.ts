import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export function adminAuth(): ReturnType<typeof getAuth> {
  // Reuse existing app if available
  if (getApps().length > 0) {
    return getAuth();
  }

  // Initialize: first try applicationDefault (Cloud Run or GOOGLE_APPLICATION_CREDENTIALS env)
  try {
    initializeApp({
      credential: applicationDefault(),
    });
  } catch {
    // If applicationDefault fails, we're in local without proper credentials
    const envName = 'GOOGLE_APPLICATION_CREDENTIALS';
    throw new Error(
      `Failed to initialize Firebase Admin: no credentials available. ` +
      `Set ${envName} environment variable or ensure running in Cloud Run with ADC enabled.`
    );
  }

  return getAuth();
}
