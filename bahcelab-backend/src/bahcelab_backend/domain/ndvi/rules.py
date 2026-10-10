"""İndeks bazlı uyarı kuralları (saf fonksiyonlar) ve çoklu indeks önceliklendirmesi."""

from __future__ import annotations

import statistics
from datetime import date, timedelta
from typing import Any

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform as shapely_transform
from shapely.ops import unary_union

from bahcelab_backend.domain.ndvi.repository import SceneWithIndices
from bahcelab_backend.domain.ndvi.schemas import Uyari

WINDOW_MIN_DAYS = 10
WINDOW_MAX_DAYS = 25
OVERLAP_MIN_M2 = 300.0  # aynı bölge sayılması için en az 3 piksel

# İndeks bazlı düşüş eşikleri (yüzde) ve açıklayıcı Türkçe metinler
DROP_RULES: dict[str, dict[str, Any]] = {
    "ndvi": {
        "esik": 10.0,
        "baslik": "NDVI düşüşü",
        "ek": "Genel canlılık azalıyor; sulama, hastalık veya stres belirtilerini kontrol edin.",
    },
    "msavi": {
        "esik": 10.0,
        "baslik": "MSAVI düşüşü",
        "ek": "Toprak etkisinden arındırılmış bitki örtüsü azalıyor; yaprak örtüsü ve sıra arası durumunu kontrol edin.",
    },
    "ndre": {
        "esik": 12.0,
        "baslik": "NDRE düşüşü",
        "ek": "Olası besin eksikliği / sararma; yaprak kontrolü önerilir.",
    },
}
NDMI_DROP_PCT = 15.0  # bağıl düşüş
NDMI_BELOW_MEDIAN = 0.05  # geçmiş medyanın bu kadar altı
NDMI_MIN_HISTORY = 6
NDMI_MIN_BASE = 0.05  # bağıl düşüş, taban değer bundan küçükse anlamsız (sıfıra yakın)


def _tr_pct(value: float) -> str:
    return f"%{abs(value):.1f}".replace(".", ",")


def _tr_num(value: float) -> str:
    return f"{value:.2f}".replace(".", ",")


def index_series(scenes: list[SceneWithIndices], indeks: str) -> list[tuple[date, float]]:
    """Bulutsuz sahnelerdeki bahçe ortalamaları, tarihe göre sıralı."""
    return sorted(
        (item.scene.tarih, item.indices[indeks].ortalama)
        for item in scenes
        if item.scene.durum == "tamam" and indeks in item.indices
    )


def _compare_window(
    series: list[tuple[date, float]],
) -> tuple[tuple[date, float], tuple[date, float]] | None:
    """(önceki, son): son görüntüye göre 10–25 gün önceki en yeni geçerli görüntü."""
    if len(series) < 2:
        return None
    latest = series[-1]
    low = latest[0] - timedelta(days=WINDOW_MAX_DAYS)
    high = latest[0] - timedelta(days=WINDOW_MIN_DAYS)
    candidates = [point for point in series[:-1] if low <= point[0] <= high]
    return (candidates[-1], latest) if candidates else None


def _change_pct(previous: float, latest: float) -> float:
    return round((latest - previous) / previous * 100, 2)


def _drop_alert(indeks: str, series: list[tuple[date, float]]) -> Uyari | None:
    rule = DROP_RULES[indeks]
    window = _compare_window(series)
    if window is None:
        return None
    (prev_date, prev), (last_date, last) = window
    if not prev:
        return None
    change = _change_pct(prev, last)
    if change >= -rule["esik"]:  # tam eşik değeri "fazla" sayılmaz
        return None
    days = (last_date - prev_date).days
    return Uyari(
        tur="indeks_dusus",
        indeks=indeks,
        indeksler=[indeks],
        oncelik="normal",
        baslik=rule["baslik"],
        mesaj=(
            f"Ortalama {indeks.upper()} {_tr_num(prev)} → {_tr_num(last)} "
            f"({_tr_pct(change)} azalma, {days} günde). {rule['ek']}"
        ),
        onceki_tarih=prev_date,
        onceki_ortalama=round(prev, 4),
        son_tarih=last_date,
        son_ortalama=round(last, 4),
        degisim_yuzde=change,
    )


def _ndmi_alert(series: list[tuple[date, float]]) -> Uyari | None:
    """Belirgin düşüş (bağıl %15) veya bahçenin geçmiş medyanının belirgin altında → olası su stresi."""
    if len(series) < 2:
        return None
    last_date, last = series[-1]
    reasons: list[str] = []
    prev_date: date | None = None
    prev: float | None = None
    change: float | None = None

    window = _compare_window(series)
    if window is not None:
        (prev_date, prev), _ = window
        if prev > NDMI_MIN_BASE:
            change = _change_pct(prev, last)
            if change < -NDMI_DROP_PCT:
                days = (last_date - prev_date).days
                reasons.append(
                    f"ortalama NDMI {_tr_num(prev)} → {_tr_num(last)} ({_tr_pct(change)} azalma, {days} günde)"
                )

    history = [value for _, value in series[:-1]]
    if len(history) >= NDMI_MIN_HISTORY:
        median = statistics.median(history)
        if last < median - NDMI_BELOW_MEDIAN:
            reasons.append(
                f"son değer {_tr_num(last)}, bahçenin geçmiş medyanı {_tr_num(median)}'nın belirgin altında"
            )

    if not reasons:
        return None
    return Uyari(
        tur="indeks_dusus",
        indeks="ndmi",
        indeksler=["ndmi"],
        oncelik="normal",
        baslik="Olası su stresi",
        mesaj=(
            f"NDMI: {'; '.join(reasons)}. Yaprak su içeriği azalıyor olabilir; "
            "sulama programını ve toprak nemini kontrol edin."
        ),
        onceki_tarih=prev_date,
        onceki_ortalama=round(prev, 4) if prev is not None else None,
        son_tarih=last_date,
        son_ortalama=round(last, 4),
        degisim_yuzde=change,
    )


_TO_EQUAL_AREA = Transformer.from_crs(4326, 6933, always_xy=True)


def _zone_union(item: SceneWithIndices, indeks: str):
    row = item.indices.get(indeks)
    features = (row.sorunlu_bolge_geojson or {}).get("features", []) if row else []
    geoms = [shape(f["geometry"]) for f in features if f.get("geometry")]
    return unary_union(geoms) if geoms else None


def _overlap_m2(a, b) -> float:
    inter = a.intersection(b)
    if inter.is_empty:
        return 0.0
    return float(shapely_transform(_TO_EQUAL_AREA.transform, inter).area)


def build_alerts(scenes: list[SceneWithIndices]) -> list[Uyari]:
    """Tüm indeksler için uyarılar. Aynı bölgede birden fazla indeks düşüyorsa öncelik yükselir."""
    alerts: list[Uyari] = []
    for indeks in DROP_RULES:
        alert = _drop_alert(indeks, index_series(scenes, indeks))
        if alert:
            alerts.append(alert)
    ndmi = _ndmi_alert(index_series(scenes, "ndmi"))
    if ndmi:
        alerts.append(ndmi)

    if len(alerts) >= 2:
        by_date = {item.scene.tarih: item for item in scenes}
        unions = {}
        for alert in alerts:
            item = by_date.get(alert.son_tarih)
            zone = _zone_union(item, alert.indeks) if item and alert.indeks else None
            if zone is not None:
                unions[alert.indeks] = zone

        overlapping: dict[str, float] = {}
        names = list(unions)
        for i, first in enumerate(names):
            for second in names[i + 1 :]:
                area = _overlap_m2(unions[first], unions[second])
                if area >= OVERLAP_MIN_M2:
                    overlapping[first] = max(overlapping.get(first, 0.0), area)
                    overlapping[second] = max(overlapping.get(second, 0.0), area)

        if overlapping:
            for alert in alerts:
                if alert.indeks in overlapping:
                    alert.oncelik = "yuksek"
            members = [a for a in alerts if a.indeks in overlapping]
            area = max(overlapping.values())
            labels = " + ".join(a.indeks.upper() for a in members)
            alerts.append(
                Uyari(
                    tur="coklu_indeks",
                    indeks=None,
                    indeksler=[a.indeks for a in members],
                    oncelik="yuksek",
                    baslik="Aynı bölgede birden fazla indeks düşüyor",
                    mesaj=(
                        f"{labels} aynı bölgede (≈ {round(area):,} m²) birlikte düşüyor".replace(
                            ",", "."
                        )
                        + "; bu bölgede saha kontrolü öncelikli."
                    ),
                    son_tarih=max(a.son_tarih for a in members),
                    degisim_yuzde=None,
                )
            )

    order = {"yuksek": 0, "normal": 1}
    return sorted(alerts, key=lambda a: (order[a.oncelik], a.tur != "coklu_indeks", a.indeks or ""))


def months_back(today: date, months: int) -> date:
    """`months` ay öncesinin aynı günü (ay sonu taşmasında ayın son günü)."""
    year = today.year - (months // 12)
    month = today.month - (months % 12)
    if month <= 0:
        month += 12
        year -= 1
    for day in (today.day, 30, 29, 28):
        try:
            return date(year, month, day)
        except ValueError:
            continue
    raise ValueError("geçersiz tarih")
