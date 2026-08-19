import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Keeps the theme store bound to the signed-in member and applies the theme
 * saved on their profile. Signing out returns the device to the guest theme.
 */
export default function ThemeSync() {
  const { user, userProfile } = useAuth();
  const { bindUser, setTheme } = useTheme();

  useEffect(() => {
    bindUser(user?.uid ?? null);
  }, [user?.uid, bindUser]);

  useEffect(() => {
    if (!user) return;
    const t = userProfile?.theme;
    if (t === "light" || t === "dark") setTheme(t);
  }, [user?.uid, userProfile?.theme, setTheme, user]);

  return null;
}
