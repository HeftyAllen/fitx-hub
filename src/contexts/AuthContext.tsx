import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userProfile: any | null;
  needsOnboarding: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<User>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Short human-friendly member code, e.g. FX-7K2Q4M — searchable by admins. */
function makeMemberCode(uid: string) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[hash % alphabet.length];
    hash = Math.floor(hash / alphabet.length) + (i + 1) * 7919;
  }
  return `FX-${out}`;
}

async function syncUserDoc(user: User) {
  try {
    const profRef = doc(db, "users", user.uid, "profile", "data");
    const indexRef = doc(db, "users", user.uid);
    const [profSnap, indexSnap] = await Promise.all([getDoc(profRef), getDoc(indexRef)]);
    const existing = { ...(profSnap.data() ?? {}), ...(indexSnap.data() ?? {}) } as any;

    const summary: any = {
      email: user.email ?? null,
      // never clobber a name/photo the member set themselves in Settings
      name: existing.name ?? user.displayName ?? null,
      photoURL: existing.photoURL ?? user.photoURL ?? null,
      providerId: user.providerData?.[0]?.providerId ?? "password",
      lastLoginAt: serverTimestamp(),
      uid: user.uid,
      memberCode: existing.memberCode ?? makeMemberCode(user.uid),
    };
    if (!profSnap.exists()) summary.createdAt = serverTimestamp();

    await Promise.all([
      setDoc(profRef, summary, { merge: true }),
      setDoc(indexRef, summary, { merge: true }),
    ]);
  } catch (e) {
    console.warn("[auth] syncUserDoc failed", e);
  }
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    const snap = await getDoc(doc(db, "users", uid, "profile", "data"));
    if (snap.exists()) setUserProfile(snap.data());
    else setUserProfile(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await syncUserDoc(user);
        await fetchProfile(user.uid);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await syncUserDoc(cred.user);
  };

  const signUp = async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await syncUserDoc(cred.user);
    return cred.user;
  };

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    await syncUserDoc(cred.user);
  };

  const logout = async () => {
    await signOut(auth);
    setUserProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  // Onboarding considered complete when profile has a goalType.
  const needsOnboarding = !!user && (!userProfile || !userProfile.goalType);

  return (
    <AuthContext.Provider value={{
      user, loading, userProfile, needsOnboarding,
      signIn, signUp, signInWithGoogle, logout, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
