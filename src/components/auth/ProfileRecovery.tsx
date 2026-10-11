import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export default function ProfileRecovery() {
  const { profileError, retryProfile, logout } = useAuth();
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    setSigningOut(true);
    try { await logout(); }
    catch { setError("We couldn't sign you out. Check your connection and try again."); }
    finally { setSigningOut(false); }
  };
  return <main className="min-h-screen bg-background flex items-center justify-center p-4">
    <div className="glass-card w-full max-w-md p-6 space-y-4">
      <h1 className="text-xl font-heading font-bold">Let's reconnect your profile</h1>
      <p role="alert" className="text-sm text-muted-foreground break-words">{profileError}</p>
      <div className="flex flex-wrap gap-3">
        <Button disabled={signingOut} onClick={retryProfile}>Try again</Button>
        <Button disabled={signingOut} variant="outline" onClick={signOut}>{signingOut ? "Signing out..." : "Sign out"}</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  </main>;
}
