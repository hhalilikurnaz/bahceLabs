"""Risk kurallarının yıl boyu simülasyonu (SAF): her gün için «o gün bugün olsaydı» kuralları çalıştırır ve seviye gün sayılarını verir.
Amaç kuralların yıl boyu «yüksek» takılı kalmadığını (sağlık kontrolü) göstermektir; tarımsal doğrulama yerine geçmez."""

from __future__ import annotations

from collections import Counter
from dataclasses import replace
from datetime import date, timedelta

from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.agro.risks import GunVerisi, Seviye, fruit_fly, mal_secco, red_spider
from bahcelab_backend.domain.agro.rulebook import RiskKitabi

MAX_HIGH_SHARE = 0.30  # hiçbir kural yılın bu oranından fazlasında «yüksek» olmamalı


def stage_on(urun: str, cesit: str | None, day: date) -> tuple[str | None, str | None]:
    rules = cat.effective_rules(cat.load_catalog(), urun, cesit)
    if rules.fenoloji is None:
        return None, None
    year = cat.season_start_year(day)
    for stage in rules.fenoloji.evreler:
        first, last = cat.stage_window(stage.baslangic, stage.bitis, year)
        if first <= day <= last:
            return stage.kod, stage.ad
    return None, None


def simulate_year(
    book: RiskKitabi, days: list[GunVerisi], year: int, urun: str = "limon", cesit: str | None = "lamas", *, forecast_days: int = 7
) -> dict[str, Counter[Seviye]]:
    """`days`: yılın günlük gözlemleri. Gelecek günler (tahmin yerine) gerçekleşen değerlerdir: kuralların en iyi tahminle vereceği seviye."""
    by_date = {d.tarih: d for d in days}
    out: dict[str, Counter[Seviye]] = {code: Counter() for code, rule in book.kurallar.items() if urun in rule.urunler}
    day = date(year, 1, 1)
    while day <= date(year, 12, 31):
        history = {d: v for d, v in by_date.items() if d < day}
        forecast = [by_date[d] for d in (day + timedelta(days=i) for i in range(forecast_days)) if d in by_date]
        for code, rule in book.kurallar.items():
            if code not in out:
                continue
            if code == "akdeniz_meyve_sinegi":
                code_s, name_s = stage_on(urun, cesit, day)
                result = fruit_fly(rule, history, day, code_s, name_s)
            elif code == "kirmizi_orumcek":
                back = int(rule.parametreler["geriye_bakis_gun"])
                # Üretimde geçmiş günlerin nemi bilinmez (yalnızca tahmin günlerinde bilinir): aynı davranış
                window = [
                    replace(by_date[d], nem_yuzde=None) if d <= day else by_date[d]
                    for d in sorted(by_date)
                    if day - timedelta(days=back) <= d <= day + timedelta(days=3)
                ]
                result = red_spider(rule, window, day)
            else:
                result = mal_secco(rule, forecast, day)
            out[code][result.seviye] += 1
        day += timedelta(days=1)
    return out
