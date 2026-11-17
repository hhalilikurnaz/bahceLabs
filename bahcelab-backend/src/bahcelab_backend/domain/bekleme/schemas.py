from typing import Literal

from pydantic import BaseModel, field_validator

from bahcelab_backend.domain.auth.schemas import _normalize_email

# Landing'deki aydınlatma metninin (frontend /kvkk) sürümü: metin değişince birlikte artırılır
AYDINLATMA_SURUMU = "2026-11"


class BeklemeBasvurusu(BaseModel):
    email: str
    il: str
    urun: Literal["limon", "portakal", "mandalina", "diger"]
    riza: bool  # açık rıza kutusu; işaretli değilse kayıt alınmaz

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        return _normalize_email(value)

    @field_validator("il")
    @classmethod
    def _il(cls, value: str) -> str:
        il = " ".join(value.split())
        if len(il) < 2 or len(il) > 80 or any(ord(c) < 32 for c in il):
            raise ValueError("İl adını girin")
        return il

    @field_validator("riza")
    @classmethod
    def _riza(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Açık rıza vermeden kayıt alınamaz")
        return value


class BeklemeYaniti(BaseModel):
    """Yeni kayıt ile zaten kayıtlı e-posta AYNI yanıtı alır: e-posta listesi dışarıdan yoklanamaz."""

    kayit: Literal["alindi"] = "alindi"
