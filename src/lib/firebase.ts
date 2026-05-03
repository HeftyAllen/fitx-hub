import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const env = import.meta.env;

function required(name: string, value: string | undefined): string {
  if (!value) {
    // eslint-disable-next-line no-console
    console.error(
      `[firebase] Missing env var ${name}. Add it to .env.local (see .env.example).`
    );
  }
  return value ?? "";
}

const firebaseConfig = {
  apiKey:            required("VITE_FIREBASE_API_KEY",        env.VITE_FIREBASE_API_KEY),
  authDomain:        required("VITE_FIREBASE_AUTH_DOMAIN",    env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId:         required("VITE_FIREBASE_PROJECT_ID",     env.VITE_FIREBASE_PROJECT_ID),
  storageBucket:     required("VITE_FIREBASE_STORAGE_BUCKET", env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: required("VITE_FIREBASE_SENDER_ID",      env.VITE_FIREBASE_SENDER_ID),
  appId:             required("VITE_FIREBASE_APP_ID",         env.VITE_FIREBASE_APP_ID),
  measurementId:     env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Firestore with offline persistence (multi-tab safe)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
