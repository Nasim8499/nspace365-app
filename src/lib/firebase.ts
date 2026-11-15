/**
 * Firebase bootstrap for NsPaces Studio.
 *
 * The config is resolved in this order:
 *   1. build-time env vars  (VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID, ...)
 *   2. the Firebase Hosting reserved URL  /__/firebase/init.json  (auto-injected on *.web.app)
 *
 * When neither is available the app keeps working on the local-first store, so a
 * missing config never breaks the UI.
 */
import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';

export interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  projectId: string;
}

const env = ((import.meta as unknown as { env?: Record<string, string> }).env || {}) as Record<string, string>;

export const FIREBASE_PROJECT_ID = env.VITE_FIREBASE_PROJECT_ID || '';
export const FIREBASE_AUTH_DOMAIN =
  env.VITE_FIREBASE_AUTH_DOMAIN || (FIREBASE_PROJECT_ID ? `${FIREBASE_PROJECT_ID}.firebaseapp.com` : '');

function optionsFromEnv(): FirebaseOptions | null {
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const appId = env.VITE_FIREBASE_APP_ID;
  if (!apiKey || !projectId || !appId) return null;
  return {
    apiKey,
    projectId,
    appId,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
  };
}

/** Firebase Hosting injects the project's web config at this reserved URL. */
async function optionsFromHosting(): Promise<FirebaseOptions | null> {
  if (typeof location === 'undefined') return null;
  try {
    const res = await fetch('/__/firebase/init.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as FirebaseOptions;
    if (!json?.apiKey || !json?.projectId || !json?.appId) return null;
    return json;
  } catch {
    return null;
  }
}

/** true when the build already carries a web-app config, so the UI can pick Firebase without waiting. */
export function firebaseConfigured(): boolean {
  return !!optionsFromEnv();
}

let handles: Promise<FirebaseHandles | null> | null = null;

async function boot(): Promise<FirebaseHandles | null> {
  const options = optionsFromEnv() || (await optionsFromHosting());
  if (!options) return null;
  try {
    const app = initializeApp(options);
    const auth = getAuth(app);
    await setPersistence(auth, browserLocalPersistence).catch(() => undefined);
    let db: Firestore;
    try {
      // offline cache: reads keep working with no connection, writes replay when back online
      db = initializeFirestore(app, {
        localCache: undefined,
        experimentalAutoDetectLongPolling: true,
      });
    } catch {
      db = getFirestore(app);
    }
    return { app, auth, db, projectId: options.projectId || '' };
  } catch (err) {
    console.warn('[firebase] init failed', err);
    return null;
  }
}

/** Cached Firebase handles, or null when the project config is missing. */
export function firebaseReady(): Promise<FirebaseHandles | null> {
  if (!handles) handles = boot();
  return handles;
}
