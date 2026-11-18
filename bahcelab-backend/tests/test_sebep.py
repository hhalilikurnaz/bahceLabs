# ruff: noqa: F811
"""ADIM 10B · Dilim 1 (ADR 0033): sebep motoru (saf), katalog tutarlılığı, API (sebep + «sebep buydu»), görüntü kapısı, kural performansı. Veri: motor testleri gerçek olay girdisinden (altın) ya da
açıkça birim testi olarak etiketli küçük girdilerden; veritabanı testleri gerçek tablolara tohumlanır."""

import json
import uuid
from datetime import date, timedelta
from pathlib import Path

import pytest
from sqlalchemy import text

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.events.service import list_events
from bahcelab_backend.domain.izleme import kural_performans
from bahcelab_backend.domain.sebep import motor, servis

from .test_events_service import (  # noqa: F401
    add_era5,
    add_history,
    add_s2,
    factory,
    seed,
    user_client,
)

K = load_catalog().sebep
GIRDI = Path(__file__).parent / "golden" / "sebep_girdi.json"


def gercek(bahce: str, tarih: str) -> motor.Girdi:
    r = next(x for x in json.loads(GIRDI.read_text()) if x["bahce"] == bahce and x["tarih"] == tarih)
    return motor.Girdi(**{**r["girdi"], "hazir": tuple(motor.HazirKanit(**h) for h in r["girdi"]["hazir"])})


# ------------------------------------------------------------------ saf motor
def test_eleme_ile_secim_yok_dogrudan_kanit_sart():
    """1 Şubat 2025 (soğuk hava): don'dan ÖNCE düşüş; su için yalnız destekleyici kanıt. Eşikler sıfırlansa bile doğrudan kanıt yoksa seçim YOK («belirsiz»)."""
    g = gercek("soğuk hava", "2025-02-01")
    s = motor.degerlendir(g, K)
    assert s.secim is None and s.guven == "belirsiz" and "eşiğinin altında" in (s.belirsiz_nedeni or "")
    gevsek = K.model_copy(update={"secim_esik": 0.1, "secim_marj": 0.0})
    assert motor.degerlendir(g, gevsek).secim is None  # puan eşikte olsa da doğrudan kanıt şartı aranır
    assert {p.sebep for p in s.siralama} == {"don", "su", "goruntu"}  # besin/hastalık/mekanik seçilemez
    assert s.puan_of("don").puan < 0  # donun öncesi + istasyon çelişmesi: don aleyhte


def test_yalniz_destekleyici_kanit_secim_vermez():
    g = motor.Girdi(ay=7, d_ndmi=-0.2)  # BİRİM TESTİ girdisi: NDMI düşüşü + yaz = su lehine DESTEKLEYİCİ kanıt, toprak nemi verisi yok
    s = motor.degerlendir(g, K.model_copy(update={"secim_esik": 0.5, "secim_marj": 0.0}))
    assert s.puan_of("su").puan > 0 and s.puan_of("su").dogrudan_lehte == 0 and s.secim is None


def test_bagimsiz_kanit_agirlasir_ve_guven_sozcugunu_belirler():
    ham = motor.Girdi(ay=2, tmin_pencere=-3.0)
    s1 = motor.degerlendir(ham, K)
    assert s1.secim == "don" and s1.guven == "olasi"  # yalnız bağımlı (ERA5-Land): «daha olası» olamaz
    ist = motor.HazirKanit("don_istasyon_destek", "bagimsiz:istasyon", "istasyon gözlemi −1,2 °C", None)
    s2 = motor.degerlendir(motor.Girdi(ay=2, tmin_pencere=-3.0, hazir=(ist,)), K)
    assert s2.secim == "don" and s2.guven == "daha_olasi"
    assert s2.puan_of("don").puan == pytest.approx(3.0 + 3.0 * K.bagimsiz_carpan)  # bağımsız ×çarpan, bağımlı ×1
    kul = motor.HazirKanit("don_kullanici_olmadi", "bagimsiz:kullanici", "kullanıcı «olmadı» dedi", None)
    assert motor.degerlendir(motor.Girdi(ay=2, tmin_pencere=-3.0, hazir=(kul,)), K).puan_of("don").puan == pytest.approx(3.0 - 3.0 * K.bagimsiz_carpan)


def test_fiziksel_dislama_ve_kanit_satiri_alanlari():
    s = motor.degerlendir(motor.Girdi(ay=7, tmin_pencere=19.0), K)
    don = s.puan_of("don")
    assert don.puan < 0 and all(x.yon == "aleyhte" for x in don.kanitlar) and don.kanitlar[0].bagimsizlik == "bagimli:model"
    for p in s.siralama:
        for x in p.kanitlar:
            assert x.bagimsizlik.split(":")[0] in ("bagimsiz", "bagimli") and x.metin and x.kod in K.agirlik


def test_kapi_yalniz_gorunt_secilir_ve_don_kaniti_yoksa_kapanir():
    g = motor.Girdi(ay=5, tmin_pencere=11.0, dusen_pay=0.9, sahne_bulut=60.0, kalici=None)  # BİRİM: bulutlu sahne + tüm bahçe tek adım, don imkânsız
    s = motor.degerlendir(g, K)
    assert s.secim == "goruntu" and s.kapi is True
    assert motor.degerlendir(motor.Girdi(ay=5, tmin_pencere=11.0, dusen_pay=0.9, sahne_bulut=60.0, kalici=True), K).kapi is False  # kalıcı düşüş: kapı açık
    assert motor.degerlendir(motor.Girdi(ay=5, tmin_pencere=11.0, dusen_pay=0.3, sahne_bulut=5.0), K).kapi is False  # bulut/tüm bahçe yok: görüntü kanıtı yok
    don_var = motor.Girdi(ay=2, tmin_pencere=-3.0, dusen_pay=0.9, sahne_bulut=60.0, kalici=False)
    assert motor.degerlendir(don_var, K).kapi is False  # don kanıtı varken görüntü kapısı kapanmaz


def test_kararlilik_deterministik_ve_aralikta():
    g = gercek("jlnnlk", "2025-03-13")
    a, b = motor.kararlilik(g, K), motor.kararlilik(g, K)
    assert a == b and 0.0 <= a <= 1.0


def test_katalog_tutarli():
    assert K.durum == "dogrulanmadi" and "mühendis onayı bekliyor" in K.kaynak
    assert motor.DOGRUDAN <= set(K.agirlik) and all(K.agirlik[k] > 0 for k in motor.DOGRUDAN)
    assert set(K.agirlik) >= {"don_istasyon_destek", "don_istasyon_celisme", "gor_toparlandi", "su_toprak_kurak"}
    assert set(K.siralanan) == {"don", "su", "goruntu"}
    assert set(K.kontrol_listesi) == {"don", "su", "besin", "hastalik", "mekanik", "goruntu"}
    for maddeler in K.kontrol_listesi.values():
        for m in maddeler:
            assert (m.url is None) or m.kaynak  # bağlantı varsa kaynak adı da var; kaynaksız madde kaynak: null ile açıkça işaretli
    assert K.kapi_esik >= K.secim_esik


def test_beklenen_gecis_ortanca_aralik_ve_gelecekte():
    gunler = [date(2026, 1, 1) + timedelta(days=5 * i) for i in range(8)]
    assert servis.beklenen_gecis(gunler, gunler[-1]) == gunler[-1] + timedelta(days=5)
    assert servis.beklenen_gecis(gunler, gunler[-1] + timedelta(days=12)) == gunler[-1] + timedelta(days=15)  # geçmişte kalırsa aralıkla ileri
    assert servis.beklenen_gecis(gunler[:2], gunler[-1]) is None  # az veri: tahmin uydurulmaz


# ------------------------------------------------------------------ veritabanı: API, etiket, kural performansı, kapı
D0 = date(2026, 4, 20)


async def _tohumla(factory, gid, *, bulut: float, sonraki: bool) -> uuid.UUID:  # noqa: ANN001
    """Tek sahnede bahçe geneli ~%80 düşüş; ERA5 ılık (don yok). Olay satırı elle yazılır (bekliyor)."""
    await add_history(factory, gid, D0)
    await add_s2(factory, gid, D0 - timedelta(days=5), None)
    await add_s2(factory, gid, D0, 0.3, whole=True)
    if sonraki:
        await add_s2(factory, gid, D0 + timedelta(days=5), None)
    async with factory() as s:
        await s.execute(text("UPDATE acquisitions SET bulut_orani = :b WHERE garden_id = :g AND tarih = :d"), {"b": bulut, "g": gid, "d": D0})
        # sahne istatistikleri (üretimde işlemci yazar; test ızgaraları yalnız NDVI taşır): bahçe ortancası düşüşü ve toparlanması
        for gun, v in ((D0 - timedelta(days=5), 0.7), (D0, 0.4), (D0 + timedelta(days=5), 0.7)):
            await s.execute(
                text("INSERT INTO acquisition_stats SELECT id, 'ndvi', :v, :v, :v, :v, :v, :v, :v, :v, 100 FROM acquisitions WHERE garden_id = :g AND tarih = :d AND source_id = 'sentinel2-l2a'"),
                {"v": v, "g": gid, "d": gun},
            )
        await s.commit()
    await add_era5(factory, gid, {D0 - timedelta(days=k): (15.0, 5.0) for k in range(0, 30)})
    async with factory() as s:
        eid = uuid.uuid4()
        await s.execute(
            text("INSERT INTO events (id, garden_id, anahtar, tur, turler, baslangic, bitis, guven, durum, ayrinti, formul_surumu, tahmin) VALUES (:i, :g, 's2_dusus:test', 's2_dusus', CAST(:t AS jsonb), :b, :e, 'orta', 'bekliyor', CAST(:a AS jsonb), 'test', false)"),
            {"i": eid, "g": gid, "t": json.dumps(["s2_dusus"]), "b": D0 - timedelta(days=4), "e": D0, "a": json.dumps({"s2_dusus.delta_ndvi": -0.3, "s2_dusus.dusen_pay": 0.85})},
        )
        await s.commit()
    return eid


async def test_sebep_api_kanit_satirlari_kontrol_listesi_ve_kapi(user_client, factory):
    gid = await seed(user_client, factory)
    eid = await _tohumla(factory, gid, bulut=60.0, sonraki=True)  # sonraki net sahnede toparlandı: kararlı görüntü kanıtı
    r = await user_client.get(f"/gardens/{gid}/olaylar/{eid}/sebep")
    assert r.status_code == 200
    j = r.json()
    assert j["durum"] == "dogrulanmadi" and "kesin değil" in j["aciklama"].lower()
    assert j["secim"] == "goruntu" and j["kapi"]["kapali"] is True and "bir sonraki net görüntüyü bekleyin" in j["kapi"]["mesaj"]
    assert j["kapi"]["beklenen_gecis"] and j["kapi"]["beklenen_gecis_tahmini"] is True
    gor = next(x for x in j["siralama"] if x["sebep"] == "goruntu")
    assert gor["kanitlar"] and all(k["bagimsizlik"] and k["metin"] for k in gor["kanitlar"])
    assert set(j["kontrol_listesi"]) == {"don", "su", "besin", "hastalik", "mekanik", "goruntu"} and j["secilemeyen"] == ["besin", "hastalik", "mekanik"]
    assert "yüzde" not in json.dumps(j).lower() and not any("%" in x["metin"] and "olasılık" in x["metin"] for p in j["siralama"] for x in p["kanitlar"])
    assert (await user_client.get(f"/gardens/{gid}/olaylar/{uuid.uuid4()}/sebep")).status_code == 404


async def test_kapi_bildirimi_bastirir_acik_olaylara_dokunmaz(user_client, factory):
    gid = await seed(user_client, factory)
    eid = await _tohumla(factory, gid, bulut=60.0, sonraki=True)
    async with factory() as s:
        ev = next(e for e in await list_events(s, gid) if e.id == eid)
        assert await servis.kapi_bastir(s, gid, ev) is True
        karar = await servis.kapi_karari(s, gid, ev)
        assert karar is not None and karar["mesaj"] == "Görüntü kaynaklı olabilir — bir sonraki net görüntüyü bekleyin." and karar["beklenen_gecis"] > D0  # tahmini sonraki geçiş sahne ritminden
        assert await servis.kapi_bastir(s, gid, ev.__class__(**{**ev.__dict__, "tur": "don"})) is False  # don bağlantılı olay kapıya girmez
        # uyarı anındaki (as_of) veriyle: kapı SONRAKİ görüntüyü kullanmaz; yalnız bulut + tüm bahçe (puan 2,0, kararlılık < 0,5) kapıyı AÇIK bırakır
        assert await servis.kapi_bastir(s, gid, ev, as_of=D0) is False


async def test_bulutsuz_ya_da_kalici_dusus_kapidan_gecer(user_client, factory):
    gid = await seed(user_client, factory)
    await _tohumla(factory, gid, bulut=2.0, sonraki=False)
    async with factory() as s:
        ev = (await list_events(s, gid))[0]
        assert await servis.kapi_bastir(s, gid, ev) is False  # bulut yok: yalnız «tüm bahçe» (+1) → eşik altı → uyarı bastırılmaz


async def test_sebep_buydu_etiket_saha_defteri_ve_kural_performansi(user_client, factory):
    gid = await seed(user_client, factory)
    eid = await _tohumla(factory, gid, bulut=60.0, sonraki=True)
    r = await user_client.post(f"/gardens/{gid}/olaylar/{eid}/sebep-yaniti", json={"sebep": "budama_hasat"})
    assert r.status_code == 204
    assert (await user_client.post(f"/gardens/{gid}/olaylar/{eid}/sebep-yaniti", json={"sebep": "bilinmeyen"})).status_code == 422
    assert (await user_client.post(f"/gardens/{gid}/olaylar/{uuid.uuid4()}/sebep-yaniti", json={"sebep": "su"})).status_code == 404
    j = (await user_client.get(f"/gardens/{gid}/olaylar/{eid}/sebep")).json()
    assert j["kullanici_yaniti"] == "budama_hasat"
    async with factory() as s:
        et = (await s.execute(text("SELECT sebep, model_secim, model_surum, egitim_riza, egitim_riza_tarihi, model_siralama FROM sebep_etiket WHERE garden_id = :g"), {"g": gid})).one()
        assert et.sebep == "budama_hasat" and et.model_secim == "goruntu" and et.model_surum == K.surum and et.egitim_riza is False and et.egitim_riza_tarihi is None
        assert {x["sebep"] for x in et.model_siralama} == {"don", "su", "goruntu"}
        sd = (await s.execute(text("SELECT tur, ayrinti FROM field_records WHERE garden_id = :g AND ayrinti->>'konu' = 'sebep_yaniti'"), {"g": gid})).all()
        assert len(sd) == 1 and sd[0].tur == "gozlem" and sd[0].ayrinti["sebep"] == "budama_hasat"
    # yanıt değişirse tek kayıt güncellenir
    assert (await user_client.post(f"/gardens/{gid}/olaylar/{eid}/sebep-yaniti", json={"sebep": "su"})).status_code == 204
    async with factory() as s:
        assert (await s.execute(text("SELECT count(*) FROM sebep_etiket WHERE garden_id = :g"), {"g": gid})).scalar() == 1
        assert (await s.execute(text("SELECT count(*) FROM field_records WHERE garden_id = :g AND ayrinti->>'konu' = 'sebep_yaniti'"), {"g": gid})).scalar() == 1
        # DB saati ≠ dondurulmuş test saati: geniş aralık
        satirlar = [x for x in await kural_performans.kural_performansi(s, D0 - timedelta(days=60), D0 + timedelta(days=400))  if x.kural == "sebep_ayrisma"]
        assert satirlar and sum(x.yanit for x in satirlar) == 1
        assert all(x.isabet is None for x in satirlar)  # tek yanıt < kural_min_yanit: isabet uydurulmaz


def test_kural_performans_sebep_ayrisma_tanimli():
    assert "sebep_ayrisma" in kural_performans.KURAL_AD
    ozet = kural_performans.ozet([])
    assert ozet["sebep_ayrisma"]["isabet"] is None


def test_kararlilik_dusukse_guven_bir_kademe_duser_ve_kapi_kapanmaz():
    kararsiz = motor.degerlendir_tam(gercek("jlnnlk", "2016-04-29"), K)  # gerçek olay: görüntü seçildi ama kararlılık 0,46 < 0,5
    assert kararsiz.secim == "goruntu" and kararsiz.kararlilik is not None and kararsiz.kararlilik < K.kararlilik_min
    assert kararsiz.guven == "zayif" and kararsiz.guven_dusuruldu is True and kararsiz.kapi is False
    kararli = motor.degerlendir_tam(gercek("jlnnlk", "2021-12-24"), K)  # kararlılık 1,0: düşürme yok
    assert kararli.guven == "olasi" and kararli.guven_dusuruldu is False
    don = motor.degerlendir_tam(gercek("jlnnlk", "2025-03-13"), K)
    assert don.guven == "daha_olasi" and don.guven_dusuruldu is False
    belirsiz = motor.degerlendir_tam(gercek("soğuk hava", "2025-02-01"), K)
    assert belirsiz.secim is None and belirsiz.guven == "belirsiz" and belirsiz.guven_dusuruldu is False
    assert motor._DUSUR["daha_olasi"] == "olasi" and motor._DUSUR["olasi"] == "zayif"  # noqa: SLF001
