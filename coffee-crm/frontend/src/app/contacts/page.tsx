import Link from "next/link";
import { type Contact } from "@/lib/api";
import { getContacts } from "@/lib/server-api";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function ContactsPage() {
  let contacts: Contact[] = [];
  let loadError = false;
  try {
    contacts = await getContacts();
  } catch {
    loadError = true;
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-espresso">People</h1>
      {loadError && (
        <p className="mb-4 rounded-xl bg-clay/60 p-4 text-sm text-espresso/70">
          Couldn't reach the backend yet — check the API is running.
        </p>
      )}
      <ul className="space-y-2">
        {contacts.map((contact) => (
          <li key={contact.id}>
            <Link
              href={`/contacts/${contact.id}`}
              className="flex items-center gap-3 rounded-xl border border-clay bg-white/60 p-3 hover:border-terracotta"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage/30 text-sm font-medium text-espresso">
                {initials(contact.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-espresso">{contact.name}</p>
                <p className="truncate text-sm text-espresso/60">
                  {contact.company ?? contact.type} · {contact.country ?? "—"}
                </p>
              </div>
            </Link>
          </li>
        ))}
        {contacts.length === 0 && (
          <p className="rounded-xl bg-clay/60 p-4 text-sm text-espresso/70">
            No one here yet. Scan a card or import your spreadsheet to get started.
          </p>
        )}
      </ul>
    </div>
  );
}
