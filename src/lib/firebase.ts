import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase web config — public identifier (security enforced via Firestore/Storage rules).
// Safe to commit. Do NOT put server secrets (Spoonacular, RapidAPI, etc.) here.
const firebaseConfig = {
  apiKey: "AIzaSyAHEvRJuOyZ8SagrmioDFmrWH8rAqCu5Vk",
  authDomain: "fit-x-journey.firebaseapp.com",
  projectId: "fit-x-journey",
  storageBucket: "fit-x-journey.appspot.com",
  messagingSenderId: "583991205621",
  appId: "1:583991205621:web:6db1600a16b23590c3efbc",
  measurementId: "G-XT12JJNNC3",
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
