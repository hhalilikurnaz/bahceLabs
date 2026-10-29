"""Olay ön-yargı kuralları (SAF): «destekleniyor / çelişiyor / kanıt yok». Yalnız istasyon GÖZLEMİ ve kamu kayıtları kullanılır; model/dolgu satırları dışlanır.

Bu modül olay motorunun girdisini (ERA5, S2, HLS, radar, Open-Meteo) İÇE AKTARMAZ ve tanımaz: kaynak bağımsızlığı yapısal olarak güvenceye alınmıştır (testle denetlenir).
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date, timedelta

from bahcelab_backend.domain.agro.catalog import DisKanitKurali
from bahcelab_backend.domain.evidence.types import (
    Kanit,
    KanitYonu,
    OnYargi,
    PublicRecord,
    Station,
    StationDay,
)

AY = ("", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara")
#: Kamu kaydı türü ↔ olay türü grubu. Optik düşüş ve radar değişimi tek başına bir hava olayı değildir: herhangi bir hasarlı kamu kaydıyla açıklanabilir.
KAYIT_ESLEME = {"don": {"don"}, "yagis": {"yagis", "sel"}, "ruzgar": {"ruzgar", "firtina"}, "optik": {"don", "yagis", "sel", "ruzgar", "firtina", "dolu", "hasar"}, "radar": {"don", "yagis", "sel", "ruzgar", "firtina", "dolu", "hasar"}}


def _gun(d: date) -> str:
    return f"{d.day} {AY[d.month]} {d.year}"


def _aralik(a: date, b: date) -> str:
    return _gun(a) if a == b else f"{_gun(a)} – {_gun(b)}"


def _sayi(v: float, digits: int = 1) -> str:
    return f"{v:.{digits}f}".replace(".", ",")


def window_of(start: date, end: date, rule: DisKanitKurali) -> tuple[date, date]:
    return start - timedelta(days=rule.pencere_gun), end + timedelta(days=rule.pencere_gun)


def observed(days: Sequence[StationDay], lo: date, hi: date) -> list[StationDay]:
    """Penceredeki GERÇEK gözlem satırları; model/dolgu satırları kanıt sayılmaz."""
    return [d for d in days if d.kaynak == "gozlem" and lo <= d.tarih <= hi]


def position_of(st: Station, rule: DisKanitKurali) -> str:
    """İstasyonun bahçeye göre konumu: uzaklık, rakım ve (rakıma dayalı yaklaşık) kıyı/iç etiketi."""
    if st.yukseklik is None:
        return f"bahçeye {_sayi(st.mesafe_km, 0)} km"
    where = "kıyı" if st.yukseklik <= rule.kiyi_rakim_azami_m else "iç kesim"
    return f"bahçeye {_sayi(st.mesafe_km, 0)} km · {_sayi(st.yukseklik, 0)} m rakım · {where}"


def station_evidence(grup: str, start: date, end: date, days: Sequence[StationDay], stations: dict[str, Station], rule: DisKanitKurali) -> tuple[list[Kanit], str]:
    """İstasyon gözleminden kanıt: don (günlük min sıcaklık) ve aşırı yağış (günlük toplam). Diğer türlerde istasyon kanıtı yoktur. Dönüş: kanıtlar, «kanıt yok» nedeni."""
    if grup not in ("don", "yagis"):
        return [], "bu olay türü için istasyon ölçümü yok (yalnız kamu kaydı bakılır)"
    lo, hi = window_of(start, end, rule)
    rows = observed(days, lo, hi)
    by_station: dict[str, list[StationDay]] = {}
    for r in rows:
        if (r.tmin if grup == "don" else r.prcp) is not None:
            by_station.setdefault(r.istasyon_id, []).append(r)
    if not stations:
        return [], "bahçeye yakın istasyon yok"
    if not by_station:
        return [], "pencerede istasyon gözlemi yok (gözlem aralığı dışı ya da eksik)"
    yon: KanitYonu
    out: list[Kanit] = []
    extreme: dict[str, float] = {}
    for sid, items in by_station.items():
        st = stations[sid]
        if grup == "don":
            low = min(items, key=lambda r: r.tmin if r.tmin is not None else 1e9)
            value = float(low.tmin)  # type: ignore[arg-type]
            extreme[sid] = value
            yon = "destek" if value <= rule.don_destek_c else "sinirda"
            text = f"{st.ad} istasyonu ({position_of(st, rule)}), {_aralik(lo, hi)}: en düşük {_sayi(value)} °C (gözlem)"
        else:
            high = max(items, key=lambda r: r.prcp if r.prcp is not None else -1.0)
            value = float(high.prcp)  # type: ignore[arg-type]
            extreme[sid] = value
            yon = "destek" if value >= rule.yagis_destek_mm else "sinirda"
            text = f"{st.ad} istasyonu ({position_of(st, rule)}), {_aralik(lo, hi)}: en yüksek günlük yağış {_sayi(value)} mm (gözlem)"
        out.append(Kanit("istasyon", yon, text, stations[sid].baglanti))
    if not any(k.yon == "destek" for k in out):
        contradict = all(v >= rule.don_celisme_c for v in extreme.values()) if grup == "don" else all(v <= rule.yagis_celisme_mm for v in extreme.values())
        if contradict:
            out = [Kanit(k.kaynak, "celisme", k.metin, k.baglanti) for k in out]
    return out, ""


def record_evidence(grup: str, start: date, end: date, records: Sequence[PublicRecord], il: str | None, ilce: str | None, rule: DisKanitKurali) -> list[Kanit]:
    """Elle derlenmiş kamu kayıtları: tarih penceresinde, tür uyumlu ve yer (il/ilçe) eşleşen kayıtlar DESTEK sayılır. Kayıt çelişki üretmez (yokluğu yokluk kanıtı değildir)."""
    kinds = KAYIT_ESLEME.get(grup, set())
    out: list[Kanit] = []
    for r in records:
        r_end = r.tarih_bitis or r.tarih
        places = [p.casefold() for p in ((il,) if r.yer_duzeyi == "il" else (il, ilce)) if p]  # il düzeyi kayıt yalnız il adıyla eşleşir (ilçe yazılı değil)
        if r.tarih - timedelta(days=rule.katalog_pencere_gun) <= end and r_end + timedelta(days=rule.katalog_pencere_gun) >= start and r.olay_turu.casefold() in kinds and any(p in r.yer.casefold() for p in places):
            level = " · il düzeyi kayıt" if r.yer_duzeyi == "il" else ""
            out.append(Kanit("dis_kayit", "destek", f"{r.kaynak}: {r.yer}, {_aralik(r.tarih, r_end)} — {r.olay_turu}{level}{' · ' + r.not_ if r.not_ else ''}", r.url, il_duzeyi=r.yer_duzeyi == "il"))
    return out


def prejudge(grup: str, start: date, end: date, days: Sequence[StationDay], stations: dict[str, Station], records: Sequence[PublicRecord], il: str | None, ilce: str | None, rule: DisKanitKurali) -> OnYargi:
    """destekleniyor: en az bir destek ve çelişki yok · çelişiyor: en az bir çelişki (kaynaklar ayrışsa da) · belirsiz: veri var ama eşikler arasında · kanıt yok: hiç bağımsız veri yok. Varsayımla «destekleniyor» ÜRETİLMEZ."""
    station_items, why = station_evidence(grup, start, end, days, stations, rule)
    items = [*station_items, *record_evidence(grup, start, end, records, il, ilce, rule)]
    if any(k.yon == "celisme" for k in items):
        return OnYargi("celisiyor", items, "istasyon gözlemi olayın tersini gösteriyor" + ("; kamu kaydı ise destekliyor (kaynaklar ayrışıyor)" if any(k.yon == "destek" for k in items) else ""))
    if any(k.yon == "destek" for k in items):
        return OnYargi("destekleniyor", items)
    if any(k.yon == "sinirda" for k in items):  # veri VAR ama eşikler arasında
        band = f"destek ≤ {_sayi(rule.don_destek_c)} °C, çelişki ≥ {_sayi(rule.don_celisme_c)} °C" if grup == "don" else f"destek ≥ {_sayi(rule.yagis_destek_mm)} mm, çelişki ≤ {_sayi(rule.yagis_celisme_mm)} mm"
        return OnYargi("belirsiz", items, f"ölçülen değer eşikler arasında ({band}); ön değer, mühendis onayı bekliyor")
    return OnYargi("kanit_yok", items, why or "pencerede hiç bağımsız veri yok (kamu kaydı da bulunamadı)")
