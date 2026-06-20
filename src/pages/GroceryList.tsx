import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Plus, Trash2, Check, X, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  GroceryItem, GROCERY_CATEGORIES,
  listGrocery, addGrocery, toggleGrocery, removeGrocery, clearChecked,
} from "@/lib/grocery";
import { toast } from "sonner";

export default function GroceryList() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [category, setCategory] = useState<string>("other");

  const reload = async () => {
    if (!uid) return;
    setLoading(true);
    setItems(await listGrocery(uid));
    setLoading(false);
  };

  useEffect(() => { reload(); }, [uid]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !name.trim()) return;
    await addGrocery(uid, { name: name.trim(), qty: qty.trim() || undefined, category, checked: false, source: "manual" });
    setName(""); setQty("");
    reload();
  };

  const toggle = async (item: GroceryItem) => {
    if (!uid || !item.id) return;
    await toggleGrocery(uid, item.id, !item.checked);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i));
  };

  const remove = async (item: GroceryItem) => {
    if (!uid || !item.id) return;
    await removeGrocery(uid, item.id);
    setItems(prev => prev.filter(i => i.id !== item.id));
  };

  const clearDone = async () => {
    if (!uid) return;
    await clearChecked(uid);
    toast.success("Cleared checked items");
    reload();
  };

  const grouped = GROCERY_CATEGORIES.map(c => ({
    cat: c,
    rows: items.filter(i => (i.category || "other") === c),
  })).filter(g => g.rows.length);

  const totalChecked = items.filter(i => i.checked).length;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-24 space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden p-6"
          style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(34,211,238,0.10) 100%)" }}>
          <div className="absolute inset-0 border border-emerald-400/20 rounded-3xl pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                <ShoppingCart size={20} className="text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black">Grocery List</h1>
                <p className="text-xs text-muted-foreground">{items.length} items · {totalChecked} checked</p>
              </div>
            </div>
            {totalChecked > 0 && (
              <button onClick={clearDone}
                className="px-3 py-2 rounded-xl bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5">
                <Trash2 size={12} /> Clear checked
              </button>
            )}
          </div>
        </motion.div>

        <form onSubmit={submit} className="glass-card p-4 grid grid-cols-1 md:grid-cols-[1fr_140px_140px_auto] gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Item (e.g. Bananas)"
            className="px-3 py-2.5 rounded-xl bg-secondary text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
          <input value={qty} onChange={e => setQty(e.target.value)} placeholder="Qty (1 bunch)"
            className="px-3 py-2.5 rounded-xl bg-secondary text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-secondary text-sm capitalize focus:outline-none focus:ring-1 focus:ring-primary/50">
            {GROCERY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="submit"
            className="px-4 py-2.5 rounded-xl gradient-bg text-primary-foreground text-sm font-bold flex items-center justify-center gap-1.5">
            <Plus size={14} /> Add
          </button>
        </form>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <ShoppingCart size={32} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm font-bold">Your list is empty</p>
            <p className="text-xs text-muted-foreground mt-1">Add items above or use the barcode scanner in Nutrition to add scanned products straight here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {grouped.map(g => (
                <motion.div key={g.cat} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="glass-card overflow-hidden">
                  <p className="px-4 pt-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">{g.cat}</p>
                  <div className="p-2 space-y-1">
                    {g.rows.map(item => (
                      <div key={item.id}
                        className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${item.checked ? "bg-secondary/30 opacity-50" : "bg-secondary/50 hover:bg-secondary/70"}`}>
                        <button onClick={() => toggle(item)}
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${item.checked ? "bg-emerald-500 border-emerald-500" : "border-border hover:border-primary"}`}>
                          {item.checked && <Check size={12} className="text-white" />}
                        </button>
                        {item.image && <img src={item.image} alt="" className="w-8 h-8 rounded-md object-cover" />}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${item.checked ? "line-through" : ""}`}>{item.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            {item.brand && <span>{item.brand}</span>}
                            {item.qty && <span>· {item.qty}</span>}
                          </div>
                        </div>
                        <button onClick={() => remove(item)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-all">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
