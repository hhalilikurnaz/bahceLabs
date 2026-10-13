"""ERA5-Land / model verisini hava hücresi başına `era5_daily` tablosuna yazar (idempotent upsert). Hücre = mevcut 0,05° hava hücresi."""

from __future__ import annotations

import logging
import uuid
from datetime import date, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.water.era5 import DayAgg, Era5Client, aggregate_day, year_chunks
from bahcelab_backend.domain.water.models import ERA5, MODEL, Era5DailyModel
from bahcelab_backend.domain.weather.service import snap

logger = logging.getLogger(__name__)
ERA5_START = date(2015, 1, 1)
ERA5_LAG_DAYS = 6  # arşiv ~5 gün gecikmelidir; bu günlerin ERA5 değerleri eksik gelirse model tahmini kullanılır


async def garden_cell(session: AsyncSession, garden_id: uuid.UUID) -> tuple[uuid.UUID, float, float]:
    """Bahçenin hava hücresi (yoksa oluşturulur): (hücre kimliği, hücre merkezi enlem, boylam)."""
    row = (await session.execute(text("SELECT ST_Y(ST_Centroid(geom)), ST_X(ST_Centroid(geom)) FROM gardens WHERE id = :g"), {"g": garden_id})).one()
    step = get_settings().weather_cell_degrees
    lat, lng = snap(float(row[0]), step), snap(float(row[1]), step)
    await session.execute(text("INSERT INTO weather_cells (id, enlem, boylam) VALUES (:i, :a, :b) ON CONFLICT ON CONSTRAINT uq_weather_cell DO NOTHING"), {"i": uuid.uuid4(), "a": lat, "b": lng})
    cell = (await session.execute(text("SELECT id FROM weather_cells WHERE enlem = :a AND boylam = :b"), {"a": lat, "b": lng})).scalar_one()
    return cell, lat, lng


def merge_day(land: dict[str, list[float | None]] | None, reanalysis: dict[str, list[float | None]] | None, model: dict[str, list[float | None]] | None) -> dict[str, Any] | None:
    """Üç kaynaktan bir gün: toprak nemi ERA5-Land öncelikli (yoksa model), yağış/ET0 ERA5 öncelikli (yoksa model), sıcaklık ERA5-Land (yoksa model)."""
    primary = aggregate_day({**(land or {}), **(reanalysis or {})})
    fallback = aggregate_day(model or {})
    soil_ok = any(v is not None for v in primary.sm)
    wx_ok = primary.yagis_mm is not None and primary.et0_mm is not None
    soil_agg, wx_agg = (primary if soil_ok else fallback), (primary if wx_ok else fallback)
    if not soil_ok and not any(v is not None for v in fallback.sm) and not wx_ok and fallback.yagis_mm is None:
        return None
    t_src = primary if primary.t_ort is not None else fallback
    return _row(soil_agg, wx_agg, t_src, soil_source=ERA5 if soil_ok else MODEL, wx_source=ERA5 if wx_ok else MODEL)


def _row(soil: DayAgg, wx: DayAgg, temp: DayAgg, *, soil_source: str, wx_source: str) -> dict[str, Any]:
    hourly = {k: v for k, v in soil.saatlik.items() if k.startswith("sm")} | {k: v for k, v in wx.saatlik.items() if k in ("yagis", "et0")} | {k: v for k, v in temp.saatlik.items() if k == "t2m"}
    return {
        "sm0": soil.sm[0], "sm1": soil.sm[1], "sm2": soil.sm[2], "sm3": soil.sm[3], "et0_mm": wx.et0_mm, "yagis_mm": wx.yagis_mm,
        "t_ort": temp.t_ort, "t_min": temp.t_min, "t_max": temp.t_max, "saatlik": hourly or None, "toprak_kaynak": soil_source, "hava_kaynak": wx_source,
    }


async def upsert_days(session: AsyncSession, cell_id: uuid.UUID, rows: dict[date, dict[str, Any]]) -> int:
    if not rows:
        return 0
    await session.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"), {"k": f"era5_daily:{cell_id}"})  # eşzamanlı yazımlar sıraya girer
    values = [{"cell_id": cell_id, "tarih": day, **row} for day, row in sorted(rows.items())]
    for i in range(0, len(values), 400):
        stmt = insert(Era5DailyModel).values(values[i : i + 400])
        update = {c.name: stmt.excluded[c.name] for c in Era5DailyModel.__table__.columns if c.name not in ("cell_id", "tarih")}
        await session.execute(stmt.on_conflict_do_update(index_elements=["cell_id", "tarih"], set_=update))
    return len(values)


OFFSET_DAYS = 7  # model–ERA5-Land katman farkı, örtüşen son bu kadar günün ortalamasından kestirilir


def model_offsets(era5_rows: dict[date, dict[str, Any]], model_days: dict[date, dict[str, list[float | None]]], last_era5_day: date) -> list[float | None]:
    """Katman başına ortalama (ERA5-Land − model) farkı (örtüşen son `OFFSET_DAYS` gün). Modelin ERA5-Land'den sistematik sapması yüzünden geçiş gününde yapay sıçrama olmasın.
    Yeterli örtüşme (≥ 3 gün) yoksa o katman için None (düzeltme yapılmaz)."""
    out: list[float | None] = []
    days = [d for d in sorted(era5_rows) if d <= last_era5_day and d in model_days][-OFFSET_DAYS:]
    for i in range(4):
        diffs = []
        for d in days:
            era = era5_rows[d].get(f"sm{i}")
            mod = aggregate_day(model_days[d]).sm[i]
            if era is not None and mod is not None and era5_rows[d]["toprak_kaynak"] == ERA5:
                diffs.append(era - mod)
        out.append(sum(diffs) / len(diffs) if len(diffs) >= 3 else None)
    return out


def apply_offsets(row: dict[str, Any], offsets: list[float | None]) -> dict[str, Any]:
    """Model kaynaklı bir günün toprak nemini (günlük + saatlik) katman farkıyla düzeltir; [0; 0,6] aralığında kırpar. Uygulanan fark `saatlik.model_ofset`te saklanır."""
    out = dict(row)
    hourly = {k: list(v) for k, v in (row.get("saatlik") or {}).items()}
    applied: dict[str, float] = {}
    for i, off in enumerate(offsets):
        key = f"sm{i}"
        if off is None or out.get(key) is None:
            continue
        out[key] = min(0.6, max(0.0, out[key] + off))
        if key in hourly:
            hourly[key] = [None if v is None else min(0.6, max(0.0, v + off)) for v in hourly[key]]
        applied[key] = round(off, 4)
    if applied:
        out["saatlik"] = {**hourly, "model_ofset": applied}
    return out


async def sync_cell(session: AsyncSession, client: Era5Client, cell_id: uuid.UUID, lat: float, lng: float, start: date, today: date, *, past_days: int = 10, forecast_days: int = 8) -> dict[str, int]:
    """[start, today] arşivi + son günler ve ileri için model tahmini. Dönüş: yazılan gün sayısı ve model günü sayısı."""
    archive_end = today - timedelta(days=1)
    model = await client.model(lat, lng, past_days=past_days, forecast_days=forecast_days)
    rows: dict[date, dict[str, Any]] = {}
    for a, b in year_chunks(start, archive_end):
        land = await client.land(lat, lng, a, b)
        rean = await client.reanalysis(lat, lng, a, b)
        for day in sorted(set(land) | set(rean)):
            row = merge_day(land.get(day), rean.get(day), model.get(day))
            if row is not None:
                rows[day] = row
    for day, hours in model.items():  # bugün ve ileri: yalnız model
        if day > archive_end:
            row = merge_day(None, None, hours)
            if row is not None:
                rows[day] = row
    era5_rows = {d: r for d, r in rows.items() if r["toprak_kaynak"] == ERA5}
    if era5_rows:  # modelin ERA5-Land'den sistematik sapması: örtüşen günlerden katman farkı → model günlerine uygulanır
        offsets = model_offsets(era5_rows, model, max(era5_rows))
        rows = {d: (apply_offsets(r, offsets) if r["toprak_kaynak"] == MODEL else r) for d, r in rows.items()}
    written = await upsert_days(session, cell_id, rows)
    return {"gun": written, "model_gunu": sum(1 for r in rows.values() if r["toprak_kaynak"] == MODEL or r["hava_kaynak"] == MODEL)}
