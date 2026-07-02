"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Art. 15/17/20 GDPR — makes the export/erasure endpoints something you can
// actually click, not just an API that exists in principle.
export function DataRightsPanel({ contactId, contactName }: { contactId: string; contactName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function deleteContact() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, { method: "DELETE" });
      if (res.ok) router.push("/contacts");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-clay bg-white/40 p-4">
      <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-espresso/50">Data</h2>
      <div className="flex flex-wrap gap-3">
        <a
          href={`/api/contacts/${contactId}/export`}
          className="rounded-xl border border-clay px-4 py-2 text-sm text-espresso hover:border-terracotta"
        >
          Export data (JSON)
        </a>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="rounded-xl border border-terracotta px-4 py-2 text-sm text-terracotta"
          >
            Delete contact & all data
          </button>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-espresso/70">Permanently delete {contactName}?</span>
            <button
              onClick={deleteContact}
              disabled={deleting}
              className="rounded-xl bg-terracotta px-3 py-1.5 text-parchment disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button onClick={() => setConfirming(false)} className="rounded-xl border border-clay px-3 py-1.5">
              Cancel
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
