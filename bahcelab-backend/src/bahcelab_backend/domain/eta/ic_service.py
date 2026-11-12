"""İç kalite ekranı okuyucusu (/ic/eta): geçiş listesi, ETf/ETa, piksel payı, tutarlılık. YALNIZ iç ekip (INTERNAL_EMAILS); kullanıcı panellerine veri VERMEZ."""

import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.eta import schemas as sc
from bahcelab_backend.shared.errors import AppError, AppErrorCode


class EtaIcService:
    def __init__(self, session: AsyncSession, workspace_id: uuid.UUID) -> None:
        self.session = session
        self.workspace_id = workspace_id

    async def bahceler(self) -> list[sc.EtaDurumOzeti]:
        rows = (await self.session.execute(text(
            "SELECT d.*, g.ad, (SELECT count(*) FROM eta_sahneler s WHERE s.garden_id = d.garden_id AND s.durum = 'hesaplandi') AS hesaplanan "
            "FROM eta_durum d JOIN gardens g ON g.id = d.garden_id WHERE g.workspace_id = :w ORDER BY g.ad"), {"w": self.workspace_id})).mappings().all()
        return [self._ozet(r) for r in rows]

    @staticmethod
    def _ozet(r: Any) -> sc.EtaDurumOzeti:
        return sc.EtaDurumOzeti(garden_id=r["garden_id"], ad=r["ad"], alan_dekar=r["alan_dekar"], kapi=r["kapi"], neden=r["neden"], tutarlilik_p90=r["tutarlilik_p90"], tutarlilik_medyan=r["tutarlilik_medyan"], cift_sayisi=r["cift_sayisi"], esik=r["esik"], sahne_sayisi=r["sahne_sayisi"], hesaplanan=int(r["hesaplanan"]), guncelleme=r["guncelleme"])

    async def detay(self, garden_id: uuid.UUID) -> sc.EtaKaliteDetay:
        g = (await self.session.execute(text("SELECT ad FROM gardens WHERE id = :g AND workspace_id = :w"), {"g": garden_id, "w": self.workspace_id})).first()
        if g is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")
        q = lambda sql: self.session.execute(text(sql), {"g": garden_id})  # noqa: E731
        d = (await q("SELECT d.*, g.ad, (SELECT count(*) FROM eta_sahneler s WHERE s.garden_id = d.garden_id AND s.durum = 'hesaplandi') AS hesaplanan FROM eta_durum d JOIN gardens g ON g.id = d.garden_id WHERE d.garden_id = :g")).mappings().first()
        sah = (await q("SELECT * FROM eta_sahneler WHERE garden_id = :g ORDER BY tarih")).mappings().all()
        satirlar: list[sc.EtaSahneSatiri] = []
        onceki: float | None = None
        for r in sah:
            delta = None if (r["etf"] is None or onceki is None) else r["etf"] - onceki
            if r["etf"] is not None:
                onceki = r["etf"]
            satirlar.append(sc.EtaSahneSatiri(**{k: r[k] for k in ("tarih", "sahne_id", "platform", "durum", "neden", "gecerli_oran", "bahce_piksel", "ic_piksel", "karisik_pay", "termal_m", "lst_k", "ndvi", "dt_k", "c_sahne", "c_uzun", "tc_k", "etf", "etf_ic", "etf_sigma", "et0_mm", "eta_mm")}, delta_etf=delta))
        bag = (await q("SELECT bas, bit, et_mm_gun, piksel_dokunan, piksel_gecerli, piksel_m FROM eta_baglam WHERE garden_id = :g ORDER BY bas")).mappings().all()
        dog = (await q("SELECT tarih, sahne_id, et_mm_gun, piksel_gecerli, piksel_dokunan FROM eta_dogrulama WHERE garden_id = :g ORDER BY tarih")).mappings().all()
        kal = (await q("SELECT tur, anahtar, deger, yayilim, n FROM eta_kalibrasyon WHERE garden_id = :g ORDER BY tur, anahtar")).mappings().all()
        notlar = [
            "İÇ KALİTE EKRANI: bu değerler kullanıcıya gösterilmez; kapı kapalıyken hiçbir kullanıcı ekranına ETa/ETf taşınmaz (ADR 0028).",
            "Termal çözünürlük fiziksel 100 m (Landsat); 30 m yeniden örneklenmiştir. «Karışık pay» bahçe pikselleri içinde iç tampon (−15 m) dışında kalan orandır.",
            "ETa = ETf × ET0 (ERA5, çim referansı). Katsayılar ön değer · mühendis onayı bekliyor.",
        ]
        return sc.EtaKaliteDetay(durum=self._ozet(d) if d else None, sahneler=satirlar, baglam=[sc.EtaBaglamSatiri(**dict(r)) for r in bag], dogrulama=[sc.EtaDogrulamaSatiri(**dict(r)) for r in dog], kalibrasyon=[sc.EtaKalibrasyonSatiri(**dict(r)) for r in kal], notlar=notlar)
