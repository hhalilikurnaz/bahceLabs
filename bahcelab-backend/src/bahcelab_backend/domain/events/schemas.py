import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel


class OlayYanit(BaseModel):
    id: uuid.UUID
    tur: str
    tur_adi: str
    turler: list[str]
    baslangic: date
    bitis: date
    alan_da: float | None
    guven: Literal["dusuk", "orta", "yuksek"]
    siddet: str | None
    katman: str | None  # ilgili harita katmanı (yoksa Hava sekmesi)
    tahmin: bool
    kaynak_sayisi: int
    durum: Literal["olay", "bekliyor", "suphe"] = "olay"  # bekliyor: sonraki net görüntü doğrulayacak
    neden: str | None = None  # şüphe nedeni (toparlandi | tum_bahce_destek_yok | teyit_edilemedi)
    dogrulama: Literal["gerceklesti", "gerceklesmedi", "bilinmiyor"] | None = None  # çiftçinin «Uydu haklı mıydı?» yanıtı (Saha Defteri)


class OlaylarYanit(BaseModel):
    olaylar: list[OlayYanit]
    supheler: list[OlayYanit]  # atmosfer şüphesi: olay DEĞİL, bilgi için
    not_: str
