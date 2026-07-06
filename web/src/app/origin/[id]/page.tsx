"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { use } from "react";
import { EntityBacklinks } from "@/components/EntityBacklinks";
import { RegionCard } from "@/components/RegionCard";
import { WatchButton } from "@/components/WatchButton";
import { getOrigin, makeRef, regionsForOrigin } from "@/lib/reference";

// ISO alpha-2 -> regional-indicator flag emoji.
function flag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export default function OriginPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const origin = getOrigin(id);
  if (!origin) notFound();

  const regions = regionsForOrigin(origin.id);
  const refs = [
    makeRef("origin", origin.id),
    ...regions.map((r) => makeRef("region", r.id)),
  ];

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto">
      <Link href="/" className="text-sm text-muted hover:text-accent">
        ← Map
      </Link>

      <header className="mt-3 mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-1.5">Origin profile</div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold flex items-center gap-2.5">
            <span aria-hidden>{flag(origin.code)}</span>
            {origin.name}
          </h1>
          <p className="text-muted mt-2 max-w-2xl">{origin.blurb}</p>
          <p className="mt-2 text-sm">
            <span className="text-muted">Typical cup · </span>
            {origin.character}
          </p>
          <p className="mt-1 text-sm text-muted">
            Altitude {origin.altitudeMinM.toLocaleString()}–
            {origin.altitudeMaxM.toLocaleString()} m · {regions.length} region
            {regions.length !== 1 && "s"}
          </p>
        </div>
        <WatchButton entityType="origin" entityId={origin.id} />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <div className="space-y-4">
          {regions.map((r) => (
            <RegionCard key={r.id} region={r} />
          ))}
        </div>

        <aside className="lg:sticky lg:top-6 card p-4">
          <h2 className="font-display text-xl font-semibold mb-3">Your brain on {origin.name}</h2>
          <EntityBacklinks refs={refs} />
        </aside>
      </div>
    </div>
  );
}
