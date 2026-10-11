"""Zararlı / hastalık RİSK TAHMİNİ motoru (SAF). Parametreler `rules/riskler.yaml`'dandır; sonuç teşhis/reçete değildir."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from bahcelab_backend.domain.agro.rulebook import RiskKurali

Seviye = Literal["dusuk", "orta", "yuksek"]
ORDER: dict[Seviye, int] = {"dusuk": 0, "orta": 1, "yuksek": 2}


_DOWN: dict[Seviye, Seviye] = {"yuksek": "orta", "orta": "dusuk", "dusuk": "dusuk"}


def _down(level: Seviye) -> Seviye:
    return _DOWN[level]


@dataclass(frozen=True)
class RiskSonucu:
    kod: str
    ad: str
    seviye: Seviye
    gerekce: str
    gecerlilik_baslangic: date
    gecerlilik_bitis: date
    veri_yeterli: bool


@dataclass(frozen=True)
class GunVerisi:
    tarih: date
    tmin: float | None
    tmax: float | None
    yagis_mm: float | None = None
    ruzgar_kmh: float | None = None
    nem_yuzde: float | None = None  # yalnızca tahmin günlerinde bilinir

    @property
    def tmean(self) -> float | None:
        return None if self.tmin is None or self.tmax is None else (self.tmin + self.tmax) / 2


def _n(value: float) -> str:
    return f"{value:.0f}" if abs(value - round(value)) < 0.05 else f"{value:.1f}".replace(".", ",")


# ----------------------------------------------------------------------------- Akdeniz meyve sineği
def fruit_fly(rule: RiskKurali, history: dict[date, GunVerisi], today: date, stage_code: str | None, stage_name: str | None) -> RiskSonucu:
    p = rule.parametreler
    month, day = (int(x) for x in str(p["birikim_baslangic"]).split("-"))
    start = date(today.year, month, day)
    valid_end = today + timedelta(days=7)
    if today < start:
        return RiskSonucu("akdeniz_meyve_sinegi", rule.ad, "dusuk", f"Birikim {day}.{month:02d} tarihinde başlar; henüz etkili sıcaklık toplanmadı.", today, valid_end, True)

    total_days = (today - start).days
    gdd = 0.0
    have = 0
    for i in range(total_days):
        d = history.get(start + timedelta(days=i))
        if d and d.tmean is not None:
            gdd += max(0.0, d.tmean - float(p["gdd_taban_c"]))
            have += 1
    if total_days > 0 and have / total_days < 0.7:
        return RiskSonucu("akdeniz_meyve_sinegi", rule.ad, "dusuk", "Sıcaklık verisi eksik olduğundan gün-derece birikimi güvenilir hesaplanamadı (veri yetersiz).", today, valid_end, False)

    level: Seviye = "yuksek" if gdd >= float(p["yuksek_gdd"]) else "orta" if gdd >= float(p["orta_gdd"]) else "dusuk"
    window = int(p["sicaklik_pencere_gun"])
    recent = [d.tmean for d in (history.get(today - timedelta(days=i)) for i in range(1, window + 1)) if d and d.tmean is not None]
    notes: list[str] = []
    if recent:
        avg = sum(recent) / len(recent)
        lo, hi = float(p["aktif_sicaklik_min_c"]), float(p["aktif_sicaklik_max_c"])
        if not lo <= avg <= hi:
            level = _down(level)
            notes.append(f"son {len(recent)} gün ortalaması {_n(avg)} °C aktif aralığın ({_n(lo)}–{_n(hi)} °C) dışında olduğundan seviye düşürüldü")
        else:
            notes.append(f"son {len(recent)} gün ortalaması {_n(avg)} °C (aktif aralık {_n(lo)}–{_n(hi)} °C)")
    sensitive = stage_code in list(p["duyarli_evreler"])
    if level == "yuksek" and not sensitive:
        level = "orta"
        notes.append("meyve henüz duyarlı evrede olmadığından en çok “orta” verildi")
    elif stage_name:
        notes.append(f"evre: {stage_name}{' (duyarlı)' if sensitive else ''}")
    reason = f"{day}.{month:02d}'dan beri biriken etkili sıcaklık {_n(gdd)} GDD (orta eşik {_n(float(p['orta_gdd']))}, yüksek eşik {_n(float(p['yuksek_gdd']))}); " + "; ".join(notes) + "."
    return RiskSonucu("akdeniz_meyve_sinegi", rule.ad, level, reason, today, valid_end, True)


# ----------------------------------------------------------------------------- kırmızı örümcek
def red_spider(rule: RiskKurali, days: list[GunVerisi], today: date) -> RiskSonucu:
    p = rule.parametreler
    ordered = sorted(days, key=lambda d: d.tarih)
    horizon = today + timedelta(days=3)

    def hot_dry(d: GunVerisi) -> bool | None:
        if d.tmax is None:
            return None
        dry = d.yagis_mm is None or d.yagis_mm < float(p["yagis_esik_mm"])
        humid_ok = d.nem_yuzde is None or d.nem_yuzde <= float(p["nem_esik_yuzde"])
        return d.tmax >= float(p["tmax_esik_c"]) and dry and humid_ok

    usable = [d for d in ordered if d.tarih <= horizon and hot_dry(d) is not None]
    if len([d for d in usable if d.tarih <= today]) < 3:
        return RiskSonucu("kirmizi_orumcek", rule.ad, "dusuk", "Son günlere ait sıcaklık verisi yetersiz (veri yetersiz).", today, horizon, False)
    run = 0
    for d in reversed([d for d in usable if d.tarih <= today]):
        if hot_dry(d):
            run += 1
        else:
            break
    projected = run
    for d in [d for d in usable if d.tarih > today]:
        if hot_dry(d):
            projected += 1
        else:
            break
    level: Seviye = "yuksek" if projected >= int(p["yuksek_gun"]) else "orta" if projected >= int(p["orta_gun"]) else "dusuk"
    extra = f" (önümüzdeki günlerin tahminiyle {projected} güne uzuyor)" if projected > run else ""
    reason = (
        f"Art arda {run} gündür sıcak (en yüksek ≥ {_n(float(p['tmax_esik_c']))} °C) ve kuru (< {_n(float(p['yagis_esik_mm']))} mm) gün{extra}; "
        f"orta eşik {int(p['orta_gun'])}, yüksek eşik {int(p['yuksek_gun'])} gün."
    )
    return RiskSonucu("kirmizi_orumcek", rule.ad, level, reason, today, horizon, True)


# ----------------------------------------------------------------------------- kuruma hastalığı (mal secco)
def mal_secco(rule: RiskKurali, forecast: list[GunVerisi], today: date) -> RiskSonucu:
    p = rule.parametreler
    days = sorted((d for d in forecast if d.tarih >= today), key=lambda d: d.tarih)
    if not days:
        return RiskSonucu("kuruma_hastaligi", rule.ad, "dusuk", "Tahmin verisi yok (veri yetersiz).", today, today, False)
    keep = int(p["koruma_penceresi_gun"])

    def day_level(d: GunVerisi) -> Seviye:
        if d.yagis_mm is None or d.ruzgar_kmh is None or d.tmean is None:
            return "dusuk"
        warm = float(p["sicaklik_min_c"]) <= d.tmean <= float(p["sicaklik_max_c"])
        if not warm:
            return "dusuk"
        if d.yagis_mm >= float(p["yagis_yuksek_mm"]) and d.ruzgar_kmh >= float(p["ruzgar_yuksek_kmh"]):
            return "yuksek"
        if d.yagis_mm >= float(p["yagis_orta_mm"]) and d.ruzgar_kmh >= float(p["ruzgar_orta_kmh"]):
            return "orta"
        return "dusuk"

    triggers = [(d, day_level(d)) for d in days if day_level(d) != "dusuk"]
    end = days[-1].tarih
    if not triggers:
        return RiskSonucu("kuruma_hastaligi", rule.ad, "dusuk", "Önümüzdeki günlerde yağış, rüzgâr ve ılık sıcaklık koşulları birlikte oluşmuyor.", today, end, True)
    level: Seviye = max((lv for _, lv in triggers), key=lambda lv: ORDER[lv])
    first_day, last_day = triggers[0][0].tarih, triggers[-1][0].tarih
    worst = next(d for d, lv in triggers if lv == level)
    reason = (
        f"{worst.tarih.day}.{worst.tarih.month:02d} günü yağış {_n(worst.yagis_mm or 0)} mm, rüzgâr {_n(worst.ruzgar_kmh or 0)} km/s ve ortalama sıcaklık "
        f"{_n(worst.tmean or 0)} °C bekleniyor; bu koşullar enfeksiyon bulaşma olasılığını artırır. Risk penceresi koşulların ardından {keep} gün sürer."
    )
    return RiskSonucu("kuruma_hastaligi", rule.ad, level, reason, first_day, last_day + timedelta(days=keep), True)
