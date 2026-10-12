# SNAP Sentinel-2 biyofizik işlemcisi — LAI ağırlıkları (v2.1)

Kaynak: ESA SNAP / S2TBX `s2tbx-biophysical/src/main/resources/auxdata/2_1/LAI/`
(https://github.com/senbox-org/s2tbx). Algoritma: Weiss & Baret (2016), *S2ToolBox Level 2 products: LAI, FAPAR, FCOVER*, ATBD v1.1
(INRAE). Ağ: 11 girdi (B03, B04, B05, B06, B07, B8A, B11, B12 yansıtımı + cos(görüş zeniti), cos(güneş zeniti), cos(göreli azimut)),
5 nöronlu gizli katman (tanh), doğrusal çıkış.

Lisans: S2TBX deposu GPL-3.0 altındadır; bu dosyalar o depodan alınmış sayısal katsayılardır ve algoritmanın yayımlanmış ATBD'sinin
verisidir. Ticari ürüne gömülmeden önce hukuki değerlendirme gerekir (ADR 0015). `LAI_TestCases` SNAP'in kendi referans çıktısıdır
(`tests/fixtures/lai/`) ve port bu çıktıyla doğrulanır.
