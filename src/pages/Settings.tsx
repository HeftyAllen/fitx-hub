import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { User, Bell, Ruler, Palette, Database, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
        <h1 className="text-2xl font-heading font-bold">Settings</h1>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full gradient-bg flex items-center justify-center text-xl font-bold text-primary-foreground">
            {userProfile?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <h2 className="font-heading font-bold">{userProfile?.name || "User"}</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </motion.div>

        {[
          { icon: User, label: "Edit Profile", desc: "Update your personal info" },
          { icon: Bell, label: "Notifications", desc: "Manage reminders and alerts" },
          { icon: Ruler, label: "Units", desc: "kg/lbs, cm/ft" },
          { icon: Palette, label: "Appearance", desc: "Theme preferences" },
          { icon: Database, label: "Data", desc: "Export or delete your data" },
        ].map(({ icon: Icon, label, desc }, i) => (
          <motion.button
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="w-full glass-card p-4 flex items-center gap-4 text-left hover:bg-secondary/50 transition-colors"
          >
            <div className="p-2 rounded-xl bg-secondary">
              <Icon size={18} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </motion.button>
        ))}

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={handleLogout}
          className="w-full glass-card p-4 flex items-center gap-4 text-left hover:bg-destructive/10 transition-colors"
        >
          <div className="p-2 rounded-xl bg-destructive/10">
            <LogOut size={18} className="text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium text-destructive">Sign Out</p>
            <p className="text-xs text-muted-foreground">Log out of your account</p>
          </div>
        </motion.button>
      </div>
    </AppLayout>
  );
}
