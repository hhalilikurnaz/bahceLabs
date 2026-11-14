"""Don olaylarının yeniden değerlendirmesi (ADIM 10 · Dilim 1, karar 3). Olay SİLİNMEZ/DEĞİŞTİRİLMEZ: sonuç `olay_yeniden_degerlendirme` tablosuna «yeniden değerlendirildi» işaretiyle yazılır.
KULLANICI DOĞRULAMALI olaylara (Saha Defteri «uydu haklı mıydı?» yanıtı) DOKUNULMAZ. Kural (don-yd-1): sapma düzeltmesi YOK (benzer kıyı istasyonlarında tutarlı yön bulunmadı);
modelin olay en düşüğü ile bağımsız istasyon gözlemi (ölçüm kaynaklı, ≤ 80 km, en çok 3) karşılaştırılır."""

from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import DonKurali, load_catalog
from bahcelab_backend.domain.evidence import rules as ev_rules
from bahcelab_backend.domain.evidence import service as ev_service

SONUCLAR = {
    "istasyon_destekliyor": "Bağımsız istasyon gözlemi de ≤ 0 °C (don destekleniyor).",
    "dis_kayit_destekliyor": "İstasyon > 0 °C gördü ama kamu kaydı (il/ilçe tarım müdürlüğü, haber vb.) bu dönemde don bildiriyor: olay KORUNUR (tek kıyı/şehir istasyonu bahçeyi temsil etmeyebilir).",
    "model_sapmasi_olasi": "İstasyon > 0 °C gördü ve model istasyondan en az σ kadar soğuk: ERA5'in bilinen soğuk sapmasıyla açıklanabilir (olay model artefaktı OLABİLİR; kanıtlanmış değil).",
    "belirsiz": "İstasyon > 0 °C gördü ama model istasyona σ içinde yakın: ayırt edilemiyor.",
    "kanit_yok": "Pencerede ölçüm kaynaklı istasyon gözlemi yok.",
}


def siniflandir(model_min: float | None, istasyon_min: float | None, kural: DonKurali, don_destek_c: float, dis_kayit_destek: bool = False) -> str:
    if istasyon_min is not None and istasyon_min <= don_destek_c:
        return "istasyon_destekliyor"
    if dis_kayit_destek:  # kamu kaydı destekliyorsa tek istasyonun «görmedi» demesi olayı zayıflatmaz
        return "dis_kayit_destekliyor"
    if istasyon_min is None:
        return "kanit_yok"
    if model_min is not None and istasyon_min - model_min >= kural.sigma_c:
        return "model_sapmasi_olasi"
    return "belirsiz"


async def yeniden_degerlendir(session: AsyncSession, garden_id: uuid.UUID, kural: DonKurali | None = None) -> dict[str, Any]:
    """Bahçenin don olaylarını yeniden değerlendirir. Dönüş: değerlendirilen satırlar ve atlananlar (kullanıcı doğrulamalı)."""
    k = kural or load_catalog().don
    dk = load_catalog().dis_kanit
    ctx = await ev_service.load_context(session, garden_id)
    dogrulanan = {r[0] for r in (await session.execute(text("SELECT hedef_anahtar FROM event_verifications WHERE garden_id = :g AND hedef_tur = 'olay'"), {"g": garden_id})).all()}
    olaylar = (await session.execute(text("SELECT anahtar, baslangic, bitis, ayrinti FROM events WHERE garden_id = :g AND tur = 'don' ORDER BY baslangic"), {"g": garden_id})).all()
    satirlar: list[dict[str, Any]] = []
    atlanan = 0
    for anahtar, bas, bit, ayrinti in olaylar:
        if anahtar in dogrulanan:
            atlanan += 1
            continue
        lo, hi = ev_rules.window_of(bas, bit, dk)
        obs = [r.tmin for r in ev_rules.observed(ctx.days, lo, hi) if r.tmin is not None]
        ist_min = min(obs) if obs else None
        model_min = (ayrinti or {}).get("don.en_dusuk_c")
        onyargi = ev_service.prior_of(ctx, "don", bas, bit)
        dis_destek = any(x.kaynak == "dis_kayit" and x.yon == "destek" for x in onyargi.kanitlar)
        yeni = siniflandir(model_min, ist_min, k, dk.don_destek_c, dis_destek)
        eski = onyargi.sonuc
        ayr = {"model_en_dusuk_c": model_min, "istasyon_en_dusuk_c": ist_min, "istasyon_sayisi": len(ctx.stations), "eski_on_yargi": eski, "dis_kayit_destek": dis_destek, "aciklama": SONUCLAR[yeni], "sigma_c": k.sigma_c, "sapma_duzeltmesi": "uygulanmadı"}
        await session.execute(
            text("INSERT INTO olay_yeniden_degerlendirme (garden_id, anahtar, kural_surum, sonuc, ayrinti, hesaplandi) VALUES (:g, :a, :s, :r, CAST(:y AS jsonb), clock_timestamp()) "
                 "ON CONFLICT (garden_id, anahtar, kural_surum) DO UPDATE SET sonuc = :r, ayrinti = CAST(:y AS jsonb), hesaplandi = clock_timestamp()"),
            {"g": garden_id, "a": anahtar, "s": k.yeniden_degerlendirme_surum, "r": yeni, "y": json.dumps(ayr)},
        )
        satirlar.append({"anahtar": anahtar, "baslangic": bas, "bitis": bit, **ayr, "yeni": yeni, "degisti": _degisti(eski, yeni)})
    return {"satirlar": satirlar, "atlanan_kullanici_dogrulamali": atlanan}


def _degisti(eski: str, yeni: str) -> bool:
    """Eski ön yargı (destekleniyor/çelişiyor/belirsiz/kanıt yok) ile yeni sonuç farklı bir ETİKETE mi karşılık geliyor?"""
    harita = {"destekleniyor": ("istasyon_destekliyor", "dis_kayit_destekliyor"), "celisiyor": ("model_sapmasi_olasi",), "belirsiz": ("belirsiz",), "kanit_yok": ("kanit_yok",)}
    return yeni not in harita.get(eski, (eski,))


async def etiketler(session: AsyncSession, garden_id: uuid.UUID) -> dict[str, dict[str, Any]]:
    """Olay listesi için: anahtar → {sonuc, aciklama, ...} (son sürüm)."""
    rows = (await session.execute(text("SELECT anahtar, sonuc, ayrinti, kural_surum, hesaplandi FROM olay_yeniden_degerlendirme WHERE garden_id = :g"), {"g": garden_id})).all()
    return {r[0]: {"sonuc": r[1], "aciklama": r[2].get("aciklama"), "model_en_dusuk_c": r[2].get("model_en_dusuk_c"), "istasyon_en_dusuk_c": r[2].get("istasyon_en_dusuk_c"), "kural_surum": r[3], "yeniden_degerlendirildi": True} for r in rows}
