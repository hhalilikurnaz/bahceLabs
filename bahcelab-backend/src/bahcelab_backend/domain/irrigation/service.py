"""Sulama planı servisi (ADR 0023): profil, FAO-56 plan, maliyet, sezon tekrarı ve senaryolar. Veri: era5_daily (ET0, yağış), IMERG, SoilGrids toprak,
Sentinel-2 NDVI (taç örtüsü), Saha Defteri sulama kayıtları. Katsayıların hepsi katalogda (`sulama_plani`); sayı uydurulmaz."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, replace
from datetime import UTC, date, datetime, timedelta
from typing import Any, cast
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.domain.irrigation import engine as en
from bahcelab_backend.domain.irrigation import schemas as sc
from bahcelab_backend.domain.irrigation.models import IrrigationProfileModel
from bahcelab_backend.domain.water import balance as wb
from bahcelab_backend.domain.water.era5_sync import garden_cell
from bahcelab_backend.domain.water.service import WaterService
from bahcelab_backend.domain.weather.provider import TIMEZONE
from bahcelab_backend.shared.errors import AppError, AppErrorCode

SOURCES = [
    sc.Kaynak(ad="ERA5-Land (Open-Meteo) · ET₀ FAO-56 Penman-Monteith, geçmiş", not_="günlük; önümüzdeki günler Open-Meteo tahmini"),
    sc.Kaynak(ad="GPM IMERG / ERA5 yağış", not_="kaynak seçimi su dengesiyle aynı (aylık karşılaştırma)"),
    sc.Kaynak(ad="FAO-56 Tablo 12 (narenciye Kc)", not_="ön değer · mühendis onayı bekliyor"),
    sc.Kaynak(ad="SoilGrids 2.0 + Saxton & Rawls 2006", not_="tarla kapasitesi ve solma noktası; ön değer"),
    sc.Kaynak(ad="Sentinel-2 NDVI → taç örtüsü", not_="Carlson & Ripley dönüşümü; ön değer"),
]


@dataclass
class Ctx:
    garden: Any
    profile: IrrigationProfileModel
    rule: cat.SulamaPlaniKurali
    cell: uuid.UUID
    today: date
    taw: float
    raw: float
    cover: float
    eff: float
    area_m2: float
    trees: int | None
    weather: dict[date, tuple[float | None, float | None]]
    soil_fc_wp: tuple[float, float]
    ndvi_tarih: date | None = None
    sektor_ad: str | None = None  # tanımlı sektörlerde: yalnız bu vanaya (ya da vana belirtilmemiş) kayıtlar sayılır


@dataclass
class SekRow:
    id: uuid.UUID | None
    ad: str
    sira: int
    geometry: dict[str, Any] | None
    alan_m2: float
    agac_sayisi: int | None
    agac_kaynak: str
    sira_aralik_m: float | None
    agac_aralik_m: float | None
    vana_debi_m3h: float | None


class Veri(Exception):
    """Plan kurulamıyor: neden kullanıcıya olduğu gibi gösterilir."""


def _cost_input(p: IrrigationProfileModel, rule: cat.SulamaPlaniKurali) -> en.CostInput:
    return en.CostInput(p.pompa_kw, p.pompa_debi_m3h, p.enerji, p.kwh_fiyat_tl, rule.tarife.birim_fiyat_tl_kwh, p.enerji_m3_maliyet_tl, p.su_ucreti_m3_tl)


def _mal(c: en.Cost) -> sc.MaliyetYaniti:
    return sc.MaliyetYaniti(m3=c.m3, pompa_saat=c.pompa_saat, kwh=c.kwh, enerji_tl=c.enerji_tl, su_ucreti_tl=c.su_ucreti_tl, toplam_tl=c.toplam_tl, fiyat_kaynagi=cast(Any, c.fiyat_kaynagi), eksik=c.eksik)


def _tarife(rule: cat.SulamaPlaniKurali, today: date) -> sc.TarifeBilgisi:
    t = rule.tarife
    guncel = t.birim_fiyat_tl_kwh is not None and t.gecerlilik_baslangic is not None and t.gecerlilik_baslangic <= today and (t.gecerlilik_bitis is None or today <= t.gecerlilik_bitis)
    return sc.TarifeBilgisi(
        ad=t.ad, kaynak_url=t.kaynak_url, gecerlilik_baslangic=t.gecerlilik_baslangic, gecerlilik_bitis=t.gecerlilik_bitis,
        birim_fiyat_tl_kwh=t.birim_fiyat_tl_kwh if guncel else None, guncel=guncel, mesaj=None if guncel else "Tarife güncel değil, faturanızdaki birim fiyatı girin.",
    )


class IrrigationService:
    def __init__(self, session: AsyncSession, workspace_id: uuid.UUID, today: date | None = None) -> None:
        self.today = today
        self.session = session
        self.workspace_id = workspace_id
        self.gardens = GardenRepository(session, workspace_id)

    def _today(self) -> date:
        return self.today or datetime.now(UTC).astimezone(ZoneInfo(TIMEZONE)).date()

    async def _garden(self, garden_id: uuid.UUID) -> Any:
        row = await self.gardens.get(garden_id)
        if row is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")
        return row.garden

    async def _profile(self, garden_id: uuid.UUID) -> IrrigationProfileModel | None:
        return await self.session.get(IrrigationProfileModel, garden_id)

    # ------------------------------------------------------------------ profil
    async def profile(self, garden_id: uuid.UUID) -> sc.ProfilYaniti:
        g = await self._garden(garden_id)
        p = await self._profile(garden_id)
        rule = cat.load_catalog().sulama_plani
        area = float(g.alan_dekar) * 1000.0
        expected, ok = en.tree_count_check(g.agac_sayisi, area, p.sira_aralik_m if p else None, p.agac_aralik_m if p else None, rule.agac_sayisi_tolerans)
        msg = None
        if ok is False:
            msg = f"Beyan edilen {g.agac_sayisi} ağaç, alan ve dikim aralığına göre beklenen ≈ {expected} ağaçtan %{round(rule.agac_sayisi_tolerans * 100)}'ten fazla farklı. Beyanı ya da aralığı kontrol edin."
        elif p is not None and expected is not None and ok is None:
            msg = f"Alan ve aralığa göre beklenen ≈ {expected} ağaç; ağaç sayısı beyan edilmemiş."
        tarife = _tarife(rule, self._today())
        source = "yok" if p is None else "kullanici" if p.kwh_fiyat_tl is not None else "katalog" if tarife.guncel else "yok"
        return sc.ProfilYaniti(
            profil=None if p is None else sc.ProfilGiris.model_validate(p, from_attributes=True), alan_m2=area, agac_sayisi=g.agac_sayisi,
            agac_kontrol=sc.AgacKontrol(beyan=g.agac_sayisi, beklenen=expected, tutarli=ok, mesaj=msg), tarife=tarife, fiyat_kaynagi=cast(Any, source),
        )

    async def save_profile(self, garden_id: uuid.UUID, body: sc.ProfilGiris) -> sc.ProfilYaniti:
        await self._garden(garden_id)
        values = {"garden_id": garden_id, **body.model_dump()}
        stmt = insert(IrrigationProfileModel).values(values)
        await self.session.execute(stmt.on_conflict_do_update(index_elements=["garden_id"], set_={k: v for k, v in values.items() if k != "garden_id"}))
        await self.session.flush()
        self.session.expire_all()
        return await self.profile(garden_id)

    # ------------------------------------------------------------------ bağlam
    async def _ctx(self, garden_id: uuid.UUID, profil_gerekli: bool = True) -> Ctx:
        g = await self._garden(garden_id)
        p = await self._profile(garden_id)
        if p is None:
            if profil_gerekli:
                raise Veri("profil_yok")
            p = IrrigationProfileModel(garden_id=garden_id, sistem="damla", enerji="sebeke")  # kaydedilmeyen geçici: yalnız kova (Su sekmesi); sistem verimi/TL kullanılmaz
        rule = cat.load_catalog().sulama_plani
        su_rule = cat.load_catalog().su
        today = self._today()
        area = float(g.alan_dekar) * 1000.0
        cell, _, _ = await garden_cell(self.session, garden_id)
        centroid = (await self.session.execute(text("SELECT ST_Y(ST_Centroid(geom)), ST_X(ST_Centroid(geom)) FROM gardens WHERE id = :g"), {"g": garden_id})).one()
        soil = await WaterService(self.session, self.workspace_id).ensure_soil(garden_id, float(centroid[0]), float(centroid[1]))
        if soil is None or soil["tarla_kapasitesi"] is None or soil["solma_noktasi"] is None:
            raise Veri("Toprak dokusu (SoilGrids) alınamadı; tarla kapasitesi ve solma noktası bilinmeden su kovası kurulamaz.")
        ndvi = (
            await self.session.execute(
                text(
                    "SELECT s.medyan, a.tarih FROM acquisitions a JOIN acquisition_stats s ON s.acquisition_id = a.id WHERE a.garden_id = :g AND a.source_id = 'sentinel2-l2a' "
                    "AND a.durum = 'net' AND s.indeks = 'ndvi' AND a.tarih BETWEEN :s AND :e ORDER BY a.tarih DESC LIMIT 1"
                ),
                {"g": garden_id, "s": today - timedelta(days=60), "e": today},
            )
        ).first()
        cover = en.canopy_cover_from_ndvi(None if ndvi is None else float(ndvi[0]), rule)
        if cover is None:
            raise Veri("Son 60 günde net Sentinel-2 görüntüsü yok; taç örtüsü (Kc düzeltmesi) hesaplanamıyor.")
        taw, raw = en.taw_raw_mm(float(soil["tarla_kapasitesi"]), float(soil["solma_noktasi"]), rule.kok_derinligi_cm, rule.tukenme_orani_p)
        weather = await self._weather(garden_id, cell, su_rule, today)
        return Ctx(g, p, rule, cell, today, taw, raw, cover, rule.sistem_verimi[p.sistem], area, g.agac_sayisi, weather, (float(soil["tarla_kapasitesi"]), float(soil["solma_noktasi"])), None if ndvi is None else ndvi[1])

    async def _weather(self, garden_id: uuid.UUID, cell: uuid.UUID, su_rule: cat.SuKurali, today: date) -> dict[date, tuple[float | None, float | None]]:
        rows = (
            await self.session.execute(
                text("SELECT tarih, yagis_mm, et0_mm, hava_kaynak FROM era5_daily WHERE cell_id = :c AND tarih BETWEEN :s AND :e"),
                {"c": cell, "s": date(su_rule.klima_ilk_yil, 1, 1), "e": today + timedelta(days=14)},
            )
        ).all()
        imerg = {r[0]: float(r[1]) for r in (await self.session.execute(text("SELECT tarih, deger FROM dogrulama_gozlem WHERE garden_id = :g AND source_id = 'imerg-daily' AND deger IS NOT NULL"), {"g": garden_id})).all()}
        era5 = {r[0]: float(r[1]) for r in rows if r[1] is not None and r[3] == "era5_land"}
        source, _ = wb.choose_rain_source(wb.monthly_rain(era5, imerg, su_rule.kucuk_yagis_esigi_mm))
        out: dict[date, tuple[float | None, float | None]] = {}
        for d, rain, et0, _ in rows:
            r = None if rain is None else float(rain)
            if source == "imerg" and d < today and d in imerg:
                r = imerg[d]
            out[d] = (r, None if et0 is None else float(et0))
        return out

    def _days(self, c: Ctx, days: list[date]) -> list[en.DayIn]:
        return [en.DayIn(d, *c.weather.get(d, (None, None)), tahmin=d > c.today) for d in days if d in c.weather or d <= c.today]

    # ------------------------------------------------------------------ sezon tekrarı (geçmiş yıl ya da bu yıl)
    def season_run(self, c: Ctx, year: int, *, oran: bool = False, sistem: str | None = None) -> list[en.DayOut]:
        days = [d for d in en.season_days(year, c.rule) if not (d.month == 2 and d.day == 29)]
        # bu yıl için hava verisi olan günler (geçmiş + tahmin ufku); sonrası uydurulmaz
        inputs = [x for x in self._days(c, days) if x.yagis_mm is not None or x.tarih <= c.today]
        return en.run_bucket(inputs, taw=c.taw, raw=c.raw, cover_pct=c.cover, rule=c.rule, efficiency=c.rule.sistem_verimi[sistem or c.profile.sistem], initial_dr=0.0, policy=self._policy(c, days[0], oran, sistem))

    @staticmethod
    def _policy(c: Ctx, from_date: date, oran: bool = False, sistem: str | None = None) -> en.Policy:
        prog = c.rule.sistem_programi[sistem or c.profile.sistem]
        return en.Policy(from_date=from_date, oran=en.deficit_ratio_fn(c.rule) if oran else (lambda d: 1.0), min_net_mm=prog.en_az_net_mm, tetik_mm=prog.tetik_orani * c.raw, azami_net_mm=prog.azami_net_mm)

    def _total(self, c: Ctx, rows: list[en.DayOut], eff_ci: en.CostInput) -> sc.SenaryoToplam:
        t = en.season_total(rows, c.rule)
        m3 = en.mm_to_m3(t.brut_mm, c.area_m2)
        cost = en.cost(m3, eff_ci)
        return sc.SenaryoToplam(m3=m3, kwh=cost.kwh, tl=cost.toplam_tl, sulama_sayisi=t.sulama_sayisi, stres_gun=t.stres_gun)

    # ------------------------------------------------------------------ kayıtlar
    async def _applied(self, c: Ctx, since: date) -> tuple[dict[date, float], dict[date, float], int, int]:
        """(net mm, brüt mm, kayıt sayısı, miktarı olmayan kayıt). Miktar: ayrinti.m3 ya da ayrinti.sure_dk (damlatıcı bilgisiyle); yoksa SAYILMAZ."""
        raw_rows = (await self.session.execute(text("SELECT tarih, ayrinti FROM field_records WHERE garden_id = :g AND tur = 'sulama' AND tarih >= :s"), {"g": c.garden.id, "s": since})).all()
        net: dict[date, float] = {}
        gross: dict[date, float] = {}
        missing = 0
        p = c.profile
        rows: list[tuple[date, dict[str, Any] | None]] = [(r[0], r[1]) for r in raw_rows if c.sektor_ad is None or (r[1] or {}).get("sektor") in (None, c.sektor_ad)]
        for d, ay in rows:
            ay = ay or {}
            mm = None
            if isinstance(ay.get("m3"), (int, float)) and ay["m3"] > 0:
                mm = ay["m3"] * 1000.0 / c.area_m2
            elif isinstance(ay.get("sure_dk"), (int, float)) and ay["sure_dk"] > 0 and p.damlatici_sayisi and p.damlatici_debi_lh and c.trees:
                mm = ay["sure_dk"] / 60.0 * p.damlatici_sayisi * p.damlatici_debi_lh * c.trees / c.area_m2
            if mm is None:
                missing += 1
                continue
            gross[d] = gross.get(d, 0.0) + mm
            net[d] = net.get(d, 0.0) + mm * c.eff
        return net, gross, len(rows), missing

    # ------------------------------------------------------------------ ortak kova (Su sekmesi ve plan AYNI hesabı kullanır)
    async def _pencere(self, c: Ctx, politika: bool) -> tuple[list[en.DayOut], list[en.DayIn], float, float | None, dict[date, float], dict[date, float], int, int, Any, list[wb.Climatology]]:
        """Gerçek zamanlı pencere: son `gecmis_gun` gün + `planlama_gun` ileri. Başlangıç eksiği ERA5-Land kök bölgesi doluluğundan (SMAP değil: o yalnız doğrulama);
        uygulanan sulama Saha Defteri kayıtlarından. `politika`: bugünden itibaren sulama önerisi eklenir."""
        su_rule = cat.load_catalog().su
        today = c.today
        start = today - timedelta(days=su_rule.gecmis_gun)
        window = [start + timedelta(days=i + 1) for i in range((today + timedelta(days=c.rule.planlama_gun) - start).days)]
        clims = await WaterService(self.session, self.workspace_id).climatology(c.cell, su_rule, start)
        fill_row = (await self.session.execute(text("SELECT sm0, sm1, sm2, sm3 FROM era5_daily WHERE cell_id = :c AND tarih = :d AND toprak_kaynak = 'era5_land'"), {"c": c.cell, "d": start})).first()
        fill = wb.root_zone_fill(list(fill_row), clims, su_rule.kok_katman_agirliklari) if fill_row else None
        initial = 0.5 * c.taw if fill is None else c.taw * (1 - fill / 100.0)
        applied_net, applied_gross, n_records, missing = await self._applied(c, date(today.year, 1, 1))
        inputs = self._days(c, window)
        rows = en.run_bucket(inputs, taw=c.taw, raw=c.raw, cover_pct=c.cover, rule=c.rule, efficiency=c.eff, initial_dr=initial, applied_net_mm=applied_net, policy=self._policy(c, today) if politika else None)
        return rows, inputs, initial, fill, applied_net, applied_gross, n_records, missing, start, clims

    async def kova(self, garden_id: uuid.UUID) -> tuple[list[en.DayOut], float, float] | None:
        """Su sekmesi için politikasız kova (satırlar, TAW, RAW); plan kurulamıyorsa (toprak ya da taç örtüsü verisi yok) None."""
        try:
            c = await self._ctx(garden_id, profil_gerekli=False)
        except Veri:
            return None
        rows = (await self._pencere(c, False))[0]
        return rows, c.taw, c.raw

    # ------------------------------------------------------------------ plan
    async def plan(self, garden_id: uuid.UUID, hafif: bool = False) -> sc.PlanYaniti:
        today = self._today()
        try:
            c = await self._ctx(garden_id)
        except Veri as v:
            if str(v) == "profil_yok":
                return sc.PlanYaniti(durum="profil_yok", neden="Sulama profili henüz kurulmadı.", bugun=today, katalog_surum=cat.load_catalog().surum)
            return sc.PlanYaniti(durum="veri_yok", neden=str(v), bugun=today, katalog_surum=cat.load_catalog().surum)
        rule, su_rule = c.rule, cat.load_catalog().su
        rows, inputs, initial, fill, applied_net, applied_gross, n_records, missing, start, clims = await self._pencere(c, True)
        wsvc = WaterService(self.session, self.workspace_id)
        # plansız karşılaştırma: aynı pencere, uygulanan sulama olmadan her gün plan → sapma
        ref = en.run_bucket([x for x in inputs if x.tarih <= today], taw=c.taw, raw=c.raw, cover_pct=c.cover, rule=rule, efficiency=c.eff, initial_dr=initial, policy=self._policy(c, start))
        last14 = today - timedelta(days=14)
        planned14 = sum(x.planli_net_mm for x in ref if x.tarih > last14)
        applied14 = sum(v for d, v in applied_net.items() if last14 < d <= today)
        sapma = (applied14 - planned14) if n_records > 0 else None
        uyarilar: list[sc.Uyari] = []
        prof = await self.profile(garden_id)
        if prof.agac_kontrol.mesaj:
            uyarilar.append(sc.Uyari(kod="agac_sayisi", mesaj=prof.agac_kontrol.mesaj))
        if c.trees is None:
            uyarilar.append(sc.Uyari(kod="agac_sayisi_yok", mesaj="Ağaç sayısı beyan edilmediği için ağaç başına litre ve damlatıcı süresi gösterilmiyor."))
        if c.profile.sistem == "damla" and not (c.profile.damlatici_sayisi and c.profile.damlatici_debi_lh):
            uyarilar.append(sc.Uyari(kod="damlatici_yok", mesaj="Damlatıcı sayısı ve debisi girilmediği için süre hesaplanamıyor."))
        # kova ↔ ERA5-Land: AYNI gün karşılaştırılır (Su sekmesindeki gözlem günü: sm0'ı olan son gün, model satırları dahil)
        obs = (await self.session.execute(text("SELECT tarih, sm0, sm1, sm2, sm3 FROM era5_daily WHERE cell_id = :c AND sm0 IS NOT NULL AND tarih <= :d ORDER BY tarih DESC LIMIT 1"), {"c": c.cell, "d": today})).first()
        if obs is not None:
            at = next((x for x in rows if x.tarih == obs[0]), None)
            fill_obs = wb.root_zone_fill(list(obs[1:]), await wsvc.climatology(c.cell, su_rule, obs[0]), su_rule.kok_katman_agirliklari)
            dr_obs = None if fill_obs is None else c.taw * (1 - fill_obs / 100.0)
            if at is not None and not at.veri_eksik and en.soil_check(at.tukenme_mm, dr_obs, rule.ilk_nem_sapma_uyari_mm):
                uyarilar.append(sc.Uyari(kod="nem_farki", mesaj=f"{obs[0].day}.{obs[0].month}: kova ({at.tukenme_mm:.0f} mm eksik) ile ERA5-Land toprak nemi ({cast(float, dr_obs):.0f} mm eksik) arasında {abs(at.tukenme_mm - cast(float, dr_obs)):.0f} mm fark var; ölçümünüzle kontrol edin."))
        if missing:
            uyarilar.append(sc.Uyari(kod="miktarsiz_kayit", mesaj=f"{missing} sulama kaydında süre ya da m³ yok; bu kayıtlar su dengesine eklenmedi."))
        if prof.profil is not None and prof.fiyat_kaynagi == "yok" and prof.profil.enerji == "sebeke":
            uyarilar.append(sc.Uyari(kod="tarife_yok", mesaj="Tarife güncel değil, faturanızdaki birim fiyatı girin."))

        def sulama(x: en.DayOut) -> sc.Sulama:
            t = en.per_tree(x.planli_brut_mm, c.area_m2, c.trees, c.profile.damlatici_sayisi, c.profile.damlatici_debi_lh) if c.profile.sistem == "damla" else None
            m3 = en.mm_to_m3(x.planli_brut_mm, c.area_m2)
            return sc.Sulama(tarih=x.tarih, net_mm=x.planli_net_mm, brut_mm=x.planli_brut_mm, m3_bahce=m3, m3_dekar=m3 / (c.area_m2 / 1000.0), litre_agac=None if t is None else t.litre_agac, emitor_dakika=None if t is None else t.emitor_dakika)

        sul = [sulama(x) for x in rows if x.planli_net_mm > 0 and x.tarih >= today]
        seks = await self._sektor_satirlari(garden_id, c.garden, c.area_m2)
        if any(x.id is not None for x in seks):  # tanımlı vanalar: «sonraki sulama» vanaların en erkeni; miktar toplamı (ağaç başına değerler vana bazında, panelde)
            toplam: dict[date, list[float]] = {}
            for x, _, rr in await self._sektor_kovalari(c, seks, True):
                for r in rr:
                    if r.planli_net_mm > 0 and r.tarih >= today:
                        tt = toplam.setdefault(r.tarih, [0.0, 0.0])
                        tt[0] += en.mm_to_m3(r.planli_brut_mm, x.alan_m2)
                        tt[1] += r.planli_net_mm * x.alan_m2
            alan = sum(x.alan_m2 for x in seks)
            sul = [sc.Sulama(tarih=d, net_mm=v[1] / alan, brut_mm=v[0] * 1000.0 / alan, m3_bahce=v[0], m3_dekar=v[0] / (alan / 1000.0), litre_agac=None, emitor_dakika=None) for d, v in sorted(toplam.items())]
        week_m3 = sum(s.m3_bahce for s in sul if s.tarih < today + timedelta(days=7))
        # sezon projeksiyonu: geçmiş yılların GERÇEK havasıyla aynı plan; tek sayı değil aralık
        ci = _cost_input(c.profile, rule)
        years = [] if hafif else [y for y in range(rule.gecmis_ilk_yil, rule.gecmis_son_yil + 1) if any(d.year == y for d in c.weather)]
        m3s, tls = [], []
        for y in years:
            t = self._total(c, self.season_run(c, y), ci)
            m3s.append(t.m3)
            if t.tl is not None:
                tls.append(t.tl)
        r3 = en.percentile_range(m3s, rule.projeksiyon_alt, rule.projeksiyon_ust)
        rt = en.percentile_range(tls, rule.projeksiyon_alt, rule.projeksiyon_ust) if len(tls) == len(m3s) else None
        proj = sc.SezonProjeksiyon(yil_sayisi=len(years), ilk_yil=rule.gecmis_ilk_yil, son_yil=rule.gecmis_son_yil, m3=None if r3 is None else sc.Aralik(alt=r3[0], orta=r3[1], ust=r3[2]), tl=None if rt is None else sc.Aralik(alt=rt[0], orta=rt[1], ust=rt[2]), alt_yuzde=rule.projeksiyon_alt, ust_yuzde=rule.projeksiyon_ust)
        # aylık çubuklar: bu yıl (plan; uygulanan kayıtlar) ve geçen yıl planı
        this_year = [] if hafif else self.season_run(c, today.year)
        last_year = [] if hafif or not any(d.year == today.year - 1 for d in c.weather) else self.season_run(c, today.year - 1)
        def monthly(rs: list[en.DayOut]) -> dict[int, float]:
            o: dict[int, float] = {}
            for x in rs:
                o[x.tarih.month] = o.get(x.tarih.month, 0.0) + en.mm_to_m3(x.planli_brut_mm, c.area_m2)
            return o
        mt, ml = monthly(this_year), monthly(last_year)
        horizon = max((x.tarih for x in this_year), default=today)
        applied_m: dict[int, float] = {}
        for d, g in applied_gross.items():
            applied_m[d.month] = applied_m.get(d.month, 0.0) + en.mm_to_m3(g, c.area_m2)
        aylik = [sc.AyCubugu(ay=m, plan_m3=mt.get(m, 0.0), uygulanan_m3=applied_m.get(m) if n_records > 0 else None, gecen_yil_plan_m3=ml.get(m) if last_year else None, tahmin=date(today.year, m, 1) > today and m not in {x.tarih.month for x in this_year if x.tarih <= horizon}) for m in sorted(set(mt) | set(ml))]
        kc_now = en.kc_monthly(today.month, c.cover, rule)
        return sc.PlanYaniti(
            durum="hazir", neden=None, bugun=today, taw_mm=c.taw, raw_mm=c.raw, orten_yuzde=c.cover, kc_bugun=kc_now, sistem_verimi=c.eff,
            gunler=[sc.PlanGunu(tarih=x.tarih, yagis_mm=None if x.veri_eksik else x.yagis_mm, etkili_yagis_mm=None if x.veri_eksik else x.etkili_yagis_mm, etc_mm=None if x.veri_eksik else x.etc_mm, uygulanan_net_mm=x.uygulanan_net_mm, planli_net_mm=x.planli_net_mm, planli_brut_mm=x.planli_brut_mm, tukenme_mm=x.tukenme_mm, tahmin=x.tahmin, veri_eksik=x.veri_eksik) for x in rows],
            sulamalar=sul, sonraki=sul[0] if sul else None, uyarilar=uyarilar, hafta_maliyet=_mal(en.cost(week_m3, ci)),
            planlanan_bugune_kadar_m3=sum(en.mm_to_m3(x.planli_brut_mm, c.area_m2) for x in this_year if x.tarih <= today) if this_year else None,
            uygulanan_sezon_m3=sum(en.mm_to_m3(g, c.area_m2) for g in applied_gross.values()) if n_records > 0 else None, uygulanan_kayit_sayisi=n_records,
            sapma_mm=sapma, sapma_ciddi=sapma is not None and abs(sapma) > rule.sapma_bildirim_mm, projeksiyon=proj, aylik=aylik, kaynaklar=SOURCES, katalog_surum=cat.load_catalog().surum,
        )

    # ------------------------------------------------------------------ sezon (animasyon ve kuru/ıslak yıl)
    async def season(self, garden_id: uuid.UUID, year: int | None) -> sc.SezonYaniti:
        try:
            c = await self._ctx(garden_id)
        except Veri as v:
            raise AppError(409, AppErrorCode.VALIDATION_ERROR, "Sulama profili ya da veri eksik." if str(v) == "profil_yok" else str(v)) from v
        y = year or c.today.year
        rows = self.season_run(c, y)
        if not rows:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bu yıl için hava verisi yok.")
        ci = _cost_input(c.profile, c.rule)
        cum = 0.0
        out: list[sc.SezonGunu] = []
        for x in rows:
            cum += en.mm_to_m3(x.planli_brut_mm, c.area_m2)
            tl = en.cost(cum, ci).toplam_tl
            out.append(sc.SezonGunu(tarih=x.tarih, tukenme_mm=x.tukenme_mm, yagis_mm=x.yagis_mm, brut_mm=x.planli_brut_mm, kumulatif_m3=cum, kumulatif_tl=tl, stres=x.stres))
        t = en.season_total(rows, c.rule)
        return sc.SezonYaniti(yil=y, taw_mm=c.taw, raw_mm=c.raw, gunler=out, toplam_m3=cum, toplam_tl=out[-1].kumulatif_tl, sulama_sayisi=t.sulama_sayisi, yagis_mm=sum(x.yagis_mm for x in rows), stres_gun=t.stres_gun, tahmin_dahil=y >= c.today.year)

    # ------------------------------------------------------------------ senaryolar
    async def scenarios(self, garden_id: uuid.UUID, *, yil: int | None, gunler: list[int], saat: float | None, hedef: str | None, yatirim_tl: float | None) -> sc.SenaryoYaniti:
        try:
            c = await self._ctx(garden_id)
        except Veri as v:
            return sc.SenaryoYaniti(durum="profil_yok" if str(v) == "profil_yok" else "veri_yok", neden="Sulama profili henüz kurulmadı." if str(v) == "profil_yok" else str(v))
        rule = c.rule
        y = yil or min(c.today.year - 1, rule.gecmis_son_yil)
        if not rule.gecmis_ilk_yil <= y <= c.today.year:
            raise AppError(422, AppErrorCode.VALIDATION_ERROR, f"Yıl {rule.gecmis_ilk_yil}–{c.today.year} arasında olmalı.")
        ci = _cost_input(c.profile, rule)
        plan_rows = self.season_run(c, y)
        if not plan_rows:
            return sc.SenaryoYaniti(durum="veri_yok", neden=f"{y} için hava verisi yok.")
        plan_t = self._total(c, plan_rows, ci)
        # 1) alışkanlık
        habit = None
        p = c.profile
        if gunler and saat and p.damlatici_sayisi and p.damlatici_debi_lh and c.trees:
            days = [x.tarih for x in plan_rows]
            ap = en.habit_applied(days, gunler, saat, c.trees, p.damlatici_sayisi, p.damlatici_debi_lh, c.area_m2, c.eff)
            inputs = [en.DayIn(x.tarih, x.yagis_mm, x.et0_mm) for x in plan_rows if not x.veri_eksik]
            hrows = en.run_bucket(inputs, taw=c.taw, raw=c.raw, cover_pct=c.cover, rule=rule, efficiency=c.eff, initial_dr=0.0, applied_net_mm=ap)
            gross = sum(ap.values()) / c.eff
            m3 = en.mm_to_m3(gross, c.area_m2)
            hc = en.cost(m3, ci)
            ht = sc.SenaryoToplam(m3=m3, kwh=hc.kwh, tl=hc.toplam_tl, sulama_sayisi=len(ap), stres_gun=sum(1 for x in hrows if x.stres))
            diff = ht.m3 - plan_t.m3
            habit = sc.AliskanlikSonuc(
                yil=y, plan=plan_t, aliskanlik=ht, fark_m3=diff, fark_tl=None if ht.tl is None or plan_t.tl is None else ht.tl - plan_t.tl,
                ozet=f"{y} havasında alışkanlığınız plandan {abs(diff):.0f} m³ {'fazla' if diff > 0 else 'az'} su verir; stres günü {ht.stres_gun} (plan: {plan_t.stres_gun}).",
            )
        # 2) kuru / ıslak yıl
        results = []
        for yy in range(rule.gecmis_ilk_yil, c.today.year + 1):
            r = self.season_run(c, yy)
            if not r or yy == c.today.year:
                continue
            t = self._total(c, r, ci)
            results.append(sc.YilSonucu(yil=yy, m3=t.m3, tl=t.tl, yagis_mm=sum(x.yagis_mm for x in r), et0_mm=sum(x.et0_mm for x in r)))
        selected = next((r for r in results if r.yil == y), None)
        median = sorted(results, key=lambda r: r.m3)[len(results) // 2] if results else None
        dry = None
        if selected is not None:
            dry = sc.KuruIslakSonuc(secili=selected, ortanca=median, yillar=results, fark_m3=None if median is None else selected.m3 - median.m3, fark_tl=None if median is None or selected.tl is None or median.tl is None else selected.tl - median.tl)
        # 3) kısıntı
        full_days = [x.tarih for x in plan_rows]
        risk = en.deficit_risk(rule, full_days)
        locked = [sc.KilitliDonem(kod=d.kod, ad=d.ad, baslangic=d.baslangic, bitis=d.bitis, mesaj="Bu dönemde önerilmez.") for d in rule.kisitli_donemler if d.durum == "kilitli"]
        approved = [d.ad for d in rule.kisitli_donemler if d.durum == "onayli"]
        deficit_t = self._total(c, self.season_run(c, y, oran=True), ci) if approved else None
        kisinti = sc.KisintiSonuc(
            yil=y, uygulanabilir=deficit_t is not None, tam=plan_t, kisintili=deficit_t,
            tasarruf_m3=None if deficit_t is None else plan_t.m3 - deficit_t.m3, tasarruf_tl=None if deficit_t is None or plan_t.tl is None or deficit_t.tl is None else plan_t.tl - deficit_t.tl,
            verim_riski=cast(Any, risk), kilitli_donemler=locked, onayli_donemler=approved,
            mesaj="Kısıntı yalnız katalogda onaylı dönemde (" + ", ".join(approved) + ") uygulanır; çiçeklenme–meyve tutumu ve hızlı meyve büyümesinde kilitlidir. Varsayılan plan değildir." if approved else "Katalogda onaylı kısıntı dönemi yok.",
        )
        # 4) sistem değişikliği
        sistem = None
        if hedef in rule.sistem_verimi and hedef != p.sistem:
            ht = self._total(c, self.season_run(c, y, sistem=hedef), ci)
            saving = None if plan_t.tl is None or ht.tl is None else plan_t.tl - ht.tl
            pb = en.payback(yatirim_tl, saving)
            sistem = sc.SistemSonuc(
                yil=y, mevcut=cast(Any, p.sistem), hedef=cast(Any, hedef), mevcut_toplam=plan_t, hedef_toplam=ht, fark_m3=ht.m3 - plan_t.m3, fark_kwh=None if ht.kwh is None or plan_t.kwh is None else ht.kwh - plan_t.kwh,
                fark_tl=None if saving is None else -saving, yatirim_tl=yatirim_tl, geri_odeme_sezon=pb.sezon,
                not_="Aynı pompa ve basınç varsayılır (kWh yalnız m³ ile orantılı değişir); yatırım bedeli sizin girdiğiniz değerdir.",
            )
        return sc.SenaryoYaniti(durum="hazir", neden=None, aliskanlik=habit, kuru_islak=dry, kisinti=kisinti, sistem=sistem, kaynaklar=SOURCES)

    # ================================================================== sektörler (vana) · 9H-S4
    async def sektor_listesi(self, garden_id: uuid.UUID) -> sc.SektorlerYaniti:
        g = await self._garden(garden_id)
        seks = await self._sektor_satirlari(garden_id, g, float(g.alan_dekar) * 1000.0)
        tanimli = any(x.id is not None for x in seks)
        return sc.SektorlerYaniti(
            tanimli=tanimli, sektorler=[self._kayit(x) for x in seks],
            not_=None if tanimli else "Sektör çizilmedi: bahçe tek sektör olarak hesaplanır. Haritada parseli bölerek vana sektörleri tanımlayabilirsiniz.",
        )

    @staticmethod
    def _kayit(x: SekRow) -> sc.SektorKaydi:
        return sc.SektorKaydi(id=x.id, ad=x.ad, geometry=x.geometry, alan_m2=x.alan_m2, alan_dekar=x.alan_m2 / 1000.0, agac_sayisi=x.agac_sayisi, agac_kaynak=cast(Any, x.agac_kaynak), sira_aralik_m=x.sira_aralik_m, agac_aralik_m=x.agac_aralik_m, vana_debi_m3h=x.vana_debi_m3h)

    async def _sektor_satirlari(self, garden_id: uuid.UUID, g: Any, garden_area: float) -> list[SekRow]:
        rows = (
            await self.session.execute(
                text("SELECT id, ad, sira, ST_AsGeoJSON(geom), alan_m2, agac_sayisi, sira_aralik_m, agac_aralik_m, vana_debi_m3h FROM irrigation_sectors WHERE garden_id = :g ORDER BY sira, ad"), {"g": garden_id}
            )
        ).all()
        if not rows:
            return [SekRow(None, "Bahçe", 0, None, garden_area, g.agac_sayisi, "beyan" if g.agac_sayisi else "yok", None, None, None)]
        out = []
        for r in rows:
            if r[5] is not None:
                trees, kaynak = int(r[5]), "sektor"
            elif g.agac_sayisi:
                trees, kaynak = round(g.agac_sayisi * float(r[4]) / garden_area), "orantili"
            else:
                trees, kaynak = None, "yok"
            out.append(SekRow(r[0], r[1], r[2], json.loads(r[3]), float(r[4]), trees, kaynak, r[6], r[7], r[8]))
        return out

    async def sektorleri_kaydet(self, garden_id: uuid.UUID, body: sc.SektorlerGirdisi) -> sc.SektorlerYaniti:
        """Sektörleri TOPLU değiştirir. Doğrulama: geçerli çokgen, bahçenin içinde (el çiziminde %2 taşma payı), sektörler birbirine binmez (%2), adlar tekil. Boş liste = sektörleri sil (bahçe tek sektör)."""
        await self._garden(garden_id)
        adlar = [x.ad.strip() for x in body.sektorler]
        if len(set(adlar)) != len(adlar) or any(not a for a in adlar):
            raise AppError(422, AppErrorCode.VALIDATION_ERROR, "Vana adları boş olmamalı ve tekrar etmemeli.")
        await self.session.execute(text("DELETE FROM irrigation_sectors WHERE garden_id = :g"), {"g": garden_id})
        gj: list[str] = []
        for i, x in enumerate(body.sektorler):
            geo = json.dumps(x.geometry)
            chk = (
                await self.session.execute(
                    text(
                        "SELECT ST_IsValid(s.g), ST_GeometryType(s.g), ST_Area(s.g::geography), "
                        "ST_Area(ST_Difference(s.g, gd.geom)::geography) FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(:geo), 4326) AS g) s, gardens gd WHERE gd.id = :gid"
                    ),
                    {"geo": geo, "gid": garden_id},
                )
            ).one()
            if not chk[0] or chk[1] != "ST_Polygon" or chk[2] <= 0:
                raise AppError(422, AppErrorCode.VALIDATION_ERROR, f"{x.ad}: geçerli bir çokgen değil.")
            if chk[3] > 0.02 * chk[2]:
                raise AppError(422, AppErrorCode.VALIDATION_ERROR, f"{x.ad}: sektör bahçenin dışına taşıyor.")
            for j, prev in enumerate(gj):
                ov = (await self.session.execute(text("SELECT ST_Area(ST_Intersection(ST_SetSRID(ST_GeomFromGeoJSON(:a), 4326), ST_SetSRID(ST_GeomFromGeoJSON(:b), 4326))::geography)"), {"a": prev, "b": geo})).scalar() or 0.0
                if ov > 0.02 * min(chk[2], (await self.session.execute(text("SELECT ST_Area(ST_SetSRID(ST_GeomFromGeoJSON(:a), 4326)::geography)"), {"a": prev})).scalar_one()):
                    raise AppError(422, AppErrorCode.VALIDATION_ERROR, f"{x.ad} ile {adlar[j]} birbirine biniyor.")
            gj.append(geo)
            await self.session.execute(
                text(
                    "INSERT INTO irrigation_sectors (id, garden_id, ad, sira, geom, alan_m2, agac_sayisi, sira_aralik_m, agac_aralik_m, vana_debi_m3h) "
                    "VALUES (gen_random_uuid(), :g, :ad, :sira, ST_SetSRID(ST_GeomFromGeoJSON(:geo), 4326), :alan, :ag, :sa, :aa, :vd)"
                ),
                {"g": garden_id, "ad": x.ad.strip(), "sira": i, "geo": geo, "alan": float(chk[2]), "ag": x.agac_sayisi, "sa": x.sira_aralik_m, "aa": x.agac_aralik_m, "vd": x.vana_debi_m3h},
            )
        await self.session.flush()
        return await self.sektor_listesi(garden_id)

    # ------------------------------------------------------------------ sektör bazında kova
    def _sektor_ctx(self, c: Ctx, x: SekRow) -> Ctx:
        return replace(c, area_m2=x.alan_m2, trees=x.agac_sayisi, sektor_ad=x.ad if x.id is not None else None)

    async def _sektor_kovalari(self, c: Ctx, seks: list[SekRow], politika: bool) -> list[tuple[SekRow, Ctx, list[en.DayOut]]]:
        out = []
        for x in seks:
            cs = self._sektor_ctx(c, x)
            out.append((x, cs, (await self._pencere(cs, politika))[0]))
        return out

    @staticmethod
    def _pct(taw: float, dr: float) -> float:
        return max(0.0, min(100.0, (taw - dr) / taw * 100.0))

    @staticmethod
    def _etiket(pct: float, rule: cat.SulamaPlaniKurali) -> str:
        return "stres" if pct < rule.durum_stres_alt else "yakin" if pct < rule.durum_yakin_ust else "yeterli" if pct < rule.durum_yeterli_ust else "dolu"

    # ------------------------------------------------------------------ panel (Bugün sekmesi, KPI, harita etiketi, Su kartı AYNI kovadan)
    async def panel(self, garden_id: uuid.UUID, user_id: uuid.UUID | None = None) -> sc.PanelYaniti:
        plan = await self.plan(garden_id)
        today = plan.bugun
        if plan.durum != "hazir":
            return sc.PanelYaniti(durum=plan.durum, neden=plan.neden, bugun=today, katalog_surum=plan.katalog_surum)
        c = await self._ctx(garden_id)
        rule = c.rule
        g = c.garden
        seks = await self._sektor_satirlari(garden_id, g, c.area_m2)
        tanimli = any(x.id is not None for x in seks)
        policy_runs = await self._sektor_kovalari(c, seks, True)
        free_runs = await self._sektor_kovalari(c, seks, False)
        prog = rule.sistem_programi[c.profile.sistem]
        toplam_alan = sum(x.alan_m2 for x in seks)
        a0, a1 = today - timedelta(days=14), today + timedelta(days=7)
        durumlar: list[sc.SektorDurumu] = []
        for (x, cs, rows), (_, _, free) in zip(policy_runs, free_runs, strict=True):
            gunler = []
            for r in rows:
                if not a0 <= r.tarih <= a1:
                    continue
                gunler.append(
                    sc.SektorGunu(
                        tarih=r.tarih, doluluk_pct=None if r.veri_eksik else self._pct(c.taw, r.tukenme_mm), etc_mm=None if r.veri_eksik else r.etc_mm, eta_mm=None if r.veri_eksik else r.eta_mm,
                        net_mm=r.uygulanan_net_mm + r.planli_net_mm, brut_mm=r.planli_brut_mm + (r.uygulanan_net_mm / c.eff), yagis_mm=None if r.veri_eksik else r.yagis_mm,
                        etkili_yagis_mm=None if r.veri_eksik else r.etkili_yagis_mm, bosa_mm=r.bosa_giden_mm, ks=None if r.veri_eksik else r.ks, planli=r.planli_net_mm > 0, uygulandi=r.uygulanan_net_mm > 0, tahmin=r.tahmin, veri_eksik=r.veri_eksik,
                    )
                )
            now = next((r for r in rows if r.tarih == today), None)
            pct = None if now is None or now.veri_eksik else self._pct(c.taw, now.tukenme_mm)
            sonraki = next((r.tarih for r in rows if r.tarih >= today and r.planli_net_mm > 0), None)
            alti = any(r.stres for r in free if today <= r.tarih <= today + timedelta(days=7) and not r.veri_eksik)
            durumlar.append(
                sc.SektorDurumu(
                    id=x.id, ad=x.ad, alan_dekar=x.alan_m2 / 1000.0, agac_sayisi=x.agac_sayisi, agac_kaynak=cast(Any, x.agac_kaynak), vana_debi_m3h=x.vana_debi_m3h, doluluk_pct=pct,
                    etiket=None if pct is None else cast(Any, self._etiket(pct, rule)), sonraki_sulama=sonraki, esik_alti_7gun=alti, gunler=gunler,
                )
            )
        # ---- KPI
        sonrakiler = [(d.sonraki_sulama, d.ad) for d in durumlar if d.sonraki_sulama is not None]
        kpi_sonraki = None
        if sonrakiler:
            ilk = min(t for t, _ in sonrakiler)
            kpi_sonraki = sc.KpiSonraki(tarih=ilk, gun_sonra=(ilk - today).days, vanalar=[a for t, a in sonrakiler if t == ilk])
        etc7 = eta7 = 0.0
        for (x, _, rows) in policy_runs:
            w = x.alan_m2 / toplam_alan
            for r in rows:
                if today - timedelta(days=6) <= r.tarih <= today and not r.veri_eksik:
                    etc7 += w * r.etc_mm
                    eta7 += w * r.eta_mm
        ihtiyac = None if etc7 <= 0 else min(100.0, eta7 / etc7 * 100.0)
        renk = None if ihtiyac is None else "yesil" if ihtiyac >= rule.ihtiyac_yesil_min else "sari" if ihtiyac >= rule.ihtiyac_sari_min else "kirmizi"
        sezon_m3 = plan.uygulanan_sezon_m3 if plan.uygulanan_sezon_m3 is not None else plan.planlanan_bugune_kadar_m3
        ortanca = plan.projeksiyon.m3.orta if plan.projeksiyon and plan.projeksiyon.m3 else None
        kpi = sc.PanelKpi(
            sonraki=kpi_sonraki, ihtiyac_karsilandi_pct=ihtiyac, ihtiyac_renk=cast(Any, renk), sezon_m3=sezon_m3, sezon_hedef_pct=None if sezon_m3 is None or not ortanca else sezon_m3 / ortanca * 100.0,
            sezon_kaynak=None if sezon_m3 is None else ("uygulanan" if plan.uygulanan_sezon_m3 is not None else "planlanan"),
        )
        # ---- 7 gün şeridi
        hafta = []
        for k in range(7):
            d = today + timedelta(days=k)
            prs = [(x, next((r for r in rows if r.tarih == d), None)) for x, _, rows in policy_runs]
            dolu = [(x, r) for x, r in prs if r is not None and not r.veri_eksik]
            ort = None if not dolu else sum(x.alan_m2 * self._pct(c.taw, r.tukenme_mm) for x, r in dolu) / sum(x.alan_m2 for x, _ in dolu)
            hafta.append(sc.Hafta7Gunu(tarih=d, ort_doluluk_pct=ort, yagis_mm=c.weather.get(d, (None, None))[0], sulama=any(r is not None and r.planli_net_mm > 0 for _, r in prs)))
        # ---- vardiya (en yakın sulama günü)
        vardiya = None
        onayli_tarih = None
        if kpi_sonraki is not None:
            vardiya = await self._vardiya(c, policy_runs, kpi_sonraki.tarih, garden_id)
            onayli_tarih = kpi_sonraki.tarih if vardiya.onayli else None
        dusuk = min((d for d in durumlar if d.doluluk_pct is not None), key=lambda d: cast(float, d.doluluk_pct), default=None)
        guven = self._guven(c)
        return sc.PanelYaniti(
            durum="hazir", neden=None, bugun=today, taw_mm=c.taw, raw_mm=c.raw, stres_pct=rule.durum_stres_alt, yakin_pct=rule.durum_yakin_ust, yeterli_pct=rule.durum_yeterli_ust,
            tetik_pct=self._pct(c.taw, prog.tetik_orani * c.raw), sektorler=durumlar, sektor_tanimli=tanimli, kpi=kpi, hafta=hafta, vardiya=vardiya,
            en_dusuk=None if dusuk is None else {"ad": dusuk.ad, "pct": dusuk.doluluk_pct}, esik_alti_sektorler=[d.ad for d in durumlar if d.esik_alti_7gun], uyarilar=plan.uyarilar, guven=guven,
            kaynaklar=plan.kaynaklar, yagis_vurgu_mm=rule.yagis_vurgu_mm, katalog_surum=plan.katalog_surum, onayli_tarih=onayli_tarih,
        )

    def _guven(self, c: Ctx) -> sc.Guven:
        """Güven etiketi (ADR 0024): 5 koşuldan kaçı sağlanıyor → düşük / orta / yüksek; eşikler katalogda."""
        rule, p = c.rule, c.profile
        son_gozlem = max((d for d, (r, _) in c.weather.items() if d <= c.today and r is not None), default=None)
        kos = [
            ("Uydu görüntüsü taze", c.ndvi_tarih is not None and (c.today - c.ndvi_tarih).days <= rule.guven_ndvi_taze_gun, None if c.ndvi_tarih is None else f"son net görüntü {(c.today - c.ndvi_tarih).days} gün önce"),
            ("Hava verisi taze", son_gozlem is not None and (c.today - son_gozlem).days <= rule.guven_hava_taze_gun, None if son_gozlem is None else f"son gün {son_gozlem}"),
            ("Ağaç sayısı beyan edilmiş", c.garden.agac_sayisi is not None, None),
            ("Sulama sistemi bilgisi tam", p.sistem != "damla" or bool(p.damlatici_sayisi and p.damlatici_debi_lh), None),
            ("Pompa bilgisi tam", bool(p.pompa_kw and p.pompa_debi_m3h), None),
        ]
        puan = sum(1 for _, ok, _ in kos if ok)
        etiket = "yuksek" if puan >= rule.guven_yuksek_min else "orta" if puan >= rule.guven_orta_min else "dusuk"
        return sc.Guven(etiket=cast(Any, etiket), puan=puan, toplam=len(kos), kosullar=[{"ad": a, "ok": ok, "not": n} for a, ok, n in kos])

    async def _vardiya(self, c: Ctx, runs: list[tuple[SekRow, Ctx, list[en.DayOut]]], gun: date, garden_id: uuid.UUID, onay_ara: bool = True) -> sc.Vardiya:
        """Sulama günü vardiya çizelgesi: en kuru vana önce; süre = brüt m³ ÷ debi (vana debisi varsa onun ve pompanın küçüğü, yoksa pompa). Başlangıç profildeki saat (varsayılan 05:00). Debi yoksa saat/süre YOK."""
        items = []
        for x, cs, rows in runs:
            r = next((r for r in rows if r.tarih == gun and r.planli_net_mm > 0), None)
            if r is None:
                continue
            m3 = en.mm_to_m3(r.planli_brut_mm, x.alan_m2)
            t = en.per_tree(r.planli_brut_mm, x.alan_m2, x.agac_sayisi, cs.profile.damlatici_sayisi, cs.profile.damlatici_debi_lh) if cs.profile.sistem == "damla" else None
            items.append((self._pct(c.taw, r.tukenme_mm + r.planli_net_mm), x, m3, r.planli_brut_mm, t))
        items.sort(key=lambda z: (z[0], z[1].ad))
        p = c.profile
        hh, mm = (int(v) for v in (p.vardiya_baslangic or c.rule.vardiya_baslangic).split(":"))
        t_min = hh * 60 + mm
        kalemler: list[sc.VardiyaKalemi] = []
        neden = None
        for _, x, m3, brut, t in items:
            flows = [f for f in (x.vana_debi_m3h, p.pompa_debi_m3h) if f]
            if not flows:
                neden = "Pompa ya da vana debisi girilmediği için başlangıç saatleri ve süreler hesaplanamıyor; yalnız sıra ve miktar gösteriliyor."
                kalemler.append(sc.VardiyaKalemi(sektor=x.ad, baslangic=None, bitis=None, sure_dk=None, m3=m3, brut_mm=brut, litre_agac=None if t is None else t.litre_agac, emitor_dakika=None if t is None else t.emitor_dakika))
                continue
            sure = round(m3 / min(flows) * 60.0)
            b, e_ = t_min, t_min + sure
            t_min = e_
            kalemler.append(sc.VardiyaKalemi(sektor=x.ad, baslangic=f"{(b // 60) % 24:02d}:{b % 60:02d}", bitis=f"{(e_ // 60) % 24:02d}:{e_ % 60:02d}", sure_dk=sure, m3=m3, brut_mm=brut, litre_agac=None if t is None else t.litre_agac, emitor_dakika=None if t is None else t.emitor_dakika))
        onay = (await self.session.execute(text("SELECT 1 FROM irrigation_approvals WHERE garden_id = :g AND tarih = :d"), {"g": garden_id, "d": gun})).first() if onay_ara else None
        if kalemler and kalemler[-1].bitis is not None and (t_min - (hh * 60 + mm)) > 24 * 60:
            toplam_sa = (t_min - (hh * 60 + mm)) / 60.0
            neden = f"Vardiya toplamı {toplam_sa:.0f} saat: 24 saati aşıyor. Pompa/vana debisi bu alan için yetersiz; vanaları birlikte açmak ya da daha yüksek debi gerekir."
        return sc.Vardiya(tarih=gun, baslangic=p.vardiya_baslangic or c.rule.vardiya_baslangic, kalemler=kalemler, toplam_m3=sum(k.m3 for k in kalemler), onayli=onay is not None, zaman_notu=neden)

    # ------------------------------------------------------------------ [Programı onayla] ve [Saha Defteri'ne işle]
    async def onayla(self, garden_id: uuid.UUID, gun: date, user_id: uuid.UUID | None) -> sc.PanelYaniti:
        panel = await self.panel(garden_id)
        if panel.vardiya is None or panel.vardiya.tarih != gun:
            raise AppError(409, AppErrorCode.VALIDATION_ERROR, "Bu gün için onaylanacak bir sulama programı yok.")
        await self.session.execute(
            text("INSERT INTO irrigation_approvals (garden_id, tarih, program, onaylayan) VALUES (:g, :d, CAST(:p AS jsonb), :u) ON CONFLICT (garden_id, tarih) DO UPDATE SET program = EXCLUDED.program, onaylayan = EXCLUDED.onaylayan"),
            {"g": garden_id, "d": gun, "p": panel.vardiya.model_dump_json(), "u": user_id},
        )
        await self.session.flush()
        return await self.panel(garden_id)

    async def isle(self, garden_id: uuid.UUID, gun: date, user_id: uuid.UUID | None) -> int:
        """Gerçekleşen sulamayı Saha Defteri'ne yazar (her vana için bir kayıt: m3 + süre + vana adı). Alışkanlık verisi buradan beslenir. Aynı gün/vana için tekrar yazmaz."""
        panel = await self.panel(garden_id)
        if panel.vardiya is None or panel.vardiya.tarih != gun:
            raise AppError(409, AppErrorCode.VALIDATION_ERROR, "Bu gün için işlenecek bir sulama programı yok.")
        yazilan = 0
        for k in panel.vardiya.kalemler:
            var = (await self.session.execute(text("SELECT 1 FROM field_records WHERE garden_id = :g AND tur = 'sulama' AND tarih = :d AND ayrinti->>'sektor' = :s"), {"g": garden_id, "d": gun, "s": k.sektor})).first()
            if var is not None:
                continue
            ay: dict[str, Any] = {"m3": round(k.m3, 2), "sektor": k.sektor, "kaynak": "plan"}
            if k.sure_dk:
                ay["sure_dk"] = k.sure_dk
            await self.session.execute(
                text("INSERT INTO field_records (id, garden_id, tur, tarih, aciklama, ayrinti, created_by) VALUES (gen_random_uuid(), :g, 'sulama', :d, :a, CAST(:y AS jsonb), :u)"),
                {"g": garden_id, "d": gun, "a": f"Sulama programından işlendi ({k.sektor})", "y": json.dumps(ay), "u": user_id},
            )
            yazilan += 1
        await self.session.flush()
        return yazilan

    # ------------------------------------------------------------------ simülasyon sekmesi
    async def simulasyon(
        self, garden_id: uuid.UUID, *, yil: int | None = None, mod: str = "plan", sistem: str | None = None, kisinti: bool = False, kwh_fiyat: float | None = None,
        gunler: list[int] | None = None, saat: float | None = None,
    ) -> sc.SimulasyonYaniti:
        try:
            c = await self._ctx(garden_id)
        except Veri as v:
            return sc.SimulasyonYaniti(durum="profil_yok" if str(v) == "profil_yok" else "veri_yok", neden="Sulama profili henüz kurulmadı." if str(v) == "profil_yok" else str(v))
        rule = c.rule
        if sistem is not None and sistem not in rule.sistem_verimi:
            raise AppError(422, AppErrorCode.VALIDATION_ERROR, "Bilinmeyen sulama sistemi.")
        sistem = sistem or c.profile.sistem
        # yıl düğmeleri: sezon yağışına göre kuru / normal / ıslak (gerçek ERA5/IMERG serisinden; sentetik yok)
        rains: dict[int, float] = {}
        for y in range(rule.gecmis_ilk_yil, rule.gecmis_son_yil + 1):
            days = [d for d in en.season_days(y, rule) if c.weather.get(d, (None, None))[0] is not None]
            if len(days) > 150:
                rains[y] = sum(cast(float, c.weather[d][0]) for d in days)
        if not rains:
            return sc.SimulasyonYaniti(durum="veri_yok", neden="Geçmiş sezon yağış verisi yok.")
        sirali = sorted(rains, key=lambda y: rains[y])
        med = sorted(rains.values())[len(rains) // 2]
        tip = {sirali[0]: "kuru", sirali[-1]: "islak", min(rains, key=lambda y: abs(rains[y] - med)): "normal"}
        yillar = [sc.SimYili(yil=y, tip=cast(Any, tip.get(y)), yagis_mm=rains[y]) for y in sorted(rains)]
        y = yil if yil in rains else next(k for k, v in tip.items() if v == "normal")
        seks = await self._sektor_satirlari(garden_id, c.garden, c.area_m2)
        alan = sum(x.alan_m2 for x in seks)
        eff = rule.sistem_verimi[sistem]
        ci = _cost_input(c.profile, rule)
        if kwh_fiyat is not None:
            ci = replace(ci, kullanici_kwh_fiyat=kwh_fiyat)

        def sayac(rows: list[en.DayOut], gross_mm: float) -> sc.SimSayac:
            m3 = en.mm_to_m3(gross_mm, alan)
            cost = en.cost(m3, ci)
            return sc.SimSayac(
                m3=m3, kwh=cost.kwh, tl=cost.toplam_tl, fiyat_kaynagi=cast(Any, cost.fiyat_kaynagi), eksik=cost.eksik, stres_gun=sum(1 for r in rows if r.stres and not r.veri_eksik),
                bosa_m3=en.mm_to_m3(sum(r.bosa_giden_mm for r in rows), alan), sulama_gunu=sum(1 for r in rows if r.planli_net_mm > 0 or r.uygulanan_net_mm > 0),
            )

        plan_rows = self.season_run(c, y, oran=kisinti, sistem=sistem)
        if not plan_rows:
            return sc.SimulasyonYaniti(durum="veri_yok", neden=f"{y} için hava verisi yok.", yillar=yillar)
        plan_say = sayac(plan_rows, sum(r.planli_brut_mm for r in plan_rows))
        # ---- alışkanlık: Saha Defteri'nden öğrenilir (≥ aliskanlik_min_kayit sulama günü), yoksa elle gün + süre
        _, gross, _, _ = await self._applied(c, date(2000, 1, 1))
        habit: dict[str, object] | None = None
        neden_h = None
        if len(gross) >= rule.aliskanlik_min_kayit:
            mmh = sorted(gross.values())[len(gross) // 2]
            wc: dict[int, int] = {}
            for d in gross:
                wc[d.weekday()] = wc.get(d.weekday(), 0) + 1
            wd = sorted(k for k, v in wc.items() if v >= 0.25 * len(gross))
            habit = {"kaynak": "kayit", "gunler": wd, "brut_mm": mmh, "kayit_sayisi": len(gross)}
        elif gunler and saat and c.profile.damlatici_sayisi and c.profile.damlatici_debi_lh and c.trees:
            habit = {"kaynak": "elle", "gunler": gunler, "brut_mm": saat * c.profile.damlatici_sayisi * c.profile.damlatici_debi_lh * c.trees / c.area_m2, "kayit_sayisi": 0}
        else:
            neden_h = f"Alışkanlık için Saha Defteri'nde en az {rule.aliskanlik_min_kayit} sulama günü kaydı (süre ya da m³ ile) gerekir; elle girmek için gün, süre, damlatıcı bilgisi ve ağaç sayısı gerekir."
        hab_say = None
        hab_rows: list[en.DayOut] = []
        if habit is not None:
            days_in = [en.DayIn(r.tarih, r.yagis_mm, r.et0_mm) for r in plan_rows if not r.veri_eksik]
            ap = {d.tarih: cast(float, habit["brut_mm"]) * eff for d in days_in if d.tarih.weekday() in cast(list[int], habit["gunler"])}
            hab_rows = en.run_bucket(days_in, taw=c.taw, raw=c.raw, cover_pct=c.cover, rule=rule, efficiency=eff, initial_dr=0.0, applied_net_mm=ap)
            hab_say = sayac(hab_rows, sum(ap.values()) / eff)
        kars = cumle = None
        if hab_say is not None:
            kars = {"plan": plan_say, "aliskanlik": hab_say}
            dm3 = hab_say.m3 - plan_say.m3
            parca = [f"{y} havasında alışkanlığınız plana göre {abs(dm3):.0f} m³ {'fazla' if dm3 > 0 else 'az'} su verir"]
            if hab_say.tl is not None and plan_say.tl is not None:
                parca.append(f"{abs(hab_say.tl - plan_say.tl):.0f} TL {'fazla' if hab_say.tl > plan_say.tl else 'az'}")
            parca.append(f"stres günü {hab_say.stres_gun} (plan {plan_say.stres_gun})")
            parca.append(f"boşa giden su {hab_say.bosa_m3:.0f} m³ (plan {plan_say.bosa_m3:.0f})")
            cumle = ", ".join(parca) + "."
        goster = hab_rows if (mod == "aliskanlik" and habit is not None) else plan_rows
        runs = [(x, self._sektor_ctx(c, x), plan_rows) for x in seks]
        vardiyalar: list[sc.Vardiya] = []
        if goster is plan_rows:
            for r in plan_rows:
                if r.planli_net_mm > 0:
                    vardiyalar.append(await self._vardiya(c, runs, r.tarih, garden_id, onay_ara=False))
        sektorler = [
            sc.SimSektor(ad=x.ad, doluluk_pct=[None if r.veri_eksik else self._pct(c.taw, r.tukenme_mm) for r in goster], brut_mm=[r.planli_brut_mm + r.uygulanan_net_mm / eff for r in goster], stres=[r.stres for r in goster])
            for x in seks
        ]
        kilit = [sc.KilitliDonem(kod=d.kod, ad=d.ad, baslangic=d.baslangic, bitis=d.bitis, mesaj="Bu dönemde önerilmez.") for d in rule.kisitli_donemler if d.durum == "kilitli"]
        return sc.SimulasyonYaniti(
            durum="hazir", neden=None, yil=y, mod=cast(Any, mod if habit is not None or mod == "plan" else "plan"), sistem=cast(Any, sistem), yillar=yillar,
            gunler=[sc.SimGunu(tarih=r.tarih, yagis_mm=r.yagis_mm, et0_mm=r.et0_mm, sulama=(r.planli_net_mm > 0 or r.uygulanan_net_mm > 0)) for r in goster], sektorler=sektorler, vardiyalar=vardiyalar,
            sayac=hab_say if (mod == "aliskanlik" and hab_say is not None) else plan_say, karsilastirma=kars, karsilastirma_cumle=cumle, aliskanlik=habit, aliskanlik_neden=neden_h,
            kisinti_uygulandi=kisinti, kilitli_donemler=kilit, kaynaklar=SOURCES,
        )
