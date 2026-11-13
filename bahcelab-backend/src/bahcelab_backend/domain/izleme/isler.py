"""İzleme işleri (9J): günlük (akış durumu anlık görüntüsü + iç uyarı + veri taraması) ve haftalık (kaynaklar arası tutarlılık). Her adım bağımsız: biri düşse diğerleri sürer."""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.izleme import akis, meteo_uyum, uyari, uyum, veri_kontrol

logger = logging.getLogger(__name__)
SessionFactory = async_sessionmaker[AsyncSession]
_AKIS_AD = {"kopuk": "KOPUK", "gecikmeli": "gecikmeli"}


async def gunluk(factory: SessionFactory, bugun: date | None = None) -> dict[str, int]:
    """Akış durumlarını yazar, uyarı gerektirenleri iç ekibe bildirir, son 3 günün verisini tarar (bayraklar)."""
    bugun = bugun or datetime.now(UTC).date()
    sonuc = {"akis": 0, "uyari": 0, "bayrak": 0, "hata": 0}
    try:
        async with factory() as s:
            d = await akis.akis_durumlari(s, bugun)
            await akis.anlik_goruntu_yaz(s, bugun, d)
            await s.commit()
            sonuc["akis"] = len(d)
            ad = {x.akis: x for x in d}
            ups = [uyari.IcUyari(f"akis:{a}:{dr}:{ilk}", f"{ad[a].ad} {_AKIS_AD.get(dr, dr)}", ad[a].neden) for a, dr, ilk in await akis.uyari_gerektirenler(s, bugun)]
            sonuc["uyari"] = await uyari.yayinla(s, ups) if ups else 0
            await s.commit()
    except Exception:  # noqa: BLE001
        logger.exception("İzleme: akış durumu başarısız")
        sonuc["hata"] += 1
    try:
        async with factory() as s:
            sonuc["bayrak"] = await veri_kontrol.tara(s, bugun - timedelta(days=3), bugun)
            await s.commit()
    except Exception:  # noqa: BLE001
        logger.exception("İzleme: veri taraması başarısız")
        sonuc["hata"] += 1
    return sonuc


async def _dekad_etc(s: AsyncSession, ws: uuid.UUID, gid: uuid.UUID) -> dict[date, float]:
    """Bu yılın plan simülasyonundan dekad (1–10, 11–20, 21–ay sonu) ortalama model ETc (mm/gün)."""
    from bahcelab_backend.domain.irrigation.service import IrrigationService

    sim = await IrrigationService(s, ws).simulasyon(gid, yil=datetime.now(UTC).year, mod="plan")
    if sim.durum != "hazir" or not sim.sektorler:
        return {}
    etc = sim.sektorler[0].etc_mm
    grup: dict[date, list[float]] = {}
    for g, v in zip(sim.gunler, etc, strict=False):
        if v is None:
            continue
        t = g.tarih
        bas = date(t.year, t.month, 1 if t.day <= 10 else 11 if t.day <= 20 else 21)
        grup.setdefault(bas, []).append(float(v))
    return {b: sum(v) / len(v) for b, v in grup.items()}


async def haftalik(factory: SessionFactory, bugun: date | None = None, *, agdan: bool = True) -> dict[str, int]:
    """Kaynaklar arası tutarlılık serileri (`izleme_uyum`); drift → iç uyarı. Hata bir bahçede diğerlerini durdurmaz."""
    bugun = bugun or datetime.now(UTC).date()
    k = load_catalog().izleme
    sonuc = {"kontrol": 0, "drift": 0, "hata": 0}
    async with factory() as s:
        bahceler = [(r[0], r[1]) for r in (await s.execute(text("SELECT id, workspace_id FROM gardens"))).all()]
    uy: list[uyari.IcUyari] = []
    for gid, ws in bahceler:
        try:
            async with factory() as s:
                sonlar: list[uyum.UyumSonuc] = [await uyum.era5_imerg_aylik(s, gid, bugun, k), await uyum.olcer_era5(s, gid, bugun, k)]
                if (await s.execute(text("SELECT 1 FROM eta_baglam WHERE garden_id = :g LIMIT 1"), {"g": gid})).first():
                    sonlar.append(await uyum.etc_wapor(s, gid, await _dekad_etc(s, ws, gid), k))
                if agdan:
                    sapma = await asyncio.to_thread(meteo_uyum.son_sapmalar, *await _koordinat(s, gid), k.drift_min_gun)
                    sonlar.append(await uyum.era5_meteostat_tmax(s, gid, sapma, k))
                for r in sonlar:
                    await uyum.yaz(s, bugun, r)
                    sonuc["kontrol"] += 1
                    if r.durum == "drift":
                        sonuc["drift"] += 1
                        uy.append(uyari.IcUyari(f"uyum:{r.kontrol}:{gid}:{bugun:%Y-%V}", f"Kaynak uyumu kayıyor: {r.kontrol}", f"bahçe {gid}: güncel {r.deger}, taban {r.taban}, sapma {r.sapma} (eşik {r.esik}, n={r.n})"))
                await s.commit()
        except Exception:  # noqa: BLE001
            logger.exception("İzleme: uyum kontrolü başarısız (bahçe %s)", gid)
            sonuc["hata"] += 1
    if uy:
        async with factory() as s:
            await uyari.yayinla(s, uy)
            await s.commit()
    return sonuc


async def _koordinat(s: AsyncSession, gid: uuid.UUID) -> tuple[float, float]:
    r = (await s.execute(text("SELECT ST_Y(ST_Centroid(geom)), ST_X(ST_Centroid(geom)) FROM gardens WHERE id = :g"), {"g": gid})).one()
    return float(r[0]), float(r[1])


def _tur(x: Any) -> Any:
    return x
