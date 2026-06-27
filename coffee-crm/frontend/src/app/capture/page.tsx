"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

interface Draft {
  type: string;
  name: string;
  company: string;
  country: string;
  emails: string[];
  phones: string[];
}

export default function CapturePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [nextAction, setNextAction] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/business-card/scan`, { method: "POST", body: form });
      if (!res.ok) throw new Error("scan_failed");
      const data = await res.json();
      setDraft(data.draft);
    } catch {
      setError("Couldn't read that card — you can still fill it in by hand below.");
      setDraft({ type: "client", name: "", company: "", country: "", emails: [], phones: [] });
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!draft) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/business-card/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      setNextAction(data.nextAction);
    } finally {
      setLoading(false);
    }
  }

  if (nextAction) {
    return (
      <div className="space-y-4 rounded-2xl border border-clay bg-white/60 p-6 text-center">
        <p className="text-3xl">✅</p>
        <h1 className="text-xl font-semibold text-espresso">Saved {draft?.name || "contact"}</h1>
        <p className="rounded-xl bg-terracotta/10 p-4 text-espresso/80">
          Suggested next step: <span className="font-medium">{nextAction}</span>
        </p>
        <button
          onClick={() => router.push("/contacts")}
          className="rounded-xl bg-terracotta px-4 py-2 text-parchment"
        >
          Go to People
        </button>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="flex flex-col items-center gap-6 pt-12 text-center">
        <h1 className="text-2xl font-semibold text-espresso">Scan a business card</h1>
        <p className="max-w-xs text-espresso/70">
          Point your camera at the card. We'll pull out the details — you just confirm.
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="flex h-40 w-40 items-center justify-center rounded-full bg-terracotta text-5xl text-parchment shadow-md active:scale-95 disabled:opacity-50"
        >
          {loading ? "…" : "📷"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-espresso">Confirm details</h1>
      {error && <p className="rounded-xl bg-clay/60 p-3 text-sm text-espresso/70">{error}</p>}

      <Field label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
      <Field label="Company" value={draft.company} onChange={(v) => setDraft({ ...draft, company: v })} />
      <Field label="Country" value={draft.country} onChange={(v) => setDraft({ ...draft, country: v })} />
      <Field
        label="Email"
        value={draft.emails[0] ?? ""}
        onChange={(v) => setDraft({ ...draft, emails: v ? [v] : [] })}
      />
      <Field
        label="Phone"
        value={draft.phones[0] ?? ""}
        onChange={(v) => setDraft({ ...draft, phones: v ? [v] : [] })}
      />

      <div className="flex gap-3 pt-2">
        <button onClick={() => setDraft(null)} className="flex-1 rounded-xl border border-clay py-3 text-espresso">
          Retake
        </button>
        <button
          onClick={confirm}
          disabled={loading || !draft.name}
          className="flex-1 rounded-xl bg-terracotta py-3 text-parchment disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save contact"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-espresso/60">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-clay bg-white/70 p-3 text-espresso focus:border-terracotta focus:outline-none"
      />
    </label>
  );
}
