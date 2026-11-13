"""İç izleme ekranı okuyucusu (/ic/izleme): akış durumu + gecikme zaman çizelgesi, kaynak uyumu serileri, kural performansı, bahçe güven dağılımı.
YALNIZ iç ekip (INTERNAL_EMAILS). Güven etiketi kullanıcı ekranlarındakiyle AYNI servisten (guven.topla) gelir; burada yeniden hesaplanmaz/ayrı eşik kullanılmaz."""

import uuid
from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.izleme import akis, guven, kural_performans
from bahcelab_backend.domain.izleme import ic_schemas as sc

ZAMAN_GUN = 60
UYUM_HAFTA = 26
KURAL_AY = 6
EN_DUSUK = 10


class IzlemeIcService:
    def __init__(self, session: AsyncSession, workspace_id: uuid.UUID) -> None:
        self.session = session
        self.workspace_id = workspace_id

    async def akislar(self, bugun: date) -> sc.AkislarYanit:
        guncel = [sc.AkisSatiri(akis=d.akis, ad=d.ad, durum=d.durum, son_veri=d.son_veri, gecikme_gun=d.gecikme_gun, bosluk_gun=d.bosluk_gun, son_basari=d.son_basari, beklenen_gun=d.beklenen_gun, kabul_gecikme_gun=d.kabul_gecikme_gun, kopuk_gun=d.kopuk_gun, neden=d.neden) for d in await akis.akis_durumlari(self.session, bugun)]
        rows = (await self.session.execute(text("SELECT akis, tarih, gecikme_gun, durum FROM izleme_akis WHERE tarih >= :b ORDER BY akis, tarih"), {"b": bugun - timedelta(days=ZAMAN_GUN)})).all()
        return sc.AkislarYanit(bugun=bugun, guncel=guncel, zaman=[sc.AkisNokta(akis=r[0], tarih=r[1], gecikme_gun=r[2], durum=r[3]) for r in rows])

    async def uyum(self, bugun: date) -> sc.UyumYanit:
        k = load_catalog().izleme
        rows = (await self.session.execute(text(
            "SELECT u.kontrol, u.garden_id, g.ad, u.tarih, u.deger, u.taban, u.sapma, u.esik, u.n, u.durum FROM izleme_uyum u "
            "LEFT JOIN gardens g ON g.id = u.garden_id "
            "WHERE u.tarih >= :b AND (u.garden_id IS NULL OR g.workspace_id = :w) ORDER BY u.kontrol, u.garden_id NULLS FIRST, u.tarih"),
            {"b": bugun - timedelta(weeks=UYUM_HAFTA), "w": self.workspace_id})).all()
        seriler: dict[tuple[str, uuid.UUID | None], sc.UyumSeri] = {}
        for r in rows:
            s = seriler.setdefault((r[0], r[1]), sc.UyumSeri(kontrol=r[0], garden_id=r[1], bahce=r[2], esik=r[7], son_durum=r[9], noktalar=[]))
            s.noktalar.append(sc.UyumNokta(tarih=r[3], deger=r[4], taban=r[5], sapma=r[6], n=r[8], durum=r[9]))
            s.son_durum, s.esik = r[9], r[7]
        _ = k
        return sc.UyumYanit(seriler=list(seriler.values()))

    async def kurallar(self, bugun: date) -> sc.KurallarYanit:
        bit = bugun
        bas = date(bit.year, bit.month, 1) - timedelta(days=31 * (KURAL_AY - 1))
        bas = date(bas.year, bas.month, 1)
        sat = await kural_performans.kural_performansi(self.session, bas, bit)
        ozet = kural_performans.ozet(sat)
        return sc.KurallarYanit(
            bas=bas, bit=bit,
            aylik=[sc.KuralSatiri(kural=s.kural, ad=kural_performans.KURAL_AD.get(s.kural, s.kural), ay=s.ay, uretilen=s.uretilen, yanit=s.yanit, yanit_orani=s.yanit_orani, isabet_n=s.isabet_n, isabet=s.isabet, durum=s.durum, neden=s.neden) for s in sat],
            ozet=[sc.KuralOzet.model_validate({"kural": ad, "ad": o["ad"], "uretilen": o["uretilen"], "yanit": o["yanit"], "isabet": o["isabet"], "durum": o["durum"]}) for ad, o in ozet.items()],
        )

    async def bahceler(self, bugun: date) -> sc.BahcelerYanit:
        gardens = (await self.session.execute(text("SELECT id, ad, agac_sayisi FROM gardens WHERE workspace_id = :w ORDER BY ad"), {"w": self.workspace_id})).all()
        sonuc: list[sc.BahceGuven] = []
        dagilim = {"yuksek": 0, "orta": 0, "dusuk": 0}
        for gid, ad, agac in gardens:
            g = await guven.topla(self.session, gid, bugun, "durum", agac_beyan=agac is not None)
            dagilim[g.etiket] += 1
            sonuc.append(sc.BahceGuven(garden_id=gid, ad=ad, etiket=g.etiket, puan=g.puan, toplam=g.toplam, nedeni=g.nedeni, eksik=[c.ad + (f" ({c.ek})" if c.ek else "") for c in g.kosullar if c.ok is False]))
        sonuc.sort(key=lambda b: ((b.puan / b.toplam) if b.toplam else 0.0, b.ad))
        return sc.BahcelerYanit(bugun=bugun, dagilim=dagilim, en_dusuk=sonuc[:EN_DUSUK], toplam_bahce=len(gardens))
