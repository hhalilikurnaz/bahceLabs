"""9I Dilim 1B: sulama sistemi kontrol kuralının GERİYE DÖNÜK koşusu (jlnnlk, gerçek Sentinel-2 NDMI geçmişi). Kural, her sahne tarihinde YALNIZ o güne kadarki veriyi görür
(taban = yalnız önceki sezonlar). Kova durumu, geçici örnek sulama profiliyle (jlnnlk'in gerçek profili yok; iş sonunda SİLİNİR) planın günlük kovasından gelir.
Kullanım: PYTHONPATH=src .venv/bin/python scripts/sk_geriye_donuk.py <garden_id> <çıktı.md>"""
import asyncio
import sys
import uuid
from collections import Counter, defaultdict
from datetime import date

from sqlalchemy import text

from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.irrigation import schemas as sc
from bahcelab_backend.domain.irrigation import sistem_kontrol as sk
from bahcelab_backend.domain.irrigation.service import IrrigationService
from bahcelab_backend.domain.irrigation.sk_servis import SkServis

PROFIL = {"sistem": "damla", "damlatici_sayisi": 4, "damlatici_debi_lh": 4.0, "sira_aralik_m": 5.0, "agac_aralik_m": 4.0, "pompa_kw": 7.5, "pompa_debi_m3h": 40.0, "enerji": "sebeke"}


async def main() -> None:
    gid, cikti = uuid.UUID(sys.argv[1]), sys.argv[2]
    kural = cat.load_catalog().sistem_kontrol
    bugun = date.today()
    async with async_session_factory() as s:
        r = (await s.execute(text("SELECT workspace_id, urun, cesit_kodu, ad, alan_dekar FROM gardens WHERE id = :g"), {"g": gid})).one()
        ws, urun, cesit, ad, alan = r
        onceden = (await s.execute(text("SELECT 1 FROM irrigation_profiles WHERE garden_id = :g"), {"g": gid})).first()
        svc = IrrigationService(s, ws)
        try:
            if not onceden:
                await svc.save_profile(gid, sc.ProfilGiris.model_validate(PROFIL))
            sks = SkServis(s)
            seri = (await sks.seriler(gid, [("Bahçe", None)], bugun, urun, cesit))["Bahçe"]
            await s.commit()
            kova: dict[date, bool] = {}
            for yil in range(2015, bugun.year + 1):
                sim = await svc.simulasyon(gid, yil=yil, mod="plan")
                if sim.durum != "hazir" or not sim.sektorler:
                    continue
                v = sim.sektorler[0]
                for i, g in enumerate(sim.gunler):
                    pct = v.doluluk_pct[i] if i < len(v.doluluk_pct) else None
                    ks = v.ks[i] if i < len(v.ks) else None
                    if pct is not None and ks is not None:
                        kova[g.tarih] = (svc._etiket(pct, svc_rule(svc)) in kural.kova_etiketleri) and ks >= 1.0
        finally:
            if not onceden:
                await s.execute(text("DELETE FROM irrigation_profiles WHERE garden_id = :g"), {"g": gid})
                await s.commit()
    # ---- değerlendirme: her sahne tarihinde yalnız o güne kadarki veri
    temiz = [g for g in seri if g.gecerli_oran >= kural.min_gecerli_oran and g.piksel >= kural.min_piksel]
    nedenler: Counter[str] = Counter()
    ateslenen: list[tuple[date, sk.Karar]] = []
    sezon_sahne: Counter[int] = Counter()
    for g in temiz:
        k = sk.degerlendir("Bahçe", [x for x in seri if x.tarih <= g.tarih], {}, g.tarih, kural, kova)
        sezon_sahne[g.sezon] += 1
        if k.durum == "isaret":
            ateslenen.append((g.tarih, k))
        else:
            nedenler[k.neden.split(":")[0].split("(")[0].strip()[:60]] += 1
    # bölümler (sezon başına) ve bölüm = art arda tetiklenen sahnelerin tek olayı; bildirim = ≥ tekrar_bekleme_gun arayla
    olaylar: list[list[tuple[date, sk.Karar]]] = []
    for t, k in ateslenen:
        if olaylar and (t - olaylar[-1][-1][0]).days <= kural.tekrar_bekleme_gun:
            olaylar[-1].append((t, k))
        else:
            olaylar.append([(t, k)])
    # tek sahne z istatistiği (taban varsa)
    tek_z = []
    for g in temiz:
        taban, _ = sk.taban_hesapla([x for x in seri if x.tarih <= g.tarih], g, kural)
        if taban is not None:
            tek_z.append((g, sk.z_skor(g.ndmi, taban)))
    dus = [z for _, z in tek_z if z <= kural.z_esik]
    kovali = [g for g, z in tek_z if z <= kural.z_esik and kova.get(g.tarih, False)]
    satir = []
    satir.append(f"# Sulama sistemi kontrol işareti — geriye dönük koşu (jlnnlk)\n\nÜretim: `scripts/sk_geriye_donuk.py` · tarih {bugun} · bahçe **{ad}** ({alan:.1f} da; tek sektör) · kural ADR 0029 (ön değer · mühendis onayı bekliyor). Kural her sahne tarihinde **yalnız o güne kadarki veriyi** görür; taban yalnız önceki sezonlardır.\n")
    satir.append("**Önemli:** jlnnlk'in gerçek sulama profili/kaydı yok; kova durumu **geçici örnek profille** (damla, 5×4 m) planın günlük kovasından gelir (profil iş sonunda silindi). Tek sektör olduğundan diğer vanalarla karşılaştırma yoktur (güven «orta»). Yer gerçeği (gerçek tıkanma kaydı) yok: tablo «kaç işaret üretilirdi»yi gösterir, doğruluğu DEĞİL.\n")
    satir.append(f"## Özet\n\n- Değerlendirilen bulutsuz Sentinel-2 sahnesi: **{len(temiz)}** ({temiz[0].tarih} → {temiz[-1].tarih})\n- Tabanı olan (≥ {kural.min_sezon} önceki sezon, ≥ {kural.min_taban_sahne} sahne) tek-sahne gözlemi: **{len(tek_z)}**; bunların **{len(dus)}**'ı z ≤ {kural.z_esik} (%{100 * len(dus) / max(1, len(tek_z)):.1f}); kova yeterliyken **{len(kovali)}**\n- İşareti ateşleyen sahne tarihi (art arda {kural.art_arda_sahne} sahne + kova): **{len(ateslenen)}**\n- **Üretilecek bildirim (olay; ≥ {kural.tekrar_bekleme_gun} gün arayla): {len(olaylar)}** — yaklaşık yılda **{len(olaylar) / max(1.0, (temiz[-1].tarih - temiz[0].tarih).days / 365):.1f}**\n")
    satir.append("## İşaret olayları\n\n| Olay başlangıcı | Bitiş | Ateşleyen sahne | z (son 2 sahne) | NDMI | Evre | Taban (ort ± std, n/sezon) |\n|---|---|---:|---|---|---|---|")
    for o in olaylar:
        t0, k0 = o[0]
        t1, _ = o[-1]
        satir.append(f"| {t0} | {t1} | {len(o)} | " + " / ".join(f"{x.z:.1f}" for x in k0.sahneler) + " | " + " / ".join(f"{x.ndmi:.2f}" for x in k0.sahneler) + f" | {k0.taban.evre if k0.taban else '—'} | " + (f"{k0.taban.ort:.2f} ± {k0.taban.std:.2f} ({k0.taban.n}/{k0.taban.sezon_sayisi})" if k0.taban else "—") + " |")
    if not olaylar:
        satir.append("| (hiç olay yok) | | | | | | |")
    satir.append("\n## Neden işaret çıkmadı (sahne sayısı)\n\n| Neden | Sahne |\n|---|---:|")
    for n, c in nedenler.most_common():
        satir.append(f"| {n} | {c} |")
    satir.append("\n## Sezon başına\n\n| Sezon (Ekim başlangıçlı) | Bulutsuz sahne | Ateşleyen sahne | z ≤ eşik (tek sahne) |\n|---|---:|---:|---:|")
    ate = Counter(cat.season_start_year(t) for t, _ in ateslenen)
    dz: dict[int, int] = defaultdict(int)
    for g, z in tek_z:
        if z <= kural.z_esik:
            dz[g.sezon] += 1
    for sez in sorted(sezon_sahne):
        satir.append(f"| {sez}/{sez + 1} | {sezon_sahne[sez]} | {ate.get(sez, 0)} | {dz.get(sez, 0)} |")
    open(cikti, "w").write("\n".join(satir) + "\n")
    print("\n".join(satir[2:8]))


def svc_rule(svc: IrrigationService) -> cat.SulamaPlaniKurali:
    return cat.load_catalog().sulama_plani


asyncio.run(main())
