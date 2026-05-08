import { useAdminInvites } from "@/hooks/useAdminInvites";
import { Button } from "@/components/ui/button";
import { ShieldCheck, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

/**
 * Floating banner shown to a normal user when an admin has invited them.
 * Accepting promotes them and signs them out (they sign back in as admin).
 */
export default function AdminInviteBanner() {
  const { invites, accept, decline } = useAdminInvites();
  if (!invites.length) return null;
  const invite = invites[0];

  return (
    <AnimatePresence>
      <motion.div
        key={invite.id}
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        className="fixed top-3 inset-x-3 md:inset-x-auto md:right-4 md:max-w-md z-[60]"
      >
        <div className="rounded-2xl border border-primary/40 bg-card/95 backdrop-blur-xl p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-primary/15 text-primary"><ShieldCheck size={18} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Admin invitation</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {invite.invitedByEmail ?? "An admin"} invited you to join the team as <span className="font-medium text-foreground">{invite.role}</span>. Accepting will sign you out so you can sign back in with admin access.
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={async () => {
                  try { await accept(invite); toast.success("Accepted — sign back in"); }
                  catch (e: any) { toast.error(e.message ?? "Failed"); }
                }}>Accept</Button>
                <Button size="sm" variant="ghost" onClick={async () => {
                  try { await decline(invite); toast("Invitation declined"); }
                  catch (e: any) { toast.error(e.message ?? "Failed"); }
                }}>Decline</Button>
              </div>
            </div>
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={() => decline(invite)}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
