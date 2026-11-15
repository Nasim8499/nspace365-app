/**
 * Firestore sync for NsPaces Studio.
 *
 * Layout (everything is scoped to the signed-in user):
 *   users/{uid}                        profile + preferences
 *   users/{uid}/conversations/{id}     chat threads with their messages
 *   users/{uid}/artifacts/{id}
 *   users/{uid}/memories/{id}
 *   users/{uid}/visaCases/{id}
 *   users/{uid}/automations/{id}
 *
 * Pull → merge into the local store, push → write local changes back.
 * Local writes stay instant; Firestore catches up behind a short debounce.
 */
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import { firebaseReady } from './firebase';
import type { DB } from '../types';
import type { VisaCase } from './dossier';

type Slice = 'conversations' | 'artifacts' | 'memories' | 'visaCases' | 'automations';
const SLICES: Slice[] = ['conversations', 'artifacts', 'memories', 'visaCases', 'automations'];

const stamp = () => Date.now();

/** newest copy of each record wins, so a stale device never rolls data back */
function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const out = new Map<string, T>();
  local.forEach((r) => r && r.id && out.set(r.id, r));
  remote.forEach((r) => {
    if (!r || !r.id) return;
    const cur = out.get(r.id);
    if (!cur) {
      out.set(r.id, r);
      return;
    }
    const a = (cur as { updatedAt?: number }).updatedAt || 0;
    const b = (r as { updatedAt?: number }).updatedAt || 0;
    out.set(r.id, b >= a ? r : cur);
  });
  return Array.from(out.values());
}

function clean<T extends object>(value: T): DocumentData {
  // Firestore rejects undefined; JSON round-trip is the cheapest sanitiser here
  return JSON.parse(JSON.stringify(value, (_k, v) => (v === undefined ? null : v))) as DocumentData;
}

/** Read the whole account state once (used on the first sign-in of a new device). */
export async function pullUserData(uid: string): Promise<Partial<DB> | null> {
  const fb = await firebaseReady();
  if (!fb) return null;
  const patch: Partial<DB> = {};
  const scope = collection(fb.db, 'users', uid);
  for (const slice of SLICES) {
    const snap = await getDocs(collection(scope, slice)).catch(() => null);
    if (!snap) continue;
    const rows = snap.docs.map((d) => d.data() as never);
    if (rows.length) (patch as Record<string, unknown>)[slice] = rows;
  }
  return patch;
}

export interface RemoteProfile {
  name?: string;
  email?: string;
  role?: 'applicant' | 'admin';
  handle?: string;
  theme?: 'light' | 'dark';
  defaultModel?: string;
  updatedAt?: number;
}

/** Write the profile document (name, role, appearance, default model). */
export async function pushProfile(uid: string, profile: RemoteProfile): Promise<void> {
  const fb = await firebaseReady();
  if (!fb) return;
  await setDoc(doc(fb.db, 'users', uid), clean({ ...profile, updatedAt: stamp() }), { merge: true }).catch((e) =>
    console.warn('[firestore] profile write failed', e)
  );
}

let pending: ReturnType<typeof setTimeout> | null = null;
let queued: { db: DB; uid: string } | null = null;

/** Debounced push of every changed slice. Safe to call on each store update. */
export function schedulePush(uid: string, db: DB): void {
  queued = { db, uid };
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    const job = queued;
    queued = null;
    if (job) void flush(job.uid, job.db);
  }, 900);
}

async function flush(uid: string, db: DB): Promise<void> {
  const fb = await firebaseReady();
  if (!fb) return;
  try {
    const batch = writeBatch(fb.db);
    SLICES.forEach((slice) => {
      const rows = (db[slice] as unknown as { id: string }[]) || [];
      rows.forEach((row) => {
        if (!row?.id) return;
        batch.set(doc(fb.db, 'users', uid, slice, row.id), clean(row));
      });
    });
    await batch.commit();
  } catch (err) {
    console.warn('[firestore] push failed', err);
  }
}

/**
 * Live listeners: any device writing to the same account shows up here.
 * `apply` receives a partial DB to merge into the local store.
 */
export function startLiveSync(uid: string, apply: (patch: Partial<DB>) => void): () => void {
  const stops: Array<() => void> = [];
  let cancelled = false;
  void firebaseReady().then((fb) => {
    if (!fb || cancelled) return;
    SLICES.forEach((slice) => {
      const stop = onSnapshot(
        collection(fb.db as Firestore, 'users', uid, slice),
        (snap) => {
          // ignore echoes of our own unsent writes
          if (snap.metadata.hasPendingWrites || snap.empty) return;
          const rows = snap.docs.map((d) => d.data() as { id: string });
          if (!rows.length) return;
          apply({ [slice]: rows } as Partial<DB>);
        },
        (err) => console.warn('[firestore] listener error', slice, err)
      );
      stops.push(stop);
    });
  });
  return () => {
    cancelled = true;
    stops.forEach((s) => s());
  };
}

export { mergeById };
export type { VisaCase };
