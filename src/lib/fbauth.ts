/**
 * Firebase Authentication helpers.
 * Email/password + Google sign-in, with the agency admin rule kept intact:
 * ADMIN_EMAIL always resolves to the admin role whatever provider was used.
 */
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { firebaseReady } from './firebase';
import { ADMIN_EMAIL } from './seed';

export interface FbAccount {
  uid: string;
  email: string;
  name: string;
  photo: string;
  verified: boolean;
  provider: string;
  role: 'applicant' | 'admin';
}

export function roleForEmail(email: string, fallback: 'applicant' | 'admin' = 'applicant'): 'applicant' | 'admin' {
  if (!email) return fallback;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : fallback;
}

export function toAccount(u: User, asked?: 'applicant' | 'admin'): FbAccount {
  const email = (u.email || '').toLowerCase();
  return {
    uid: u.uid,
    email,
    name: u.displayName || email.split('@')[0] || 'you',
    photo: u.photoURL || '',
    verified: !!u.emailVerified,
    provider: u.providerData[0]?.providerId || 'password',
    role: roleForEmail(email, asked),
  };
}

async function handles() {
  const fb = await firebaseReady();
  if (!fb) throw new Error('Firebase is not configured for this build.');
  return fb;
}

/** Create the account, set the display name, and fire Firebase's verification email. */
export async function fbSignUp(name: string, email: string, password: string): Promise<FbAccount> {
  const { auth } = await handles();
  const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() }).catch(() => undefined);
  await sendEmailVerification(cred.user, { url: `${location.origin}/#/chat` }).catch((e) => {
    console.warn('[firebase] verification email not sent', e);
  });
  return toAccount({ ...cred.user, displayName: name.trim() || cred.user.displayName } as User);
}

export async function fbSignIn(email: string, password: string): Promise<FbAccount> {
  const { auth } = await handles();
  const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  return toAccount(cred.user);
}

export async function fbGoogle(): Promise<FbAccount> {
  const { auth } = await handles();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const cred = await signInWithPopup(auth, provider);
    return toAccount(cred.user);
  } catch (err) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
      await signInWithRedirect(auth, provider);
      throw new Error('redirecting');
    }
    throw err;
  }
}

export async function fbResetPassword(email: string): Promise<void> {
  const { auth } = await handles();
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export async function fbSignOutNow(): Promise<void> {
  const fb = await firebaseReady();
  if (!fb) return;
  await signOut(fb.auth).catch(() => undefined);
}

/** Subscribe to the Firebase session (survives reloads) and finish any redirect sign-in. */
export function fbWatch(cb: (account: FbAccount | null) => void): () => void {
  let unsub: () => void = () => undefined;
  let dead = false;
  void firebaseReady().then(async (fb) => {
    if (!fb || dead) return;
    await getRedirectResult(fb.auth).catch(() => undefined);
    if (dead) return;
    unsub = onAuthStateChanged(fb.auth, (u) => cb(u ? toAccount(u) : null));
  });
  return () => {
    dead = true;
    unsub();
  };
}

/** Human wording for the common Firebase auth failures. */
export function fbError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'That email address does not look right.',
    'auth/missing-password': 'Enter your password.',
    'auth/weak-password': 'Use at least 6 characters for the password.',
    'auth/email-already-in-use': 'This email already has an account. Sign in instead.',
    'auth/invalid-credential': 'Email or password is wrong.',
    'auth/wrong-password': 'Email or password is wrong.',
    'auth/user-not-found': 'No account for that email yet. Sign up first.',
    'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
    'auth/popup-closed-by-user': 'The Google window closed before finishing.',
    'auth/unauthorized-domain': 'This domain is not authorized in Firebase Auth yet.',
    'auth/operation-not-allowed': 'That sign-in method is not enabled in Firebase yet.',
    'auth/network-request-failed': 'Network problem. Check your connection and retry.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      'Firebase is not configured for this build yet (missing web-app keys).',
    'auth/configuration-not-found': 'Firebase Authentication is not enabled for this project yet.',
    'auth/internal-error': 'Firebase could not reach the project. Check the config and try again.',
  };
  if (map[code]) return map[code];
  const msg = (err as { message?: string })?.message || '';
  if (msg) return msg.replace(/^Firebase:\s*/, '');
  return 'Sign-in failed. Try again.';
}
