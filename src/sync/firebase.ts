import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

// These values are app identifiers, not secrets — they ship in the JS bundle
// anyway. Security comes from Firestore rules (docs/GOOGLE_LOGIN.md, step 4).
const app = initializeApp({
  apiKey: 'AIzaSyBPB1fOdP6n73L5PpvUKG-flrzXICF3F_0',
  authDomain: 'countries-visited-87759.firebaseapp.com',
  projectId: 'countries-visited-87759',
  storageBucket: 'countries-visited-87759.firebasestorage.app',
  messagingSenderId: '367554257034',
  appId: '1:367554257034:web:79d6ba7d9dca20b29d0d73',
});

export const auth = getAuth(app);

// persistentLocalCache = Firestore keeps data + pending writes in IndexedDB,
// so writes made offline are queued and sent automatically on reconnect.
export const db = initializeFirestore(app, { localCache: persistentLocalCache() });

export function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  // Popups are unreliable in iOS installed-PWA (standalone) mode — use redirect there.
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent);
  return standalone && ios
    ? signInWithRedirect(auth, provider)
    : signInWithPopup(auth, provider);
}

export function logout() {
  return signOut(auth);
}
