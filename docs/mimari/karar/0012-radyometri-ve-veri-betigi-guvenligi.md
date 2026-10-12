# ADR 0012 — Sahne radyometrisi meta veriden; veri betiği güvenliği; e2e veritabanı ayrımı

**Durum:** kabul (Adım 9B, B5)

**Bağlam.** Sentinel-2 L2A işleme sürümü 04.00 (2022-01-25) ile yansıtıma −0,1 ofset (BOA_ADD_OFFSET = −1000 DN) eklendi. Planetary
Computer STAC varlıklarında `raster:bands` yok; ofset atlandığı için 2022 sonrası NDVI ≈ 0,2 düşük hesaplanıyordu (ör. 0,43 yerine
0,66). İlk düzeltme sabit bir sürüm kuralıydı. Aynı turda bir yeniden işleme betiği kapsam sınırı olmadan tüm bahçelere uygulanıp
yarıda kesildi (etkilenen 9 bahçenin hepsi e2e test kullanıcılarınındı). e2e testleri geliştirme veritabanını kullanıyor ve ~780 test
bahçesi biriktiriyordu.

**Karar.**
1. **Radyometri sahnenin kendi meta verisinden** (`domain/imagery/radiometry.py`, saf): ürün meta verisi (`MTD_MSIL2A.xml`:
   `BOA_QUANTIFICATION_VALUE`, bant başına `BOA_ADD_OFFSET`) → `raster:bands` → son çare işleme sürümü kuralı. Kullanılan kaynak her
   sahnede kaydedilir (`SceneBands.radiometri`); yedek kaynağa düşüş uyarı olarak loglanır. Ağ okuması altyapıda (`sentinel2.py`),
   sahne kimliğiyle önbelleklenir. Test: 04.00 öncesi/sonrası gerçek iki sahnenin fikstürüyle süreklilik (meta veri: 0,713 → 0,643;
   ofsetsiz: 0,395).
2. **Veriyi değiştiren betikler** (`scripts/guard.py`): varsayılan dry-run, zorunlu kapsam (`--user`/`--garden`; temizlikte yalnız
   `e2e-*@example.test` + koruma listesi), `--apply`'da önce `pg_dump -Fc` yedeği (`BACKUP_DIR`, `DB_CONTAINER`), etkilenecek kayıt
   sayısı ve «evet» onayı; çıktılar yapılandırılmış JSON satırları.
3. **e2e ayrı veritabanında:** `docker compose --profile e2e` (`db-e2e`), ayrı API/web portu; Playwright sunucuları kendisi başlatır,
   kurulumda şemayı kurar, bitişte e2e veritabanını boşaltır. e2e backend'inde gerçek uydu işi kapalıdır (`NDVI_ENABLED=false`).
4. **Portlar ve adresler yalnız ortamdan:** `DATABASE_URL` zorunlu (kodda varsayılan yok), `API_PROXY_TARGET` zorunlu, compose ve
   Makefile kök `.env`'yi okur.

**Sonuçlar.** Yeniden işleme yedeksiz ya da kapsamsız çalışamaz. e2e koşuları geliştirme verisini kirletmez. Yeni bir ortamda kök `.env`,
`bahcelab-backend/.env` ve `bahcelab-frontend/.env` örneklerden oluşturulmalıdır.
