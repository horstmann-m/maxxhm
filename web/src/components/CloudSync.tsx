"use client";

import { useObservable } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { cloudEnabled, getDb } from "@/lib/db";

// Dexie Cloud sign-in + status. Renders nothing unless NEXT_PUBLIC_DEXIE_CLOUD_URL
// is set. Gated on a client-mounted flag so getDb() (browser-only) is never called
// during server-side pre-rendering. Handles the addon's email → OTP flow inline.
export function CloudSync() {
  const [mounted, setMounted] = useState(false);
  // Client-only mount gate so getDb() (browser-only) never runs during SSR/prerender.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!cloudEnabled || !mounted) return null;
  return <CloudSyncInner />;
}

function CloudSyncInner() {
  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cloud = (db as any).cloud;
  const user = useObservable(() => cloud.currentUser, []) as
    | { userId?: string; email?: string; isLoggedIn?: boolean }
    | undefined;
  const interaction = useObservable(() => cloud.userInteraction, []) as
    | {
        type: string;
        title?: string;
        fields?: Record<string, { type?: string; label?: string; placeholder?: string }>;
        onSubmit: (p: Record<string, string>) => void;
        onCancel?: () => void;
      }
    | undefined;
  const [form, setForm] = useState<Record<string, string>>({});

  const loggedIn = !!user && user.userId !== "unauthorized" && user.isLoggedIn !== false && !!user.email;

  if (interaction) {
    const fields = interaction.fields ?? {};
    return (
      <div className="text-xs space-y-2">
        {interaction.title && <div className="font-medium">{interaction.title}</div>}
        {Object.entries(fields).map(([key, f]) => (
          <input
            key={key}
            type={f.type === "email" ? "email" : "text"}
            placeholder={f.placeholder || f.label || key}
            value={form[key] ?? ""}
            onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
            className="w-full rounded-md border border-border bg-background px-2 py-1"
          />
        ))}
        <div className="flex gap-2">
          <button
            onClick={() => {
              interaction.onSubmit(form);
              setForm({});
            }}
            className="btn btn-primary py-1"
          >
            Continue
          </button>
          {interaction.onCancel && (
            <button onClick={() => interaction.onCancel?.()} className="btn btn-ghost py-1">
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="text-xs text-muted flex items-center justify-between gap-2">
      {loggedIn ? (
        <>
          <span className="truncate" title={user!.email}>☁ {user!.email}</span>
          <button onClick={() => cloud.logout()} className="hover:text-foreground shrink-0">
            Log out
          </button>
        </>
      ) : (
        <button onClick={() => cloud.login()} className="hover:text-accent">
          ☁ Sign in to sync
        </button>
      )}
    </div>
  );
}
