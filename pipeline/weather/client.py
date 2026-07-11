"""Minimal Open-Meteo client (stdlib only). Mirrors the browser fetch in
``web/src/lib/weather.ts`` so backtests use the same inputs as production."""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from datetime import date

from .evaluate import DailySeries

BASE = "https://api.open-meteo.com/v1/forecast"
DAILY = "precipitation_sum,temperature_2m_max,temperature_2m_min"


def build_url(coords: list[tuple[float, float]], past_days: int = 30, forecast_days: int = 16) -> str:
    lats = ",".join(str(round(la, 4)) for la, _ in coords)
    lngs = ",".join(str(round(lo, 4)) for _, lo in coords)
    q = urllib.parse.urlencode(
        {
            "latitude": lats,
            "longitude": lngs,
            "daily": DAILY,
            "past_days": past_days,
            "forecast_days": forecast_days,
            "timezone": "auto",
        }
    )
    return f"{BASE}?{q}"


def fetch(coords: list[tuple[float, float]], **kw) -> list[dict]:
    """Return one raw Open-Meteo object per coordinate (list even for one)."""
    url = build_url(coords, **kw)
    with urllib.request.urlopen(url, timeout=30) as r:  # noqa: S310 (trusted host)
        data = json.loads(r.read())
    return data if isinstance(data, list) else [data]


def to_series(raw: dict, today: date | None = None) -> DailySeries:
    d = raw["daily"]
    times: list[str] = d["time"]
    today_str = (today or date.today()).isoformat()
    today_index = times.index(today_str) if today_str in times else min(30, len(times) - 1)
    return DailySeries(
        time=times,
        precip=d["precipitation_sum"],
        tmax=d["temperature_2m_max"],
        tmin=d["temperature_2m_min"],
        today_index=today_index,
    )
