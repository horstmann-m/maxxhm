"""Pydantic models for the curated coffee knowledge base.

These validate the human-authored YAML in ``pipeline/sources`` before it is
compiled to the JSON the web app reads from ``web/public/data``. Keep the source
YAML the single source of truth; never hand-edit the generated JSON.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base: author YAML in snake_case, emit JSON in camelCase for the TS app."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

# Canonical phenology / seasonality stages. The web app maps each of these to a
# colour + label for the "global coffee clock" map and the harvest calendar.
Stage = Literal[
    "flowering",
    "cherry_development",
    "harvest_main",
    "harvest_fly",
    "drying",
    "export",
]


class HarvestWindow(CamelModel):
    """A single stage window within the calendar year.

    Months are 1-12. A window may wrap the year boundary (e.g. Nov->Feb is
    ``start=11, end=2``); the app is responsible for wrap-aware rendering.
    """

    stage: Stage
    start: int = Field(ge=1, le=12)
    end: int = Field(ge=1, le=12)
    note: str | None = None


class Origin(CamelModel):
    id: str
    name: str
    code: str = Field(min_length=2, max_length=2, description="ISO 3166-1 alpha-2")
    blurb: str
    altitude_min_m: int = Field(ge=0, le=3500)
    altitude_max_m: int = Field(ge=0, le=3500)
    character: str = Field(description="One-line flavour character summary")

    @model_validator(mode="after")
    def _altitude_order(self) -> "Origin":
        if self.altitude_min_m > self.altitude_max_m:
            raise ValueError(f"{self.id}: altitude_min_m > altitude_max_m")
        return self


class Region(CamelModel):
    id: str
    origin_id: str
    name: str
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    altitude_min_m: int = Field(ge=0, le=3500)
    altitude_max_m: int = Field(ge=0, le=3500)
    varietals: list[str] = Field(default_factory=list)
    processes: list[str] = Field(default_factory=list)
    flavor_tags: list[str] = Field(default_factory=list)
    flavor_nodes: list[str] = Field(default_factory=list, description="flavor-wheel node ids")
    frost_prone: bool = Field(default=False, description="evaluate frost alerts here")
    harvest: list[HarvestWindow] = Field(default_factory=list)

    @model_validator(mode="after")
    def _altitude_order(self) -> "Region":
        if self.altitude_min_m > self.altitude_max_m:
            raise ValueError(f"{self.id}: altitude_min_m > altitude_max_m")
        return self


class Varietal(CamelModel):
    id: str
    name: str
    lineage: str | None = None
    notes: str


class Process(CamelModel):
    id: str
    name: str
    description: str


class ClimateBand(CamelModel):
    """Ideal climate envelope for a phenology stage.

    Authored now; consumed in Phase 2 to compare against live weather and raise
    per-stage quality-risk flags.
    """

    stage: Stage
    label: str
    ideal: str
    temp_min_c: float | None = None
    temp_max_c: float | None = None
    rain_mm_min: float | None = None
    rain_mm_max: float | None = None
    risk_if_wrong: str


class FlavorNode(CamelModel):
    id: str
    name: str
    color: str = Field(pattern=r"^#([0-9a-fA-F]{6})$")
    children: list["FlavorNode"] = Field(default_factory=list)


# ---- top-level source-file wrappers ----------------------------------------


class OriginsFile(CamelModel):
    origins: list[Origin]


class RegionsFile(CamelModel):
    regions: list[Region]


class VarietalsFile(CamelModel):
    varietals: list[Varietal]


class ProcessesFile(CamelModel):
    processes: list[Process]


class PhenologyFile(CamelModel):
    stages: list[ClimateBand]


class FlavorWheelFile(CamelModel):
    wheel: list[FlavorNode]

    @field_validator("wheel")
    @classmethod
    def _non_empty(cls, v: list[FlavorNode]) -> list[FlavorNode]:
        if not v:
            raise ValueError("flavor wheel must not be empty")
        return v


# ---- weather risk model (Phase 2) ------------------------------------------

MetricKind = Literal["rolling_sum", "sum", "count_above"]
Source = Literal["precip", "tmax", "tmin"]
Direction = Literal["high", "low"]


class RiskMetric(CamelModel):
    """One evaluable rule over a window of day-offsets from today.

    See ``sources/risk_model.yaml`` for the semantics of each ``kind``. The same
    fields are consumed verbatim by the TS evaluator (``web/src/lib/risk.ts``).
    """

    kind: MetricKind
    source: Source
    label: str
    unit: str
    from_day: int = Field(le=0 + 20, ge=-92, description="window start offset (days)")
    to_day: int = Field(ge=-92, le=16, description="window end offset (days)")
    direction: Direction
    warn: float
    alert: float
    reason_warn: str
    reason_alert: str
    window_days: int | None = Field(default=None, ge=1, le=92)
    threshold: float | None = None

    @model_validator(mode="after")
    def _check(self) -> "RiskMetric":
        if self.to_day < self.from_day:
            raise ValueError(f"{self.label}: to_day < from_day")
        if self.kind == "rolling_sum" and self.window_days is None:
            raise ValueError(f"{self.label}: rolling_sum requires window_days")
        if self.kind == "count_above" and self.threshold is None:
            raise ValueError(f"{self.label}: count_above requires threshold")
        # high: alert should be the more severe (larger) bound; low: the smaller.
        if self.direction == "high" and self.alert < self.warn:
            raise ValueError(f"{self.label}: high metric needs alert >= warn")
        if self.direction == "low" and self.alert > self.warn:
            raise ValueError(f"{self.label}: low metric needs alert <= warn")
        return self


class StageRule(CamelModel):
    stage: Stage
    metrics: list[RiskMetric]


class RiskModelFile(CamelModel):
    stages: list[StageRule]


# ---- recommendation model (Phase 3) ----------------------------------------


class RecoWeights(CamelModel):
    freshness: float = Field(gt=0)
    taste_match: float = Field(gt=0)
    weather: float = Field(gt=0)
    value: float = Field(gt=0)
    watchlist: float = Field(gt=0)


class RecoNeutral(CamelModel):
    taste_match: float = Field(ge=0, le=1)
    weather: float = Field(ge=0, le=1)
    value: float = Field(ge=0, le=1)


class RecoModelFile(CamelModel):
    weights: RecoWeights
    freshness_by_stage: dict[str, float]
    value_scale_usc_lb: float = Field(gt=0)
    neutral: RecoNeutral

    @field_validator("freshness_by_stage")
    @classmethod
    def _fresh_range(cls, v: dict[str, float]) -> dict[str, float]:
        for stage, val in v.items():
            if not 0 <= val <= 1:
                raise ValueError(f"freshness for '{stage}' must be 0..1")
        return v


# ---- market signals: frost + rainfall anomaly (Phase 4) --------------------


class FrostConfig(CamelModel):
    from_day: int
    to_day: int
    tmin_watch_c: float
    tmin_alert_c: float

    @model_validator(mode="after")
    def _order(self) -> "FrostConfig":
        if self.tmin_alert_c > self.tmin_watch_c:
            raise ValueError("frost: tmin_alert_c must be <= tmin_watch_c")
        return self


class AnomalyConfig(CamelModel):
    from_day: int
    to_day: int
    wet_ratio_watch: float = Field(gt=1)
    wet_ratio_alert: float = Field(gt=1)
    dry_ratio_watch: float = Field(gt=0, lt=1)
    dry_ratio_alert: float = Field(gt=0, lt=1)


class MarketModelFile(CamelModel):
    frost: FrostConfig
    anomaly: AnomalyConfig


class ClimateNormal(CamelModel):
    origin_id: str
    rain_mm: list[float]

    @field_validator("rain_mm")
    @classmethod
    def _twelve(cls, v: list[float]) -> list[float]:
        if len(v) != 12:
            raise ValueError("rain_mm must have exactly 12 monthly values")
        return v


class ClimateNormalsFile(CamelModel):
    normals: list[ClimateNormal]
