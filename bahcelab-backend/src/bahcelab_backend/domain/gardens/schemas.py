import uuid
from datetime import UTC, date, datetime
from typing import Any, Literal

from pydantic import BaseModel, field_validator, model_validator

Urun = Literal["limon", "portakal", "mandalina", "greyfurt", "diger"]

MIN_DEKAR = 0.5
MAX_DEKAR = 5000.0
MAX_AGAC_SAYISI = 1_000_000


def _number(value: Any) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool)


def _check_ring(ring: Any) -> None:
    if not isinstance(ring, list) or len(ring) < 4:
        raise ValueError("Bahçe sınırı en az 3 köşeden oluşmalı.")
    for position in ring:
        if (
            not isinstance(position, list)
            or len(position) < 2
            or not all(_number(c) for c in position)
        ):
            raise ValueError("Bahçe sınırındaki koordinatlar geçersiz.")
        lng, lat = position[0], position[1]
        if not (-180 <= lng <= 180 and -90 <= lat <= 90):
            raise ValueError("Bahçe sınırı geçerli koordinat aralığının dışında.")
    if ring[0][:2] != ring[-1][:2]:
        raise ValueError("Bahçe sınırı kapalı olmalı (ilk ve son köşe aynı olmalı).")


class GeoJsonGeometry(BaseModel):
    """Polygon veya MultiPolygon; koordinatlar [boylam, enlem] (EPSG:4326)."""

    type: Literal["Polygon", "MultiPolygon"]
    coordinates: list[Any]

    @model_validator(mode="after")
    def _check_coordinates(self) -> "GeoJsonGeometry":
        polygons = [self.coordinates] if self.type == "Polygon" else self.coordinates
        if not polygons:
            raise ValueError("Bahçe sınırı boş olamaz.")
        for rings in polygons:
            if not isinstance(rings, list) or not rings:
                raise ValueError("Bahçe sınırı geçersiz.")
            for ring in rings:
                _check_ring(ring)
        return self

    def to_geojson_dict(self) -> dict[str, Any]:
        # PostGIS'e yalnızca 2B gider; yükseklik değerleri atılır
        def strip(position: list[float]) -> list[float]:
            return [position[0], position[1]]

        if self.type == "Polygon":
            coords: Any = [[strip(p) for p in ring] for ring in self.coordinates]
        else:
            coords = [[[strip(p) for p in ring] for ring in poly] for poly in self.coordinates]
        return {"type": self.type, "coordinates": coords}


_PRODUCTS = ("limon", "portakal", "mandalina", "greyfurt", "diger")
_MAX_LEN = {"ad": 120, "cesit": 100, "il": 100, "ilce": 100}
_LABELS = {"ad": "Bahçe adı", "cesit": "Çeşit", "il": "İl", "ilce": "İlçe"}


class _GardenFields(BaseModel):
    """Alan doğrulamaları; hata mesajları kullanıcıya olduğu gibi gösterilebilir."""

    @field_validator("ad", "cesit", "il", "ilce", mode="before", check_fields=False)
    @classmethod
    def _text(cls, value: Any, info: Any) -> Any:
        if value is None or not isinstance(value, str):
            return value
        name = info.field_name
        text = value.strip()
        if name == "ad" and not text:
            raise ValueError("Bahçe adı boş olamaz.")
        if len(text) > _MAX_LEN[name]:
            raise ValueError(f"{_LABELS[name]} en fazla {_MAX_LEN[name]} karakter olabilir.")
        return text or None

    @field_validator("urun", mode="before", check_fields=False)
    @classmethod
    def _urun(cls, value: Any) -> Any:
        if value is not None and value not in _PRODUCTS:
            raise ValueError(
                "Ürün şunlardan biri olmalı: limon, portakal, mandalina, greyfurt, diğer."
            )
        return value

    @field_validator("dikim_yili", check_fields=False)
    @classmethod
    def _year(cls, value: int | None) -> int | None:
        limit = datetime.now(UTC).year + 1
        if value is not None and not (1900 <= value <= limit):
            raise ValueError(f"Dikim yılı 1900 ile {limit} arasında olmalı.")
        return value

    @field_validator("agac_sayisi", check_fields=False)
    @classmethod
    def _trees(cls, value: int | None) -> int | None:
        if value is not None and not (1 <= value <= MAX_AGAC_SAYISI):
            raise ValueError(f"Ağaç sayısı 1 ile {MAX_AGAC_SAYISI:,} arasında olmalı.".replace(",", "."))
        return value


class GardenCreate(_GardenFields):
    ad: str
    urun: Urun = "limon"
    cesit: str | None = None
    dikim_yili: int | None = None
    agac_sayisi: int | None = None
    geometry: GeoJsonGeometry
    il: str | None = None
    ilce: str | None = None


class GardenUpdate(_GardenFields):
    """Yalnızca gönderilen alanlar değişir; null göndermek isteğe bağlı alanı temizler."""

    ad: str | None = None
    urun: Urun | None = None
    cesit: str | None = None
    dikim_yili: int | None = None
    agac_sayisi: int | None = None
    geometry: GeoJsonGeometry | None = None
    il: str | None = None
    ilce: str | None = None

    @model_validator(mode="after")
    def _required_not_null(self) -> "GardenUpdate":
        labels = {"ad": "Bahçe adı", "urun": "Ürün", "geometry": "Bahçe sınırı"}
        for field, label in labels.items():
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{label} boş bırakılamaz.")
        return self


class MeasureRequest(BaseModel):
    geometry: GeoJsonGeometry


class MeasureResponse(BaseModel):
    alan_dekar: float
    alan_m2: float


class GardenResponse(BaseModel):
    id: uuid.UUID
    ad: str
    urun: Urun
    cesit: str | None
    dikim_yili: int | None
    agac_sayisi: int | None
    geometry: dict[str, Any]
    alan_dekar: float
    il: str | None
    ilce: str | None
    created_at: datetime
    updated_at: datetime
    son_ndvi_ortalama: float | None = None
    son_ndvi_tarihi: date | None = None
    # Planlama ekranının beklediği alanlar
    name: str
    location_label: str | None
    area_m2: float
