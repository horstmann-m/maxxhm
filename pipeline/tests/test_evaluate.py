"""Offline evaluator tests. The asserted values are the parity anchor: the TS
test in web/src/lib/risk.test.ts asserts the identical numbers on the same fixture."""

import datetime as dt
import json
from pathlib import Path

from weather.client import to_series
from weather.evaluate import evaluate, focus_stage
from weather.model import load_metrics_by_stage

FIXTURE = Path(__file__).resolve().parent.parent / "weather" / "fixtures" / "rainy_drying.json"
TODAY = dt.date(2024, 6, 15)


def series(raw=None):
    raw = raw or json.loads(FIXTURE.read_text())
    return to_series(raw, today=TODAY)


def test_today_index_and_source():
    s = series()
    assert s.today_index == 30
    assert s.precip[30] == 8.0


def test_drying_is_alert():
    m = load_metrics_by_stage()
    r = evaluate("yirgacheffe", "drying", m, series())
    assert r.level == "alert"
    assert r.metrics[0].value == 56.0  # 7-day forecast rain
    assert "defect risk" in r.headline.lower()


def test_harvest_is_watch_not_alert():
    m = load_metrics_by_stage()
    r = evaluate("yirgacheffe", "harvest_main", m, series())
    assert r.level == "watch"
    assert r.metrics[0].value == 56.0  # 25 <= 56 < 60


def test_cherry_development_ok_when_wet_enough():
    m = load_metrics_by_stage()
    r = evaluate("yirgacheffe", "cherry_development", m, series())
    assert r.level == "ok"  # 90mm/30d > 40 floor, no hot days


def test_flowering_ok_under_threshold():
    m = load_metrics_by_stage()
    r = evaluate("yirgacheffe", "flowering", m, series())
    assert r.level == "ok"  # rolling 10-day rain well under 120mm


def test_drought_triggers_alert():
    raw = json.loads(FIXTURE.read_text())
    raw["daily"]["precipitation_sum"] = [0.0] * len(raw["daily"]["time"])
    m = load_metrics_by_stage()
    r = evaluate("yirgacheffe", "cherry_development", m, series(raw))
    assert r.level == "alert"  # 0mm over 30 days <= 15 alert floor


def test_heat_stress_counts_days():
    raw = json.loads(FIXTURE.read_text())
    t = raw["daily"]["temperature_2m_max"]
    # 15 hot days within the -6..14 window (indices 24..44)
    for i in range(24, 39):
        t[i] = 33.0
    m = load_metrics_by_stage()
    r = evaluate("yirgacheffe", "cherry_development", m, series(raw))
    assert any(mr.label.startswith("Hot days") and mr.value >= 12 for mr in r.metrics)
    assert r.level == "alert"


def test_no_focus_stage_is_ok():
    m = load_metrics_by_stage()
    r = evaluate("x", focus_stage(["export"]), m, series())
    assert r.level == "ok"
    assert r.stage is None


def test_focus_priority():
    assert focus_stage(["cherry_development", "drying"]) == "drying"
    assert focus_stage(["export"]) is None
