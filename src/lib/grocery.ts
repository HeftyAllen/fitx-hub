import { db } from "@/lib/firebase";
import {
  collection, doc, addDoc, deleteDoc, getDocs, updateDoc,
  query, orderBy, Timestamp,
} from "firebase/firestore";

export interface GroceryItem {
  id?: string;
  name: string;
  brand?: string;
  qty?: string;          // freeform "1 box", "500g", "2 cans"
  category?: string;     // produce | dairy | pantry | meat | snacks | drinks | other
  image?: string;
  checked: boolean;
  source?: "barcode" | "manual" | "recipe";
  createdAt?: any;
}

export const GROCERY_CATEGORIES = [
  "produce", "dairy", "meat", "pantry", "snacks", "drinks", "frozen", "other",
] as const;

const col = (uid: string) => collection(db, "users", uid, "groceryList");

export async function listGrocery(uid: string): Promise<GroceryItem[]> {
  const snap = await getDocs(query(col(uid), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as GroceryItem) }));
}

export async function addGrocery(uid: string, item: Omit<GroceryItem, "id" | "createdAt">) {
  await addDoc(col(uid), { ...item, createdAt: Timestamp.now() });
}

export async function toggleGrocery(uid: string, id: string, checked: boolean) {
  await updateDoc(doc(db, "users", uid, "groceryList", id), { checked });
}

export async function removeGrocery(uid: string, id: string) {
  await deleteDoc(doc(db, "users", uid, "groceryList", id));
}

export async function clearChecked(uid: string) {
  const items = await listGrocery(uid);
  await Promise.all(items.filter(i => i.checked && i.id).map(i => removeGrocery(uid, i.id!)));
}
