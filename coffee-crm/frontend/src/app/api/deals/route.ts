import { NextResponse } from "next/server";
import { API_URL } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export async function POST(req: Request) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.text();
  const res = await fetch(`${API_URL}/deals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body,
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
