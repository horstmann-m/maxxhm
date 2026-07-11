"""Load the risk model + regions from the authored YAML sources (via pydantic)."""

from __future__ import annotations

from pathlib import Path

import yaml

from coffeekb.models import (
    Region,
    RegionsFile,
    RiskMetric,
    RiskModelFile,
    Stage,
)

SOURCES = Path(__file__).resolve().parent.parent / "sources"


def _load(name: str) -> dict:
    with (SOURCES / name).open() as fh:
        return yaml.safe_load(fh)


def load_metrics_by_stage() -> dict[Stage, list[RiskMetric]]:
    model = RiskModelFile.model_validate(_load("risk_model.yaml"))
    return {sr.stage: sr.metrics for sr in model.stages}


def load_regions() -> list[Region]:
    return RegionsFile.model_validate(_load("regions.yaml")).regions
