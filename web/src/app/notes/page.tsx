"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { NoteEditor } from "@/components/NoteEditor";
import { resolveRef } from "@/lib/reference";
import { getDb } from "@/lib/db";

export default function NotesPage() {
  const notes = useLiveQuery(
    () => getDb().notes.orderBy("updatedAt").reverse().toArray(),
    []
  );
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [query, setQuery] = useState("");

  // Deep-link support: /notes#<id> focuses that note. Reading the URL hash on
  // mount is a legitimate one-shot sync from an external system (the browser URL).
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hash) setSelectedId(hash);
  }, []);

  const filtered = useMemo(() => {
    if (!notes) return [];
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.tags.some((t) => t.includes(q))
    );
  }, [notes, query]);

  const selectedNote =
    selectedId && selectedId !== "new"
      ? notes?.find((n) => n.id === selectedId) ?? null
      : null;

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Notes</h1>
          <p className="text-muted mt-1">
            Your second brain. Write in markdown, tag freely, and link notes to
            origins and regions — links surface as backlinks on each profile.
          </p>
        </div>
        <button
          onClick={() => setSelectedId("new")}
          className="shrink-0 px-4 py-2 rounded-lg bg-accent text-accent-fg text-sm font-medium hover:opacity-90"
        >
          + New note
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
        <div className="space-y-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="w-full text-sm rounded-lg border border-border bg-surface px-3 py-2"
          />
          <ul className="space-y-1.5">
            {filtered.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => setSelectedId(n.id)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                    selectedId === n.id
                      ? "border-accent bg-surface-2"
                      : "border-border bg-surface hover:bg-surface-2"
                  }`}
                >
                  <div className="text-sm font-medium truncate">
                    {n.title || "Untitled"}
                  </div>
                  <div className="text-xs text-muted truncate">
                    {n.links
                      .map((r) => resolveRef(r)?.label)
                      .filter(Boolean)
                      .join(", ") ||
                      n.tags.map((t) => `#${t}`).join(" ") ||
                      "—"}
                  </div>
                </button>
              </li>
            ))}
            {notes && notes.length === 0 && (
              <li className="text-sm text-muted px-1">
                No notes yet — create your first.
              </li>
            )}
          </ul>
        </div>

        <div>
          {selectedId ? (
            <NoteEditor
              key={selectedId}
              note={selectedNote}
              onSaved={(id) => setSelectedId(id)}
              onDeleted={() => setSelectedId(null)}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted">
              Select a note or create a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
