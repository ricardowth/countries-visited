# Google login & cloud sync — how it will work

This guide explains how to add "Sign in with Google" to Countries Visited so each
user's marked countries are saved to the cloud, and how offline changes sync when
the user comes back online. Nothing here is implemented yet — it's the plan and a
tutorial, written for this codebase.

## The mental model: local-first

The app already works fully offline: every change is written to `localStorage`
immediately (see `src/state/store.tsx`). That stays exactly as it is. Login adds a
**second, cloud copy** of the same data:

```
user taps a country
      │
      ▼
localStorage (instant, works offline)          ← source of truth on the device
      │
      ▼  (when logged in, whenever online)
Firestore users/{uid}  (cloud copy)            ← source of truth across devices
```

The golden rule of local-first apps: the UI never waits for the network. The
cloud copy catches up in the background.

## Recommended stack: Firebase (Auth + Firestore)

For this app I recommend **Firebase** over alternatives:

| Option | Verdict |
|---|---|
| **Firebase Auth + Firestore** | ✅ Google login is first-class, Firestore has *built-in* offline queueing (writes made offline are persisted in IndexedDB and auto-sent when back online), generous free tier, no server to run. |
| Supabase | Nice, but its offline story is DIY — you'd hand-build the sync queue Firebase gives you for free. |
| Your own backend (Google Identity Services + a database) | Most control, most work: token verification, session handling, sync endpoint, conflict logic — all on you. Not worth it for this app yet. |

Free tier limits (more than enough here): 50k reads / 20k writes per day. One
user's whole dataset is a single small document.

## Step 1 — Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and **Add project** (e.g. `countries-visited`).
2. In **Build → Authentication → Sign-in method**, enable **Google**.
3. In **Build → Firestore Database**, create a database in production mode.
4. In **Project settings → Your apps**, add a **Web app**. Copy the `firebaseConfig` object it shows you.
5. In **Authentication → Settings → Authorized domains**, add the domain where you'll host the app (localhost is pre-authorized).

The `firebaseConfig` values (apiKey etc.) are **not secrets** — they ship in the
JS bundle. Security comes from Firestore rules (step 4).

## Step 2 — Add Firebase to the app

```powershell
npm install firebase
```

Create `src/sync/firebase.ts`:

```ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  doc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';

const app = initializeApp({
  // paste your firebaseConfig here
});

export const auth = getAuth(app);

// persistentLocalCache = Firestore keeps data + pending writes in IndexedDB,
// so writes made offline are queued and sent automatically on reconnect.
export const db = initializeFirestore(app, { localCache: persistentLocalCache() });

export function loginWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function logout() {
  return signOut(auth);
}
```

Popup vs redirect: `signInWithPopup` works on desktop and Android. On iOS in
installed-PWA (standalone) mode popups are unreliable — fall back to
`signInWithRedirect` there. A simple check:

```ts
const standalone = window.matchMedia('(display-mode: standalone)').matches;
```

## Step 3 — The data model and sync logic

One document per user is enough — the whole dataset is tiny:

```
users/{uid}
  listMode: "un" | "travel"
  statuses: { PRT: {s: "home", t: 1752900000000}, ESP: {s: "visited", t: 1752900010000}, ... }
```

Note each status carries `t`, a **timestamp of when that country was last
changed**. That's what makes merging two devices safe.

### The merge rule (last-write-wins per country)

When a user logs in (or comes back online on a second device), you have a local
map and a remote map. For every country in either map, **keep the entry with the
newer timestamp**. Deletions are handled by writing a tombstone
`{s: null, t: ...}` instead of removing the key.

```ts
function merge(local: Statuses, remote: Statuses): Statuses {
  const out = { ...remote };
  for (const [code, entry] of Object.entries(local)) {
    if (!out[code] || entry.t > out[code].t) out[code] = entry;
  }
  return out;
}
```

This requires one small change to the app's store: when a status changes, record
`Date.now()` alongside it. (Today the store keeps only the status string; the
migration is: on first login, stamp all existing entries with `t: Date.now()`.)

### Wiring it up

```ts
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

onAuthStateChanged(auth, (user) => {
  if (!user) return; // stay purely local
  const ref = doc(db, 'users', user.uid);

  // Pull: listen to the cloud copy; merge remote changes into local state.
  onSnapshot(ref, (snap) => {
    if (snap.exists()) store.replaceState(merge(localState(), snap.data()));
  });

  // Push: after every local change, write the merged result back.
  // Firestore queues this if offline and sends it when back online — free sync.
  store.subscribe((state) => setDoc(ref, state, { merge: true }));
});
```

That's the whole system. Because Firestore's persistent cache queues offline
writes, "user marks 5 countries in airplane mode, lands, opens the app" is
handled without any code of yours: the queued `setDoc` calls flush on reconnect.

## Step 4 — Security rules

In **Firestore → Rules** — each user can touch only their own document:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

## Step 5 — UI touches

- A **Sign in with Google** button in Settings (and show the account's photo/name + Sign out when logged in).
- On first login, if the cloud copy is non-empty and local is non-empty, the merge rule above resolves it silently — no scary dialogs needed.
- Anonymous use keeps working forever; login is optional and only adds backup + multi-device.

## Gotchas to remember

- **Auth needs network the first time.** After that, Firebase caches the session and the user stays "logged in" offline.
- **Never block the UI on a network write.** Always write localStorage first (the app already does).
- **Timestamps from two devices with skewed clocks** can theoretically fight; for this app's data (a few hundred small entries, one owner) last-write-wins is fine.
- **The service worker caches the app shell**, not Firestore data — Firestore's own IndexedDB cache handles data offline. The two don't conflict.
- If you later add **Story mode sharing**, generated images should not require login — keep sharing anonymous-friendly.
