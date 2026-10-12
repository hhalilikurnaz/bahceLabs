"""İndeks bazlı uyarı kuralları (saf fonksiyonlar) ve çoklu indeks önceliklendirmesi."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from pyproj import Transformer
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform as shapely_transform
from shapely.ops import unary_union

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.agro.score import ScoreConfig, baseline
from bahcelab_backend.domain.ndvi.repository import SceneWithIndices
from bahcelab_backend.domain.ndvi.schemas import Uyari

WINDOW_MIN_DAYS = 10
WINDOW_MAX_DAYS = 25
OVERLAP_MIN_M2 = 300.0  # aynı bölge sayılması için en az 3 piksel

# Çiftçi dilinde parametre adları (teknik ad ikincil, parantez içinde)
FARMER_NAMES: dict[str, str] = {
    "ndvi": "Canlılık",
    "msavi": "Toprak düzeltilmiş canlılık",
    "ndre": "Klorofil / besin",
    "ndmi": "Yaprak suyu",
    "cigreen": "Klorofil yoğunluğu",
}


def display_name(indeks: str) -> str:
    """"Canlılık (NDVI)" biçimi."""
    return f"{FARMER_NAMES.get(indeks, indeks.upper())} ({indeks.upper()})"


# İndeks bazlı düşüş eşikleri (yüzde) ve açıklayıcı Türkçe metinler.
# Uyarı, ham "son 10–25 günde %X düşüş" ile DEĞİL, bahçenin kendi mevsim normuna göre üretilir (skorla aynı norm):
#   düzeltilmiş değişim = gerçek değişim − normun aynı aralıktaki beklenen değişimi < −eşik
#   ve son değer, kendi normunun `norm_alti_yuzde` (yoksa eşiğin yarısı) kadar altında olmalı.
DROP_RULES: dict[str, dict[str, Any]] = {
    "ndvi": {
        "esik": 10.0,
        "baslik": "Canlılık düşüşü",
        "ek": "Genel canlılık azalıyor; sulama, hastalık veya stres belirtilerini kontrol edin.",
    },
    "msavi": {
        "esik": 10.0,
        "baslik": "Toprak düzeltilmiş canlılık düşüşü",
        "ek": "Toprak etkisinden arındırılmış bitki örtüsü azalıyor; yaprak örtüsü ve sıra arası durumunu kontrol edin.",
    },
    "ndre": {
        "esik": 12.0,
        "baslik": "Klorofil / besin düşüşü",
        "ek": "Olası besin eksikliği / sararma; yaprak kontrolü önerilir.",
    },
    "ndmi": {
        "esik": 15.0,  # bağıl düşüş
        "baslik": "Olası su stresi",
        "ek": "Yaprak su içeriği azalıyor olabilir; sulama programını ve toprak nemini kontrol edin.",
        "min_taban": 0.05,  # norm bu değerin altındaysa bağıl değişim anlamsız (sıfıra yakın)
        "mutlak_alti": 0.05,  # son değer normun en az bu kadar altında olmalı
    },
}
DEFAULT_MIN_BASE = 0.0


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


def _drop_alert(indeks: str, series: list[tuple[date, float]], cfg: ScoreConfig) -> Uyari | None:
    """Mevsim normuna göre düzeltilmiş düşüş; norm (geçen yıl aynı dönem / kendi taban) yoksa uyarı üretilmez."""
    rule = DROP_RULES[indeks]
    window = _compare_window(series)
    if window is None:
        return None
    (prev_date, prev), (last_date, last) = window
    norm_last = baseline([p for p in series if p[0] < last_date], last_date, cfg)
    norm_prev = baseline([p for p in series if p[0] < prev_date], prev_date, cfg)
    if norm_last is None or norm_prev is None:
        return None
    min_base = float(rule.get("min_taban", DEFAULT_MIN_BASE))
    if not prev or prev <= min_base or norm_prev.deger <= min_base or norm_last.deger <= 0:
        return None

    actual = _change_pct(prev, last)
    expected = round((norm_last.deger - norm_prev.deger) / norm_prev.deger * 100, 2)  # mevsimsel beklenen değişim
    adjusted = actual - expected
    deviation = (last - norm_last.deger) / norm_last.deger * 100
    esik = float(rule["esik"])
    if adjusted >= -esik:  # tam eşik değeri "fazla" sayılmaz
        return None
    if "mutlak_alti" in rule:
        if last >= norm_last.deger - float(rule["mutlak_alti"]):
            return None
    elif deviation >= -esik / 2:
        return None

    source = "bu dönemin kendi normu (geçen yıl aynı dönem)" if norm_last.kaynak == "gecmis_sezon" else "son haftalardaki kendi düzeyi"
    days = (last_date - prev_date).days
    return Uyari(
        tur="indeks_dusus",
        indeks=indeks,
        indeksler=[indeks],
        oncelik="normal",
        baslik=rule["baslik"],
        mesaj=(
            f"{display_name(indeks)}: son değer {_tr_num(last)}; {source} {_tr_num(norm_last.deger)} "
            f"({_tr_pct(deviation)} {'altında' if deviation < 0 else 'üstünde'}). Son {days} günde "
            f"{_tr_pct(actual)} {'azaldı' if actual < 0 else 'arttı'}; mevsimsel beklenen değişim {_tr_pct(expected)} "
            f"{'azalma' if expected < 0 else 'artış'} olduğundan beklenenden {_tr_pct(adjusted)} fazla düştü. {rule['ek']}"
        ),
        onceki_tarih=prev_date,
        onceki_ortalama=round(prev, 4),
        son_tarih=last_date,
        son_ortalama=round(last, 4),
        degisim_yuzde=actual,
        norm_degeri=round(norm_last.deger, 4),
        norm_kaynagi=norm_last.kaynak,
        beklenen_degisim_yuzde=expected,
        normdan_sapma_yuzde=round(deviation, 2),
    )


_TO_EQUAL_AREA = Transformer.from_crs(4326, 6933, always_xy=True)


def _zone_union(item: SceneWithIndices, indeks: str) -> BaseGeometry | None:
    row = item.indices.get(indeks)
    features = (row.sorunlu_bolge_geojson or {}).get("features", []) if row else []
    geoms = [shape(f["geometry"]) for f in features if f.get("geometry")]
    return unary_union(geoms) if geoms else None


def _overlap_m2(a: BaseGeometry, b: BaseGeometry) -> float:
    inter = a.intersection(b)
    if inter.is_empty:
        return 0.0
    return float(shapely_transform(_TO_EQUAL_AREA.transform, inter).area)


def _components(alerts: list[Uyari], overlaps: dict[tuple[str, str], float]) -> list[list[Uyari]]:
    """Aynı bölgede (alan örtüşmesi) düşen indeksleri bağlı bileşenlere ayırır."""
    parent = {a.indeks or "": a.indeks or "" for a in alerts}

    def find(x: str) -> str:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for first, second in overlaps:
        parent[find(first)] = find(second)
    groups: dict[str, list[Uyari]] = {}
    for alert in alerts:
        groups.setdefault(find(alert.indeks or ""), []).append(alert)
    return list(groups.values())


def build_alerts(scenes: list[SceneWithIndices], cfg: ScoreConfig | None = None) -> list[Uyari]:
    """Uyarılar: mevsim normuna göre düzeltilmiş düşüşler (skorla aynı norm).

    Aynı gün aynı bölgede birden fazla indeks düşüyorsa bunlar TEK olayda birleşir (bir olay = bir uyarı):
    `indeksler` etkilenen tüm indeksleri listeler ve öncelik yüksektir; bölgeleri ayrı olanlar kendi uyarılarını korur.
    """
    cfg = cfg or ScoreConfig.from_settings(get_settings())
    alerts: list[Uyari] = []
    for indeks in DROP_RULES:
        alert = _drop_alert(indeks, index_series(scenes, indeks), cfg)
        if alert:
            alerts.append(alert)

    if len(alerts) >= 2:
        by_date = {item.scene.tarih: item for item in scenes}
        unions: dict[tuple[date, str], BaseGeometry] = {}
        for alert in alerts:
            item = by_date.get(alert.son_tarih)
            zone = _zone_union(item, alert.indeks) if item and alert.indeks else None
            if zone is not None and alert.indeks is not None:
                unions[(alert.son_tarih, alert.indeks)] = zone

        overlaps: dict[tuple[str, str], float] = {}
        keys = list(unions)
        for i, first in enumerate(keys):
            for second in keys[i + 1 :]:
                if first[0] != second[0]:
                    continue  # farklı günlerin düşüşleri aynı olay sayılmaz
                area = _overlap_m2(unions[first], unions[second])
                if area >= OVERLAP_MIN_M2:
                    overlaps[(first[1], second[1])] = area

        merged: list[Uyari] = []
        remaining = list(alerts)
        for group in _components(alerts, overlaps):
            members = [a for a in group if any(a.indeks in pair for pair in overlaps)]
            if len(members) < 2:
                continue
            area = max(v for (x, y), v in overlaps.items() if x in {a.indeks for a in members} and y in {a.indeks for a in members})
            names = [a.indeks for a in members if a.indeks]
            area_text = f"{area / 1000:.1f}".replace(".", ",")  # dönüm (1 da = 1000 m²)
            details = "; ".join(
                f"{display_name(a.indeks)} normunun {_tr_pct(a.normdan_sapma_yuzde or 0)} altında" for a in members if a.indeks
            )
            merged.append(
                Uyari(
                    tur="coklu_indeks",
                    indeks=None,
                    indeksler=sorted(names),
                    oncelik="yuksek",
                    baslik="Aynı bölgede birkaç gösterge düşüyor",
                    mesaj=f"≈ {area_text} da alanda birlikte düşüyor; tek olay sayıldı, saha kontrolü öncelikli.",
                    ayrinti=f"{details}.",
                    son_tarih=max(a.son_tarih for a in members),
                    degisim_yuzde=None,
                )
            )
            remaining = [a for a in remaining if a not in members]
        alerts = [*remaining, *merged]

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
