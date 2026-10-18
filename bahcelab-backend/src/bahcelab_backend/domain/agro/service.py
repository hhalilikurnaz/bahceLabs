"""Agro servisi: katalog, fenoloji (bahçe düzeltmeleriyle), sezon serileri, durum skoru ve «Bugün» listesi."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.agro import status_v2 as sv
from bahcelab_backend.domain.agro import status_v2_service as sv2
from bahcelab_backend.domain.agro.irrigation import DayInput, IrrigationResult, StageKc, recommend
from bahcelab_backend.domain.agro.repository import AgroRepository
from bahcelab_backend.domain.agro.risks import (
    GunVerisi,
    RiskSonucu,
    fruit_fly,
    mal_secco,
    red_spider,
)
from bahcelab_backend.domain.agro.rulebook import (
    SulamaKurallari,
    load_irrigation_rules,
    load_risk_rules,
)
from bahcelab_backend.domain.agro.schemas import (
    BilesenV2Yanit,
    BugunMaddesiYanit,
    BugunYanit,
    DurumV2Yanit,
    EvreYanit,
    FenolojiDuzeltme,
    FenolojiYanit,
    KatalogCesit,
    KatalogUrun,
    KatalogYanit,
    KuralMeta,
    RiskleriYanit,
    RiskYanit,
    SeriGunu,
    SerilerYanit,
    SeriOzeti,
    SulamaPenceresi,
    SulamaSistemiYanit,
    SulamaYanit,
    TuzakArayuzu,
)
from bahcelab_backend.domain.agro.series import DayWeather, build_season, coverage, one_year_earlier
from bahcelab_backend.domain.agro.tiers import (
    KADEME_ADLARI,
    Seviye,
    active_risks_of,
    summary_sentence,
)
from bahcelab_backend.domain.agro.today import Girdi, Oncelik, Sekme, build_today
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.domain.ndvi.repository import NdviRepository, SceneWithIndices
from bahcelab_backend.domain.ndvi.rules import build_alerts
from bahcelab_backend.domain.notifications.repository import StatusSnapshotRepository
from bahcelab_backend.domain.water.schemas import SulamaKarari
from bahcelab_backend.domain.water.service import WaterService
from bahcelab_backend.domain.weather.provider import TIMEZONE
from bahcelab_backend.domain.weather.schemas import HavaYanit
from bahcelab_backend.domain.weather.service import WeatherService
from bahcelab_backend.shared.errors import AppError, AppErrorCode


def _meta(block: cat.KuralBlok | None) -> KuralMeta | None:
    if block is None:
        return None
    return KuralMeta(durum=block.durum, kaynak=block.kaynak, onaylayan=block.onaylayan, onay_tarihi=block.onay_tarihi)


def satellite_severities(
    scenes: list[SceneWithIndices],
) -> tuple[list[Seviye], list[tuple[Seviye, str, str, str | None]]]:
    alerts = build_alerts(scenes)
    levels: list[tuple[Seviye, str, str, str | None]] = [
        ("kirmizi" if a.oncelik == "yuksek" else "sari", a.baslik, a.mesaj, a.ayrinti) for a in alerts
    ]
    return [lvl for lvl, _, _, _ in levels], levels


def _meta_of(block: cat.KuralBlok) -> KuralMeta:
    return KuralMeta(durum=block.durum, kaynak=block.kaynak, onaylayan=block.onaylayan, onay_tarihi=block.onay_tarihi)


IRRIGATION_NOTE = "Yaklaşık öneridir, sulama reçetesi değildir; toprak nemi, ağaç durumu ve yerel koşullar sahada kontrol edilmelidir."
RISK_NOTE = "Hava koşullarından türetilen risk tahminidir; teşhis ya da ilaçlama tavsiyesi değildir. Sahada kontrol edin."


class AgroService:
    def __init__(
        self,
        gardens: GardenRepository,
        ndvi: NdviRepository,
        weather: WeatherService,
        repo: AgroRepository,
    ) -> None:
        self.gardens = gardens
        self.ndvi = ndvi
        self.weather = weather
        self.repo = repo
        self.settings = get_settings()
        self.catalog = cat.load_catalog()

    def _today(self) -> date:
        return datetime.now(ZoneInfo(TIMEZONE)).date()

    def current_date(self) -> date:
        return self._today()

    async def _garden(self, garden_id: uuid.UUID) -> GardenModel:
        row = await self.gardens.get(garden_id)
        if row is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")
        return row.garden

    # ------------------------------------------------------------------ katalog
    def catalog_response(self) -> KatalogYanit:
        products = []
        for code, product in self.catalog.urunler.items():
            products.append(
                KatalogUrun(
                    kod=code,
                    ad=product.ad,
                    cesitler=[KatalogCesit(kod=c.kod, ad=c.ad, not_=c.not_) for c in product.cesitler],
                    fenoloji=_meta(product.fenoloji),
                    kc=_meta(product.kc),
                    gdd=_meta(product.gdd),
                    gdd_taban_c=product.gdd.taban_c if product.gdd else None,
                )
            )
        return KatalogYanit(surum=self.catalog.surum, urunler=products)

    # ------------------------------------------------------------------ fenoloji
    def _season_year(self, requested: int | None, today: date) -> int:
        current = cat.season_start_year(today, self.catalog.sezon_baslangici)
        year = requested if requested is not None else current
        if year > current:
            raise AppError(422, AppErrorCode.VALIDATION_ERROR, "Henüz başlamamış bir sezon istenemez.")
        if year < current - 5:
            raise AppError(422, AppErrorCode.VALIDATION_ERROR, "En fazla 5 sezon öncesi istenebilir.")
        return year

    async def phenology(self, garden_id: uuid.UUID, season: int | None) -> FenolojiYanit:
        garden = await self._garden(garden_id)
        year = self._season_year(season, self._today())
        rules = cat.effective_rules(self.catalog, garden.urun, garden.cesit_kodu)
        if rules.fenoloji is None:
            return FenolojiYanit(sezon=year, urun=garden.urun, cesit_kodu=garden.cesit_kodu, kural=None, kc_kural=None, kural_yok=True, evreler=[])
        overrides = await self.repo.overrides(garden_id)
        kc = rules.kc.degerler if rules.kc else {}
        stages: list[EvreYanit] = []
        for season_year in (year - 1, year, year + 1):
            for stage in rules.fenoloji.evreler:
                special = overrides.get(stage.kod)
                start_m, end_m = (special.baslangic, special.bitis) if special else (stage.baslangic, stage.bitis)
                start, end = cat.stage_window(start_m, end_m, season_year, self.catalog.sezon_baslangici)
                stages.append(
                    EvreYanit(
                        kod=stage.kod, ad=stage.ad, baslangic=start, bitis=end, baslangic_aagg=start_m, bitis_aagg=end_m,
                        ozel=special is not None, kc=kc.get(stage.kod), sezon=season_year,
                    )
                )
        return FenolojiYanit(
            sezon=year, urun=garden.urun, cesit_kodu=garden.cesit_kodu, kural=_meta(rules.fenoloji),
            kc_kural=_meta(rules.kc), kural_yok=False, evreler=stages,
        )

    async def set_phenology_override(self, garden_id: uuid.UUID, stage: str, body: FenolojiDuzeltme) -> FenolojiYanit:
        garden = await self._garden(garden_id)
        rules = cat.effective_rules(self.catalog, garden.urun, garden.cesit_kodu)
        if rules.fenoloji is None or stage not in {e.kod for e in rules.fenoloji.evreler}:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bu ürün için böyle bir fenoloji evresi yok.")
        await self.repo.set_override(garden_id, stage, body.baslangic, body.bitis)
        return await self.phenology(garden_id, None)

    async def reset_phenology_override(self, garden_id: uuid.UUID, stage: str) -> FenolojiYanit:
        await self._garden(garden_id)
        await self.repo.delete_override(garden_id, stage)
        return await self.phenology(garden_id, None)

    # ------------------------------------------------------------------ seriler
    async def series(self, garden_id: uuid.UUID, season: int | None) -> SerilerYanit:
        garden = await self._garden(garden_id)
        today = self._today()
        year = self._season_year(season, today)
        start = date(year, 10, 1)
        season_end = date(year + 1, 9, 30)
        end = min(season_end, today - timedelta(days=1))
        rules = cat.effective_rules(self.catalog, garden.urun, garden.cesit_kodu)
        base_c = rules.gdd.taban_c if rules.gdd else None
        notes: list[str] = []
        if base_c is None:
            notes.append("Bu ürün için GDD tabanı tanımlı değil; etkili sıcaklık toplamı hesaplanamadı.")

        empty = SerilerYanit(
            sezon=year, sezon_baslangici=start, sezon_bitisi=season_end, gdd_taban_c=base_c, gdd_kural=_meta(rules.gdd),
            gunler=[], ozet=SeriOzeti(son_gun=None, yagis_birikimli_mm=None, onceki_ayni_gun_yagis_mm=None, gdd_birikimli=None, onceki_ayni_gun_gdd=None),
            eksik_gun=0, onceki_sezon_var=False, notlar=[*notes, "Sezon yeni başladı; henüz günlük veri yok."],
        )
        if end < start:
            return empty

        limit = self.settings.weather_history_days
        prev_start = date(year - 1, 10, 1)
        prev_end = one_year_earlier(end)
        fetch_start = prev_start if (end - prev_start).days <= limit else start
        history = await self.weather.history(garden_id, fetch_start, end)
        rows = {g.tarih: DayWeather(g.tarih, g.min, g.max, g.yagis_mm) for g in history.gunler}

        current = build_season(rows, start, end, base_c)
        has_prev = fetch_start == prev_start and coverage(rows, prev_start, prev_end) >= self.settings.agro_prev_season_min_coverage
        previous = build_season(rows, prev_start, prev_end, base_c) if has_prev else []
        if not has_prev:
            notes.append("Geçen sezonun hava verisi eksik olduğundan karşılaştırma gösterilmiyor.")

        missing = sum(1 for d in current if d.yagis_mm is None)
        days = []
        for i, day in enumerate(current):
            prev = previous[i] if i < len(previous) else None
            days.append(
                SeriGunu(
                    tarih=day.tarih, tmin=day.tmin, tmax=day.tmax, yagis_mm=day.yagis_mm,
                    yagis_birikimli_mm=day.yagis_birikimli_mm,
                    onceki_yagis_birikimli_mm=prev.yagis_birikimli_mm if prev else None,
                    gdd=day.gdd, gdd_birikimli=day.gdd_birikimli,
                    onceki_gdd_birikimli=prev.gdd_birikimli if prev else None,
                )
            )
        last = days[-1]
        summary = SeriOzeti(
            son_gun=last.tarih, yagis_birikimli_mm=last.yagis_birikimli_mm,
            onceki_ayni_gun_yagis_mm=last.onceki_yagis_birikimli_mm, gdd_birikimli=last.gdd_birikimli,
            onceki_ayni_gun_gdd=last.onceki_gdd_birikimli,
        )
        return SerilerYanit(
            sezon=year, sezon_baslangici=start, sezon_bitisi=season_end, gdd_taban_c=base_c, gdd_kural=_meta(rules.gdd),
            gunler=days, ozet=summary, eksik_gun=missing, onceki_sezon_var=has_prev, notlar=notes,
        )

    # ------------------------------------------------------------------ hava girdileri
    async def _effective_stages(self, garden: GardenModel) -> tuple[list[StageKc], cat.EtkinKurallar]:
        rules = cat.effective_rules(self.catalog, garden.urun, garden.cesit_kodu)
        if rules.fenoloji is None or rules.kc is None:
            return [], rules
        overrides = await self.repo.overrides(garden.id)
        stages = []
        for stage in rules.fenoloji.evreler:
            special = overrides.get(stage.kod)
            start, end = (special.baslangic, special.bitis) if special else (stage.baslangic, stage.bitis)
            stages.append(StageKc(stage.kod, start, end, rules.kc.degerler[stage.kod]))
        return stages, rules

    async def _history(self, garden_id: uuid.UUID, today: date) -> dict[date, GunVerisi]:
        march = date(today.year, 3, 1)
        start = march if today >= march else today - timedelta(days=14)
        start = max(start, today - timedelta(days=self.settings.weather_history_days))
        try:
            data = await self.weather.history(garden_id, start, today - timedelta(days=1))
        except AppError:
            return {}
        return {g.tarih: GunVerisi(g.tarih, g.min, g.max, g.yagis_mm) for g in data.gunler}

    @staticmethod
    def _forecast_days(weather: HavaYanit | None) -> list[GunVerisi]:
        if weather is None:
            return []
        humidity: dict[str, list[float]] = {}
        for hour in weather.saatlik:
            if hour.nem is not None:
                humidity.setdefault(hour.zaman[:10], []).append(hour.nem)
        out = []
        for d in weather.gunler:
            hums = humidity.get(d.tarih.isoformat())
            out.append(GunVerisi(d.tarih, d.min, d.max, d.yagis_mm, d.ruzgar_max, sum(hums) / len(hums) if hums else None))
        return out

    # ------------------------------------------------------------------ riskler
    async def _compute_risks(
        self, garden: GardenModel, history: dict[date, GunVerisi], weather: HavaYanit | None, today: date
    ) -> list[tuple[RiskSonucu, str, str]]:
        """(sonuç, kısa ad, kural kodu) listesi; yalnızca bu ürüne uygulanabilir kurallar."""
        book = load_risk_rules()
        stages, _ = await self._effective_stages(garden)
        current = next((st for st in stages if cat.stage_window(st.baslangic, st.bitis, cat.season_start_year(today))[0] <= today <= cat.stage_window(st.baslangic, st.bitis, cat.season_start_year(today))[1]), None)
        stage_name = None
        if current is not None and self.catalog.urun(garden.urun) and self.catalog.urun(garden.urun).fenoloji:  # type: ignore[union-attr]
            stage_name = next((e.ad for e in self.catalog.urun(garden.urun).fenoloji.evreler if e.kod == current.kod), None)  # type: ignore[union-attr]
        forecast = self._forecast_days(weather)
        by_date = {**history, **{d.tarih: d for d in forecast}}
        out: list[tuple[RiskSonucu, str, str]] = []
        for code, rule in book.kurallar.items():
            if garden.urun not in rule.urunler:
                continue
            if code == "akdeniz_meyve_sinegi":
                result = fruit_fly(rule, history, today, current.kod if current else None, stage_name)
            elif code == "kirmizi_orumcek":
                window = [by_date[d] for d in sorted(by_date) if today - timedelta(days=int(rule.parametreler["geriye_bakis_gun"])) <= d <= today + timedelta(days=3)]
                result = red_spider(rule, window, today)
            else:
                result = mal_secco(rule, forecast, today)
            out.append((result, rule.kisa, code))
        return out

    async def risks(self, garden_id: uuid.UUID) -> RiskleriYanit:
        garden = await self._garden(garden_id)
        today = self._today()
        weather = await self._weather_or_none(garden_id)
        history = await self._history(garden_id, today)
        book = load_risk_rules()
        items = [
            RiskYanit(
                kod=r.kod, ad=r.ad, kisa=short, seviye=r.seviye, gerekce=r.gerekce, gecerlilik_baslangic=r.gecerlilik_baslangic,
                gecerlilik_bitis=r.gecerlilik_bitis, veri_yeterli=r.veri_yeterli, kural=_meta_of(book.kurallar[code]),
            )
            for r, short, code in await self._compute_risks(garden, history, weather, today)
        ]
        return RiskleriYanit(
            tarih=today, riskler=items,
            tuzak=TuzakArayuzu(desteklenir=False, adim="Adım 12", aciklama="Tuzak sayımı girişi Adım 12'de bu risk motoruna bağlanacak."),
            not_=RISK_NOTE,
        )

    # ------------------------------------------------------------------ sulama
    async def _compute_irrigation(
        self, garden: GardenModel, history: dict[date, GunVerisi], weather: HavaYanit | None, today: date, daily_et0: dict[date, float | None]
    ) -> tuple[IrrigationResult | None, str | None]:
        stages, _ = await self._effective_stages(garden)
        if not stages:
            return None, "Bu ürün için Kc (bitki katsayısı) kuralı tanımlı değil."
        rules = load_irrigation_rules()
        past = [DayInput(today - timedelta(days=i), daily_et0.get(today - timedelta(days=i)), (history.get(today - timedelta(days=i)) or GunVerisi(today, None, None)).yagis_mm) for i in range(rules.hesap.gecmis_gun, 0, -1)]
        future = [DayInput(d.tarih, d.et0_mm, d.yagis_mm) for d in (weather.gunler if weather else []) if d.tarih >= today][: rules.hesap.gelecek_gun]
        result = recommend(past, future, stages, rules, dekar=float(garden.alan_dekar), system=garden.sulama_sistemi) if future else None
        unified = await self._water_decision(garden.id, today)
        if unified is not None:  # TEK karar kaynağı: toprak nemi + su dengesi varsa karar buradan gelir (Su sekmesiyle aynı)
            return self._merge_decision(result, unified, garden, rules), None
        if result is None:
            return None, "Hava tahmini alınamadığından önümüzdeki günlerin su ihtiyacı hesaplanamadı."
        return result, None

    async def _water_decision(self, garden_id: uuid.UUID, today: date) -> SulamaKarari | None:
        """Su sekmesinin kararı (`WaterService.su().karar_detay`); toprak nemi/ERA5 verisi yoksa None (o zaman hava tabanlı yaklaşık hesap kalır)."""
        try:
            decision = (await WaterService(self.ndvi.session, self.gardens.workspace_id).su(garden_id, today)).karar_detay
        except AppError:
            return None
        return None if decision.durum == "veri_yok" else decision

    @staticmethod
    def _merge_decision(base: IrrigationResult | None, decision: SulamaKarari, garden: GardenModel, rules: SulamaKurallari) -> IrrigationResult:
        info = rules.sulama_sistemleri.sistemler.get(garden.sulama_sistemi or "")
        efficiency = info.verimlilik if info else None
        need = decision.ihtiyac_mm if decision.gerekli and decision.ihtiyac_mm else 0.0
        gross = round(need / efficiency, 1) if need and efficiency else None
        ton_da = round((gross if gross is not None else need) * rules.hesap.mm_basina_ton_dekar, 1)
        gecmis, gelecek = (base.gecmis, base.gelecek) if base else (None, None)
        sentence = decision.cumle
        if decision.gerekli and need:
            suffix = "" if gross is not None else " (sulama sistemi seçilmediğinden verimlilik uygulanmadı)"
            sentence += f" Kök bölgesini doldurmak için yaklaşık {(gross if gross is not None else need):g} mm (≈ {ton_da:g} ton/dekar){suffix}."
        return IrrigationResult(gecmis, gelecek, need, gross, ton_da, round(ton_da * float(garden.alan_dekar), 1), garden.sulama_sistemi, efficiency, decision.gerekli, sentence, "su")

    async def _daily_et0(self, garden_id: uuid.UUID, today: date) -> dict[date, float | None]:
        try:
            data = await self.weather.history(garden_id, today - timedelta(days=14), today - timedelta(days=1))
        except AppError:
            return {}
        return {g.tarih: g.et0_mm for g in data.gunler}

    async def irrigation(self, garden_id: uuid.UUID) -> SulamaYanit:
        garden = await self._garden(garden_id)
        today = self._today()
        rules = load_irrigation_rules()
        weather = await self._weather_or_none(garden_id)
        history = await self._history(garden_id, today)
        et0 = await self._daily_et0(garden_id, today)
        result, reason = await self._compute_irrigation(garden, history, weather, today, et0)
        _, eff = await self._effective_stages(garden)
        info = rules.sulama_sistemleri.sistemler.get(garden.sulama_sistemi or "")
        system = SulamaSistemiYanit(kod=garden.sulama_sistemi, ad=info.ad if info else None, verimlilik=info.verimlilik if info else None)
        etkili, sistem_kural, kc_kural = _meta_of(rules.etkili_yagis), _meta_of(rules.sulama_sistemleri), _meta(eff.kc)

        def win(w) -> SulamaPenceresi | None:  # type: ignore[no-untyped-def]
            return SulamaPenceresi(gun=w.gun, etc_mm=w.etc_mm, etkili_yagis_mm=w.etkili_yagis_mm, net_mm=w.net_mm, eksik_gun=w.eksik_gun) if w else None

        if result is None or (result.gelecek is None and result.kaynak != "su"):
            return SulamaYanit(
                veri_yeterli=False, veri_yetersiz_nedeni=reason or "Su ihtiyacı için yeterli veri yok.", son_gunler=None, onumuzdeki_gunler=None,
                ihtiyac_mm=None, brut_ihtiyac_mm=None, ton_dekar=None, toplam_ton=None, sistem=system, gerekli=False,
                cumle="Su ihtiyacı için yeterli veri yok.", not_=IRRIGATION_NOTE, etkili_yagis_kural=etkili, sistem_kural=sistem_kural, kc_kural=kc_kural,
            )
        return SulamaYanit(
            veri_yeterli=True, veri_yetersiz_nedeni=None, son_gunler=win(result.gecmis), onumuzdeki_gunler=win(result.gelecek),
            ihtiyac_mm=result.ihtiyac_mm, brut_ihtiyac_mm=result.brut_ihtiyac_mm, ton_dekar=result.ton_dekar, toplam_ton=result.toplam_ton,
            sistem=system, gerekli=result.gerekli, cumle=result.cumle, karar_kaynagi="su" if result.kaynak == "su" else "hava", not_=IRRIGATION_NOTE, etkili_yagis_kural=etkili, sistem_kural=sistem_kural, kc_kural=kc_kural,
        )

    # ------------------------------------------------------------------ skor
    async def _weather_or_none(self, garden_id: uuid.UUID) -> HavaYanit | None:
        try:
            return await self.weather.get(garden_id)
        except AppError:
            return None

    async def collect(
        self, garden_id: uuid.UUID
    ) -> tuple[
        list[SceneWithIndices],
        HavaYanit | None,
        list[tuple[RiskSonucu, str, str]],
        IrrigationResult | None,
    ]:
        """Bugün listesi ve bildirim işi için ortak girdiler: sahneler, hava, riskler ve sulama sonucu (Durum v2 kademesi `status_v2_result`'tan gelir)."""
        garden = await self._garden(garden_id)
        today = self._today()
        scenes = await self.ndvi.list_scenes(garden_id)
        weather = await self._weather_or_none(garden_id)
        history = await self._history(garden_id, today)
        risks = await self._compute_risks(garden, history, weather, today)
        irrigation, _ = await self._compute_irrigation(
            garden, history, weather, today, await self._daily_et0(garden_id, today)
        )
        return scenes, weather, risks, irrigation

    async def status_v2_result(self, garden_id: uuid.UUID, today: date | None = None) -> sv.DurumV2:
        """Durum v2 (alan sonucu; iç puan dahil — yalnız karşılaştırma ve testler için). API `status_v2` iç puanı yanıta koymaz."""
        garden = await self._garden(garden_id)
        today = today or self._today()
        weather = await self._weather_or_none(garden_id)
        history = await self._history(garden_id, today)
        risks = await self._compute_risks(garden, history, weather, today)
        red = any(a.seviye == "kirmizi" for a in (weather.uyarilar if weather else []))
        inputs, _ = await sv2.collect(self.ndvi.session, self.gardens.workspace_id, garden_id, today, active_risks_of(risks), red)
        return sv.evaluate(inputs, self.catalog.durum_v2)

    async def status(self, garden_id: uuid.UUID) -> DurumV2Yanit:
        """Durum (v2, ADR 0018): kademe + 5 bileşen. Son kademe bahçe listesi ve kademe düşüşü bildirimi için kaydedilir (liste ile Durum sekmesi TEK kademe)."""
        today = self._today()
        result = await self.status_v2_result(garden_id, today)
        if result.kademe != "veri_yok":
            await StatusSnapshotRepository(self.ndvi.session).save(garden_id, result.kademe)
        rule = self.catalog.durum_v2
        weather = await self._weather_or_none(garden_id)
        garden = await self._garden(garden_id)
        risks = active_risks_of(await self._compute_risks(garden, await self._history(garden_id, today), weather, today))
        return DurumV2Yanit(
            durum=result.kademe, etiket=KADEME_ADLARI[result.kademe], ozet=summary_sentence(result.kademe),
            bilesenler=[BilesenV2Yanit(kod=c.kod, ad=c.ad, seviye=c.seviye, kullanilabilir=c.kullanilabilir, bayat=c.bayat, neden=c.neden, veri_tarihi=c.veri_tarihi) for c in result.bilesenler],  # type: ignore[arg-type]
            riskler=[r.metin for r in risks], guven=result.guven, guven_nedeni=result.guven_nedeni, nasil=result.nasil, dusuren=result.dusuren, risk_sinirladi=result.risk_sinirladi,
            esik_durumu="ön değer · v2" if rule.durum == "dogrulanmadi" else "mühendis onaylı · v2", hesaplama_tarihi=today,
        )

    async def _today_events(self, garden_id: uuid.UUID, today: date) -> list[tuple[Oncelik, str, str, Sekme]]:
        """Bugün listesine girecek taze/tahmin olaylar: önem ve metin bildirimle AYNI kuraldan (event_importance + şablon). Düşük güvenliler girmez."""
        from bahcelab_backend.domain.events.service import list_events
        from bahcelab_backend.domain.notifications.event_candidates import (
            WEATHER_KINDS,
            event_candidate,
        )

        rule = self.catalog.bildirim
        garden = await self._garden(garden_id)
        out: list[tuple[Oncelik, str, str, Sekme]] = []
        for e in await list_events(self.ndvi.session, garden_id, since=today - timedelta(days=rule.taze_olay_gun)):
            cand = event_candidate(garden_id, garden.ad, e, today, rule, e.anahtar) if not (e.tahmin and e.tur == "don") else None
            if cand is None and e.tahmin and e.tur == "don":  # tahmin donu hava uyarısı yolundan da gelir; Bugün'de kritik olay olarak görünür
                from bahcelab_backend.domain.notifications import templates

                title, body = templates.event_text(garden.ad, "don", e.baslangic, e.bitis, {"en_dusuk_c": (e.ayrinti or {}).get("don.en_dusuk_c")}, forecast=True, severe=e.siddet == "siddetli")
                out.append(("kritik", title, body, "hava"))
            elif cand is not None:
                out.append((cand.oncelik, cand.baslik, cand.metin, "hava" if e.tur in WEATHER_KINDS else "durum"))
        return out

    # ------------------------------------------------------------------ bugün
    async def today(self, garden_id: uuid.UUID) -> BugunYanit:
        scenes, weather, risks, irrigation = await self.collect(garden_id)
        today = self._today()
        _, sat = satellite_severities(scenes)
        spray = []
        if weather:
            for day in weather.gunler[:2]:
                if day.ilaclama.en_iyi_aralik:
                    spray.append((day.tarih, *day.ilaclama.en_iyi_aralik))
        data = Girdi(
            hava_uyarilari=[(a.seviye, a.baslik, a.mesaj) for a in (weather.uyarilar if weather else [])],
            zararli_riskleri=[(r.seviye, r.ad, r.sade, r.gerekce) for r, _, _ in risks if r.veri_yeterli],
            ilaclama=spray,
            uydu_uyarilari=sat,
            sulama=(irrigation.ihtiyac_mm or 0.0, irrigation.cumle) if irrigation is not None and irrigation.gerekli else None,
            olaylar=await self._today_events(garden_id, today),
        )
        items = build_today(data, today, self.settings.today_priority, self.settings.today_max_items)
        return BugunYanit(tarih=today, maddeler=[BugunMaddesiYanit(**i.__dict__) for i in items])
