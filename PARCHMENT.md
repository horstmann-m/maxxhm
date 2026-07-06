# ☕ Parchment — Coffee Sourcing Intelligence

A second brain for green coffee that doubles as a purchasing-intelligence platform
for a semi-pro green buyer. Understand every origin, see the global harvest clock
turning in real time, keep a linked tasting journal, and track what you want to buy.

> This project lives alongside the profile `README.md` (which GitHub renders on the
> user profile and is intentionally left untouched). All app docs are here.

## What it does

- **"Buy now" board** *(Phase 3)* — every region ranked by one score that blends
  **freshness × taste match × weather × value × watchlist**, each card explaining *why*
  ("Arriving now · Matches your taste · Weather clear · Good value vs target"). Powered by
  a **taste-preferences** editor (rate flavour notes, or "learn from my tastings") and a
  manual **prices** page (C-price + differential + your target → estimated FOB).
- **The global coffee clock** — a world map where each origin is coloured by the most
  advanced stage across its regions for the selected month (flowering → developing →
  harvesting → drying → **arriving**). Scrub through the year to see the world turn.
- **Weather intelligence** *(Phase 2)* — live Open-Meteo forecasts are compared against
  each stage's ideal climate to raise **ok / watch / alert** quality-risk flags: a ring
  on map markers, a badge + driving metric on each region, and a dedicated **Weather
  alerts** page. E.g. *"Sul de Minas is drying and 84 mm of rain is forecast over 7 days
  → high defect risk."*
- **Harvest calendar** — the whole growing year across all 25 regions, month by month.
- **Origin profiles** — altitude, varietals, processes, flavour, and a per-region
  mini harvest strip, plus a live status badge, weather-risk badge and a "Watch" toggle.
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
knowledge **and the weather risk model** are authored and validated; the Next.js app
(`/web`) is the local-first product surface. Phase 3 adds price + recommendations.

### The weather risk engine (Phase 2)

Runs **client-side**: the browser fetches Open-Meteo once for all regions (cached 6h)
and applies a **declarative risk model authored + validated in Python**
(`sources/risk_model.yaml` → `public/data/risk_model.json`). That JSON is the **single
source of truth**; the Python evaluator (`pipeline/weather/evaluate.py`) and the TS
evaluator (`web/src/lib/risk.ts`) are thin interpreters of it, pinned to identical
output by a **parity test** on a shared fixture. Tune thresholds in the YAML and rerun
`python -m weather.backtest <region>` to see the effect. Risk is purely additive — if
the fetch fails, the app degrades to the plain season view.

## Repo layout

```
/web        Next.js app (deploys to Vercel)
  src/app         routes: / (map), /recommend, /calendar, /weather, /origin/[id],
                  /notes, /tastings, /watchlist, /search, /preferences, /prices
  src/components  WorldMap, HarvestCalendar, RegionCard, RiskBadge, WeatherRiskProvider, …
  src/lib         db.ts (Dexie), reference.ts, season.ts, scoring.ts, store.ts, types.ts,
                  risk.ts + weather.ts (Phase 2), recommend.ts (Phase 3 scorer), *.test.ts
  public/data     generated reference JSON incl. risk_model.json, reco_model.json (committed)
/pipeline   Python knowledge pipeline
  sources/*.yaml  human-authored curated data incl. risk_model.yaml, reco_model.yaml
  coffeekb/       pydantic models
  weather/        Open-Meteo client, pure evaluator, backtest CLI, fixtures
  tests/          pytest (evaluator parity anchor + model validation)
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
harvest windows, risk-model stages absent from phenology, etc.), so the app never ships
broken reference data. Commit the regenerated JSON along with your YAML edits.

### 3. Tests

```bash
# TS evaluator + parity (web/)
npm test                                    # vitest

# Python evaluator (pipeline/, venv active)
pip install pytest && PYTHONPATH=. pytest tests/

# Tune the weather model and inspect one region
PYTHONPATH=. python -m weather.backtest yirgacheffe --stage drying \
  --fixture weather/fixtures/rainy_drying.json
```

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

- **Phase 1 — Knowledge + second brain.** ✅ Shipped.
- **Phase 2 — Weather intelligence.** ✅ Shipped (client-side Open-Meteo + Python-authored
  risk model; map rings, region badges, and the Weather alerts page).
- **Phase 3 — Price + recommendations.** ✅ Shipped (taste preferences, manual price
  entry, and the "Buy now" board blending freshness/taste/weather/value/watchlist via a
  Python-authored `reco_model.json`). Next up: swap manual price for a licensed live
  futures feed (the `prices` table is the drop-in point).
