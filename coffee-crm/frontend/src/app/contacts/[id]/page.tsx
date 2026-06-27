import Link from "next/link";
import { getContact, daysSince } from "@/lib/api";

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  let contact: Awaited<ReturnType<typeof getContact>> | null = null;
  try {
    contact = await getContact(params.id);
  } catch {
    contact = null;
  }

  if (!contact) {
    return (
      <div className="space-y-4">
        <Link href="/contacts" className="text-sm text-espresso/60 hover:text-terracotta">
          ← People
        </Link>
        <p className="rounded-xl bg-clay/60 p-4 text-sm text-espresso/70">
          Couldn't load this contact — check the API is running and the link is correct.
        </p>
      </div>
    );
  }

  const days = daysSince(contact.lastContactedAt);

  return (
    <div className="space-y-6">
      <Link href="/contacts" className="text-sm text-espresso/60 hover:text-terracotta">
        ← People
      </Link>

      <header className="rounded-2xl border border-clay bg-white/60 p-5">
        <h1 className="text-2xl font-semibold text-espresso">{contact.name}</h1>
        <p className="mt-1 text-espresso/70">
          {contact.company ?? "—"} · {contact.country ?? "—"}
        </p>
        <p className="mt-3 text-sm text-espresso/60">
          {days === null
            ? "Never contacted yet"
            : `Last in touch ${days === 0 ? "today" : `${days} days ago`}`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {contact.emails.map((email) => (
            <a
              key={email}
              href={`mailto:${email}`}
              className="rounded-full bg-clay/70 px-3 py-1 text-espresso/80"
            >
              {email}
            </a>
          ))}
          {contact.phones.map((phone) => (
            <a
              key={phone}
              href={`tel:${phone}`}
              className="rounded-full bg-clay/70 px-3 py-1 text-espresso/80"
            >
              {phone}
            </a>
          ))}
        </div>
      </header>

      {contact.notes && (
        <section className="rounded-2xl bg-sage/10 p-4">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-espresso/50">Notes</h2>
          <p className="text-espresso/80">{contact.notes}</p>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-espresso/50">
          Timeline
        </h2>
        <ul className="space-y-3">
          {contact.activities.map((activity) => (
            <li key={activity.id} className="rounded-xl border border-clay bg-white/60 p-3">
              <p className="text-espresso">{activity.body}</p>
              <p className="mt-1 text-xs text-espresso/50">
                {new Date(activity.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
          {contact.activities.length === 0 && (
            <p className="text-sm text-espresso/60">No activity logged yet.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
