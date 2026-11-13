"""Kural performansı (9J-4): her kural için AYLIK üretilen sayı, kullanıcı yanıt oranı ve yanıtı olanlarda isabet. Yanıt mekanizması olmayan ya da yanıt sayısı eşiğin
(`kural_min_yanit`) altında olan kural «ölçülemiyor» görünür; İSABET UYDURULMAZ (None).

  sulama_onerisi   — üretilen: sulama bildirimleri; yanıt: ±2 gün içinde uygulanan sulama kaydı (uygulama oranı); isabet: ölçülemiyor (yer gerçeği yok)
  sistem_kontrol   — üretilen: işaret bildirimleri; yanıt: kullanıcı yanıtı; isabet = (tıkalı + başka sorun) / yanıt
  don              — üretilen: don uyarıları + don olayları; yanıt: «Uydu/uyarı haklı mıydı?» doğrulaması (grup don); isabet = gerçekleşti / (gerçekleşti + gerçekleşmedi)
  hastalik_zararli — üretilen: zararlı/hastalık riski bildirimleri; yanıt: uyarı doğrulaması; isabet aynı
  olay_on_dogrulama— üretilen: olaylar; yanıt: olay doğrulaması (9G-E); isabet aynı
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import IzlemeKurali, load_catalog

KURAL_AD = {
    "sulama_onerisi": "Sulama önerisi",
    "sistem_kontrol": "Sulama sistemi kontrol işareti",
    "don": "Don uyarısı / olayı",
    "hastalik_zararli": "Hastalık / zararlı riski",
    "olay_on_dogrulama": "Olay ön doğrulaması (9G-E)",
}


@dataclass(frozen=True)
class KuralAy:
    kural: str
    ay: date
    uretilen: int
    yanit: int
    yanit_orani: float | None
    isabet_n: int  # isabeti hesaplanan yanıt sayısı (bilinmiyor hariç)
    isabet_poz: int  # bunlardan isabetli olanlar (aylık oran eşik altında gizlense de dönem toplamı için saklanır)
    isabet: float | None
    durum: str  # olculuyor | olculemiyor
    neden: str


def _dogrulama_isabet(g: int, d: int, bil: int) -> tuple[int, float | None]:
    n = g + d
    return n, (g / n if n else None)


def degerlendir(kural: str, ay: date, uretilen: int, yanit: int, isabet_pozitif: int, isabet_n: int, min_yanit: int, isabet_olculebilir: bool) -> KuralAy:
    """Saf: yanıt oranı ve isabet; ölçülebilirlik kuralları (yanıt eşiği, yer gerçeği yoksa «ölçülemiyor»)."""
    oran = (yanit / uretilen) if uretilen else None
    if not isabet_olculebilir:
        return KuralAy(kural, ay, uretilen, yanit, oran, 0, 0, None, "olculemiyor", "isabet için yer gerçeği/yanıt mekanizması yok: ölçülemiyor")
    if isabet_n < min_yanit:
        return KuralAy(kural, ay, uretilen, yanit, oran, isabet_n, isabet_pozitif, None, "olculemiyor", f"yanıtlı örnek {isabet_n} < {min_yanit}: isabet uydurulmaz, ölçülemiyor")
    return KuralAy(kural, ay, uretilen, yanit, oran, isabet_n, isabet_pozitif, isabet_pozitif / isabet_n, "olculuyor", "")


async def kural_performansi(session: AsyncSession, bas: date, bit: date, kural: IzlemeKurali | None = None) -> list[KuralAy]:
    k = kural or load_catalog().izleme
    p = {"b": bas, "e": bit}
    out: list[KuralAy] = []
    ay_listesi: set[date] = set()

    async def aylik(sql: str) -> dict[date, tuple[int, ...]]:
        rows = (await session.execute(text(sql), p)).all()
        return {r[0]: tuple(int(x or 0) for x in r[1:]) for r in rows}

    # sulama önerisi: üretilen bildirim; yanıt = bildirimden sonraki ≤ 2 günde sulama kaydı olanlar
    sul = await aylik("SELECT date_trunc('month', n.created_at)::date, count(*), count(*) FILTER (WHERE EXISTS (SELECT 1 FROM field_records f WHERE f.garden_id = n.garden_id AND f.tur = 'sulama' AND f.tarih BETWEEN n.created_at::date AND n.created_at::date + 2)) FROM notifications n WHERE n.tur IN ('sulama','sulama_plani','sulama_revize') AND n.created_at::date BETWEEN :b AND :e GROUP BY 1")
    # sistem kontrol: üretilen bildirim; yanıt = sk_yanit
    skn = await aylik("SELECT date_trunc('month', created_at)::date, count(*) FROM notifications WHERE tur = 'sulama_sistem_kontrol' AND created_at::date BETWEEN :b AND :e GROUP BY 1")
    sky = await aylik("SELECT date_trunc('month', created_at)::date, count(*), count(*) FILTER (WHERE yanit IN ('damlatici_tikali','baska_sorun')) FROM sk_yanit WHERE created_at::date BETWEEN :b AND :e GROUP BY 1")
    # don / zararlı / olay: üretilen + doğrulama sonuçları
    don_u = await aylik("SELECT date_trunc('month', created_at)::date, count(*) FROM notifications WHERE tur = 'hava_don' AND created_at::date BETWEEN :b AND :e GROUP BY 1")
    don_o = await aylik("SELECT date_trunc('month', baslangic)::date, count(*) FROM events WHERE tur = 'don' AND baslangic BETWEEN :b AND :e GROUP BY 1")
    zar_u = await aylik("SELECT date_trunc('month', created_at)::date, count(*) FROM notifications WHERE tur = 'zararli_riski' AND created_at::date BETWEEN :b AND :e GROUP BY 1")
    olay_u = await aylik("SELECT date_trunc('month', baslangic)::date, count(*) FROM events WHERE baslangic BETWEEN :b AND :e GROUP BY 1")
    dog = lambda cond: aylik(f"SELECT date_trunc('month', baslangic)::date, count(*), count(*) FILTER (WHERE sonuc = 'gerceklesti'), count(*) FILTER (WHERE sonuc = 'gerceklesmedi') FROM event_verifications WHERE {cond} AND baslangic BETWEEN :b AND :e GROUP BY 1")  # noqa: E731
    dd = await dog("(tur_grubu = 'don' OR hedef_anahtar LIKE 'hava_don%')")
    dz = await dog("(hedef_tur = 'uyari' AND hedef_anahtar LIKE 'zararli%')")
    do = await dog("hedef_tur = 'olay'")
    for d in (sul, skn, sky, don_u, don_o, zar_u, olay_u, dd, dz, do):
        ay_listesi |= set(d)
    for ay in sorted(ay_listesi):
        s = sul.get(ay, (0, 0))
        out.append(degerlendir("sulama_onerisi", ay, s[0], s[1], 0, 0, k.kural_min_yanit, False))
        y = sky.get(ay, (0, 0))
        out.append(degerlendir("sistem_kontrol", ay, skn.get(ay, (0,))[0], y[0], y[1], y[0], k.kural_min_yanit, True))
        for ad, u, dv in (("don", (don_u.get(ay, (0,))[0] + don_o.get(ay, (0,))[0]), dd.get(ay, (0, 0, 0))), ("hastalik_zararli", zar_u.get(ay, (0,))[0], dz.get(ay, (0, 0, 0))), ("olay_on_dogrulama", olay_u.get(ay, (0,))[0], do.get(ay, (0, 0, 0)))):
            n, oran = _dogrulama_isabet(dv[1], dv[2], dv[0] - dv[1] - dv[2])
            out.append(degerlendir(ad, ay, u, dv[0], dv[1], n, k.kural_min_yanit, True))
    return out


def ozet(satirlar: list[KuralAy], kural: IzlemeKurali | None = None) -> dict[str, dict[str, object]]:
    """Kural başına dönem toplamı (üretilen, yanıt, isabet); toplamda da eşik altı → ölçülemiyor."""
    k = kural or load_catalog().izleme
    out: dict[str, dict[str, object]] = {}
    for ad in KURAL_AD:
        sat = [s for s in satirlar if s.kural == ad]
        u, y = sum(s.uretilen for s in sat), sum(s.yanit for s in sat)
        poz = sum(s.isabet_poz for s in sat)
        n = sum(s.isabet_n for s in sat)
        olculebilir = ad in ("sistem_kontrol", "don", "hastalik_zararli", "olay_on_dogrulama")
        out[ad] = {"ad": KURAL_AD[ad], "uretilen": u, "yanit": y, "yanit_orani": (y / u) if u else None, "isabet_n": n, "isabet": None if not olculebilir or n < k.kural_min_yanit else poz / n, "durum": "olculuyor" if olculebilir and n >= k.kural_min_yanit else "olculemiyor"}
    return out
