"""Bahçe durumu skoru (SAF fonksiyonlar): bahçenin KENDİ geçmişine göre 0–100.

İÇ skor, bileşen puanlarının ağırlıklı ortalamasıdır; kullanılamayan bileşenler dışarıda bırakılır ve kalan ağırlıklar yeniden
normalleştirilir. Geçmiş ya da görüntü yetersizse "veri yetersiz" ve nedeni döner. Kademe (İyi · İzle · Dikkat · Sorun) skordan
türetilir; skor ARAYÜZE ÇIKMAZ. Aktif risk (uyarı ya da yüksek zararlı riski) kademeyi en fazla "İzle"ye çeker; kırmızı uyarı en az
"Dikkat" yapar. Kademe ve bileşen eşikleri katalogdadır («ön değer · v1»); ağırlıklar `Settings`'ten gelir (`ScoreConfig`).
"""

from __future__ import annotations

import statistics
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal

from bahcelab_backend.config import Settings, get_settings
from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.agro.risks import RiskSonucu

Durum = Literal["iyi", "izle", "dikkat", "sorun", "veri_yok"]
BilesenSeviyesi = Literal["normal", "normalin_alti", "belirgin_dusuk"]
KADEME_ADLARI: dict[str, str] = {"iyi": "İyi", "izle": "İzle", "dikkat": "Dikkat", "sorun": "Sorun", "veri_yok": "Veri yok"}
Seviye = Literal["sari", "kirmizi"]
GuvenSeviyesi = Literal["yuksek", "orta", "dusuk"]

AY_ADLARI: dict[int, str] = {1: "Ocak", 2: "Şubat", 3: "Mart", 4: "Nisan", 5: "Mayıs", 6: "Haziran", 7: "Temmuz", 8: "Ağustos", 9: "Eylül", 10: "Ekim", 11: "Kasım", 12: "Aralık"}
AY_KISA: dict[int, str] = {1: "Oca", 2: "Şub", 3: "Mar", 4: "Nis", 5: "May", 6: "Haz", 7: "Tem", 8: "Ağu", 9: "Eyl", 10: "Eki", 11: "Kas", 12: "Ara"}

COMPONENT_NAMES = {
    "canlilik": "Canlılık",
    "yaprak_suyu": "Yaprak suyu",
    "uyarilar": "Uydu uyarıları",
    "hava": "Hava riskleri",
}


@dataclass(frozen=True)
class ScoreConfig:
    weights: dict[str, float]
    good_min: int
    watch_min: int
    caution_min: int
    component_normal_min: int
    component_low_max: int
    band_min_years: int
    band_high_years: int
    deviation_normal: float
    deviation_zero: float
    tolerance_share: float
    zero_share: float
    alert_points: dict[str, int]
    risk_penalty_per_medium: int
    risk_penalty_per_high: int
    period_half_window_days: int
    period_min_points: int
    fallback_window_days: int
    fallback_exclude_days: int
    fallback_min_points: int
    fallback_min_span_days: int
    stale_image_days: int
    aging_image_days: int

    @classmethod
    def from_settings(cls, s: Settings | None = None) -> ScoreConfig:
        s = s or get_settings()
        tiers = load_catalog().durum_kademesi
        return cls(
            weights={
                "canlilik": s.score_weight_vigor,
                "yaprak_suyu": s.score_weight_water,
                "uyarilar": s.score_weight_alerts,
                "hava": s.score_weight_weather,
            },
            good_min=tiers.iyi_min,
            watch_min=tiers.izle_min,
            caution_min=tiers.dikkat_min,
            component_normal_min=tiers.bilesen_normal_min,
            component_low_max=tiers.bilesen_belirgin_dusuk_max,
            band_min_years=load_catalog().normal_bant.asgari_yil_ceyrek,
            band_high_years=load_catalog().normal_bant.asgari_yil_onluk,
            deviation_normal=load_catalog().normal_bant.sapma_normal,
            deviation_zero=load_catalog().normal_bant.sapma_sifir,
            tolerance_share=s.score_tolerance_share,
            zero_share=s.score_zero_share,
            alert_points={"sari": s.score_alert_points_yellow, "kirmizi": s.score_alert_points_red},
            risk_penalty_per_medium=s.score_risk_penalty_per_medium,
            risk_penalty_per_high=s.score_risk_penalty_per_high,
            period_half_window_days=s.score_period_half_window_days,
            period_min_points=s.score_period_min_points,
            fallback_window_days=s.score_fallback_window_days,
            fallback_exclude_days=s.score_fallback_exclude_days,
            fallback_min_points=s.score_fallback_min_points,
            fallback_min_span_days=s.score_fallback_min_span_days,
            stale_image_days=s.score_stale_image_days,
            aging_image_days=s.score_aging_image_days,
        )


@dataclass(frozen=True)
class BandRef:
    """Bahçenin takvim ayı normal bandı (acquisitions/normal_bands): ortanca ve MAD (yıl değerlerinden), bantta kullanılan yıllar."""

    ay: int
    yil_sayisi: int
    yillar: list[int]
    median: float
    mad: float  # yıl değerlerinin ortancadan mutlak sapmasının ortancası (ham, ölçeklenmemiş)


@dataclass(frozen=True)
class Baseline:
    deger: float
    kaynak: Literal["gecmis_sezon", "son_gunler"]
    nokta_sayisi: int


@dataclass(frozen=True)
class Bilesen:
    kod: str
    ad: str
    puan: int | None
    agirlik: float
    kullanilabilir: bool
    neden: str


@dataclass(frozen=True)
class Guven:
    seviye: GuvenSeviyesi
    aciklama: str
    gecmis_gun: int
    son_goruntu_yasi_gun: int | None


@dataclass(frozen=True)
class AktifRisk:
    """Zararlı/hastalık risk motorunun orta ya da yüksek çıkardığı risk (düşük riskler aktif sayılmaz)."""

    ad: str
    seviye: Literal["orta", "yuksek"]

    @property
    def metin(self) -> str:
        return f"{self.ad} · {'yüksek' if self.seviye == 'yuksek' else 'orta'}"


@dataclass(frozen=True)
class Cip:
    """Arayüz çipi: Ağaç gücü (NDVI) · Su (NDMI) · Risk — sayı yok, yalnız seviye (None = veri yok)."""

    kod: str
    ad: str
    seviye: BilesenSeviyesi | None
    aciklama: str
    etiket: str | None = None  # görünen seviye yazısı: Risk çipinde «orta» / «yüksek»; boşsa seviye adı kullanılır


@dataclass(frozen=True)
class Skor:
    durum: Durum
    skor: int | None  # İÇ değer: arayüze ve API yanıtına çıkmaz
    bilesenler: list[Bilesen]
    guven: Guven
    ozet: str
    veri_yeterli: bool
    veri_yetersiz_nedeni: str | None
    cipler: list[Cip]
    kademe_nedeni: str
    dusuren: str | None  # kademeyi en çok düşüren çipin kodu (agac_gucu | su | risk); düşüren yoksa None
    cumleler: list[str] = field(default_factory=list)  # «Nasıl hesaplandı?»: en fazla 3 kısa cümle


Series = list[tuple[date, float]]


# ----------------------------------------------------------------------------- taban (bahçenin kendi normu)
def baseline(series: Series, latest: date, cfg: ScoreConfig) -> Baseline | None:
    """Önce geçen yılların AYNI dönemi (±pencere), yoksa son 60–90 günün kendi tabanı; ikisi de yoksa None."""
    values: list[float] = []
    for years in (1, 2):
        try:
            anchor = latest.replace(year=latest.year - years)
        except ValueError:
            anchor = latest.replace(year=latest.year - years, day=28)
        half = timedelta(days=cfg.period_half_window_days)
        values += [v for d, v in series if anchor - half <= d <= anchor + half]
    if len(values) >= cfg.period_min_points:
        return Baseline(statistics.median(values), "gecmis_sezon", len(values))

    start = latest - timedelta(days=cfg.fallback_window_days)
    end = latest - timedelta(days=cfg.fallback_exclude_days)
    window = [(d, v) for d, v in series if start <= d <= end]
    if len(window) >= cfg.fallback_min_points and (window[-1][0] - window[0][0]).days >= cfg.fallback_min_span_days:
        return Baseline(statistics.median(v for _, v in window), "son_gunler", len(window))
    return None


def deviation_points(latest: float, base: float, span: float, cfg: ScoreConfig) -> int:
    """Norma göre düşüş (indeks aralığının payı olarak): toleransa kadar 100, `zero_share`'de 0, arası doğrusal."""
    drop = (base - latest) / span if span > 0 else 0.0
    if drop <= cfg.tolerance_share:
        return 100
    if drop >= cfg.zero_share:
        return 0
    return round(100 * (1 - (drop - cfg.tolerance_share) / (cfg.zero_share - cfg.tolerance_share)))


def _percent_text(latest: float, base: float) -> str:
    pct = abs(latest / base - 1) * 100 if abs(base) > 0.05 else 0.0
    return f"%{round(pct)}"


def band_points(value: float, band: BandRef, cfg: ScoreConfig) -> int:
    """Normal banda göre puan (0–100): z = (değer − ortanca)/(1,4826·MAD); yalnız ortancanın ALTI cezalandırılır."""
    scale = max(1.4826 * band.mad, 1e-3)
    z = (value - band.median) / scale
    if z >= -cfg.deviation_normal:
        return 100
    if z <= -cfg.deviation_zero:
        return 0
    return round(100 * (cfg.deviation_zero + z) / (cfg.deviation_zero - cfg.deviation_normal))


def usable_band(band: BandRef | None, month: int, cfg: ScoreConfig) -> BandRef | None:
    return band if band is not None and band.ay == month and band.yil_sayisi >= cfg.band_min_years else None


def index_component(
    code: str,
    series: Series,
    span: float,
    latest_date: date | None,
    cfg: ScoreConfig,
    band: BandRef | None = None,
) -> Bilesen:
    name = COMPONENT_NAMES[code]
    weight = cfg.weights[code]
    if not series or latest_date is None:
        return Bilesen(code, name, None, weight, False, f"{name} için uydu verisi yok.")
    latest = next(v for d, v in reversed(series) if d <= latest_date)
    ref = usable_band(band, latest_date.month, cfg)
    if ref is not None:  # karar bahçenin kendi normal bandına göre (ADR 0015)
        points = band_points(latest, ref, cfg)
        month = AY_ADLARI[ref.ay]
        reason = f"{name}, {month} bandı ile uyumlu." if points == 100 else f"{name}, {month} bandının ortancasının altında."
        return Bilesen(code, name, points, weight, True, reason)
    base = baseline([(d, v) for d, v in series if d < latest_date], latest_date, cfg)
    if base is None:
        return Bilesen(code, name, None, weight, False, f"{name}: kendi normunu hesaplamak için yeterli geçmiş görüntü yok.")
    points = deviation_points(latest, base.deger, span, cfg)
    nominative, genitive = (
        ("bu dönemin kendi normu", "bu dönemin kendi normunun")
        if base.kaynak == "gecmis_sezon"
        else ("son haftalardaki kendi düzeyi", "son haftalardaki kendi düzeyinin")
    )
    if points == 100:
        reason = f"{name}, {nominative} ile uyumlu."
    else:
        reason = f"{name}, {genitive} {_percent_text(latest, base.deger)} altında."
    return Bilesen(code, name, points, weight, True, reason)


def alerts_component(severities: list[Seviye], cfg: ScoreConfig, *, has_data: bool) -> Bilesen:
    name, weight = COMPONENT_NAMES["uyarilar"], cfg.weights["uyarilar"]
    if not has_data:
        return Bilesen("uyarilar", name, None, weight, False, "Uydu görüntüsü olmadığından uyarı değerlendirilemedi.")
    if not severities:
        return Bilesen("uyarilar", name, 100, weight, True, "Aktif uydu uyarısı yok.")
    worst: Seviye = "kirmizi" if "kirmizi" in severities else "sari"
    reason = f"{severities.count(worst)} {'öncelikli' if worst == 'kirmizi' else 'izlenmesi gereken'} uydu uyarısı var."
    return Bilesen("uyarilar", name, cfg.alert_points[worst], weight, True, reason)


def weather_component(severities: list[Seviye] | None, cfg: ScoreConfig, risks: list[AktifRisk] | None = None) -> Bilesen:
    """Hava riskleri: don/sıcak uyarıları + zararlı/hastalık risk motoru (orta ve yüksek riskler puanı düşürür; kademeyi
    «aktif risk» kuralı sınırlar). `severities=None`: hava bilgisi alınamadı (bileşen dışarıda kalır)."""
    name, weight = COMPONENT_NAMES["hava"], cfg.weights["hava"]
    if severities is None:
        return Bilesen("hava", name, None, weight, False, "Hava bilgisi alınamadığından değerlendirilemedi.")
    base = 100
    parts: list[str] = []
    if severities:
        worst: Seviye = "kirmizi" if "kirmizi" in severities else "sari"
        base = cfg.alert_points[worst]
        parts.append("Don ya da aşırı sıcak için kırmızı uyarı var." if worst == "kirmizi" else "Don ya da sıcak için sarı uyarı var.")
    active = risks or []
    if active:
        penalty = sum(cfg.risk_penalty_per_high if r.seviye == "yuksek" else cfg.risk_penalty_per_medium for r in active)
        base = max(0, base - penalty)
        parts.append(f"Zararlı/hastalık risk tahmini: {', '.join(r.metin for r in active)} (teşhis değil, risk tahmini).")
    if not parts:
        parts.append("Önümüzdeki günlerde don, aşırı sıcak ya da zararlı/hastalık riski görünmüyor.")
    return Bilesen("hava", name, base, weight, True, " ".join(parts))


# ----------------------------------------------------------------------------- etiket ve güven
RiskSeviyesi = Literal["orta", "yuksek"]


def label_from_score(score: int, severities: list[Seviye], cfg: ScoreConfig, *, risk_level: RiskSeviyesi | None = None) -> Durum:
    """Skordan kademe. Aktif risk kademeyi sınırlar: uyarı ya da ORTA zararlı riski en iyi «izle», YÜKSEK zararlı riski en iyi
    «dikkat» bırakır; daha kötü kademe yükseltilmez. Kırmızı uyarı en az «dikkat» yapar (zaten «sorun» ise öyle kalır)."""
    label: Durum = "iyi" if score >= cfg.good_min else "izle" if score >= cfg.watch_min else "dikkat" if score >= cfg.caution_min else "sorun"
    if "kirmizi" in severities and label in ("iyi", "izle"):
        return "dikkat"
    if risk_level == "yuksek" and label in ("iyi", "izle"):
        return "dikkat"
    if (severities or risk_level) and label == "iyi":
        return "izle"
    return label


def active_risks_of(risks: Sequence[tuple[RiskSonucu, object, object]]) -> list[AktifRisk]:
    """Risk motoru çıktısından orta ve yüksek (veri yeterli) riskleri alır; düşük riskler aktif sayılmaz."""
    return [AktifRisk(r.ad, r.seviye) for r, _, _ in risks if r.veri_yeterli and r.seviye in ("orta", "yuksek")]


def derive_status(
    *, has_data: bool, severities: list[Seviye], score: int | None, cfg: ScoreConfig | None = None, risk_level: RiskSeviyesi | None = None
) -> Durum:
    """TEK durum fonksiyonu (liste, harita rengi ve Durum sekmesi bunu kullanır).

    Görüntü yoksa «veri yok»; kırmızı uyarı varsa «dikkat» (skor hesaplanamasa bile); skor varsa skordan kademe;
    skor yoksa (yetersiz geçmiş) yalnızca risklerden: uyarı/yüksek risk → «izle», yoksa «iyi».
    """
    cfg = cfg or ScoreConfig.from_settings()
    if "kirmizi" in severities:
        return "dikkat" if score is None or score >= cfg.caution_min else "sorun"
    if not has_data:
        return "veri_yok"
    if score is not None:
        return label_from_score(score, severities, cfg, risk_level=risk_level)
    if risk_level == "yuksek":
        return "dikkat"
    return "izle" if (severities or risk_level) else "iyi"


def band_confidence(band: BandRef, image_age_days: int | None, history_days: int, cfg: ScoreConfig) -> Guven:
    """Güven normal banda göre anlatılır: «Ekim bandı: 9 yıl, 2016–2024.» ≥8 yıl yüksek, 5–7 yıl orta; eski görüntü güveni bir kademe düşürür."""
    level: GuvenSeviyesi = "yuksek" if band.yil_sayisi >= cfg.band_high_years else "orta"
    if image_age_days is not None and image_age_days > cfg.aging_image_days:
        level = "orta" if level == "yuksek" else "dusuk"
    return Guven(level, f"{AY_ADLARI[band.ay]} bandı: {band.yil_sayisi} yıl, {min(band.yillar)}–{max(band.yillar)}.", history_days, image_age_days)


def confidence(
    base: Baseline | None, history_days: int, image_age_days: int | None, cfg: ScoreConfig
) -> Guven:
    if base is None or image_age_days is None:
        return Guven("dusuk", "Kendi normunu hesaplamak için yeterli geçmiş görüntü yok.", history_days, image_age_days)
    aging = image_age_days > cfg.aging_image_days
    if base.kaynak == "gecmis_sezon" and not aging:
        level: GuvenSeviyesi = "yuksek"
        text = f"Bahçenin geçen yıl aynı dönemdeki {base.nokta_sayisi} görüntüsüyle karşılaştırıldı."
    else:
        level = "orta"
        text = (
            f"Son haftalardaki {base.nokta_sayisi} görüntüyle karşılaştırıldı; geçen yıl aynı dönem verisi yok."
            if base.kaynak == "son_gunler"
            else f"Geçen yılla karşılaştırıldı ama son net görüntü {image_age_days} günlük."
        )
        if aging and base.kaynak == "son_gunler":
            level = "dusuk"
    return Guven(level, text, history_days, image_age_days)


# ----------------------------------------------------------------------------- özet, çipler ve kademe nedeni (sayı içermez)
CIP_ADLARI = {"agac_gucu": "Ağaç gücü (NDVI)", "su": "Su (NDMI)", "risk": "Risk"}
SEVIYE_ADLARI: dict[str, str] = {"normal": "normal", "normalin_alti": "normalin altı", "belirgin_dusuk": "belirgin düşük"}


def summary_sentence(durum: Durum) -> str:
    return {
        "iyi": "Bahçeniz bu dönemin kendi normuna göre iyi durumda.",
        "izle": "Bahçenizde takip edilmesi gereken bir değişim var.",
        "dikkat": "Bahçeniz bu dönemin kendi normunun belirgin altında ya da öncelikli bir uyarı var.",
        "sorun": "Bahçenizde ciddi bir sorun görünüyor; sahada kontrol edin.",
        "veri_yok": "Durum için yeterli veri yok.",
    }[durum]


def _level(points: int | None, cfg: ScoreConfig) -> BilesenSeviyesi | None:
    if points is None:
        return None
    return "normal" if points >= cfg.component_normal_min else "belirgin_dusuk" if points <= cfg.component_low_max else "normalin_alti"


def build_chips(components: list[Bilesen], cfg: ScoreConfig, risks: list[AktifRisk]) -> list[Cip]:
    by = {c.kod: c for c in components}
    vigor, water = by.get("canlilik"), by.get("yaprak_suyu")
    alert_parts = [c for c in (by.get("uyarilar"), by.get("hava")) if c is not None and c.kullanilabilir and c.puan is not None]
    risk_points = min((c.puan for c in alert_parts if c.puan is not None), default=None)
    reasons = [c.neden for c in sorted(alert_parts, key=lambda c: c.puan or 0) if (c.puan or 0) < 100]
    risk_reason = " ".join(reasons) or next((c.neden for c in alert_parts), "Uyarı ve risk değerlendirilemedi.")
    risk_level = _level(risk_points, cfg)
    if risks:  # Risk çipi zararlı/hastalık motorunu da kapsar: «Meyve sineği · orta» (puandan bağımsız: orta ve üstü = normalin altı)
        by_risk: BilesenSeviyesi = "belirgin_dusuk" if any(r.seviye == "yuksek" for r in risks) else "normalin_alti"
        worse: dict[str | None, int] = {None: -1, "normal": 0, "normalin_alti": 1, "belirgin_dusuk": 2}
        risk_level = by_risk if worse[by_risk] >= worse[risk_level] else risk_level
    return [
        Cip("agac_gucu", CIP_ADLARI["agac_gucu"], _level(vigor.puan if vigor and vigor.kullanilabilir else None, cfg), vigor.neden if vigor else ""),
        Cip("su", CIP_ADLARI["su"], _level(water.puan if water and water.kullanilabilir else None, cfg), water.neden if water else ""),
        Cip("risk", CIP_ADLARI["risk"], risk_level, risk_reason, etiket=("yüksek" if any(r.seviye == "yuksek" for r in risks) else "orta") if risks else None),
    ]


def explain_tier(durum: Durum, chips: list[Cip], risk_capped: bool, risks: list[AktifRisk] | None = None) -> tuple[str, str | None]:
    """Kademenin KISA nedeni (sayı yok); aynı risk bir kez anılır. Dönüş: (metin, düşüren çip kodu)."""
    if durum == "veri_yok":
        return "Kademe için yeterli veri yok.", None
    order: dict[str, int] = {"belirgin_dusuk": 0, "normalin_alti": 1, "normal": 2}
    worst = min((c for c in chips if c.seviye is not None), key=lambda c: order[c.seviye or "normal"], default=None)
    lowered = worst if worst is not None and worst.seviye != "normal" else None
    name = KADEME_ADLARI[durum]
    risk_text = ", ".join(r.metin for r in risks or [])
    parts: list[str] = []
    if risk_capped and risks:
        ceiling = "Dikkat" if any(r.seviye == "yuksek" for r in risks) else "İzle"
        parts.append(f"Aktif risk ({risk_text}) olduğu için kademe en fazla {ceiling}.")
    elif lowered is not None and lowered.kod == "risk":
        parts.append(f"Risk {lowered.etiket or SEVIYE_ADLARI[lowered.seviye or 'normal']}: {risk_text or lowered.aciklama}. Bu yüzden kademe {name}.")
    if lowered is not None and lowered.kod != "risk":
        parts.append(f"{lowered.ad} {SEVIYE_ADLARI[lowered.seviye or 'normal']}: {lowered.aciklama} Bu yüzden kademe {name}.")
    if not parts:
        parts.append("Ağaç gücü, su ve risk normal; kademe İyi." if durum == "iyi" else f"Kademe {name}.")
    return " ".join(parts), (lowered.kod if lowered is not None else None)


def how_computed(reason: str, trust: Guven, latest: date | None) -> list[str]:
    """«Nasıl hesaplandı?»: en fazla 3 kısa cümle — neden · güven (banda göre) · son görüntü ve ön değer notu."""
    out = [reason, trust.aciklama.rstrip(".") + "."]
    if latest is not None and len(out) < 3:
        out.append(f"Son net görüntü {latest.day} {AY_KISA[latest.month]}; eşikler ön değer (v1).")
    return [c for c in out if c][:3]


@dataclass(frozen=True)
class SceneValue:
    """Skorun ihtiyaç duyduğu sahne özeti: tarih ve parametre ortalamaları (bulutsuz sahneler)."""

    tarih: date
    degerler: dict[str, float]


def assess(
    scenes: list[SceneValue],
    *,
    spans: dict[str, float],
    sat_severities: list[Seviye],
    weather_severities: list[Seviye] | None,
    today: date,
    cfg: ScoreConfig | None = None,
    extra_components: list[Bilesen] | None = None,
    active_risks: list[AktifRisk] | None = None,
    bands: dict[str, BandRef] | None = None,
) -> Skor:
    """Skor ve dökümü üretir. `scenes` bulutsuz sahnelerdir (tarih sıralı olması gerekmez)."""
    cfg = cfg or ScoreConfig.from_settings()
    ordered = sorted(scenes, key=lambda s: s.tarih)
    risks = active_risks or []
    risk_level: RiskSeviyesi | None = "yuksek" if any(r.seviye == "yuksek" for r in risks) else ("orta" if risks else None)

    severities_all: list[Seviye] = [*sat_severities, *(weather_severities or [])]

    def result(durum: Durum, score: int | None, components: list[Bilesen], trust: Guven, sufficient: bool, reason: str | None) -> Skor:
        chips = build_chips(components, cfg, risks)
        capped = score is not None and durum in ("izle", "dikkat") and label_from_score(score, severities_all, cfg, risk_level=None) != durum  # kademeyi risk sınırladı
        text, lowered = explain_tier(durum, chips, capped, risks)
        return Skor(durum, score, components, trust, summary_sentence(durum), sufficient, reason, chips, text, lowered, how_computed(text, trust, ordered[-1].tarih if ordered else None))

    if not ordered:
        comps = [
            Bilesen("canlilik", COMPONENT_NAMES["canlilik"], None, cfg.weights["canlilik"], False, "Henüz net uydu görüntüsü yok."),
            Bilesen("yaprak_suyu", COMPONENT_NAMES["yaprak_suyu"], None, cfg.weights["yaprak_suyu"], False, "Henüz net uydu görüntüsü yok."),
            alerts_component([], cfg, has_data=False),
            weather_component(weather_severities, cfg),
        ]
        reason = "Henüz net uydu görüntüsü yok; görüntü geldikçe durum hesaplanacak."
        durum_no_data = derive_status(has_data=False, severities=list(weather_severities or []), score=None, cfg=cfg)
        return result(durum_no_data, None, comps, Guven("dusuk", reason, 0, None), False, reason)

    latest = ordered[-1].tarih
    image_age = (today - latest).days
    history_days = (latest - ordered[0].tarih).days
    series = {code: sorted((s.tarih, s.degerler[idx]) for s in ordered if idx in s.degerler) for code, idx in (("canlilik", "ndvi"), ("yaprak_suyu", "ndmi"))}

    band_map = bands or {}
    vigor = index_component("canlilik", series["canlilik"], spans["ndvi"], latest, cfg, band_map.get("ndvi"))
    water = index_component("yaprak_suyu", series["yaprak_suyu"], spans["ndmi"], latest, cfg, band_map.get("ndmi"))
    alerts = alerts_component(sat_severities, cfg, has_data=True)
    weather = weather_component(weather_severities, cfg, risks)
    components = [vigor, water, alerts, weather, *(extra_components or [])]

    base = baseline([(d, v) for d, v in series["canlilik"] if d < latest], latest, cfg)
    ndvi_band = band_map.get("ndvi")
    if usable_band(ndvi_band, latest.month, cfg) is not None and ndvi_band is not None:
        trust = band_confidence(ndvi_band, image_age, history_days, cfg)
    else:
        trust = confidence(base, history_days, image_age, cfg)
        if ndvi_band is not None and ndvi_band.ay == latest.month:  # band var ama yıl sayısı yetersiz: nedeni söylenir
            trust = Guven(trust.seviye, f"Yetersiz geçmiş ({ndvi_band.yil_sayisi} yıl): " + trust.aciklama[0].lower() + trust.aciklama[1:], trust.gecmis_gun, trust.son_goruntu_yasi_gun)
    severities = severities_all

    stale = image_age > cfg.stale_image_days
    if stale or not vigor.kullanilabilir:
        reason = (
            f"Son net görüntü {image_age} günlük; güncel bir görüntü gelince durum hesaplanacak."
            if stale
            else vigor.neden
        )
        durum = derive_status(has_data=True, severities=severities, score=None, cfg=cfg, risk_level=risk_level)
        return result(durum, None, components, trust, False, reason)

    usable = [c for c in components if c.kullanilabilir and c.puan is not None]
    total_weight = sum(c.agirlik for c in usable)
    score = round(sum((c.puan or 0) * c.agirlik for c in usable) / total_weight) if total_weight > 0 else None
    durum = derive_status(has_data=True, severities=severities, score=score, cfg=cfg, risk_level=risk_level)
    return result(durum, score, components, trust, True, None)
