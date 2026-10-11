"""Sentinel-2 indeks tanımları, formülleri ve renk skalaları (tek kaynak).

Arayüzdeki `lib/indices.ts` bu tanımların aynasıdır; burada bir değer değişirse orada da değişmelidir.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from bahcelab_backend.domain.imagery.roles import ALL_ROLES, CORE_ROLES, TRUE_COLOR_ROLES, Band

TRUE_COLOR = "gercek-renk"

# İndeksler sağlayıcıdan bağımsızdır: bant ROLLERİYLE tanımlanır (domain/imagery/roles.py).
# Sentinel-2 karşılıkları: blue=B02 green=B03 red=B04 rededge=B05 nir=B08 nir_narrow=B8A swir1=B11

# Renk skalaları: (konum 0–1, RGB). Konum, indeksin (min, max) aralığına göre normalize edilir.
COLORMAPS: dict[str, list[tuple[float, tuple[int, int, int]]]] = {
    # kırmızı → sarı → yeşil (NDVI için 0,0–0,9: eski sürümle birebir aynı duraklar)
    "rdylgn": [
        (0.0, (215, 48, 39)),
        (0.3 / 0.9, (252, 141, 89)),
        (0.5 / 0.9, (254, 224, 139)),
        (0.7 / 0.9, (145, 207, 96)),
        (1.0, (26, 152, 80)),
    ],
    # açık → koyu mavi (kuru → nemli)
    "mavi": [
        (0.0, (247, 251, 255)),
        (0.25, (198, 219, 239)),
        (0.5, (107, 174, 214)),
        (0.75, (33, 113, 181)),
        (1.0, (8, 48, 107)),
    ],
    # açık sarı → koyu yeşil (klorofil yoğunluğu)
    "yesil": [
        (0.0, (255, 255, 204)),
        (0.35, (194, 230, 153)),
        (0.7, (49, 163, 84)),
        (1.0, (0, 90, 50)),
    ],
    # değişim haritası: kırmızı = düşüş, beyaz = değişmedi, yeşil = artış
    "fark": [
        (0.0, (215, 48, 39)),
        (0.35, (252, 174, 145)),
        (0.5, (245, 245, 245)),
        (0.65, (166, 217, 106)),
        (1.0, (26, 152, 80)),
    ],
}


@dataclass(frozen=True)
class IndexDef:
    id: str
    ad: str
    kisa_aciklama: str
    aciklama: str
    bantlar: tuple[Band, ...]  # gereken bant rolleri
    min: float  # mutlak skala alt sınırı
    max: float  # mutlak skala üst sınırı
    renk: str  # COLORMAPS anahtarı
    sorun_esigi: float  # sorunlu bölge: bahçe medyanının bu kadar altı
    fark_araligi: float  # değişim haritası ±aralık
    birim_notu: str = ""


INDICES: dict[str, IndexDef] = {
    "ndvi": IndexDef(
        id="ndvi",
        ad="NDVI",
        kisa_aciklama="Genel canlılık / biyokütle",
        aciklama=(
            "Bitkinin yeşil yaprak yoğunluğunu gösterir. Yüksek değer sağlıklı ve yoğun yaprak örtüsü, "
            "düşük değer zayıf bitki, çıplak toprak veya stres demektir."
        ),
        bantlar=(Band.RED, Band.NIR),
        min=0.0,
        max=0.9,
        renk="rdylgn",
        sorun_esigi=0.10,
        fark_araligi=0.25,
    ),
    "msavi": IndexDef(
        id="msavi",
        ad="MSAVI",
        kisa_aciklama="Toprak etkisi düzeltilmiş canlılık",
        aciklama=(
            "NDVI'nin toprak parlaklığına duyarlılığını azaltır. Sıra arası çıplak toprak olan ya da "
            "genç bahçelerde bitki örtüsünü NDVI'dan daha güvenilir gösterir."
        ),
        bantlar=(Band.RED, Band.NIR),
        min=0.0,
        max=0.8,
        renk="rdylgn",
        sorun_esigi=0.10,
        fark_araligi=0.2,
    ),
    "ndre": IndexDef(
        id="ndre",
        ad="NDRE",
        kisa_aciklama="Klorofil / azot durumu",
        aciklama=(
            "Kırmızı kenar bandını kullanır; yaprak klorofil içeriğine ve azot durumuna duyarlıdır. "
            "Sararmayı NDVI'dan önce yakalayabilir."
        ),
        bantlar=(Band.REDEDGE, Band.NIR_NARROW),
        min=0.0,
        max=0.6,
        renk="rdylgn",
        sorun_esigi=0.05,
        fark_araligi=0.15,
    ),
    "ndmi": IndexDef(
        id="ndmi",
        ad="NDMI",
        kisa_aciklama="Yaprak su içeriği / su stresi",
        aciklama=(
            "Yakın kızılötesi ve kısa dalga kızılötesi (SWIR) farkıyla yaprağın su içeriğini gösterir. "
            "Koyu mavi nemli, açık ton kuru yaprak demektir; düşüşler su stresini işaret edebilir."
        ),
        bantlar=(Band.NIR_NARROW, Band.SWIR1),
        min=-0.2,
        max=0.6,
        renk="mavi",
        sorun_esigi=0.08,
        fark_araligi=0.15,
    ),
    "cigreen": IndexDef(
        id="cigreen",
        ad="CIgreen",
        kisa_aciklama="Klorofil yoğunluğu",
        aciklama=(
            "Yeşil banda göre yakın kızılötesi oranıdır; yaprak klorofil yoğunluğuyla doğrusala yakın "
            "ilişkilidir ve yoğun yaprak örtüsünde doymaz."
        ),
        bantlar=(Band.GREEN, Band.NIR),
        min=0.0,
        max=3.0,
        renk="yesil",
        sorun_esigi=0.35,
        fark_araligi=1.0,
    ),
}

INDEX_IDS: tuple[str, ...] = tuple(INDICES)
ALL_OUTPUTS: tuple[str, ...] = (*INDEX_IDS, TRUE_COLOR)

# Sahne "bulutlu mu" kararı bu iki rolle (+ sağlayıcının bulut maskesi) verilir
CORE_BANDS = CORE_ROLES
ALL_BANDS = ALL_ROLES


def _safe_ratio(numerator: np.ndarray, denominator: np.ndarray) -> np.ndarray:
    with np.errstate(divide="ignore", invalid="ignore"):
        out = numerator / denominator
    out[~np.isfinite(out) | (denominator == 0)] = np.nan
    return out


def normalized_difference(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """(a − b) / (a + b), payda 0 veya veri yoksa NaN; [-1, 1]'e kırpılır."""
    a = a.astype(np.float32)
    b = b.astype(np.float32)
    return np.clip(_safe_ratio(a - b, a + b), -1.0, 1.0)


def compute_ndvi(red: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """NDVI = (B08 − B04) / (B08 + B04)"""
    return normalized_difference(nir, red)


def compute_msavi2(red: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """MSAVI2 = (2·NIR + 1 − √((2·NIR + 1)² − 8·(NIR − RED))) / 2"""
    nir = nir.astype(np.float32)
    red = red.astype(np.float32)
    inside = (2 * nir + 1) ** 2 - 8 * (nir - red)
    with np.errstate(invalid="ignore"):
        out = (2 * nir + 1 - np.sqrt(inside)) / 2
    out[~np.isfinite(out) | (inside < 0)] = np.nan
    return np.clip(out, -1.0, 1.0)


def compute_ndre(b8a: np.ndarray, b05: np.ndarray) -> np.ndarray:
    """NDRE = (B8A − B05) / (B8A + B05)"""
    return normalized_difference(b8a, b05)


def compute_ndmi(b8a: np.ndarray, b11: np.ndarray) -> np.ndarray:
    """NDMI = (B8A − B11) / (B8A + B11)"""
    return normalized_difference(b8a, b11)


def compute_cigreen(nir: np.ndarray, green: np.ndarray) -> np.ndarray:
    """CIgreen = B08 / B03 − 1"""
    out = _safe_ratio(nir.astype(np.float32), green.astype(np.float32)) - 1.0
    out[~np.isfinite(out)] = np.nan
    return np.clip(out, -1.0, 20.0)


def compute_index(index_id: str, bands: dict[str, np.ndarray]) -> np.ndarray:
    """`bands`: rol → yansıtım (sağlayıcıdan bağımsız)."""
    if index_id == "ndvi":
        return compute_ndvi(bands[Band.RED], bands[Band.NIR])
    if index_id == "msavi":
        return compute_msavi2(bands[Band.RED], bands[Band.NIR])
    if index_id == "ndre":
        return compute_ndre(bands[Band.NIR_NARROW], bands[Band.REDEDGE])
    if index_id == "ndmi":
        return compute_ndmi(bands[Band.NIR_NARROW], bands[Band.SWIR1])
    if index_id == "cigreen":
        return compute_cigreen(bands[Band.NIR], bands[Band.GREEN])
    raise KeyError(index_id)


def bands_needed(outputs: set[str]) -> set[str]:
    """İstenen çıktılar için okunması gereken bant rolleri (her zaman red/nir çekirdeği dahil)."""
    needed: set[str] = set(CORE_BANDS)
    for output in outputs:
        if output == TRUE_COLOR:
            needed |= set(TRUE_COLOR_ROLES)
        else:
            needed |= {str(b) for b in INDICES[output].bantlar}
    return needed


def sample_index_definitions() -> list[dict]:
    """API için tanımlar (arayüz açıklamaları ve renk skalaları)."""
    return [
        {
            "id": d.id,
            "ad": d.ad,
            "kisa_aciklama": d.kisa_aciklama,
            "aciklama": d.aciklama,
            "min": d.min,
            "max": d.max,
            "renk": d.renk,
            "duraklar": [[pos, list(rgb)] for pos, rgb in COLORMAPS[d.renk]],
        }
        for d in INDICES.values()
    ]
