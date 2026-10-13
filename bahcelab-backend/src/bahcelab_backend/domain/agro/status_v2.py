"""Bahçe durumu v2 (SAF, ADR 0018): sonuç sayı değil KADEME — İyi · İzle · Dikkat · Sorun. İç puan arayüze ve API'ye çıkmaz.

Beş bileşen, her biri bahçenin KENDİ dönem normuna göre (aynı takvim ayının geçmişi; ortanca/MAD sapması, YALNIZ aşağı yön ceza):
Ağaç gücü (NDVI) · Su (NDMI + kök bölgesi doluluğu) · Beslenme (NDRE) · Ani değişim (S2 düşüşü + yüksek güvenli radar adayı) · Isı (Landsat yüzey–hava, aynı ay bandı).
Radar nem değildir: Su bileşenine girmez. Bayat bileşenin ağırlığı diğerlerine dağıtılır ve güven düşer. Risk tavanı: orta → en fazla İzle, yüksek → en fazla Dikkat.
Ağırlıklar, eşikler ve kademe sınırları katalogdadır («ön değer · v2»).
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal

from bahcelab_backend.domain.agro.catalog import DurumV2Kurali
from bahcelab_backend.domain.agro.score import AY_ADLARI, AktifRisk

Kademe = Literal["iyi", "izle", "dikkat", "sorun", "veri_yok"]
Seviye = Literal["belirgin_dusuk", "normalin_alti", "normal", "normalin_ustu", "belirgin_yuksek"]
BAD_DOWN = {"belirgin_dusuk": 2, "normalin_alti": 1}  # aşağı yön kötüdür (ağaç gücü, beslenme, su)
BAD_UP = {"belirgin_yuksek": 2, "normalin_ustu": 1}  # yukarı yön kötüdür (ısı)
Guven = Literal["yuksek", "orta", "dusuk"]
KADEME_ADI: dict[str, str] = {"iyi": "İyi", "izle": "İzle", "dikkat": "Dikkat", "sorun": "Sorun", "veri_yok": "Veri yok"}
BILESEN_ADI = {"agac_gucu": "Ağaç gücü", "su": "Su", "beslenme": "Beslenme", "ani_degisim": "Ani değişim", "isi": "Isı"}
BILESEN_SIRASI = ("agac_gucu", "su", "beslenme", "ani_degisim", "isi")
MAD_OLCEK = 1.4826  # normal dağılımda MAD → standart sapma


@dataclass(frozen=True)
class IndexInput:
    """Bir indeksin son net S2 değeri ve bahçenin AYNI takvim ayındaki geçmiş sahne değerleri (son sahnenin kendisi hariç)."""

    deger: float
    tarih: date
    gecmis: list[float]


@dataclass(frozen=True)
class ChangeSignal:
    """Ani değişim sinyali: `s2` (NDVI bitişik düşüş) ya da `radar` (yalnız güven=yüksek aday)."""

    kaynak: Literal["s2", "radar"]
    tarih: date


@dataclass(frozen=True)
class HeatInput:
    """Son Landsat geçişinin aynı-ay bandına göre durumu (9E): fark, bandın üst sınırı, karışık piksel."""

    tarih: date
    fark_c: float | None
    bant_ust_c: float | None
    karisik_piksel: bool | None
    bant: tuple[float, float, float, float] | None = None  # aynı ay yüzey–hava farkının p10, p25, p75, p90 değeri (etiket kuralı)


@dataclass(frozen=True)
class StatusInputs:
    bugun: date
    ndvi: IndexInput | None
    ndmi: IndexInput | None
    ndre: IndexInput | None
    doluluk: float | None  # kök bölgesi, dönem normaline göre %
    doluluk_tarihi: date | None
    degisimler: list[ChangeSignal]
    isi: HeatInput | None
    riskler: list[AktifRisk] = field(default_factory=list)
    kirmizi_uyari: bool = False  # hava kırmızı uyarısı (don/aşırı sıcak): kademe en az Dikkat
    doluluk_bant: tuple[float, float, float, float] | None = None  # kök bölgesi doluluğunun dönem p10, p25, p75, p90 değeri


@dataclass(frozen=True)
class BilesenV2:
    kod: str
    ad: str
    puan: int | None  # İÇ değer: arayüze çıkmaz
    seviye: Seviye | None
    kullanilabilir: bool
    bayat: bool
    agirlik: float  # katalog ağırlığı
    etkin_agirlik: float  # bayat/eksik bileşenlerin payı dağıtıldıktan sonra
    neden: str
    veri_tarihi: date | None


@dataclass(frozen=True)
class DurumV2:
    kademe: Kademe
    bilesenler: list[BilesenV2]
    guven: Guven
    guven_nedeni: str
    nasil: list[str]  # «Nasıl hesaplandı?»: en çok 3 cümle
    dusuren: list[str]  # kademeyi en çok düşüren 1–2 bileşen kodu
    risk_sinirladi: bool
    ic_puan: int | None  # YALNIZ karşılaştırma/test içindir; API'ye yazılmaz


# ----------------------------------------------------------------------------- bileşen puanları (saf)
def robust_center_scale(values: list[float], sigma_floor: float) -> tuple[float, float]:
    """(ortanca, ölçek): ölçek = 1,4826·MAD, `sigma_floor`'un altına inmez (dar geçmişte küçük oynama büyük ceza doğurmasın)."""
    med = statistics.median(values)
    mad = statistics.median(abs(v - med) for v in values)
    return med, max(MAD_OLCEK * mad, sigma_floor)


def penalty_points(z_low: float, rule: DurumV2Kurali) -> int:
    """Aşağı sapma (ölçek birimiyle): toleransa kadar 100, `z_sifir`'da 0, arası doğrusal."""
    if z_low <= rule.z_tolerans:
        return 100
    if z_low >= rule.z_sifir:
        return 0
    return round(100 * (1 - (z_low - rule.z_tolerans) / (rule.z_sifir - rule.z_tolerans)))


def index_points(item: IndexInput | None, sigma_floor: float, rule: DurumV2Kurali) -> tuple[int | None, str]:
    """İndeks puanı: son değer, bahçenin aynı ay geçmişinin ortancasından ölçekli kaç birim AŞAĞIDA? Yukarı sapma ceza değildir."""
    if item is None:
        return None, "uydu verisi yok"
    if len(item.gecmis) < rule.asgari_ornek:
        return None, "bu ay için yeterli geçmiş yok"
    center, scale = robust_center_scale(item.gecmis, sigma_floor)
    return penalty_points((center - item.deger) / scale, rule), ""


def fill_points(fill: float | None, rule: DurumV2Kurali) -> int | None:
    if fill is None:
        return None
    if fill >= rule.doluluk_normal_min:
        return 100
    if fill <= rule.doluluk_sifir:
        return 0
    return round(100 * (fill - rule.doluluk_sifir) / (rule.doluluk_normal_min - rule.doluluk_sifir))


def combine_water(ndmi: int | None, fill: int | None, rule: DurumV2Kurali) -> int | None:
    """Su puanı: NDMI ve doluluk cezasının ORTALAMASI; ikisi de normalin altındaysa ikisinin KÖTÜSÜ. Biri yoksa diğeri."""
    if ndmi is None or fill is None:
        return ndmi if fill is None else fill
    if ndmi < rule.bilesen_normal_min and fill < rule.bilesen_normal_min:
        return min(ndmi, fill)
    return round((ndmi + fill) / 2)


def change_points(signals: list[ChangeSignal], today: date, rule: DurumV2Kurali) -> tuple[int, list[str]]:
    recent = [s for s in signals if timedelta(0) <= today - s.tarih <= timedelta(days=rule.ani_pencere_gun)]
    kinds = {s.kaynak for s in recent}
    if kinds == {"s2", "radar"}:
        return rule.ani_ikisi_puan, ["optik düşüş", "radar değişimi"]
    if kinds == {"s2"}:
        return rule.ani_s2_puan, ["optik düşüş"]
    if kinds == {"radar"}:
        return rule.ani_radar_puan, ["radar değişimi"]
    return 100, []


def heat_points(heat: HeatInput | None, rule: DurumV2Kurali) -> tuple[int | None, str]:
    if heat is None:
        return None, "Landsat geçişi yok"
    if heat.karisik_piksel:
        return None, "karışık piksel: bahçe dışı etkisi olabilir"
    if heat.fark_c is None or heat.bant_ust_c is None:
        return None, "aynı ay için yeterli geçmiş yok"
    excess = heat.fark_c - heat.bant_ust_c
    if excess <= 0:
        return 100, ""
    return round(100 * (1 - min(1.0, excess / rule.isi_sifir_c))), ""


def level_of(points: int | None, rule: DurumV2Kurali) -> Seviye | None:
    if points is None:
        return None
    return "normal" if points >= rule.bilesen_normal_min else "belirgin_dusuk" if points <= rule.bilesen_belirgin_dusuk_max else "normalin_alti"


def position_label(value: float, band: tuple[float, float, float, float], rule: DurumV2Kurali) -> Seviye:
    """TEK etiket kuralı (her bileşende aynı): p25–p75 normal · p10–p25 / p75–p90 normalin altı/üstü · <p10 / >p90 belirgin. `band` = (p10, p25, p75, p90)."""
    p10, p25, p75, p90 = band
    if value < p10:
        return "belirgin_dusuk"
    if value < p25:
        return "normalin_alti"
    if value > p90:
        return "belirgin_yuksek"
    if value > p75:
        return "normalin_ustu"
    return "normal"


def percentile_band(samples: list[float], rule: DurumV2Kurali) -> tuple[float, float, float, float]:
    a, b, c, d = (float(v) for v in statistics_percentile(samples, [rule.bant_belirgin_alt, rule.bant_normal_alt, rule.bant_normal_ust, rule.bant_belirgin_ust]))
    return a, b, c, d


def statistics_percentile(samples: list[float], q: list[float]) -> list[float]:
    ordered = sorted(samples)
    n = len(ordered)
    out = []
    for p in q:
        pos = (n - 1) * p / 100.0
        lo, hi = int(pos // 1), min(n - 1, int(pos // 1) + 1)
        out.append(ordered[lo] + (ordered[hi] - ordered[lo]) * (pos - lo))
    return out


def index_label(item: IndexInput | None, rule: DurumV2Kurali) -> Seviye | None:
    if item is None or len(item.gecmis) < rule.asgari_ornek:
        return None
    return position_label(item.deger, percentile_band(item.gecmis, rule), rule)


def water_label(ndmi: Seviye | None, fill: Seviye | None) -> Seviye | None:
    """Su etiketi: biri yoksa öbürü; ikisi de normalin altındaysa KÖTÜSÜ (puanla aynı kural); yalnız biri düşükse en çok «normalin altı» (puan ortalaması); yukarı yön etiketi gösterim içindir."""
    if ndmi is None or fill is None:
        return ndmi if fill is None else fill
    down_a, down_b = BAD_DOWN.get(ndmi, 0), BAD_DOWN.get(fill, 0)
    if down_a and down_b:
        return ndmi if down_a >= down_b else fill
    if down_a or down_b:
        return "normalin_alti"
    if "belirgin_yuksek" in (ndmi, fill):
        return "belirgin_yuksek"
    return "normalin_ustu" if "normalin_ustu" in (ndmi, fill) else "normal"


def heat_label(heat: HeatInput | None) -> Seviye | None:
    if heat is None or heat.karisik_piksel or heat.fark_c is None or heat.bant is None:
        return None
    p10, p25, p75, p90 = heat.bant
    return "belirgin_yuksek" if heat.fark_c > p90 else "normalin_ustu" if heat.fark_c > p75 else "belirgin_dusuk" if heat.fark_c < p10 else "normalin_alti" if heat.fark_c < p25 else "normal"


def change_label(kinds: list[str]) -> Seviye:
    """Ani değişim dağılım değil olay sayımıdır: olay yok = normal; yalnız radar = normalin altı; optik düşüş (tek başına ya da radarla) = belirgin."""
    return "belirgin_dusuk" if "optik düşüş" in kinds else "normalin_alti" if kinds else "normal"


# ----------------------------------------------------------------------------- kademe
def tier_of(score: int, rule: DurumV2Kurali) -> Kademe:
    return "iyi" if score >= rule.iyi_min else "izle" if score >= rule.izle_min else "dikkat" if score >= rule.dikkat_min else "sorun"


def apply_caps(tier: Kademe, risks: list[AktifRisk], red_alert: bool) -> tuple[Kademe, bool]:
    """Risk tavanı: orta risk → en fazla İzle (İyi olamaz); yüksek risk → en fazla Dikkat; kırmızı hava uyarısı en az Dikkat. Daha kötü kademe yükseltilmez."""
    high = any(r.seviye == "yuksek" for r in risks)
    capped = False
    if tier == "iyi" and (risks or red_alert):
        tier, capped = "izle", True
    if tier in ("iyi", "izle") and (high or red_alert):
        tier, capped = "dikkat", True
    return tier, capped


def _stale(day: date | None, today: date, limit: int) -> bool:
    return day is None or (today - day).days > limit


def _phrase(name: str, label: Seviye | None, month: str | None, *, up_is_bad: bool = False) -> str:
    where = f"{month} normalinin" if month else "dönem normalinin"
    if label is None:
        return f"{name}: değerlendirilemedi."
    text = {
        "belirgin_dusuk": f"{where} belirgin altında", "normalin_alti": f"{where} altında", "normal": f"{month or 'dönem'} normali ile uyumlu",
        "normalin_ustu": f"{where} üstünde", "belirgin_yuksek": f"{where} belirgin üstünde",
    }[label]
    return f"{name}, {text}."


def _is_bad(label: Seviye | None, up_is_bad: bool) -> bool:
    return label is not None and label in (BAD_UP if up_is_bad else BAD_DOWN)


def evaluate(inp: StatusInputs, rule: DurumV2Kurali) -> DurumV2:
    today = inp.bugun
    ndvi_p, ndvi_why = index_points(inp.ndvi, rule.sigma_taban_ndvi, rule)
    ndmi_p, ndmi_why = index_points(inp.ndmi, rule.sigma_taban_ndmi, rule)
    ndre_p, ndre_why = index_points(inp.ndre, rule.sigma_taban_ndre, rule)
    s2_day = max((i.tarih for i in (inp.ndvi, inp.ndmi, inp.ndre) if i is not None), default=None)
    s2_stale = _stale(s2_day, today, rule.bayat_s2_gun)
    heat_p, heat_why = heat_points(inp.isi, rule)
    heat_stale = inp.isi is None or _stale(inp.isi.tarih, today, rule.bayat_landsat_gun)
    fill_p = fill_points(inp.doluluk, rule)
    change_p, change_kinds = change_points(inp.degisimler, today, rule)
    anchor = inp.ndvi or inp.ndmi or inp.ndre
    month = AY_ADLARI[anchor.tarih.month] if anchor is not None else None

    # etiketler: TEK kural (p25–p75 normal · p10–p25 / p75–p90 altı/üstü · <p10 / >p90 belirgin); bayat/eksik bileşen etiketsizdir
    ndvi_l = None if s2_stale else index_label(inp.ndvi, rule)
    ndre_l = None if s2_stale else index_label(inp.ndre, rule)
    ndmi_l = None if s2_stale else index_label(inp.ndmi, rule)
    fill_l = position_label(inp.doluluk, inp.doluluk_bant, rule) if inp.doluluk is not None and inp.doluluk_bant is not None else None
    heat_l = None if heat_stale else heat_label(inp.isi)

    def lbl_or_points(label: Seviye | None, points: int | None) -> Seviye | None:
        return label if label is not None else level_of(points, rule)  # dağılım yoksa (ör. doluluk bandı) puan eşiğine düşülür

    ndmi_use = None if s2_stale else ndmi_p
    water_p = combine_water(ndmi_use, fill_p, rule)
    water_l = water_label(ndmi_l, lbl_or_points(fill_l, fill_p))
    if water_p is None:
        water_why = "NDMI ve kök bölgesi nemi yok."
    else:
        water_why = _phrase("Su", water_l, month)
        if BAD_DOWN.get(ndmi_l or "", 0) and BAD_DOWN.get(lbl_or_points(fill_l, fill_p) or "", 0):
            water_why += " Kök bölgesi ve yaprak suyu birlikte düşük."

    raw: list[tuple[str, float, int | None, bool, str, Seviye | None, date | None]] = [
        ("agac_gucu", rule.w_agac_gucu, None if s2_stale else ndvi_p, s2_stale and ndvi_p is not None, _phrase("Ağaç gücü", ndvi_l, month) if ndvi_p is not None and not s2_stale else (f"Ağaç gücü: {'veri bayat' if s2_stale and ndvi_p is not None else ndvi_why}."), ndvi_l, inp.ndvi.tarih if inp.ndvi else None),
        ("su", rule.w_su, water_p, False, water_why, water_l, inp.doluluk_tarihi or (inp.ndmi.tarih if inp.ndmi else None)),
        ("beslenme", rule.w_beslenme, None if s2_stale else ndre_p, s2_stale and ndre_p is not None, _phrase("Beslenme", ndre_l, month) if ndre_p is not None and not s2_stale else (f"Beslenme: {'veri bayat' if s2_stale and ndre_p is not None else ndre_why}."), ndre_l, inp.ndre.tarih if inp.ndre else None),
        (
            "ani_degisim", rule.w_ani_degisim, None if (s2_stale and not any(s.kaynak == "radar" for s in inp.degisimler)) else change_p, False,
            f"Son {rule.ani_pencere_gun} günde {' ve '.join(change_kinds)} görüldü." if change_kinds else f"Son {rule.ani_pencere_gun} günde ani değişim görülmedi.", change_label(change_kinds), s2_day,
        ),
        ("isi", rule.w_isi, None if heat_stale else heat_p, heat_stale and inp.isi is not None and heat_p is not None, _phrase("Isı", heat_l, "aynı ay", up_is_bad=True) if heat_p is not None and not heat_stale else (f"Isı: {'veri bayat' if heat_stale and inp.isi is not None else heat_why}."), heat_l, inp.isi.tarih if inp.isi else None),
    ]
    usable_weight = sum(w for _, w, p, _, _, _, _ in raw if p is not None)
    components: list[BilesenV2] = []
    for kod, w, p, stale, why, label, day in raw:
        shown = None if p is None else (label if label is not None else level_of(p, rule))
        components.append(BilesenV2(kod, BILESEN_ADI[kod], p, shown, p is not None, stale, w, (w / usable_weight if usable_weight > 0 and p is not None else 0.0), why, day))
    score = round(sum((c.puan or 0) * c.etkin_agirlik for c in components)) if usable_weight >= rule.min_toplam_agirlik else None

    high = any(r.seviye == "yuksek" for r in inp.riskler)
    if score is None:
        if inp.kirmizi_uyari or high:
            tier: Kademe = "dikkat"
        elif inp.riskler:
            tier = "izle"
        else:
            tier = "veri_yok"
        capped = tier != "veri_yok"
    else:
        tier, capped = apply_caps(tier_of(score, rule), inp.riskler, inp.kirmizi_uyari)

    losses = sorted(
        ((c.etkin_agirlik * (100 - c.puan), c) for c in components if c.puan is not None and c.puan < 100 and _is_bad(c.seviye, c.kod == "isi")), key=lambda t: t[0], reverse=True
    )  # kademeyi düşüren: kötü yönde etiketli ve puan kaybı olan bileşenler
    lowering = [c.kod for _, c in losses[:2]]
    missing = [c for c in components if not c.kullanilabilir and c.kod != "ani_degisim"]
    low_samples = any(i is not None and len(i.gecmis) < rule.asgari_ornek for i in (inp.ndvi, inp.ndmi, inp.ndre))
    trust: Guven = "yuksek" if not missing and not low_samples else "orta" if len(missing) <= 1 else "dusuk"
    if tier == "veri_yok":
        trust = "dusuk"
    trust_reason = "Tüm bileşenler güncel." if not missing and not low_samples else "; ".join(f"{c.ad}: {c.neden.split(': ', 1)[-1].rstrip('.')}" for c in missing) + ("; geçmiş örnek sayısı az." if low_samples else ".")
    return DurumV2(tier, components, trust, trust_reason, how_computed(tier, components, lowering, inp, rule, trust, capped, month), lowering, capped, score)


def how_computed(tier: Kademe, components: list[BilesenV2], lowering: list[str], inp: StatusInputs, rule: DurumV2Kurali, trust: Guven, capped: bool, month: str | None) -> list[str]:
    """«Nasıl hesaplandı?»: en çok 3 cümle — kademeyi düşüren bileşen(ler) · veri tarihleri · güven. Sayı yok."""
    by = {c.kod: c for c in components}
    if tier == "veri_yok":
        first = "Kademe için yeterli veri yok."
    elif lowering:
        first = f"Kademeyi en çok {' ve '.join(by[k].ad for k in lowering)} düşürüyor: {' '.join(by[k].neden for k in lowering)}"
    elif capped:
        first = "Aktif risk ya da uyarı olduğu için kademe sınırlandı."
    else:
        first = "Beş bileşen de kendi dönem normuna uygun."
    if capped and lowering:
        first += " Aktif risk kademeyi ayrıca sınırlıyor."
    parts = []
    if inp.ndvi or inp.ndmi or inp.ndre:
        s2 = max(i.tarih for i in (inp.ndvi, inp.ndmi, inp.ndre) if i is not None)
        parts.append(f"son net görüntü {s2.day} {AY_ADLARI[s2.month]}")
    if inp.isi is not None:
        parts.append(f"Landsat {inp.isi.tarih.day} {AY_ADLARI[inp.isi.tarih.month]}")
    if inp.doluluk_tarihi is not None:
        parts.append(f"toprak nemi {inp.doluluk_tarihi.day} {AY_ADLARI[inp.doluluk_tarihi.month]}")
    second = ("Veri: " + ", ".join(parts) + ".") if parts else "Uydu verisi yok."
    third = f"Güven {'yüksek' if trust == 'yuksek' else 'orta' if trust == 'orta' else 'düşük'}; eşikler ön değer (v2)."
    return [first, second, third]
