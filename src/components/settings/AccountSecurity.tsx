import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  MailCheck, MailWarning, KeyRound, Trash2, Loader2, Eye, EyeOff, ChevronRight,
} from "lucide-react";

function friendly(err: any) {
  const code = err?.code || "";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") return "That password isn't right.";
  if (code === "auth/weak-password") return "Pick a longer password — at least 6 characters.";
  if (code === "auth/too-many-requests") return "Too many attempts — wait a few minutes.";
  if (code === "auth/requires-recent-login") return "Please sign out, sign back in, and try again.";
  if (code === "auth/popup-blocked") return "Allow pop-ups to confirm it's you, then try again.";
  return err?.message || "Something went wrong.";
}

const rowClass = "w-full min-w-0 flex flex-wrap items-center gap-3 px-4 sm:px-5 py-4 text-left transition-colors";
const iconWrap = "p-2.5 rounded-xl shrink-0";

export default function AccountSecurity() {
  const { user, sendVerification, changePassword, deleteAccount } = useAuth();
  const navigate = useNavigate();

  const usesPassword = !!user?.providerData?.some((p) => p.providerId === "password");
  const verified = !!user?.emailVerified;

  const [verifySending, setVerifySending] = useState(false);
  const [verifySent, setVerifySent] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState("");
  const [delConfirm, setDelConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleVerify = async () => {
    setVerifySending(true);
    try {
      await sendVerification();
      setVerifySent(true);
      toast.success("Verification email sent — check your inbox");
    } catch (err: any) {
      toast.error(friendly(err));
    } finally {
      setVerifySending(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    if (newPw !== confirmPw) { toast.error("The two new passwords don't match"); return; }
    setPwSaving(true);
    try {
      await changePassword(currentPw, newPw);
      toast.success("Password updated");
      setPwOpen(false);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: any) {
      toast.error(friendly(err));
    } finally {
      setPwSaving(false);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (delConfirm.trim().toUpperCase() !== "DELETE") { toast.error('Type DELETE to confirm'); return; }
    setDeleting(true);
    try {
      await deleteAccount(usesPassword ? delPw : undefined);
      toast.success("Your account has been deleted");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(friendly(err));
    } finally {
      setDeleting(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all";

  return (
    <>
      {/* Email verification */}
      {usesPassword && (
        <div className={rowClass}>
          <div className={`${iconWrap} ${verified ? "bg-primary/10" : "bg-secondary"}`}>
            {verified
              ? <MailCheck size={17} className="text-primary" />
              : <MailWarning size={17} className="text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{verified ? "Email verified" : "Verify your email"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {verified
                ? "Your address is confirmed — password resets will reach you."
                : verifySent
                  ? "Link sent. Open it, then reload this page."
                  : "Confirm your address so you can recover your account."}
            </p>
          </div>
          {!verified && (
            <Button
              onClick={handleVerify}
              disabled={verifySending}
              size="sm"
              className="shrink-0 text-xs"
            >
              {verifySending && <Loader2 size={13} className="animate-spin" />}
              {verifySent ? "Resend" : "Send link"}
            </Button>
          )}
        </div>
      )}

      {/* Change password */}
      {usesPassword && (
        <div>
          <Button
            variant="ghost"
            onClick={() => setPwOpen(v => !v)}
            aria-expanded={pwOpen}
            className={`${rowClass} h-auto rounded-none justify-start hover:bg-secondary/50`}
          >
            <div className={`${iconWrap} bg-secondary`}>
              <KeyRound size={17} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Change password</p>
              <p className="text-xs text-muted-foreground mt-0.5">You'll confirm your current one first</p>
            </div>
            <ChevronRight size={16} className={`text-muted-foreground transition-transform ${pwOpen ? "rotate-90" : ""}`} />
          </Button>
          <AnimatePresence initial={false}>
            {pwOpen && (
              <motion.form
                onSubmit={handleChangePassword}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 space-y-3">
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="Current password"
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      className={`${inputClass} pr-11`}
                      required
                      autoComplete="current-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPw(v => !v)}
                      aria-label={showPw ? "Hide passwords" : "Show passwords"}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="New password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className={inputClass}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    className={inputClass}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={pwSaving}
                    >
                      {pwSaving && <Loader2 size={14} className="animate-spin" />}
                      Update password
                    </Button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Delete account */}
      <div>
        <Button
          variant="ghost"
          onClick={() => setDelOpen(v => !v)}
          aria-expanded={delOpen}
          className={`${rowClass} h-auto rounded-none justify-start hover:bg-destructive/10 group`}
        >
          <div className={`${iconWrap} bg-destructive/10`}>
            <Trash2 size={17} className="text-destructive" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">Delete account</p>
            <p className="text-xs text-muted-foreground mt-0.5">Permanently removes your sign-in and stops all access</p>
          </div>
          <ChevronRight size={16} className={`text-muted-foreground transition-transform ${delOpen ? "rotate-90" : ""}`} />
        </Button>
        <AnimatePresence initial={false}>
          {delOpen && (
            <motion.form
              onSubmit={handleDelete}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-3">
                <p className="text-xs text-muted-foreground">
                  This can't be undone. You'll be signed out immediately and won't be able to sign in again with this email.
                </p>
                {usesPassword && (
                  <input
                    type="password"
                    placeholder="Your password"
                    value={delPw}
                    onChange={(e) => setDelPw(e.target.value)}
                    className={inputClass}
                    required
                    autoComplete="current-password"
                  />
                )}
                <input
                  type="text"
                  placeholder='Type DELETE to confirm'
                  value={delConfirm}
                  onChange={(e) => setDelConfirm(e.target.value)}
                  className={inputClass}
                  required
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => { setDelOpen(false); setDelPw(""); setDelConfirm(""); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={deleting}
                  >
                    {deleting && <Loader2 size={14} className="animate-spin" />}
                    Delete forever
                  </Button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
