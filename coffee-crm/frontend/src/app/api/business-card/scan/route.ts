import { NextResponse } from "next/server";
import { API_URL } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export async function POST(req: Request) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const res = await fetch(`${API_URL}/business-card/scan`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
