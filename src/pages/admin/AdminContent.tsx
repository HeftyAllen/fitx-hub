import { useEffect, useState } from "react";
import {
  collection, doc, onSnapshot, serverTimestamp, setDoc, deleteDoc, addDoc, orderBy, query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Star } from "lucide-react";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";

interface FeaturedItem { id: string; title: string; description?: string; type: "workout" | "recipe"; url?: string; }

export default function AdminContent() {
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<"workout" | "recipe">("workout");
  const [url, setUrl] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "siteSettings", "featured", "items"), orderBy("createdAt", "desc")),
      (snap) => setItems(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
    return unsub;
  }, []);

  async function add() {
    if (!title.trim()) return;
    try {
      await setDoc(doc(db, "siteSettings", "featured"), { updatedAt: serverTimestamp() }, { merge: true });
      await addDoc(collection(db, "siteSettings", "featured", "items"), {
        title: title.trim(), description: desc.trim() || null, type, url: url.trim() || null,
        createdAt: serverTimestamp(),
      });
      logActivity("admin.settings.update", { area: "featured.add", title });
      setTitle(""); setDesc(""); setUrl("");
      toast.success("Added");
    } catch (e: any) { toast.error(e.message); }
  }

  async function remove(id: string) {
    await deleteDoc(doc(db, "siteSettings", "featured", "items", id));
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Featured Content</h1>
        <p className="text-sm text-muted-foreground">Highlight workouts or recipes on the user dashboard.</p>
      </header>

      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Star size={16} className="text-primary" /> Add featured item
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <select className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={type} onChange={e => setType(e.target.value as any)}>
            <option value="workout">Workout</option>
            <option value="recipe">Recipe</option>
          </select>
        </div>
        <Input placeholder="Optional URL or recipe id" value={url} onChange={e => setUrl(e.target.value)} />
        <Textarea placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} rows={2} />
        <Button onClick={add}>Add</Button>
      </Card>

      <Card>
        <div className="p-4 border-b border-border text-sm font-semibold">Featured ({items.length})</div>
        <ul className="divide-y divide-border">
          {items.map(it => (
            <li key={it.id} className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><Badge variant="outline">{it.type}</Badge><span className="font-medium">{it.title}</span></div>
                {it.description && <p className="text-sm text-muted-foreground mt-1">{it.description}</p>}
                {it.url && <p className="text-xs text-primary mt-1 truncate">{it.url}</p>}
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(it.id)}><Trash2 size={14} /></Button>
            </li>
          ))}
          {items.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nothing featured yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
