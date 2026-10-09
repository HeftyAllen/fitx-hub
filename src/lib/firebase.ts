import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase web config — public identifier (security enforced via Firestore/Storage rules).
// Safe to commit. Do NOT put server secrets (Spoonacular, RapidAPI, etc.) here.
const emulators = import.meta.env.MODE === "e2e" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
const firebaseConfig = {
  apiKey: "AIzaSyAHEvRJuOyZ8SagrmioDFmrWH8rAqCu5Vk",
  authDomain: "fit-x-journey.firebaseapp.com",
  projectId: emulators ? "demo-fitx-workspaces" : "fit-x-journey",
  // New Firebase projects use *.firebasestorage.app — legacy projects use *.appspot.com.
  // Override via VITE_FIREBASE_STORAGE_BUCKET if your console shows the legacy host.
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "fit-x-journey.firebasestorage.app",
  messagingSenderId: "583991205621",
  appId: "1:583991205621:web:6db1600a16b23590c3efbc",
  measurementId: "G-XT12JJNNC3",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
if (emulators) connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });

// Firestore with offline persistence (multi-tab safe)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
if (emulators) connectFirestoreEmulator(db, "127.0.0.1", 8085);

export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
