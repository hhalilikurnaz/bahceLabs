# U4 · Performans A/B (katman değişimi)

Aynı makine, aynı test (`bahcelab-frontend/e2e/performans.spec.ts`, 17 katman değişimi + 60 adımlık harita sürüklemesi), eski ve yeni sürüm sırayla (eski, yeni, eski, yeni …) 5'er koşu. Eski = `208a05c` (U1 ve U4 öncesi, git worktree); yeni = çalışma ağacı. Makine yükü 6–9,4 (macOS arka plan süreçleri kapatılamadı; ölçüm sırasında `makineYuku1dk` kayıtlı). `E2E_PERF_YUKLU=1` (p95 raporlanır; eşik testi tam pakette yük koşulsuz koşar ve geçer).

| Koşu | Eski medyan | Eski p95 | Eski fps | Yeni medyan | Yeni p95 | Yeni fps |
|---|---|---|---|---|---|---|
| 1 | 168 | 212 | 25,0 | 79 | 129 | 87,2 |
| 2 | 163 | 182 | 26,3 | 75 | 108 | 90,3 |
| 3 | 164 | 190 | 25,2 | 81 | 109 | 89,7 |
| 4 | 162 | 187 | 25,7 | 75 | 107 | 89,6 |
| 5 | 158 | 189 | 26,8 | 75 | 110 | 92,4 |
| **ort.** | **163** | **192** | **25,8** | **77** | **113** | **89,8** |

Eşikler (değişmedi): medyan ≤ 150 ms, p95 ≤ 200 ms, fps ≥ 30, kare p95 ≤ 66 ms. Eski sürüm bu makinede eşiğin üstünde (medyan 163); yeni sürüm hepsinin altında.

## Kök neden ve düzeltme
İlk U4 sürümü eskiden **belirgin yavaştı** (medyan ≈ 198 ms, p95 210–390 ms): cam yüzeylerdeki `backdrop-filter: blur(20px) saturate(160%)` WebGL haritanın üstünde her harita karesinde yeniden bulanıklaştırılıyordu. Tek başına kapatmak medyanı 73 ms, fps'i 89'a çıkardı (eskinin 28 fps'i de bu yüzdendi: eski `.glass` blur(6px) kullanıyordu).

- **Cam hareket halindeyken bulanıksız yedek:** harita sürüklenirken/yakınlaşırken/uçarken ve katman değişirken `html[data-harita-hareket]` açılır, `.glass` yarı saydam yedeğe düşer (zemin %86); durunca blur geri gelir (`src/lib/cam.ts`). Katman rayına ilk dokunuşta (menü açılırken) bayrak önceden kaldırılır; böylece ilk değişim «blur kapatma» maliyetini ödemez (ilk ölçüm 150–230 ms idi, şimdi diğerleriyle aynı).
- **Çapraz geçiş:** raster **bir kez** hazırlanır (`paintGrid` etkisi katman/görüntü değişiminde tek çalışır). Yeni katman tam opaklıkta ve eskinin **altına** eklenir; geçiş yalnız eski katmanın opaklığını 200 ms'de 0'a indirir. 600 ms içinde art arda değişimde geçiş yok (anında). Geçişin kendisi ölçülen süreyi etkilemiyordu (kapalıyken de aynı sonuç).
