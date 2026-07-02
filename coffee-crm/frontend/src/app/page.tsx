import Link from "next/link";
import { daysSince, type Contact } from "@/lib/api";
import { getContacts } from "@/lib/server-api";

// Thresholds mirror DESIGN.md §6: 60 days for clients, 120 for suppliers.
function needsAttention(contact: Contact): { days: number } | null {
  const days = daysSince(contact.lastContactedAt);
  if (days === null) return { days: -1 }; // never contacted
  const threshold = contact.type === "supplier" ? 120 : 60;
  return days >= threshold ? { days } : null;
}

export default async function HomePage() {
  let contacts: Contact[] = [];
  let loadError = false;
  try {
    contacts = await getContacts();
  } catch {
    loadError = true;
  }

  const followUps = contacts
    .map((c) => ({ contact: c, attention: needsAttention(c) }))
    .filter((x) => x.attention)
    .sort((a, b) => (b.attention!.days ?? 0) - (a.attention!.days ?? 0));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-espresso">Good to see you ☕</h1>
        <p className="mt-1 text-espresso/70">Here's who could use a moment of your time.</p>
      </header>

      <Link
        href="/capture"
        className="flex items-center justify-center gap-2 rounded-2xl bg-terracotta py-4 text-lg font-medium text-parchment shadow-sm active:scale-[0.99]"
      >
        📷 Scan a business card
      </Link>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-espresso/50">
          Who needs you today
        </h2>

        {loadError && (
          <p className="rounded-xl bg-clay/60 p-4 text-sm text-espresso/70">
            Couldn't reach the backend yet — check the API is running.
          </p>
        )}

        {!loadError && followUps.length === 0 && (
          <p className="rounded-xl bg-clay/60 p-4 text-sm text-espresso/70">
            Nothing urgent — everyone's been spoken to recently. Nice.
          </p>
        )}

        <ul className="space-y-3">
          {followUps.map(({ contact, attention }) => (
            <li key={contact.id}>
              <Link
                href={`/contacts/${contact.id}`}
                className="flex items-center justify-between rounded-xl border border-clay bg-white/60 p-4 hover:border-terracotta"
              >
                <div>
                  <p className="font-medium text-espresso">{contact.name}</p>
                  <p className="text-sm text-espresso/60">{contact.company ?? contact.type}</p>
                </div>
                <span className="text-sm text-terracotta">
                  {attention!.days < 0 ? "never contacted" : `${attention!.days}d quiet`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
