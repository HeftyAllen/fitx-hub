import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { toast } from "sonner";
import {
  Camera, User, Ruler, Bell, Palette, LogOut,
  Save, Loader2, ChevronDown, Moon, Sun, Shield,
} from "lucide-react";

const GOALS = ["Lose Weight", "Build Muscle", "Improve Endurance", "Stay Active", "Athletic Performance", "General Health"];
const ACTIVITY_LEVELS = ["Sedentary", "Lightly Active", "Moderately Active", "Very Active", "Elite Athlete"];
const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];

interface ProfileData {
  name: string;
  bio: string;
  photoURL: string;
  gender: string;
  dob: string;
  height: string;
  weight: string;
  goal: string;
  activityLevel: string;
  units: "metric" | "imperial";
  notifications: {
    workoutReminders: boolean;
    challengeAlerts: boolean;
    progressUpdates: boolean;
    weeklyReport: boolean;
  };
  theme: "dark" | "light";
}

const defaultProfile: ProfileData = {
  name: "",
  bio: "",
  photoURL: "",
  gender: "",
  dob: "",
  height: "",
  weight: "",
  goal: "",
  activityLevel: "",
  units: "metric",
  notifications: {
    workoutReminders: true,
    challengeAlerts: true,
    progressUpdates: true,
    weeklyReport: false,
  },
  theme: "dark",
};

function SectionHeader({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-primary/80 mb-0.5">{label}</h2>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all"
    />
  );
}

function SelectInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm appearance-none cursor-pointer transition-all pr-10"
      >
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
    </div>
  );
}

function Toggle({ checked, onChange, label, desc }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; desc: string;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0 ml-4 ${checked ? "bg-primary" : "bg-secondary border border-border"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function SaveButton({ onClick, saving, saved }: { onClick: () => void; saving: boolean; saved: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-60 shadow-lg shadow-primary/20"
    >
      {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
      {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
    </button>
  );
}

export default function Settings() {
  const { user, userProfile, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileData>(defaultProfile);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [metricsSaving, setMetricsSaving] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid, "profile", "data")).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile(prev => ({
          ...prev,
          ...data,
          notifications: { ...defaultProfile.notifications, ...(data.notifications || {}) },
        }));
      } else if (userProfile) {
        setProfile(prev => ({
          ...prev,
          name: userProfile.name || "",
          photoURL: userProfile.photoURL || user.photoURL || "",
        }));
      }
      setLoading(false);
    });
  }, [user, userProfile]);

  const set = (key: keyof ProfileData) => (value: any) =>
    setProfile(prev => ({ ...prev, [key]: value }));

  const setNotif = (key: keyof ProfileData["notifications"]) => (value: boolean) =>
    setProfile(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }));

  const saveSection = async (section: string, setSaving: (v: boolean) => void, data: Partial<ProfileData>) => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid, "profile", "data"), data, { merge: true });
      await refreshProfile();
      setSavedSection(section);
      toast.success("Changes saved");
      setTimeout(() => setSavedSection(null), 2500);
    } catch {
      toast.error("Failed to save — please try again");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoClick = () => fileInputRef.current?.click();

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5MB");
      return;
    }
    setPhotoUploading(true);
    try {
      const storageRef = ref(storage, `users/${user.uid}/avatar`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const newProfile = { ...profile, photoURL: url };
      setProfile(newProfile);
      await setDoc(doc(db, "users", user.uid, "profile", "data"), { photoURL: url }, { merge: true });
      await refreshProfile();
      toast.success("Profile photo updated");
    } catch {
      toast.error("Photo upload failed — try again");
    } finally {
      setPhotoUploading(false);
    }
    e.target.value = "";
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const initials = profile.name ? profile.name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "U";

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 pb-24 space-y-10">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-heading font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your profile, preferences and account</p>
        </div>

        {/* ===== PROFILE PHOTO + IDENTITY ===== */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <SectionHeader label="Profile" desc="Your public identity across FitX Journey" />

          <div className="glass-card p-6 space-y-6">
            {/* Avatar upload */}
            <div className="flex items-center gap-5">
              <div className="relative flex-shrink-0">
                <div
                  onClick={handlePhotoClick}
                  className="w-20 h-20 rounded-2xl overflow-hidden cursor-pointer group relative bg-secondary border-2 border-border hover:border-primary/50 transition-all"
                >
                  {profile.photoURL ? (
                    <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full gradient-bg flex items-center justify-center text-2xl font-black text-primary-foreground">
                      {initials}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {photoUploading
                      ? <Loader2 size={18} className="text-white animate-spin" />
                      : <Camera size={18} className="text-white" />}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>
              <div>
                <button
                  onClick={handlePhotoClick}
                  disabled={photoUploading}
                  className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  {photoUploading ? "Uploading..." : "Change photo"}
                </button>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG or WebP · max 5MB</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            {/* Name & bio */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Display Name">
                <TextInput value={profile.name} onChange={set("name")} placeholder="Your name" />
              </Field>
              <Field label="Gender">
                <SelectInput value={profile.gender} onChange={set("gender")} options={GENDERS} />
              </Field>
            </div>

            <Field label="Bio">
              <textarea
                value={profile.bio}
                onChange={e => set("bio")(e.target.value)}
                placeholder="A short bio — your training style, goals, favourite lift..."
                rows={3}
                maxLength={200}
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">{profile.bio.length}/200</p>
            </Field>

            <div className="flex justify-end">
              <SaveButton
                onClick={() => saveSection("profile", setProfileSaving, {
                  name: profile.name,
                  bio: profile.bio,
                  gender: profile.gender,
                  photoURL: profile.photoURL,
                })}
                saving={profileSaving}
                saved={savedSection === "profile"}
              />
            </div>
          </div>
        </motion.section>

        {/* ===== BODY METRICS ===== */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <SectionHeader label="Body Metrics" desc="Used to personalise your workouts and track progress" />

          <div className="glass-card p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Date of Birth">
                <TextInput type="date" value={profile.dob} onChange={set("dob")} />
              </Field>
              <Field label={`Height (${profile.units === "metric" ? "cm" : "ft/in"})`}>
                <TextInput value={profile.height} onChange={set("height")} placeholder={profile.units === "metric" ? "e.g. 178" : "e.g. 5'10\""} />
              </Field>
              <Field label={`Weight (${profile.units === "metric" ? "kg" : "lbs"})`}>
                <TextInput value={profile.weight} onChange={set("weight")} placeholder={profile.units === "metric" ? "e.g. 80" : "e.g. 176"} />
              </Field>
            </div>

            <div className="flex justify-end">
              <SaveButton
                onClick={() => saveSection("metrics", setMetricsSaving, {
                  dob: profile.dob,
                  height: profile.height,
                  weight: profile.weight,
                })}
                saving={metricsSaving}
                saved={savedSection === "metrics"}
              />
            </div>
          </div>
        </motion.section>

        {/* ===== FITNESS PREFERENCES ===== */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <SectionHeader label="Fitness Preferences" desc="Shape your plans and progress tracking" />

          <div className="glass-card p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Primary Goal">
                <SelectInput value={profile.goal} onChange={set("goal")} options={GOALS} />
              </Field>
              <Field label="Activity Level">
                <SelectInput value={profile.activityLevel} onChange={set("activityLevel")} options={ACTIVITY_LEVELS} />
              </Field>
            </div>

            <Field label="Units">
              <div className="flex gap-3">
                {(["metric", "imperial"] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => set("units")(u)}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold capitalize border transition-all ${
                      profile.units === u
                        ? "gradient-bg text-primary-foreground border-transparent shadow-lg shadow-primary/20"
                        : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {u === "metric" ? "Metric (kg, cm)" : "Imperial (lbs, ft)"}
                  </button>
                ))}
              </div>
            </Field>

            <div className="flex justify-end">
              <SaveButton
                onClick={() => saveSection("prefs", setPrefSaving, {
                  goal: profile.goal,
                  activityLevel: profile.activityLevel,
                  units: profile.units,
                })}
                saving={prefSaving}
                saved={savedSection === "prefs"}
              />
            </div>
          </div>
        </motion.section>

        {/* ===== NOTIFICATIONS ===== */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <SectionHeader label="Notifications" desc="Control when and how FitX Journey notifies you" />

          <div className="glass-card px-5 py-1">
            <Toggle
              checked={profile.notifications.workoutReminders}
              onChange={setNotif("workoutReminders")}
              label="Workout Reminders"
              desc="Get notified when a scheduled workout is coming up"
            />
            <Toggle
              checked={profile.notifications.challengeAlerts}
              onChange={setNotif("challengeAlerts")}
              label="Challenge Alerts"
              desc="Notifications when you complete or earn a challenge reward"
            />
            <Toggle
              checked={profile.notifications.progressUpdates}
              onChange={setNotif("progressUpdates")}
              label="Progress Milestones"
              desc="Celebrate hitting new PRs and milestone moments"
            />
            <Toggle
              checked={profile.notifications.weeklyReport}
              onChange={setNotif("weeklyReport")}
              label="Weekly Summary"
              desc="A weekly digest of your workouts, nutrition and progress"
            />
          </div>

          <div className="flex justify-end mt-3">
            <SaveButton
              onClick={() => saveSection("notif", setNotifSaving, { notifications: profile.notifications })}
              saving={notifSaving}
              saved={savedSection === "notif"}
            />
          </div>
        </motion.section>

        {/* ===== APPEARANCE ===== */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <SectionHeader label="Appearance" desc="Choose your preferred theme" />

          <div className="glass-card p-5">
            <div className="flex gap-3">
              {([
                { val: "dark", icon: Moon, label: "Dark" },
                { val: "light", icon: Sun, label: "Light" },
              ] as const).map(({ val, icon: Icon, label }) => (
                <button
                  key={val}
                  onClick={() => set("theme")(val)}
                  className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border text-sm font-semibold transition-all ${
                    profile.theme === val
                      ? "gradient-bg text-primary-foreground border-transparent shadow-lg shadow-primary/20"
                      : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon size={20} />
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">Theme preference is saved to your profile</p>
          </div>
        </motion.section>

        {/* ===== ACCOUNT ===== */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <SectionHeader label="Account" desc="Manage your account and security" />

          <div className="glass-card divide-y divide-border overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="p-2.5 rounded-xl bg-secondary">
                <Shield size={17} className="text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Signed in as</p>
                <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-destructive/8 transition-colors group text-left"
            >
              <div className="p-2.5 rounded-xl bg-destructive/10 group-hover:bg-destructive/15 transition-colors">
                <LogOut size={17} className="text-destructive" />
              </div>
              <div>
                <p className="text-sm font-semibold text-destructive">Sign Out</p>
                <p className="text-xs text-muted-foreground mt-0.5">You'll need to sign in again to access your data</p>
              </div>
            </button>
          </div>
        </motion.section>

      </div>
    </AppLayout>
  );
}
