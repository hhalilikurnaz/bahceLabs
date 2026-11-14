"""Gece don API şemaları (ADIM 10, ADR 0031). Kullanıcıya SÖZCÜK gösterilir (düşük / orta / yüksek); sayısal olasılık yalnız iç ekranda."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel


class DonGecesi(BaseModel):
    gece: date  # akşamın tarihi
    sabah: date  # minimumun görüldüğü gün
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


class Topografya(BaseModel):
    profil: dict[str, float]
    bahce_ici: dict[str, Any] | None
    hesaplandi: datetime
    kaynak: str
    not_: str | None = None


class DonYaniti(BaseModel):
    geceler: list[DonGecesi]
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
    epsg: int | None = None
    hucreler: list[dict[str, float]] = []


class DonGeriBildirim(BaseModel):
    gece: date
    yanit: Literal["oldu", "olmadi", "bilmiyorum"]
