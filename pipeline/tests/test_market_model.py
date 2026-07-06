"""Validation tests for the Phase 4 market-signal model + climate normals."""

import pytest
import yaml
from pathlib import Path

from coffeekb.models import ClimateNormalsFile, MarketModelFile
from pydantic import ValidationError

SOURCES = Path(__file__).resolve().parent.parent / "sources"


def _load(name: str) -> dict:
    return yaml.safe_load((SOURCES / name).read_text())


def test_market_model_loads():
    m = MarketModelFile.model_validate(_load("market_model.yaml"))
    assert m.frost.tmin_alert_c <= m.frost.tmin_watch_c
    assert m.anomaly.wet_ratio_alert > 1
    assert m.anomaly.dry_ratio_alert < 1


def test_frost_thresholds_ordered():
    bad = _load("market_model.yaml")
    bad["frost"]["tmin_alert_c"] = 10  # alert warmer than watch -> invalid
    with pytest.raises(ValidationError):
        MarketModelFile.model_validate(bad)


def test_normals_load_and_have_twelve_months():
    n = ClimateNormalsFile.model_validate(_load("climate_normals.yaml"))
    assert len(n.normals) >= 1
    for entry in n.normals:
        assert len(entry.rain_mm) == 12


def test_normals_reject_wrong_length():
    with pytest.raises(ValidationError):
        ClimateNormalsFile.model_validate({"normals": [{"origin_id": "x", "rain_mm": [1, 2, 3]}]})
