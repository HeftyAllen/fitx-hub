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

async function syncUserDoc(user: User) {
  try {
    const profRef = doc(db, "users", user.uid, "profile", "data");
    const indexRef = doc(db, "users", user.uid);
    const profSnap = await getDoc(profRef);

    const summary: any = {
      email: user.email ?? null,
      name: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      providerId: user.providerData?.[0]?.providerId ?? "password",
      lastLoginAt: serverTimestamp(),
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
