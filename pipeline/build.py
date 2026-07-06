#!/usr/bin/env python3
"""Compile curated coffee YAML sources into the JSON the web app consumes.

Usage:  python build.py

Reads ``pipeline/sources/*.yaml``, validates them against the pydantic models,
checks referential integrity (regions -> origins/varietals/processes), then
writes camelCase JSON to ``web/public/data/``. Any validation or integrity
error aborts the build loudly and non-zero, so bad data never ships.
"""

from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

from coffeekb.models import (
    FlavorWheelFile,
    OriginsFile,
    PhenologyFile,
    ProcessesFile,
    RegionsFile,
    VarietalsFile,
)

ROOT = Path(__file__).resolve().parent
SOURCES = ROOT / "sources"
OUT = ROOT.parent / "web" / "public" / "data"
WORLD_ATLAS = ROOT.parent / "web" / "node_modules" / "world-atlas" / "countries-110m.json"


def load(name: str) -> dict:
    path = SOURCES / name
    if not path.exists():
        die(f"missing source file: {path}")
    with path.open() as fh:
        return yaml.safe_load(fh)


def die(msg: str) -> None:
    print(f"\n  build FAILED: {msg}\n", file=sys.stderr)
    sys.exit(1)


def dump(name: str, payload) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(f"  wrote {name}")


def main() -> None:
    print("building coffee knowledge base...")

    origins = OriginsFile.model_validate(load("origins.yaml"))
    regions = RegionsFile.model_validate(load("regions.yaml"))
    varietals = VarietalsFile.model_validate(load("varietals.yaml"))
    processes = ProcessesFile.model_validate(load("processes.yaml"))
    phenology = PhenologyFile.model_validate(load("phenology.yaml"))
    wheel = FlavorWheelFile.model_validate(load("flavor_wheel.yaml"))

    # ---- referential integrity -------------------------------------------
    origin_ids = {o.id for o in origins.origins}
    varietal_ids = {v.id for v in varietals.varietals}
    process_ids = {p.id for p in processes.processes}
    errors: list[str] = []

    if len(origin_ids) != len(origins.origins):
        errors.append("duplicate origin id")
    seen_region: set[str] = set()
    for r in regions.regions:
        if r.id in seen_region:
            errors.append(f"duplicate region id: {r.id}")
        seen_region.add(r.id)
        if r.origin_id not in origin_ids:
            errors.append(f"region {r.id}: unknown originId '{r.origin_id}'")
        for v in r.varietals:
            if v not in varietal_ids:
                errors.append(f"region {r.id}: unknown varietal '{v}'")
        for p in r.processes:
            if p not in process_ids:
                errors.append(f"region {r.id}: unknown process '{p}'")
        if not r.harvest:
            errors.append(f"region {r.id}: no harvest windows")

    orphan_origins = origin_ids - {r.origin_id for r in regions.regions}
    for o in sorted(orphan_origins):
        errors.append(f"origin {o}: has no regions")

    if errors:
        die("referential integrity:\n    - " + "\n    - ".join(errors))

    # ---- emit -------------------------------------------------------------
    dump("origins.json", [o.model_dump(by_alias=True) for o in origins.origins])
    dump("regions.json", [r.model_dump(by_alias=True) for r in regions.regions])
    dump("varietals.json", [v.model_dump(by_alias=True) for v in varietals.varietals])
    dump("processes.json", [p.model_dump(by_alias=True) for p in processes.processes])
    dump("phenology.json", [s.model_dump(by_alias=True) for s in phenology.stages])
    dump("flavor_wheel.json", [n.model_dump(by_alias=True) for n in wheel.wheel])
    dump(
        "meta.json",
        {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "counts": {
                "origins": len(origins.origins),
                "regions": len(regions.regions),
                "varietals": len(varietals.varietals),
                "processes": len(processes.processes),
            },
        },
    )

    # World outline for the map (copied so the app has a stable local asset).
    if WORLD_ATLAS.exists():
        shutil.copyfile(WORLD_ATLAS, OUT / "countries-110m.json")
        print("  wrote countries-110m.json (world outline)")
    else:
        print("  NOTE: world-atlas not found; run npm install in /web for the map outline")

    print(
        f"\n  done: {len(origins.origins)} origins, {len(regions.regions)} regions.\n"
    )


if __name__ == "__main__":
    main()
