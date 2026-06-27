import Link from "next/link";
import { getContacts } from "@/lib/api";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function ContactsPage() {
  const contacts = await getContacts();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-espresso">People</h1>
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
