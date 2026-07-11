"use client";

import dynamic from "next/dynamic";

// Leaflet touches window at import, so load the implementation client-only.
const Impl = dynamic(() => import("./LeafletMapImpl"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[520px] rounded-xl border border-border bg-surface-2 grid place-items-center text-sm text-muted">
      Loading map…
    </div>
  ),
});

export function LeafletMap({ month }: { month: number }) {
  return <Impl month={month} />;
}
