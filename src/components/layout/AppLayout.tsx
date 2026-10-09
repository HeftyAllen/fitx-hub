import { ReactNode } from "react";
import Navbar from "./Navbar";
import { motion } from "framer-motion";
import SyncStatus from "@/components/SyncStatus";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <motion.main
        className="md:pt-16 pb-20 md:pb-0"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4 flex justify-end"><SyncStatus /></div>
        {children}
      </motion.main>
    </div>
  );
}
