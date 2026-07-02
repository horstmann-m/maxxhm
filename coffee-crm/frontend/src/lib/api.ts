// Direct backend origin — only ever called from server-side code (Server
// Components via lib/server-api.ts, or the /api/* Route Handlers below) that
// can attach the Authorization header from the httpOnly session cookie.
// Client components never call this directly; they hit the same-origin
// /api/* routes instead, so the browser sends the httpOnly cookie itself.
const API_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

export async function getContacts(token?: string): Promise<Contact[]> {
  const res = await fetch(`${API_URL}/contacts`, { cache: "no-store", headers: authHeaders(token) });
  if (!res.ok) throw new Error("Failed to load contacts");
  return res.json();
}

export async function getContact(id: string, token?: string): Promise<Contact & { activities: Activity[] }> {
  const res = await fetch(`${API_URL}/contacts/${id}`, { cache: "no-store", headers: authHeaders(token) });
  if (!res.ok) throw new Error("Failed to load contact");
  return res.json();
}

export function daysSince(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const diff = Date.now() - new Date(dateIso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export type PriceMarket = "robusta" | "arabica" | "usd_index";

export interface PriceQuote {
  id: string;
  market: PriceMarket;
  contractMonth: string | null;
  price: number;
  currency: string;
  quoteDate: string;
  source: string;
  isDelayed: boolean;
}

export interface Arbitrage {
  arabica: { price: number; quoteDate: string };
  robusta: { price: number; quoteDate: string };
  arabicaPerTonneUsd: number;
  spreadUsdPerTonne: number;
}

export async function getPrices(token?: string): Promise<PriceQuote[]> {
  const res = await fetch(`${API_URL}/prices`, { cache: "no-store", headers: authHeaders(token) });
  if (!res.ok) throw new Error("Failed to load prices");
  return res.json();
}

export async function getArbitrage(token?: string): Promise<Arbitrage | null> {
  const res = await fetch(`${API_URL}/prices/arbitrage`, { cache: "no-store", headers: authHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load arbitrage");
  return res.json();
}

// Called from the client — hits our own same-origin Route Handler (not the
// backend directly) so the browser sends the httpOnly session cookie.
export async function addPriceQuote(input: {
  market: PriceMarket;
  contractMonth?: string;
  price: number;
  currency: string;
  quoteDate: string;
  source?: string;
}) {
  const res = await fetch(`/api/prices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to save price");
  return res.json();
}

export type DealStage =
  | "lead"
  | "engaged"
  | "sample_sent"
  | "sample_feedback"
  | "negotiation"
  | "contracted"
  | "shipped"
  | "closed_won"
  | "closed_lost";

export const DEAL_STAGES: { value: DealStage; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "engaged", label: "Engaged" },
  { value: "sample_sent", label: "Sample sent" },
  { value: "sample_feedback", label: "Sample feedback" },
  { value: "negotiation", label: "Negotiation" },
  { value: "contracted", label: "Contracted" },
  { value: "shipped", label: "Shipped" },
  { value: "closed_won", label: "Closed won" },
  { value: "closed_lost", label: "Closed lost" },
];

export interface Deal {
  id: string;
  contactId: string;
  contact: { id: string; name: string; company: string | null };
  coffeeDescription: string | null;
  stage: DealStage;
  priceType: "outright" | "differential";
  currency: "EUR" | "USD";
  outrightPrice: number | null;
  market: PriceMarket | null;
  differentialCents: number | null;
  quantityKg: number | null;
  incoterm: string | null;
  expectedCloseDate: string | null;
  probability: number | null;
  lostReason: string | null;
  createdAt: string;
  closedAt: string | null;
  priceEstimate: {
    perTonne: number | null;
    basis: "outright" | "differential";
    referenceQuoteDate?: string;
    fxConversionApplied: boolean;
  };
}

export async function getDeals(token?: string): Promise<Deal[]> {
  const res = await fetch(`${API_URL}/deals`, { cache: "no-store", headers: authHeaders(token) });
  if (!res.ok) throw new Error("Failed to load deals");
  return res.json();
}

export interface DealInput {
  contactId: string;
  coffeeDescription?: string;
  stage?: DealStage;
  priceType: "outright" | "differential";
  currency: "EUR" | "USD";
  outrightPrice?: number;
  market?: "robusta" | "arabica";
  differentialCents?: number;
  quantityKg?: number;
  incoterm?: string;
}

export async function createDeal(input: DealInput): Promise<Deal> {
  const res = await fetch(`/api/deals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to create deal");
  }
  return res.json();
}

export async function updateDealStage(id: string, stage: DealStage): Promise<Deal> {
  const res = await fetch(`/api/deals/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stage }),
  });
  if (!res.ok) throw new Error("Failed to update deal");
  return res.json();
}

export async function scanBusinessCard(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/business-card/scan", { method: "POST", body: form });
  if (!res.ok) throw new Error("scan_failed");
  return res.json();
}

export async function confirmBusinessCard(draft: unknown) {
  const res = await fetch("/api/business-card/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  if (!res.ok) throw new Error("confirm_failed");
  return res.json();
}

export { API_URL };
