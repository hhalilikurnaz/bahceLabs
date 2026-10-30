"""Sulama planı servisi (ADR 0023): profil, FAO-56 plan, maliyet, sezon tekrarı ve senaryolar. Veri: era5_daily (ET0, yağış), IMERG, SoilGrids toprak,
Sentinel-2 NDVI (taç örtüsü), Saha Defteri sulama kayıtları. Katsayıların hepsi katalogda (`sulama_plani`); sayı uydurulmaz."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
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
    def __init__(self, session: AsyncSession, workspace_id: uuid.UUID) -> None:
        self.session = session
        self.workspace_id = workspace_id
        self.gardens = GardenRepository(session, workspace_id)

    @staticmethod
    def _today() -> date:
        return datetime.now(UTC).astimezone(ZoneInfo(TIMEZONE)).date()

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
    async def _ctx(self, garden_id: uuid.UUID) -> Ctx:
        g = await self._garden(garden_id)
        p = await self._profile(garden_id)
        if p is None:
            raise Veri("profil_yok")
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
                    "SELECT s.medyan FROM acquisitions a JOIN acquisition_stats s ON s.acquisition_id = a.id WHERE a.garden_id = :g AND a.source_id = 'sentinel2-l2a' "
                    "AND a.durum = 'net' AND s.indeks = 'ndvi' AND a.tarih BETWEEN :s AND :e ORDER BY a.tarih DESC LIMIT 1"
                ),
                {"g": garden_id, "s": today - timedelta(days=60), "e": today},
            )
        ).scalar()
        cover = en.canopy_cover_from_ndvi(None if ndvi is None else float(ndvi), rule)
        if cover is None:
            raise Veri("Son 60 günde net Sentinel-2 görüntüsü yok; taç örtüsü (Kc düzeltmesi) hesaplanamıyor.")
        taw, raw = en.taw_raw_mm(float(soil["tarla_kapasitesi"]), float(soil["solma_noktasi"]), rule.kok_derinligi_cm, rule.tukenme_orani_p)
        weather = await self._weather(garden_id, cell, su_rule, today)
        return Ctx(g, p, rule, cell, today, taw, raw, cover, rule.sistem_verimi[p.sistem], area, g.agac_sayisi, weather, (float(soil["tarla_kapasitesi"]), float(soil["solma_noktasi"])))

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
        rows = (await self.session.execute(text("SELECT tarih, ayrinti FROM field_records WHERE garden_id = :g AND tur = 'sulama' AND tarih >= :s"), {"g": c.garden.id, "s": since})).all()
        net: dict[date, float] = {}
        gross: dict[date, float] = {}
        missing = 0
        p = c.profile
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

    # ------------------------------------------------------------------ plan
    async def plan(self, garden_id: uuid.UUID) -> sc.PlanYaniti:
        today = self._today()
        try:
            c = await self._ctx(garden_id)
        except Veri as v:
            if str(v) == "profil_yok":
                return sc.PlanYaniti(durum="profil_yok", neden="Sulama profili henüz kurulmadı.", bugun=today, katalog_surum=cat.load_catalog().surum)
            return sc.PlanYaniti(durum="veri_yok", neden=str(v), bugun=today, katalog_surum=cat.load_catalog().surum)
        rule, su_rule = c.rule, cat.load_catalog().su
        start = today - timedelta(days=30)
        window = [start + timedelta(days=i + 1) for i in range((today + timedelta(days=rule.planlama_gun) - start).days)]
        wsvc = WaterService(self.session, self.workspace_id)
        clims = await wsvc.climatology(c.cell, su_rule, start)
        fill_row = (await self.session.execute(text("SELECT sm0, sm1, sm2, sm3 FROM era5_daily WHERE cell_id = :c AND tarih = :d AND toprak_kaynak = 'era5_land'"), {"c": c.cell, "d": start})).first()
        fill = wb.root_zone_fill(list(fill_row), clims, su_rule.kok_katman_agirliklari) if fill_row else None
        initial = 0.5 * c.taw if fill is None else c.taw * (1 - fill / 100.0)
        applied_net, applied_gross, n_records, missing = await self._applied(c, date(today.year, 1, 1))
        inputs = self._days(c, window)
        rows = en.run_bucket(inputs, taw=c.taw, raw=c.raw, cover_pct=c.cover, rule=rule, efficiency=c.eff, initial_dr=initial, applied_net_mm=applied_net, policy=self._policy(c, today))
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
        now = next((x for x in rows if x.tarih == today), None)
        if now is not None and fill is not None:
            end_fill = wb.root_zone_fill(list(fill_row), clims, su_rule.kok_katman_agirliklari) if fill_row else None
            latest = (await self.session.execute(text("SELECT sm0, sm1, sm2, sm3 FROM era5_daily WHERE cell_id = :c AND toprak_kaynak = 'era5_land' AND sm0 IS NOT NULL AND tarih <= :d ORDER BY tarih DESC LIMIT 1"), {"c": c.cell, "d": today})).first()
            fill_now = wb.root_zone_fill(list(latest), await wsvc.climatology(c.cell, su_rule, today), su_rule.kok_katman_agirliklari) if latest else None
            dr_obs = None if fill_now is None else c.taw * (1 - fill_now / 100.0)
            if end_fill is not None and en.soil_check(now.tukenme_mm, dr_obs, rule.ilk_nem_sapma_uyari_mm):
                uyarilar.append(sc.Uyari(kod="nem_farki", mesaj=f"Kova ({now.tukenme_mm:.0f} mm eksik) ile ERA5-Land toprak nemi ({dr_obs:.0f} mm eksik) arasında {abs(now.tukenme_mm - cast(float, dr_obs)):.0f} mm fark var; ölçümünüzle kontrol edin."))
        if missing:
            uyarilar.append(sc.Uyari(kod="miktarsiz_kayit", mesaj=f"{missing} sulama kaydında süre ya da m³ yok; bu kayıtlar su dengesine eklenmedi."))
        if prof.profil is not None and prof.fiyat_kaynagi == "yok" and prof.profil.enerji == "sebeke":
            uyarilar.append(sc.Uyari(kod="tarife_yok", mesaj="Tarife güncel değil, faturanızdaki birim fiyatı girin."))

        def sulama(x: en.DayOut) -> sc.Sulama:
            t = en.per_tree(x.planli_brut_mm, c.area_m2, c.trees, c.profile.damlatici_sayisi, c.profile.damlatici_debi_lh) if c.profile.sistem == "damla" else None
            m3 = en.mm_to_m3(x.planli_brut_mm, c.area_m2)
            return sc.Sulama(tarih=x.tarih, net_mm=x.planli_net_mm, brut_mm=x.planli_brut_mm, m3_bahce=m3, m3_dekar=m3 / (c.area_m2 / 1000.0), litre_agac=None if t is None else t.litre_agac, emitor_dakika=None if t is None else t.emitor_dakika)

        sul = [sulama(x) for x in rows if x.planli_net_mm > 0 and x.tarih >= today]
        week_m3 = sum(s.m3_bahce for s in sul if s.tarih < today + timedelta(days=7))
        # sezon projeksiyonu: geçmiş yılların GERÇEK havasıyla aynı plan; tek sayı değil aralık
        ci = _cost_input(c.profile, rule)
        years = [y for y in range(rule.gecmis_ilk_yil, rule.gecmis_son_yil + 1) if len(c.weather) and any(d.year == y for d in c.weather)]
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
        this_year = self.season_run(c, today.year)
        last_year = self.season_run(c, today.year - 1) if any(d.year == today.year - 1 for d in c.weather) else []
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
