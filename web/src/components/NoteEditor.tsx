"use client";

import { useState } from "react";
import { EntityMultiPicker } from "@/components/EntityMultiPicker";
import { MarkdownView } from "@/components/MarkdownView";
import { createNote, deleteNote, updateNote } from "@/lib/store";
import type { EntityRef, Note } from "@/lib/types";

const parseTags = (s: string) =>
  s
    .split(/[,\s]+/)
    .map((t) => t.replace(/^#/, "").trim().toLowerCase())
    .filter(Boolean);

export function NoteEditor({
  note,
  onSaved,
  onDeleted,
}: {
  note: Note | null; // null => new note
  onSaved: (id: string) => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [links, setLinks] = useState<EntityRef[]>([]);
  const [preview, setPreview] = useState(false);

  // Load fields when the selected note changes — including when it arrives late
  // (e.g. deep-link before Dexie has loaded). This render-time reset is React's
  // recommended alternative to a syncing effect.
  const [loadedId, setLoadedId] = useState<string | null | undefined>(undefined);
  const noteId = note?.id ?? null;
  if (loadedId !== noteId) {
    setLoadedId(noteId);
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
    setTagsInput(note?.tags.join(", ") ?? "");
    setLinks(note?.links ?? []);
    setPreview(false);
  }

  async function save() {
    const payload = { title: title.trim() || "Untitled", body, tags: parseTags(tagsInput), links };
    if (note) {
      await updateNote(note.id, payload);
      onSaved(note.id);
    } else {
      const id = await createNote(payload);
      onSaved(id);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title"
          className="flex-1 text-lg font-semibold bg-transparent outline-none placeholder:text-muted"
        />
        <button
          onClick={() => setPreview((p) => !p)}
          className="text-xs px-2 py-1 rounded-md border border-border hover:bg-surface-2"
        >
          {preview ? "Edit" : "Preview"}
        </button>
      </div>

      {preview ? (
        <div className="min-h-[180px] rounded-lg border border-border bg-background p-3">
          <MarkdownView>{body || "_Nothing to preview yet._"}</MarkdownView>
        </div>
      ) : (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write in markdown… tasting impressions, supplier notes, price thoughts, links between origins."
          className="w-full min-h-[180px] text-sm rounded-lg border border-border bg-background p-3 outline-none resize-y font-mono"
        />
      )}

      <div>
        <label className="text-xs text-muted">Tags</label>
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="e.g. natural, competition, supplier-x"
          className="w-full text-sm rounded-lg border border-border bg-background px-2 py-1.5 mt-1"
        />
      </div>

      <div>
        <label className="text-xs text-muted">Linked to</label>
        <div className="mt-1">
          <EntityMultiPicker value={links} onChange={setLinks} />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={save}
          className="px-4 py-1.5 rounded-lg bg-accent text-accent-fg text-sm font-medium hover:opacity-90"
        >
          {note ? "Save" : "Create note"}
        </button>
        {note && (
          <button
            onClick={async () => {
              await deleteNote(note.id);
              onDeleted();
            }}
            className="px-3 py-1.5 rounded-lg text-sm text-red-600 hover:bg-red-500/10"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
