import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";

export default function OfflineBanner() {
  const online = useOnline();

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-0 inset-x-0 z-[60] flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium bg-amber-500/95 text-amber-950 backdrop-blur-md shadow-lg"
          role="status"
          aria-live="polite"
        >
          <WifiOff size={14} />
          You're offline — viewing cached data. Changes sync when you reconnect.
        </motion.div>
      )}
    </AnimatePresence>
  );
}
