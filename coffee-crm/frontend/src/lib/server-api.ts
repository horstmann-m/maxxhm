import "server-only";
import { getSessionToken } from "./session";
import * as api from "./api";

// Thin server-only wrapper: pulls the JWT out of the httpOnly session cookie
// and attaches it to each backend call. Only import this from Server
// Components (page.tsx) — client components must go through /api/* instead.
export function getContacts() {
  return api.getContacts(getSessionToken());
}

export function getContact(id: string) {
  return api.getContact(id, getSessionToken());
}

export function getDeals() {
  return api.getDeals(getSessionToken());
}

export function getPrices() {
  return api.getPrices(getSessionToken());
}

export function getArbitrage() {
  return api.getArbitrage(getSessionToken());
}
