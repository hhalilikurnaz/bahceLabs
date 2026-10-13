"""Su sekmesi servisi (ADR 0017): toprak nem profili, su dengesi, yüzey–hava sıcaklığı ve karar cümlesi. Veri: era5_daily, soil_profiles, acquisitions (Landsat, NDVI), doğrulama gözlemleri."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any, Literal, cast
from zoneinfo import ZoneInfo

import httpx
import numpy as np
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.domain.water import balance as wb
from bahcelab_backend.domain.water.era5_sync import garden_cell
from bahcelab_backend.domain.water.models import ERA5, SoilProfileModel
from bahcelab_backend.domain.water.pedotransfer import (
    aggregate_soilgrids,
    available_water_mm,
    saxton_rawls,
)
from bahcelab_backend.domain.water.schemas import (
    DengeGunu,
    KaynakCipi,
    NemProfili,
    ProfilNoktasi,
    SicaklikNoktasi,
    SicaklikNormali,
    SuDengesi,
    SulamaKarari,
    SuYaniti,
    ToprakOzeti,
    YuzeyHava,
)
from bahcelab_backend.domain.weather.provider import TIMEZONE
from bahcelab_backend.shared.errors import AppError, AppErrorCode

logger = logging.getLogger(__name__)
LAYER_LABELS = ("0–7 cm", "7–28 cm", "28–100 cm", "100–255 cm")
SOILGRIDS_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
SOIL_SOURCE = "SoilGrids 2.0 (ISRIC, 250 m) + Saxton & Rawls 2006 pedotransfer · ön değer"
VALIDATION_SOURCES = [
    "Doğrulama (arayüzde gösterilmez): SMAP L3 9 km yüzey nemi, ERA5-Land ile karşılaştırma",
    "Doğrulama (arayüzde gösterilmez): GPM IMERG günlük yağış, ERA5 yağışıyla aylık karşılaştırma",
]


async def fetch_soilgrids(lat: float, lng: float, client: httpx.AsyncClient | None = None) -> dict[str, Any] | None:
    """SoilGrids REST: 0–100 cm kum/kil/silt/organik karbon. Ulaşılamazsa None (toprak parametresi uydurulmaz)."""
    params: list[tuple[str, str | int | float | bool | None]] = [("lon", lng), ("lat", lat), ("value", "mean")]
    params += [("property", p) for p in ("sand", "clay", "silt", "soc")]
    params += [("depth", d) for d in ("0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm")]
    try:
        if client is not None:
            response = await client.get(SOILGRIDS_URL, params=params, timeout=30)
        else:
            async with httpx.AsyncClient() as c:
                response = await c.get(SOILGRIDS_URL, params=params, timeout=30)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError):
        logger.warning("SoilGrids'e ulaşılamadı (%.3f, %.3f)", lat, lng)
        return None


def soil_value(soil: dict[str, Any] | None, key: str) -> Any:
    return None if soil is None else soil[key]


class WaterService:
    def __init__(self, session: AsyncSession, workspace_id: uuid.UUID, soil_client: httpx.AsyncClient | None = None) -> None:
        self.session = session
        self.gardens = GardenRepository(session, workspace_id)
        self.soil_client = soil_client

    # ------------------------------------------------------------------ toprak
    async def ensure_soil(self, garden_id: uuid.UUID, lat: float, lng: float) -> dict[str, Any] | None:
        row = (await self.session.execute(text("SELECT 1 FROM soil_profiles WHERE garden_id = :g"), {"g": garden_id})).first()
        if row is None and get_settings().soilgrids_enabled:
            payload = await fetch_soilgrids(lat, lng, self.soil_client)
            if payload is None:
                return None
            tex = aggregate_soilgrids(payload)
            fc, wp = saxton_rawls(tex.kum_yuzde, tex.kil_yuzde, tex.organik_madde_yuzde)
            values = {
                "garden_id": garden_id, "kum_yuzde": tex.kum_yuzde, "kil_yuzde": tex.kil_yuzde, "silt_yuzde": tex.silt_yuzde, "organik_karbon_g_kg": tex.organik_karbon_g_kg,
                "tarla_kapasitesi": fc, "solma_noktasi": wp, "kaynak": SOIL_SOURCE, "ayrinti": {"derinlik": "0–100 cm", "organik_madde_yuzde": tex.organik_madde_yuzde},
            }
            await self.session.execute(insert(SoilProfileModel).values(values).on_conflict_do_nothing())
            await self.session.flush()
        found = (await self.session.execute(text("SELECT * FROM soil_profiles WHERE garden_id = :g"), {"g": garden_id})).mappings().first()
        return None if found is None else dict(found)

    # ------------------------------------------------------------------ klimatoloji
    async def climatology(self, cell: uuid.UUID, rule: cat.SuKurali, ref: date) -> list[wb.Climatology]:
        """Katman başına AYNI DÖNEMİN (yılın gününe göre ±`klima_pencere_gun`, 2015–2025) p2 / p10 / p90 / p98 değerleri."""
        out = []
        doy = ref.timetuple().tm_yday
        for i in range(4):
            r = (
                await self.session.execute(
                    text(
                        f"SELECT percentile_cont(ARRAY[CAST(:a AS float8), CAST(:b AS float8), CAST(:c AS float8), CAST(:d AS float8)]) WITHIN GROUP (ORDER BY sm{i}) FROM era5_daily "
                        "WHERE cell_id = :cell AND toprak_kaynak = 'era5_land' AND sm" + str(i) + " IS NOT NULL AND tarih BETWEEN :s AND :e "
                        "AND LEAST(ABS(EXTRACT(DOY FROM tarih)::int - :doy), 366 - ABS(EXTRACT(DOY FROM tarih)::int - :doy)) <= :w"
                    ),
                    {"a": rule.klima_p_alt / 100, "b": rule.normal_aralik_alt / 100, "c": rule.normal_aralik_ust / 100, "d": rule.klima_p_ust / 100, "cell": cell, "s": date(rule.klima_ilk_yil, 1, 1), "e": date(rule.klima_son_yil, 12, 31), "doy": doy, "w": rule.klima_pencere_gun},
                )
            ).scalar_one()
            p2, p10, p90, p98 = (r or [0, 0, 0, 0])
            out.append(wb.Climatology(p_alt=float(p2), p_ust=float(p98), normal_alt=float(p10), normal_ust=float(p90)))
        return out

    async def fill_band(self, cell: uuid.UUID, ref: date, clims: list[wb.Climatology], rule: cat.SuKurali) -> list[float] | None:
        """Kök bölgesi doluluğunun AYNI DÖNEM (±pencere, 2015–2025) dağılımı: [p10, p25, p75, p90]. Etiket kuralı (p25–p75 normal …) bununla çalışır."""
        rows = (
            await self.session.execute(
                text(
                    "SELECT sm0, sm1, sm2, sm3 FROM era5_daily WHERE cell_id = :cell AND toprak_kaynak = 'era5_land' AND sm0 IS NOT NULL AND tarih BETWEEN :s AND :e "
                    "AND LEAST(ABS(EXTRACT(DOY FROM tarih)::int - :doy), 366 - ABS(EXTRACT(DOY FROM tarih)::int - :doy)) <= :w"
                ),
                {"cell": cell, "s": date(rule.klima_ilk_yil, 1, 1), "e": date(rule.klima_son_yil, 12, 31), "doy": ref.timetuple().tm_yday, "w": rule.klima_pencere_gun},
            )
        ).all()
        fills = [f for r in rows if (f := wb.root_zone_fill(list(r), clims, rule.kok_katman_agirliklari)) is not None]
        if len(fills) < 30:
            return None
        return [float(v) for v in np.percentile(fills, [rule.sicaklik_belirgin_alt, rule.sicaklik_normal_alt, rule.sicaklik_normal_ust, rule.sicaklik_belirgin_ust])]

    # ------------------------------------------------------------------ ana hesap
    async def su(self, garden_id: uuid.UUID, today: date | None = None) -> SuYaniti:
        row = await self.gardens.get(garden_id)
        if row is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")
        rule = cat.load_catalog().su
        today = today or datetime.now(UTC).astimezone(ZoneInfo(TIMEZONE)).date()
        cell, _, _ = await garden_cell(self.session, garden_id)
        centroid = (await self.session.execute(text("SELECT ST_Y(ST_Centroid(geom)), ST_X(ST_Centroid(geom)) FROM gardens WHERE id = :g"), {"g": garden_id})).one()
        soil = await self.ensure_soil(garden_id, float(centroid[0]), float(centroid[1]))  # toprak BAHÇE noktasında (hücre merkezi kıyıda boş olabilir)

        start = today - timedelta(days=rule.gecmis_gun)
        rows = {
            r["tarih"]: r
            for r in (await self.session.execute(text("SELECT * FROM era5_daily WHERE cell_id = :c AND tarih BETWEEN :s AND :e ORDER BY tarih"), {"c": cell, "s": start - timedelta(days=1), "e": today + timedelta(days=rule.tahmin_gun)})).mappings().all()
        }
        usable_days = [d for d in sorted(rows) if d <= today and rows[d]["sm0"] is not None]
        ref_day = usable_days[-1] if usable_days else today
        clims = await self.climatology(cell, rule, ref_day)  # bugünün DÖNEMİ (±15 gün) — doluluk ve normal aralık buna göre
        profile = self._profile(rows, clims, today, rule)
        if profile.bugun_tarihi is not None:
            profile = profile.model_copy(update={"kok_bolgesi_bant": await self.fill_band(cell, ref_day, clims, rule)})

        # toprak kovası
        taw = None
        if soil is not None and soil["tarla_kapasitesi"] is not None and soil["solma_noktasi"] is not None:
            taw = available_water_mm(float(soil["tarla_kapasitesi"]), float(soil["solma_noktasi"]), rule.kok_derinligi_cm)
        balance = await self._balance(garden_id, cell, rows, taw, today, start, rule)
        forecast = [b for b in balance[0] if b.tarih > today]  # önümüzdeki `tahmin_gun` gün
        now = next((b for b in balance[0] if b.tarih == today), None)
        decision = wb.irrigation_decision(profile.kok_bolgesi_doluluk, profile.bugun_tarihi, forecast, now, taw, rule)
        thermal = await self._thermal(garden_id, cell, rule)

        last_thermal = thermal.noktalar[-1].tarih if thermal.noktalar else None
        return SuYaniti(
            karar=decision.cumle,
            karar_detay=SulamaKarari(durum=cast(Literal["sulama", "izle", "gerekmiyor", "veri_yok"], decision.durum), gerekli=decision.gerekli, cumle=decision.cumle, doluluk=decision.doluluk, donem=decision.donem, ihtiyac_mm=decision.ihtiyac_mm),
            on_deger=True,
            profil=profile,
            denge=SuDengesi(
                taw_mm=taw, tukenme_esigi_mm=None if taw is None else rule.tukenme_orani * taw, gunler=[self._day(b, balance[1].get(b.tarih, "yok")) for b in balance[0]],
                yagis_kaynagi=cast(Literal["era5", "imerg"], balance[2]), yagis_karari=balance[3],
                kc_notu=f"Kc = NDVI'dan doğrusal ({rule.kc_alt}–{rule.kc_ust}); ETc = Kc × ET0 · ön değer · mühendis onayı bekliyor",
            ),
            sicaklik=thermal,
            toprak=ToprakOzeti(
                kum_yuzde=soil_value(soil, "kum_yuzde"), kil_yuzde=soil_value(soil, "kil_yuzde"), silt_yuzde=soil_value(soil, "silt_yuzde"), organik_karbon_g_kg=soil_value(soil, "organik_karbon_g_kg"),
                tarla_kapasitesi=soil_value(soil, "tarla_kapasitesi"), solma_noktasi=soil_value(soil, "solma_noktasi"), kaynak=soil_value(soil, "kaynak"),
            ),
            kaynaklar={
                "profil": KaynakCipi(ad="ERA5-Land (Open-Meteo)", cozunurluk="9 km · saatlik", tarih=profile.bugun_tarihi, not_=(f"model tahmini; geçiş {profile.gecis_gunu.day}.{profile.gecis_gunu.month}" if profile.gecis_gunu else None)),
                "denge": KaynakCipi(ad=f"{'IMERG Late' if balance[2] == 'imerg' else 'ERA5'} + Open-Meteo tahmini", cozunurluk="~10–31 km · günlük", tarih=today, not_="ön değer"),
                "sicaklik": KaynakCipi(ad="Landsat 8/9 yüzey sıcaklığı", cozunurluk="30 m ürün · 100 m fiziksel", tarih=last_thermal, not_=None),
            },
            dogrulama=VALIDATION_SOURCES,
        )

    @staticmethod
    def _day(b: wb.DayBalance, source: str) -> DengeGunu:
        return DengeGunu(
            tarih=b.tarih, yagis_mm=None if b.veri_eksik else b.yagis_mm, etc_mm=None if b.veri_eksik else b.etc_mm, etkili_yagis_mm=None if b.veri_eksik else b.etkili_yagis_mm, tukenme_mm=b.tukenme_mm, birikimli_mm=b.birikimli_mm, tahmin=b.tahmin,
            yagis_kaynagi=cast(Literal["era5", "imerg", "model", "yok"], source), veri_eksik=b.veri_eksik,
        )

    def _profile(self, rows: dict[date, Any], clims: list[wb.Climatology], today: date, rule: cat.SuKurali) -> NemProfili:
        usable = [d for d in sorted(rows) if d <= today and rows[d]["sm0"] is not None]
        latest = usable[-1] if usable else None
        weights = rule.kok_katman_agirliklari
        if latest is None:
            return NemProfili(bugun_tarihi=None, otuz_gun_once_tarihi=None, katmanlar=[], kok_bolgesi_doluluk=None, kok_bolgesi_sinif="bilinmiyor", gecis_gunu=None, model_ofset=None, donem=None, donem_pencere_gun=rule.klima_pencere_gun)
        before_day = latest - timedelta(days=30)
        before = rows.get(before_day)
        today_row = rows[latest]
        values = [today_row[f"sm{i}"] for i in range(4)]
        layers = [
            ProfilNoktasi(
                derinlik=LAYER_LABELS[i], bugun=values[i], bugun_kaynak=cast(Literal["era5_land", "model", "yok"], "yok" if values[i] is None else ERA5 if today_row["toprak_kaynak"] == ERA5 else "model"),
                otuz_gun_once=None if before is None else before[f"sm{i}"], normal_alt=clims[i].normal_alt, normal_ust=clims[i].normal_ust, doluluk=wb.normalized_fill(values[i], clims[i]),
            )
            for i in range(4)
        ]
        fill = wb.root_zone_fill(values, clims, weights)
        first_model = next((d for d in sorted(rows) if rows[d]["toprak_kaynak"] != ERA5 and d > (latest - timedelta(days=15))), None)
        offsets = (today_row["saatlik"] or {}).get("model_ofset") if today_row["toprak_kaynak"] != ERA5 else None
        return NemProfili(
            bugun_tarihi=latest, otuz_gun_once_tarihi=before_day if before is not None else None, katmanlar=layers, kok_bolgesi_doluluk=fill, kok_bolgesi_sinif=cast(Literal["nemli", "orta", "kuru", "bilinmiyor"], wb.classify_fill(fill, rule)),
            gecis_gunu=first_model, model_ofset=offsets, donem=wb.TR_AYLAR[latest.month - 1], donem_pencere_gun=rule.klima_pencere_gun,
        )

    async def _balance(
        self, garden_id: uuid.UUID, cell: uuid.UUID, rows: dict[date, Any], taw: float | None, today: date, start: date, rule: cat.SuKurali
    ) -> tuple[list[wb.DayBalance], dict[date, str], str, str]:
        era5_all = {r[0]: float(r[1]) for r in (await self.session.execute(text("SELECT tarih, yagis_mm FROM era5_daily WHERE cell_id = :c AND hava_kaynak = 'era5_land' AND yagis_mm IS NOT NULL"), {"c": cell})).all()}
        imerg_all = {r[0]: float(r[1]) for r in (await self.session.execute(text("SELECT tarih, deger FROM dogrulama_gozlem WHERE garden_id = :g AND source_id = 'imerg-daily' AND deger IS NOT NULL"), {"g": garden_id})).all()}
        source, reason = wb.choose_rain_source(wb.monthly_rain(era5_all, imerg_all, rule.kucuk_yagis_esigi_mm))
        ndvi_obs = [
            (r[0], float(r[1]))
            for r in (
                await self.session.execute(
                    text("SELECT a.tarih, s.medyan FROM acquisitions a JOIN acquisition_stats s ON s.acquisition_id = a.id WHERE a.garden_id = :g AND a.source_id = 'sentinel2-l2a' AND a.durum = 'net' AND s.indeks = 'ndvi' AND a.tarih BETWEEN :s AND :e ORDER BY a.tarih"),
                    {"g": garden_id, "s": start - timedelta(days=60), "e": today},
                )
            ).all()
        ]
        days = [start + timedelta(days=i + 1) for i in range((today + timedelta(days=rule.tahmin_gun) - start).days)]
        ndvi = wb.interpolate_ndvi(days, ndvi_obs)
        inputs, sources = [], {}
        for d, nd in zip(days, ndvi, strict=True):
            r = rows.get(d)
            rain, src = (None, "yok")
            if r is not None and r["yagis_mm"] is not None:
                rain, src = float(r["yagis_mm"]), ("era5" if r["hava_kaynak"] == ERA5 else "model")
            if source == "imerg" and d < today and d in imerg_all:
                rain, src = imerg_all[d], "imerg"
            sources[d] = src
            inputs.append(wb.DayInput(d, rain, None if r is None else r["et0_mm"], wb.kc_from_ndvi(nd, rule), tahmin=d >= today))
        clims_start = await self.climatology(cell, rule, start)  # başlangıç nemi, başlangıç gününün DÖNEMİne göre normalize edilir
        fill_start = wb.root_zone_fill([rows[start][f"sm{i}"] for i in range(4)], clims_start, rule.kok_katman_agirliklari) if start in rows else None
        initial = 0.5 * (taw or 0.0) if fill_start is None else (taw or 0.0) * (1 - fill_start / 100.0)
        return (wb.simulate(inputs, taw or 0.0, initial, rule.kucuk_yagis_esigi_mm) if taw else []), sources, source, reason

    async def _thermal(self, garden_id: uuid.UUID, cell: uuid.UUID, rule: cat.SuKurali) -> YuzeyHava:
        """Son 6 Landsat geçişi; her birinin yüzey − hava farkı bahçenin AYNI AY geçmişine (p25–p75) göre değerlendirilir."""
        rows = (
            await self.session.execute(
                text(
                    "SELECT a.tarih, b.ortalama, t.ortalama, (e.saatlik->'t2m'->>CAST(:h AS int))::float8 FROM acquisitions a "
                    "JOIN acquisition_stats b ON b.acquisition_id = a.id AND b.indeks = 'st_c' "
                    "LEFT JOIN acquisition_stats t ON t.acquisition_id = a.id AND t.indeks = 'st_tampon' "
                    "LEFT JOIN era5_daily e ON e.cell_id = :c AND e.tarih = a.tarih "
                    "WHERE a.garden_id = :g AND a.source_id = 'landsat-c2-l2' AND a.durum = 'net' ORDER BY a.tarih"
                ),
                {"g": garden_id, "c": cell, "h": rule.landsat_gecis_saati},
            )
        ).all()
        history = [(day, float(garden_c) - float(air)) for day, garden_c, _, air in rows if air is not None]
        points: list[SicaklikNoktasi] = []
        for day, garden_c, buffer_c, air in rows[-6:]:
            p = wb.thermal_point(day, float(garden_c), None if buffer_c is None else float(buffer_c), None if air is None else float(air), wb.thermal_normal(history, day, rule), rule)
            normal = None if p.normal is None else SicaklikNormali(alt_c=p.normal.alt, ortanca_c=p.normal.ortanca, ust_c=p.normal.ust, sahne=p.normal.sahne, p10_c=p.normal.p10, p90_c=p.normal.p90)
            points.append(
                SicaklikNoktasi(
                    tarih=p.tarih, ay=p.ay, yuzey_bahce_c=p.yuzey_bahce_c, yuzey_tampon_c=p.yuzey_tampon_c, hava_c=p.hava_c, fark_c=p.fark_c, normal=normal, sapma_c=p.sapma_c,
                    durum=cast(Literal["ustunde", "icinde", "altinda", "yetersiz_gecmis", "bilinmiyor"], p.durum), stres=p.stres, karisik_piksel=p.karisik_piksel, bahce_tampon_fark_c=p.bahce_tampon_fark_c,
                )
            )
        return YuzeyHava(noktalar=points, karisik_piksel_esigi_c=rule.karisik_piksel_c, normal_alt_yuzde=rule.sicaklik_normal_alt, normal_ust_yuzde=rule.sicaklik_normal_ust, min_sahne=rule.sicaklik_min_sahne)
