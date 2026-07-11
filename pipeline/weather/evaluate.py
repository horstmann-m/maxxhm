"""Pure risk evaluator — the reference implementation of the shared risk model.

Given a region's focus stage, its daily weather series, and the risk model, it
produces a RiskResult. This has NO I/O and is unit-tested offline; the TS twin in
``web/src/lib/risk.ts`` mirrors it exactly (guarded by a parity test on a shared
fixture).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from coffeekb.models import RiskMetric, Stage

Level = str  # "ok" | "watch" | "alert"

# Stages a buyer can act on for weather, most weather-sensitive first. A region's
# focus stage is the highest-priority stage currently active in its calendar.
FOCUS_PRIORITY: list[Stage] = [
    "drying",
    "harvest_main",
    "harvest_fly",
    "flowering",
    "cherry_development",
]

_RANK = {"ok": 0, "watch": 1, "alert": 2}


@dataclass
class DailySeries:
    time: list[str]
    precip: list[float | None]
    tmax: list[float | None]
    tmin: list[float | None]
    today_index: int

    def source(self, name: str) -> list[float | None]:
        return {"precip": self.precip, "tmax": self.tmax, "tmin": self.tmin}[name]


@dataclass
class MetricResult:
    label: str
    unit: str
    value: float
    level: Level
    warn: float
    alert: float
    reason: str | None


@dataclass
class RiskResult:
    region_id: str
    stage: Stage | None
    level: Level
    headline: str
    metrics: list[MetricResult] = field(default_factory=list)


def focus_stage(active: list[Stage]) -> Stage | None:
    """Pick the weather-relevant stage to evaluate from a region's active stages."""
    for s in FOCUS_PRIORITY:
        if s in active:
            return s
    return None


def _window(values: list[float | None], today: int, from_day: int, to_day: int) -> list[float]:
    """Values whose day-offset lies in [from_day, to_day], missing dropped."""
    lo = max(0, today + from_day)
    hi = min(len(values) - 1, today + to_day)
    return [v for v in values[lo : hi + 1] if v is not None]

def _max_rolling_sum(vals: list[float], window: int) -> float:
    if not vals:
        return 0.0
    if len(vals) <= window:
        return sum(vals)
    best = 0.0
    run = sum(vals[:window])
    best = run
    for i in range(window, len(vals)):
        run += vals[i] - vals[i - window]
        best = max(best, run)
    return best


def _classify(value: float, direction: str, warn: float, alert: float) -> Level:
    if direction == "high":
        if value >= alert:
            return "alert"
        if value >= warn:
            return "watch"
    else:  # low: smaller is worse
        if value <= alert:
            return "alert"
        if value <= warn:
            return "watch"
    return "ok"


def eval_metric(m: RiskMetric, series: DailySeries) -> MetricResult:
    vals = _window(series.source(m.source), series.today_index, m.from_day, m.to_day)
    if m.kind == "rolling_sum":
        value = _max_rolling_sum(vals, m.window_days or 1)
    elif m.kind == "sum":
        value = float(sum(vals))
    elif m.kind == "count_above":
        thr = m.threshold if m.threshold is not None else 0.0
        value = float(sum(1 for v in vals if v > thr))
    else:  # pragma: no cover - guarded by model validation
        raise ValueError(f"unknown metric kind {m.kind}")

    value = round(value, 1)
    level = _classify(value, m.direction, m.warn, m.alert)
    reason = m.reason_alert if level == "alert" else m.reason_warn if level == "watch" else None
    return MetricResult(
        label=m.label, unit=m.unit, value=value, level=level,
        warn=m.warn, alert=m.alert, reason=reason,
    )


def evaluate(
    region_id: str,
    stage: Stage | None,
    metrics_by_stage: dict[Stage, list[RiskMetric]],
    series: DailySeries,
) -> RiskResult:
    if stage is None or stage not in metrics_by_stage:
        return RiskResult(region_id, stage, "ok", "No weather-sensitive stage right now.")
    results = [eval_metric(m, series) for m in metrics_by_stage[stage]]
    worst = max(results, key=lambda r: _RANK[r.level]) if results else None
    level = worst.level if worst else "ok"
    if level == "ok":
        headline = f"Conditions look favourable during {stage.replace('_', ' ')}."
    else:
        headline = worst.reason or level
    return RiskResult(region_id, stage, level, headline, results)
