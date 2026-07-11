"""Validation tests for the Phase 3 recommendation model + region flavor nodes."""

import pytest
import yaml
from pathlib import Path

from coffeekb.models import RecoModelFile, Region
from pydantic import ValidationError

SOURCES = Path(__file__).resolve().parent.parent / "sources"


def _reco() -> dict:
    return yaml.safe_load((SOURCES / "reco_model.yaml").read_text())


def test_reco_model_loads_and_weights_positive():
    m = RecoModelFile.model_validate(_reco())
    for w in (m.weights.freshness, m.weights.taste_match, m.weights.value):
        assert w > 0


def test_freshness_covers_all_stages():
    m = RecoModelFile.model_validate(_reco())
    for stage in ("export", "drying", "harvest_main", "cherry_development", "flowering"):
        assert stage in m.freshness_by_stage


def test_zero_weight_rejected():
    bad = _reco()
    bad["weights"]["value"] = 0
    with pytest.raises(ValidationError):
        RecoModelFile.model_validate(bad)


def test_freshness_out_of_range_rejected():
    bad = _reco()
    bad["freshness_by_stage"]["export"] = 1.7
    with pytest.raises(ValidationError):
        RecoModelFile.model_validate(bad)


def test_region_accepts_flavor_nodes():
    r = Region.model_validate(
        {
            "id": "x",
            "origin_id": "o",
            "name": "X",
            "lat": 0,
            "lng": 0,
            "altitude_min_m": 1000,
            "altitude_max_m": 1500,
            "flavor_nodes": ["jasmine", "citrus"],
            "harvest": [{"stage": "export", "start": 1, "end": 3}],
        }
    )
    assert r.flavor_nodes == ["jasmine", "citrus"]
