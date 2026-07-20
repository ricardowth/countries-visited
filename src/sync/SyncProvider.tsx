import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useStore } from '../state/store';
import { auth, db, loginWithGoogle, logout } from './firebase';
import {
  fromCloud,
  merge,
  stableStringify,
  toCloud,
  type CloudDoc,
  type CloudStatuses,
} from './merge';

interface SyncContextValue {
  user: User | null;
  login: () => Promise<unknown>;
  logout: () => Promise<void>;
  syncError: string | null;
}

const SyncContext = createContext<SyncContextValue>({
  user: null,
  login: loginWithGoogle,
  logout,
  syncError: null,
});

export function SyncProvider({ children }: { children: ReactNode }) {
  const { listMode, statuses, stamps, applyCloud } = useStore();
  const [user, setUser] = useState<User | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Latest local state, readable from the snapshot listener without resubscribing.
  const localRef = useRef({ listMode, statuses, stamps });
  localRef.current = { listMode, statuses, stamps };

  // stableStringify of the last CloudDoc known to match the cloud — breaks the
  // pull → state change → push → snapshot → pull echo loop.
  const lastSynced = useRef('');

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Pull: merge every remote change into local state (last write wins per country).
  useEffect(() => {
    if (!user) {
      lastSynced.current = '';
      setSyncError(null);
      return;
    }
    const ref = doc(db, 'users', user.uid);
    return onSnapshot(
      ref,
      (snap) => {
        setSyncError(null);
        const data = snap.data() as Partial<CloudDoc> | undefined;
        if (!data) return;
        const local = localRef.current;
        const remoteStatuses = (data.statuses ?? {}) as CloudStatuses;
        const merged = merge(toCloud(local.statuses, local.stamps), remoteStatuses);
        const nextListMode =
          data.listMode === 'travel' || data.listMode === 'un' ? data.listMode : local.listMode;
        if (stableStringify(merged) === stableStringify(remoteStatuses)) {
          // Nothing local is newer — remember this doc so the push effect stays quiet.
          lastSynced.current = stableStringify({ listMode: nextListMode, statuses: merged });
        }
        applyCloud({ listMode: nextListMode, ...fromCloud(merged) });
      },
      (err) => {
        console.error('Cloud sync read failed:', err);
        setSyncError(err.code);
      },
    );
  }, [user, applyCloud]);

  // Push: after every local change, write the full map back. Firestore queues
  // this while offline and flushes it on reconnect — offline sync for free.
  useEffect(() => {
    if (!user) return;
    const payload: CloudDoc = { listMode, statuses: toCloud(statuses, stamps) };
    const json = stableStringify(payload);
    if (json === lastSynced.current) return;
    lastSynced.current = json;
    setDoc(doc(db, 'users', user.uid), payload, { merge: true })
      .then(() => setSyncError(null))
      .catch((err) => {
        console.warn('Cloud sync write failed:', err);
        setSyncError(err.code ?? 'unknown');
      });
  }, [user, listMode, statuses, stamps]);

  const value = useMemo<SyncContextValue>(
    () => ({ user, login: loginWithGoogle, logout, syncError }),
    [user, syncError],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}
