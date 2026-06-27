const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export interface Contact {
  id: string;
  type: "client" | "supplier" | "both";
  name: string;
  company: string | null;
  country: string | null;
  emails: string[];
  phones: string[];
  leadStatus: string | null;
  notes: string | null;
  lastContactedAt: string | null;
  createdAt: string;
}

export interface Activity {
  id: string;
  type: string;
  body: string;
  dueAt: string | null;
  createdAt: string;
}

export async function getContacts(): Promise<Contact[]> {
  const res = await fetch(`${API_URL}/contacts`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load contacts");
  return res.json();
}

export async function getContact(id: string): Promise<Contact & { activities: Activity[] }> {
  const res = await fetch(`${API_URL}/contacts/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load contact");
  return res.json();
}

export function daysSince(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const diff = Date.now() - new Date(dateIso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export { API_URL };
