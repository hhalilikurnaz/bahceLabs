"""Gece don riski: SAF mantık (ağ/veritabanı yok). Tahmin = «en soğuk model» (IFS, ICON, GFS'nin en düşüğü); sapma düzeltmesi YOK (don-dogrulama.md §6, ADR 0031).
Seviyeler: yok → izle (yalnız uygulama içi) → uyari (18:00 bildirimi). Dil: olasılık sözcükleri; kesin «don olacak» denmez."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal

from bahcelab_backend.domain.agro.catalog import DonKurali

Seviye = Literal["yok", "izle", "uyari"]
SOZ: dict[str, str] = {"yok": "düşük", "izle": "orta", "uyari": "yüksek"}
TEMKIN_NOTU = "Uyarılarımız bilerek temkinlidir: don olmayan geceler için de uyarabiliriz; kaçırmamayı önceliklendiriyoruz."


@dataclass(frozen=True)
class SaatlikModel:
    """Bir modelin saatlik tahmini (yerel saat, ISO 'YYYY-MM-DDTHH:MM')."""

    model: str
    zaman: list[str]
    t2m: list[float | None]
    bulut: list[float | None] = field(default_factory=list)  # %
    ruzgar: list[float | None] = field(default_factory=list)  # m/s


@dataclass(frozen=True)
class GeceOzeti:
    gece: date  # akşamın tarihi; sabah (minimumun görüldüğü gün) = gece + 1
    tmin_model: dict[str, float]
    en_soguk_c: float
    kac_model_uzlasi: int  # kritik + uzlaşı eşiği altındaki model sayısı
    bulut_ort: float | None
    ruzgar_ort: float | None
    saat_kritik_alti: int  # en soğuk modelin saatlik değeri ≤ kritik olan saat sayısı (bilgi; uyarıyı KISITLAMAZ)


@dataclass(frozen=True)
class Karar:
    seviye: Seviye
    soz: str
    olasilik: float  # P(T_min ≤ kritik), N(en soğuk model, σ²) — yalnız sıralama/denetim için; kullanıcıya SÖZCÜK gösterilir
    kritik_c: float
    neden: str


def _norm_cdf(z: float) -> float:
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


def gece_ozeti(modeller: list[SaatlikModel], gece: date, kritik_c: float, kural: DonKurali) -> GeceOzeti | None:
    """`gece` akşamı için: sabah günü (gece+1) takvim gününün saatlik minimumu (doğrulamayla AYNI tanım), bulut/rüzgâr 00–07 ortalaması. Eksik (< 22 saat) modeller dışlanır."""
    sabah = (gece + timedelta(days=1)).isoformat()
    tmin: dict[str, float] = {}
    bulut: list[float] = []
    ruzgar: list[float] = []
    saat_alti = None
    for m in modeller:
        v = [(z, t) for z, t in zip(m.zaman, m.t2m, strict=False) if z.startswith(sabah) and t is not None]
        if len(v) < 22:
            continue
        tmin[m.model] = min(t for _, t in v)
        b = [x for z, x in zip(m.zaman, m.bulut, strict=False) if z.startswith(sabah) and int(z[11:13]) <= 7 and x is not None]
        w = [x for z, x in zip(m.zaman, m.ruzgar, strict=False) if z.startswith(sabah) and int(z[11:13]) <= 7 and x is not None]
        if len(b) >= 6:
            bulut.append(sum(b) / len(b))
        if len(w) >= 6:
            ruzgar.append(sum(w) / len(w))
        if tmin[m.model] == min(tmin.values()):
            saat_alti = sum(1 for _, t in v if t <= kritik_c)
    if len(tmin) < kural.min_model_sayisi:
        return None
    return GeceOzeti(
        gece=gece, tmin_model={k: round(x, 1) for k, x in tmin.items()}, en_soguk_c=round(min(tmin.values()), 1),
        kac_model_uzlasi=sum(1 for x in tmin.values() if x <= kritik_c + kural.uzlasi_k),
        bulut_ort=round(sum(bulut) / len(bulut), 1) if bulut else None, ruzgar_ort=round(sum(ruzgar) / len(ruzgar), 1) if ruzgar else None,
        saat_kritik_alti=int(saat_alti or 0),
    )


def acik_sakin(o: GeceOzeti, kural: DonKurali) -> bool | None:
    """Açık + sakin gece tahmini; bulut/rüzgâr tahmini yoksa None (ölçülemiyor)."""
    if o.bulut_ort is None or o.ruzgar_ort is None:
        return None
    return o.bulut_ort < kural.acik_sakin_bulut_max and o.ruzgar_ort < kural.acik_sakin_ruzgar_max


def karar(o: GeceOzeti, kritik_c: float, kural: DonKurali) -> Karar:
    """Uyarı kuralı katalogdan: A (en soğuk ≤ kritik+uyari_k), B (A + en az 2 model ≤ kritik+uzlasi_k), C (B + açık-sakin). İzle: en soğuk ≤ kritik+izle_k."""
    fark = o.en_soguk_c - kritik_c
    p = _norm_cdf((kritik_c - o.en_soguk_c) / kural.sigma_c)
    a = fark <= kural.uyari_k
    b = a and o.kac_model_uzlasi >= 2
    if kural.uyari_kural == "A":
        uyari, kos = a, f"en soğuk model ≤ kritik + {kural.uyari_k:g} K"
    elif kural.uyari_kural == "B":
        uyari, kos = b, f"en soğuk model ≤ kritik + {kural.uyari_k:g} K ve en az 2 model ≤ kritik + {kural.uzlasi_k:g} K"
    else:
        sk = acik_sakin(o, kural)
        uyari = b and sk is not False  # bulut/rüzgâr tahmini yoksa (None) kaçırmama tarafında uyarıyı KISITLAMA
        kos = f"B ve açık-sakin gece (bulut < {kural.acik_sakin_bulut_max:g} %, rüzgâr < {kural.acik_sakin_ruzgar_max:g} m/s)"
    if uyari:
        sev: Seviye = "uyari"
    elif fark <= kural.izle_k:
        sev = "izle"
    else:
        sev = "yok"
    neden = (
        f"En soğuk model {o.en_soguk_c:.1f} °C (kritik {kritik_c:.1f} °C; fark {fark:+.1f} K); {o.kac_model_uzlasi}/{len(o.tmin_model)} model kritik + {kural.uzlasi_k:g} K altında. "
        + (f"Uyarı kuralı ({kural.uyari_kural}): {kos}." if sev == "uyari" else f"İzle: en soğuk model ≤ kritik + {kural.izle_k:g} K." if sev == "izle" else "Eşiklerin üstünde.")
    )
    return Karar(sev, SOZ[sev], round(p, 3), kritik_c, neden)


def kritik_sicaklik(evre: str | None, kural: DonKurali) -> tuple[float, list[str]] | None:
    """Fenoloji evresindeki organların kritik sıcaklıklarının EN YÜKSEĞİ (temkinli). Yaprak/odun modelde YOK (kaynak yok: mühendis girdisi bekleniyor)."""
    if evre is None or evre not in kural.evre_organ:
        return None
    organlar = kural.evre_organ[evre]
    degerler = [(v, o) for o in organlar if (v := kural.kritik_c.get(o)) is not None]
    if not degerler:
        return None
    return max(v for v, _ in degerler), [o for _, o in degerler]


NASIL = (
    "Önümüzdeki gecelerin en düşük sıcaklığı üç hava modelinin (ECMWF IFS, ICON, GFS) saatlik tahmininden alınır; üçünün EN SOĞUĞU esas alınır, "
    "çünkü kaçırmamak yanlış alarmdan önemlidir. Kritik sıcaklık, ağacın o dönemdeki en hassas organına göre seçilir (çiçek −2,8 °C; meyve evrelerinde −0,8 … −1,4 °C; "
    "UC ANR 8100 ve FAO Tablo 4.10). Modellerin bahçe sıcaklığındaki hatası ≈ 2,4 K'dir; bu yüzden eşiğin 2–3 K üstü bile «izle/uyarı» sayılır. "
    "Arazi (vadi, yamaç) sıcaklığa eklenmez; yalnız betimlenir. Yaprak ve odun hasarı için kaynaklı eşik yoktur. Eşikler ön değerdir; mühendis onayı bekler."
)
