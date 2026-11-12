"""Uydudan ETa tabloları (iç kalite; ADR 0028)."""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from bahcelab_backend.database import Base


def _gid(pk: bool = True) -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=pk)


class EtaSahneModel(Base):
    __tablename__ = "eta_sahneler"
    garden_id: Mapped[uuid.UUID] = _gid()
    tarih: Mapped[date] = mapped_column(Date, primary_key=True)
    kaynak: Mapped[str] = mapped_column(String(32), primary_key=True)
    sahne_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    platform: Mapped[str | None] = mapped_column(String(16))
    termal_m: Mapped[float | None] = mapped_column(Float)
    bahce_piksel: Mapped[int] = mapped_column(Integer)
    gecerli_piksel: Mapped[int] = mapped_column(Integer)
    ic_piksel: Mapped[int] = mapped_column(Integer)
    gecerli_oran: Mapped[float] = mapped_column(Float)
    karisik_pay: Mapped[float] = mapped_column(Float)
    lst_k: Mapped[float | None] = mapped_column(Float)
    lst_ic_k: Mapped[float | None] = mapped_column(Float)
    sigma_lst_k: Mapped[float | None] = mapped_column(Float)
    ndvi: Mapped[float | None] = mapped_column(Float)
    tc_soguk_k: Mapped[float | None] = mapped_column(Float)
    n_soguk: Mapped[int | None] = mapped_column(Integer)
    dem_m: Mapped[float | None] = mapped_column(Float)
    ta_ham_k: Mapped[float | None] = mapped_column(Float)
    ta_duz_k: Mapped[float | None] = mapped_column(Float)
    dt_k: Mapped[float | None] = mapped_column(Float)
    c_sahne: Mapped[float | None] = mapped_column(Float)
    c_uzun: Mapped[float | None] = mapped_column(Float)
    c_yayilim: Mapped[float | None] = mapped_column(Float)
    tc_k: Mapped[float | None] = mapped_column(Float)
    etf: Mapped[float | None] = mapped_column(Float)
    etf_ic: Mapped[float | None] = mapped_column(Float)
    etf_sigma: Mapped[float | None] = mapped_column(Float)
    et0_mm: Mapped[float | None] = mapped_column(Float)
    eta_mm: Mapped[float | None] = mapped_column(Float)
    durum: Mapped[str] = mapped_column(String(16), server_default="ham")
    neden: Mapped[str | None] = mapped_column(Text)
    guncelleme: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EtaMeteoModel(Base):
    """ERA5 günlük girdileri (Open-Meteo): dT, ET0 ve tutarlılık için yağış. Aşama B ağ gerektirmesin diye saklanır."""

    __tablename__ = "eta_meteo"
    garden_id: Mapped[uuid.UUID] = _gid()
    tarih: Mapped[date] = mapped_column(Date, primary_key=True)
    rs_mj: Mapped[float | None] = mapped_column(Float)
    tmax_c: Mapped[float | None] = mapped_column(Float)
    tmin_c: Mapped[float | None] = mapped_column(Float)
    tmean_c: Mapped[float | None] = mapped_column(Float)
    cig_c: Mapped[float | None] = mapped_column(Float)
    et0_mm: Mapped[float | None] = mapped_column(Float)
    yagis_mm: Mapped[float | None] = mapped_column(Float)


class EtaBaglamModel(Base):
    __tablename__ = "eta_baglam"
    garden_id: Mapped[uuid.UUID] = _gid()
    kaynak: Mapped[str] = mapped_column(String(32), primary_key=True)
    bas: Mapped[date] = mapped_column(Date, primary_key=True)
    bit: Mapped[date] = mapped_column(Date)
    et_mm_gun: Mapped[float | None] = mapped_column(Float)
    piksel_dokunan: Mapped[int] = mapped_column(Integer)
    piksel_gecerli: Mapped[int] = mapped_column(Integer)
    piksel_m: Mapped[float | None] = mapped_column(Float)


class EtaDogrulamaModel(Base):
    __tablename__ = "eta_dogrulama"
    garden_id: Mapped[uuid.UUID] = _gid()
    kaynak: Mapped[str] = mapped_column(String(32), primary_key=True)
    sahne_id: Mapped[str] = mapped_column(String(96), primary_key=True)
    tarih: Mapped[date] = mapped_column(Date)
    et_mm_gun: Mapped[float | None] = mapped_column(Float)
    piksel_gecerli: Mapped[int] = mapped_column(Integer)
    piksel_dokunan: Mapped[int] = mapped_column(Integer)


class EtaKalibrasyonModel(Base):
    __tablename__ = "eta_kalibrasyon"
    garden_id: Mapped[uuid.UUID] = _gid()
    tur: Mapped[str] = mapped_column(String(16), primary_key=True)
    anahtar: Mapped[str] = mapped_column(String(8), primary_key=True)
    deger: Mapped[float | None] = mapped_column(Float)
    yayilim: Mapped[float | None] = mapped_column(Float)
    n: Mapped[int] = mapped_column(Integer)
    guncelleme: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EtaDurumModel(Base):
    __tablename__ = "eta_durum"
    garden_id: Mapped[uuid.UUID] = _gid()
    tutarlilik_p90: Mapped[float | None] = mapped_column(Float)
    tutarlilik_medyan: Mapped[float | None] = mapped_column(Float)
    cift_sayisi: Mapped[int] = mapped_column(Integer, server_default="0")
    esik: Mapped[float] = mapped_column(Float)
    kapi: Mapped[str] = mapped_column(String(8))
    neden: Mapped[str] = mapped_column(Text)
    alan_dekar: Mapped[float | None] = mapped_column(Float)
    sahne_sayisi: Mapped[int] = mapped_column(Integer, server_default="0")
    guncelleme: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
