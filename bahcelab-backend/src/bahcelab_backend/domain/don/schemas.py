"""Gece don API şemaları (ADIM 10, ADR 0031). Kullanıcıya SÖZCÜK gösterilir (düşük / orta / yüksek); sayısal olasılık yalnız iç ekranda."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel


class DonGecesi(BaseModel):
    gece: date  # akşamın tarihi
    sabah: date  # minimumun görüldüğü gün
    en_soguk_saat: int | None = None  # en soğuk modelin gece minimumunu gördüğü yerel saat
    organ_adlari: list[str] = []
    olasilik_sozu: Literal["düşük", "orta", "yüksek"]  # «Bu gece don olasılığı: yüksek»
    seviye: Literal["yok", "izle", "uyari"]  # izle: yalnız uygulama içi; uyari: 18:00 bildirimi
    kritik_c: float
    evre: str
    organlar: list[str]
    en_soguk_c: float
    model_tmin: dict[str, float]
    uzlasi_model: int
    neden: str
    uretildi: datetime
    saat_kritik_alti: int
    geri_bildirim: str | None = None  # oldu | olmadi | bilmiyorum


class DonYaniti(BaseModel):
    geceler: list[DonGecesi]
    onlemler: list[dict[str, Any]] = []  # risk orta/yüksekse kaynaklı «ne yapmalı»
    onlem_notu: str | None = None
    dun_soru: dict[str, Any] | None = None  # dün gece uyarı verildiyse «Don oldu mu?» (yanıtlanmadıysa)
    topografya: dict[str, Any] | None
    temkin_notu: str
    nasil: str
    esik_durumu: str
    kural_surum: str
    veri_yok_nedeni: str | None = None


class GoreliHucreler(BaseModel):
    uygun: bool
    neden: str | None = None
    aciklama: str | None = None
    geojson: dict[str, Any] | None = None  # 30 m kareler (WGS84), özellik: goreli_soguk 0–1 (sıcaklık DEĞİL)
    hucre_sayisi: int = 0
    rolyef_m: float | None = None
    egim_ort_der: float | None = None
    rolyef_min_m: float | None = None  # katman açılma koşulu (katalog)
    egim_min_der: float | None = None


class DonGeriBildirim(BaseModel):
    gece: date
    yanit: Literal["oldu", "olmadi", "bilmiyorum"]
