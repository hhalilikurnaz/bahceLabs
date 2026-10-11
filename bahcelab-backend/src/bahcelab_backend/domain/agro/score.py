"""Bahçe durumu skoru (SAF fonksiyonlar): bahçenin KENDİ geçmişine göre 0–100.

Skor, bileşen puanlarının ağırlıklı ortalamasıdır; kullanılamayan bileşenler (veri yok, 8B'de bağlanacak olanlar)
dışarıda bırakılır ve kalan ağırlıklar yeniden normalleştirilir. Geçmiş ya da görüntü yetersizse skor yerine
"veri yetersiz" ve nedeni döner. Etiket (İyi/İzle/Dikkat) bu skordan türetilir; kırmızı uyarı etiketi en fazla
"dikkat"e, sarı uyarı en fazla "izle"ye çeker. Tüm eşik ve ağırlıklar `Settings`'ten gelir (`ScoreConfig`).
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from bahcelab_backend.config import Settings, get_settings

Durum = Literal["iyi", "izle", "dikkat", "veri_yok"]
Seviye = Literal["sari", "kirmizi"]
GuvenSeviyesi = Literal["yuksek", "orta", "dusuk"]

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
    tolerance_share: float
    zero_share: float
    alert_points: dict[str, int]
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
        return cls(
            weights={
                "canlilik": s.score_weight_vigor,
                "yaprak_suyu": s.score_weight_water,
                "uyarilar": s.score_weight_alerts,
                "hava": s.score_weight_weather,
            },
            good_min=s.score_good_min,
            watch_min=s.score_watch_min,
            tolerance_share=s.score_tolerance_share,
            zero_share=s.score_zero_share,
            alert_points={"sari": s.score_alert_points_yellow, "kirmizi": s.score_alert_points_red},
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
class Skor:
    durum: Durum
    skor: int | None
    bilesenler: list[Bilesen]
    guven: Guven
    ozet: str
    veri_yeterli: bool
    veri_yetersiz_nedeni: str | None


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


def index_component(
    code: str,
    series: Series,
    span: float,
    latest_date: date | None,
    cfg: ScoreConfig,
) -> Bilesen:
    name = COMPONENT_NAMES[code]
    weight = cfg.weights[code]
    if not series or latest_date is None:
        return Bilesen(code, name, None, weight, False, f"{name} için uydu verisi yok.")
    latest = next(v for d, v in reversed(series) if d <= latest_date)
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


def weather_component(severities: list[Seviye] | None, cfg: ScoreConfig) -> Bilesen:
    """`None`: hava bilgisi alınamadı (bileşen dışarıda kalır)."""
    name, weight = COMPONENT_NAMES["hava"], cfg.weights["hava"]
    if severities is None:
        return Bilesen("hava", name, None, weight, False, "Hava bilgisi alınamadığından değerlendirilemedi.")
    if not severities:
        return Bilesen("hava", name, 100, weight, True, "Önümüzdeki günlerde don ya da aşırı sıcak riski görünmüyor.")
    worst: Seviye = "kirmizi" if "kirmizi" in severities else "sari"
    reason = "Don ya da aşırı sıcak için kırmızı uyarı var." if worst == "kirmizi" else "Don ya da sıcak için sarı uyarı var."
    return Bilesen("hava", name, cfg.alert_points[worst], weight, True, reason)


# ----------------------------------------------------------------------------- etiket ve güven
def label_from_score(score: int, severities: list[Seviye], cfg: ScoreConfig) -> Durum:
    """Skordan etiket; kırmızı uyarı en iyi "dikkat", sarı uyarı en iyi "izle" bırakır."""
    label: Durum = "iyi" if score >= cfg.good_min else "izle" if score >= cfg.watch_min else "dikkat"
    if "kirmizi" in severities:
        return "dikkat"
    if severities and label == "iyi":
        return "izle"
    return label


def derive_status(
    *, has_data: bool, severities: list[Seviye], score: int | None, cfg: ScoreConfig | None = None
) -> Durum:
    """TEK durum fonksiyonu (liste, harita rengi ve Durum sekmesi bunu kullanır).

    Görüntü yoksa «veri yok»; kırmızı uyarı varsa «dikkat» (skor hesaplanamasa bile); skor varsa skordan etiket;
    skor yoksa (yetersiz geçmiş) yalnızca uyarılardan: sarı → «izle», yoksa «iyi».
    """
    cfg = cfg or ScoreConfig.from_settings()
    if "kirmizi" in severities:
        return "dikkat"
    if not has_data:
        return "veri_yok"
    if score is not None:
        return label_from_score(score, severities, cfg)
    return "izle" if severities else "iyi"


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


# ----------------------------------------------------------------------------- özet cümlesi (şablon)
def summary_sentence(durum: Durum, score: int | None, components: list[Bilesen]) -> str:
    if score is None:
        return "Skor için yeterli veri yok."
    worst = min((c for c in components if c.kullanilabilir and c.puan is not None), key=lambda c: c.puan or 0, default=None)
    head = {
        "iyi": f"Bahçeniz bu dönemin kendi normuna göre iyi durumda ({score}/100).",
        "izle": f"Bahçenizde takip edilmesi gereken bir değişim var ({score}/100).",
        "dikkat": f"Bahçeniz bu dönemin kendi normunun belirgin altında ya da öncelikli bir uyarı var ({score}/100).",
        "veri_yok": "Skor için yeterli veri yok.",
    }[durum]
    if worst is not None and worst.puan is not None and worst.puan < 100:
        return f"{head} En çok etkileyen: {worst.neden}"
    return head


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
) -> Skor:
    """Skor ve dökümü üretir. `scenes` bulutsuz sahnelerdir (tarih sıralı olması gerekmez)."""
    cfg = cfg or ScoreConfig.from_settings()
    ordered = sorted(scenes, key=lambda s: s.tarih)
    if not ordered:
        comps = [
            Bilesen("canlilik", COMPONENT_NAMES["canlilik"], None, cfg.weights["canlilik"], False, "Henüz net uydu görüntüsü yok."),
            Bilesen("yaprak_suyu", COMPONENT_NAMES["yaprak_suyu"], None, cfg.weights["yaprak_suyu"], False, "Henüz net uydu görüntüsü yok."),
            alerts_component([], cfg, has_data=False),
            weather_component(weather_severities, cfg),
        ]
        reason = "Henüz net uydu görüntüsü yok; görüntü geldikçe skor hesaplanacak."
        durum_no_data = derive_status(has_data=False, severities=list(weather_severities or []), score=None, cfg=cfg)
        return Skor(durum_no_data, None, comps, Guven("dusuk", reason, 0, None), "Skor için yeterli veri yok.", False, reason)

    latest = ordered[-1].tarih
    image_age = (today - latest).days
    history_days = (latest - ordered[0].tarih).days
    series = {code: sorted((s.tarih, s.degerler[idx]) for s in ordered if idx in s.degerler) for code, idx in (("canlilik", "ndvi"), ("yaprak_suyu", "ndmi"))}

    vigor = index_component("canlilik", series["canlilik"], spans["ndvi"], latest, cfg)
    water = index_component("yaprak_suyu", series["yaprak_suyu"], spans["ndmi"], latest, cfg)
    alerts = alerts_component(sat_severities, cfg, has_data=True)
    weather = weather_component(weather_severities, cfg)
    components = [vigor, water, alerts, weather, *(extra_components or [])]

    base = baseline([(d, v) for d, v in series["canlilik"] if d < latest], latest, cfg)
    trust = confidence(base, history_days, image_age, cfg)
    severities: list[Seviye] = [*sat_severities, *(weather_severities or [])]

    stale = image_age > cfg.stale_image_days
    if stale or not vigor.kullanilabilir:
        reason = (
            f"Son net görüntü {image_age} günlük; güncel bir görüntü gelince skor hesaplanacak."
            if stale
            else vigor.neden
        )
        durum = derive_status(has_data=True, severities=severities, score=None, cfg=cfg)
        return Skor(durum, None, components, trust, "Skor için yeterli veri yok.", False, reason)

    usable = [c for c in components if c.kullanilabilir and c.puan is not None]
    total_weight = sum(c.agirlik for c in usable)
    score = round(sum((c.puan or 0) * c.agirlik for c in usable) / total_weight) if total_weight > 0 else None
    durum = derive_status(has_data=True, severities=severities, score=score, cfg=cfg)
    return Skor(durum, score, components, trust, summary_sentence(durum, score, components), True, None)
