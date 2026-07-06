# ☕ Roastmap — Coffee Sourcing Intelligence

A second brain for green coffee that doubles as a purchasing-intelligence platform
for a semi-pro green buyer. Understand every origin, see the global harvest clock
turning in real time, keep a linked tasting journal, and track what you want to buy.

> This project lives alongside the profile `README.md` (which GitHub renders on the
> user profile and is intentionally left untouched). All app docs are here.

## What it does (Phase 1)

- **The global coffee clock** — a world map where each origin is coloured by the most
  advanced stage across its regions for the selected month (flowering → developing →
  harvesting → drying → **arriving**). Scrub through the year to see the world turn.
- **Harvest calendar** — the whole growing year across all 25 regions, month by month.
- **Origin profiles** — altitude, varietals, processes, flavour, and a per-region
  mini harvest strip, plus a live status badge and a "Watch" toggle.
- **Notes** — a markdown second brain. Tag freely, link notes to origins/regions;
  links surface as **backlinks** on each profile.
- **Tasting journal** — score cups on the SCA form (live 100-pt total), tag flavours
  from the wheel, link each to its coffee. Scores appear as backlinks too.
- **Watchlist** — origins/regions you're tracking, each showing its current season
  status so you can spot the buying window opening.
- **Search** — across the knowledge base *and* your own notes and tastings.

## Architecture

Data is split by ownership — the two halves never fight:

| Data | Home | Tech |
|------|------|------|
| **Your data** (notes, tastings, watchlist, prefs) | Dexie / IndexedDB (local-first) | TypeScript, in the browser |
| **The world's data** (origins, regions, calendars, phenology, flavour wheel) | versioned JSON, generated from authored YAML | **Python** pipeline |
| **App shell / UI** | Next.js on Vercel | TypeScript / React |

The Python pipeline (`/pipeline`) is the stats-heavy half and where the curated coffee
knowledge is authored and validated; the Next.js app (`/web`) is the local-first
product surface. Phase 2 adds live weather-per-stage risk flags (the `phenology.json`
climate bands are already authored for it); Phase 3 adds price + recommendations.

## Repo layout

```
/web        Next.js app (deploys to Vercel)
  src/app         routes: / (map), /calendar, /origin/[id], /notes, /tastings, /watchlist, /search
  src/components  WorldMap, HarvestCalendar, RegionCard, CuppingForm, NoteEditor, …
  src/lib         db.ts (Dexie), reference.ts, season.ts, scoring.ts, store.ts, types.ts
  public/data     generated reference JSON (committed; produced by the pipeline)
/pipeline   Python knowledge pipeline
  sources/*.yaml  human-authored curated data (edit these)
  coffeekb/       pydantic models
  build.py        validates YAML → writes web/public/data/*.json
```

## Running it

### 1. Web app

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

Your notes/tastings/watchlist persist locally in the browser (IndexedDB) — no account
needed. Deploy `/web` to Vercel as-is.

### 2. Regenerate the knowledge base (after editing `pipeline/sources/*.yaml`)

```bash
cd pipeline
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python build.py       # validates sources → web/public/data/*.json
```

The build fails loudly on bad data (unknown originId, altitude inversions, missing
harvest windows, etc.), so the app never ships broken reference data. Commit the
regenerated JSON along with your YAML edits.

## Enabling sync (Dexie Cloud) — optional

Phase 1 is local-only. To sync your notes/tastings across devices:

```bash
cd web
npx dexie-cloud create          # gives you a databaseUrl
npm install dexie-cloud-addon
echo "NEXT_PUBLIC_DEXIE_CLOUD_URL=<url>" >> .env.local
```

Then follow the `--- CLOUD:` markers in `web/src/lib/db.ts` (pass the addon to Dexie,
switch primary keys from `id` to `@id`).

## Roadmap

- **Phase 2 — Weather intelligence.** Open-Meteo ingestion (Python) compared against the
  per-stage `phenology.json` climate bands to raise quality-risk flags on the map/profiles.
- **Phase 3 — Price + recommendations.** ICE "C"/KC futures + differentials, and a
  personalised "what to buy now" that weights your flavour affinities.
