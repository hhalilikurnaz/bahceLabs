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


# (kural, seviye) → sade cümle. «Orta/yüksek» dışındakiler Bugün listesinde gösterilmez.
_PLAIN: dict[tuple[str, Seviye], str] = {
    ("akdeniz_meyve_sinegi", "orta"): "Meyve sineği için koşullar uygun – tuzakları kontrol edin.",
    ("akdeniz_meyve_sinegi", "yuksek"): "Tuzaklarda meyve sineği çok yakalandı – ilçe tarım müdürlüğüne danışın.",
    ("kirmizi_orumcek", "orta"): "Sıcak ve kuru günler sürüyor – yaprakların altında kırmızı örümceği kontrol edin.",
    ("kirmizi_orumcek", "yuksek"): "Uzun süredir sıcak ve kuru – kırmızı örümcek riski yüksek, bahçeyi gezin.",
    ("kuruma_hastaligi", "orta"): "Yağmur ve rüzgâr bekleniyor – yaralı dallarda kuruma hastalığı bulaşma riski var.",
    ("kuruma_hastaligi", "yuksek"): "Kuvvetli yağmur ve rüzgâr bekleniyor – kuruma hastalığı bulaşma riski yüksek.",
}


def plain_sentence(code: str, level: Seviye, data_ok: bool = True) -> str:
    if not data_ok:
        return "Bu risk için yeterli veri yok."
    return _PLAIN.get((code, level), "Şu an belirgin bir risk görünmüyor.")


@dataclass(frozen=True)
class RiskSonucu:
    kod: str
    ad: str
    seviye: Seviye
    gerekce: str
    gecerlilik_baslangic: date
    gecerlilik_bitis: date
    veri_yeterli: bool

    @property
    def sade(self) -> str:
        """Çiftçi dilinde tek cümle (teknik ayrıntı `gerekce`'de)."""
        return plain_sentence(self.kod, self.seviye, self.veri_yeterli)


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
def fly_cycles(history: dict[date, GunVerisi], start: date, today: date, base_c: float, per_cycle_gdd: float) -> tuple[int, float, float, int, int]:
    """Kuşak (döngü) bazlı birikim: GDD `per_cycle_gdd`'ye ulaşınca sayaç SIFIRLANIR, sonraki kuşak sayılır.
    Dönüş: (tamamlanan kuşak, mevcut kuşakta biriken GDD, toplam GDD, verisi olan gün, toplam gün)."""
    gdd_cycle = 0.0
    total = 0.0
    completed = 0
    have = 0
    span = (today - start).days
    for i in range(span):
        d = history.get(start + timedelta(days=i))
        if d is None or d.tmean is None:
            continue
        have += 1
        step = max(0.0, d.tmean - base_c)
        gdd_cycle += step
        total += step
        while gdd_cycle >= per_cycle_gdd:
            gdd_cycle -= per_cycle_gdd
            completed += 1
    return completed, gdd_cycle, total, have, span


def fruit_fly(
    rule: RiskKurali,
    history: dict[date, GunVerisi],
    today: date,
    stage_code: str | None,
    stage_name: str | None,
    trap_per_week: float | None = None,
) -> RiskSonucu:
    """Seviye = (son günlerin aktivite koşulları) × (meyvenin duyarlı evresi). Tuzak sayımı yoksa en fazla «orta» (tuzak
    kontrolü önerilir); «yüksek» yalnızca tuzak verisi eşiği aştığında verilir (`trap_per_week`: tuzak başına haftalık yakalama)."""
    p = rule.parametreler
    month, day = (int(x) for x in str(p["birikim_baslangic"]).split("-"))
    start = date(today.year, month, day)
    valid_end = today + timedelta(days=7)
    code = "akdeniz_meyve_sinegi"
    if today < start:
        return RiskSonucu(code, rule.ad, "dusuk", f"Birikim {day}.{month:02d} tarihinde başlar; henüz etkili sıcaklık toplanmadı.", today, valid_end, True)

    completed, in_cycle, _, have, span = fly_cycles(history, start, today, float(p["gdd_taban_c"]), float(p["nesil_gdd"]))
    if span > 0 and have / span < 0.7:
        return RiskSonucu(code, rule.ad, "dusuk", "Sıcaklık verisi eksik olduğundan gün-derece birikimi güvenilir hesaplanamadı (veri yetersiz).", today, valid_end, False)

    window = int(p["aktivite_pencere_gun"])
    means = [d.tmean for d in (history.get(today - timedelta(days=i)) for i in range(1, window + 1)) if d and d.tmean is not None]
    lo, hi = float(p["aktif_sicaklik_min_c"]), float(p["aktif_sicaklik_max_c"])
    active_share = sum(1 for m in means if lo <= m <= hi) / len(means) if means else 0.0
    active = bool(means) and active_share >= float(p["aktif_gun_orani"])
    sensitive = stage_code in list(p["duyarli_evreler"])
    cycle_pct = in_cycle / float(p["nesil_gdd"])
    cycle_note = f"{completed + 1}. kuşak, döngünün %{_n(cycle_pct * 100)}'i"
    if cycle_pct >= float(p["yeni_kusak_yakin_orani"]):
        cycle_note += " (yeni kuşak çıkışı yaklaşıyor)"

    traps = p.get("tuzak_esikleri") or {}
    if trap_per_week is not None and traps:
        level: Seviye = "yuksek" if trap_per_week >= float(traps["yuksek"]) else "orta" if trap_per_week >= float(traps["orta"]) else "dusuk"
        reason = f"Tuzaklarda haftalık ortalama {_n(trap_per_week)} adet yakalandı (orta eşik {_n(float(traps['orta']))}, yüksek eşik {_n(float(traps['yuksek']))}); {cycle_note}."
        return RiskSonucu(code, rule.ad, level, reason, today, valid_end, True)

    parts = [f"son {len(means)} günün %{_n(active_share * 100)}'inde sıcaklık aktif aralıkta ({_n(lo)}–{_n(hi)} °C)"]
    if stage_name:
        parts.append(f"evre: {stage_name}{' (meyve duyarlı)' if sensitive else ' (meyve henüz duyarlı değil)'}")
    parts.append(cycle_note)
    if active and sensitive:
        return RiskSonucu(code, rule.ad, "orta", "Koşullar uygun – tuzak kontrolü önerilir; " + "; ".join(parts) + ". Tuzak sayımı olmadan «yüksek» verilmez.", today, valid_end, True)
    why = "sıcaklık koşulları etkinliğe uygun değil" if not active else "meyve henüz duyarlı evrede değil"
    return RiskSonucu(code, rule.ad, "dusuk", f"Şu an etkinlik beklenmiyor ({why}); " + "; ".join(parts) + ".", today, valid_end, True)


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
