import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Calendar as CalIcon } from "lucide-react";

export default function CalendarView() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: firstDay }, () => null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold">Calendar</h1>
          <div className="flex items-center gap-2 glass-card px-4 py-2">
            <span className="text-sm">🔥 Current Streak: 0 days</span>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <h3 className="text-center font-heading font-bold mb-4">
            {now.toLocaleString("default", { month: "long" })} {year}
          </h3>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => (
              <div
                key={i}
                className={`aspect-square flex items-center justify-center rounded-xl text-sm transition-colors cursor-pointer ${
                  day === now.getDate() ? "gradient-bg text-primary-foreground font-bold" : day ? "hover:bg-secondary text-foreground" : ""
                }`}
              >
                {day}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
