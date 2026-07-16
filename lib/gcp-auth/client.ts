// Client-side Firebase Auth initialization.
// Use: getAuth() returns the client Auth instance for signInWithEmailAndPassword, etc.

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { Auth, getAuth as getAuthFromFirebase } from 'firebase/auth';

let app: FirebaseApp | null = null;

export function getAuth(): Auth {
  // Ensure app is initialized
  if (!app) {
    const configStr = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
    if (!configStr) {
      throw new Error('NEXT_PUBLIC_FIREBASE_CONFIG environment variable is not set');
    }

    const config = JSON.parse(configStr);

    // Reuse existing Firebase app if available (singleton pattern)
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
    } else {
      app = initializeApp(config);
    }
  }

  return getAuthFromFirebase(app);
}
