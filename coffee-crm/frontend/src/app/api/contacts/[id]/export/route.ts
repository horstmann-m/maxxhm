import { NextResponse } from "next/server";
import { API_URL } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const res = await fetch(`${API_URL}/contacts/${params.id}/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
    headers: { "Content-Disposition": res.headers.get("content-disposition") ?? "" },
  });
}
