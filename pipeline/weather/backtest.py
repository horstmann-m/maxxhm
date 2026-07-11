"""Evaluate weather risk for a region — live from Open-Meteo, or from a saved
fixture (useful offline / for tuning thresholds).

    python -m weather.backtest yirgacheffe --stage drying
    python -m weather.backtest yirgacheffe --fixture weather/fixtures/yirgacheffe.json
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

from .client import fetch, to_series
from .evaluate import evaluate, focus_stage
from .model import load_metrics_by_stage, load_regions

STAGE_FROM_MONTH_NOTE = "using current month to pick the focus stage"


def _active_stages(region, month: int) -> list[str]:
    def in_win(w) -> bool:
        return w.start <= month <= w.end if w.start <= w.end else (month >= w.start or month <= w.end)

    return [w.stage for w in region.harvest if in_win(w)]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("region_id")
    ap.add_argument("--stage", help="override the focus stage")
    ap.add_argument("--fixture", type=Path, help="evaluate a saved Open-Meteo response")
    args = ap.parse_args()

    regions = {r.id: r for r in load_regions()}
    region = regions.get(args.region_id)
    if not region:
        raise SystemExit(f"unknown region '{args.region_id}'. options: {', '.join(sorted(regions))}")

    metrics_by_stage = load_metrics_by_stage()
    month = dt.date.today().month
    stage = args.stage or focus_stage(_active_stages(region, month))

    if args.fixture:
        raw = json.loads(args.fixture.read_text())
    else:
        raw = fetch([(region.lat, region.lng)])[0]
    series = to_series(raw)

    result = evaluate(region.id, stage, metrics_by_stage, series)

    print(f"\n{region.name}  ({region.lat}, {region.lng})")
    print(f"focus stage: {result.stage or '—'}  ·  {STAGE_FROM_MONTH_NOTE if not args.stage else 'stage overridden'}")
    print(f"RISK: {result.level.upper()}  —  {result.headline}\n")
    for m in result.metrics:
        flag = {"ok": "  ", "watch": "⚠ ", "alert": "✗ "}[m.level]
        print(f"  {flag}{m.label}: {m.value} {m.unit}  (warn {m.warn} / alert {m.alert})")
    print()


if __name__ == "__main__":
    main()
