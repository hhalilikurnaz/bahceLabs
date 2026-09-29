# Vercel’de yayın (bahcelabs.com)

Repoda hazır olanlar: kök `vercel.json`, `bahcelab-frontend/vercel.json`, `.nvmrc` (Node 22).

## Ön koşul

- Kod **GitHub**’da olmalı (Vercel repoyu oradan bağlar).
- Henüz yoksa: GitHub’da repo oluştur → bu projeyi push et.

## İki geçerli kurulum (birini seçin)

**A) Repo kökü (önerilen)** — Root Directory **boş bırakın** (`.`)

| Alan | Değer |
|------|--------|
| Build Command | `npm run build` |
| Output Directory | `bahcelab-frontend/dist` |

**B) Frontend klasörü** — Root Directory: `bahcelab-frontend`

| Alan | Değer |
|------|--------|
| Output Directory | `dist` |

---

## 1. Projeyi Vercel’e ekle

1. Tarayıcıda [https://vercel.com](https://vercel.com) aç → **Sign Up** / **Log In** (GitHub ile giriş en kolayı).
2. Üstte veya ana sayfada **Add New…** → **Project** (bazen **Import Project**).
3. **Import Git Repository** listesinden **bahcelab-web** (veya repo adınız) seç → **Import**.
4. **Configure Project** ekranında **önemli**:

   | Alan | Değer |
   |------|--------|
   | **Framework Preset** | Vite (otomatik gelmeli) |
   | **Root Directory** | **Edit** tıkla → `bahcelab-frontend` seç / yaz |
   | **Build Command** | `npm run build` (varsayılan) |
   | **Output Directory** | `dist` (varsayılan) |
   | **Install Command** | `npm install` (varsayılan) |

5. **Environment Variables** (şimdilik sadece site + blog için):

   | Name | Value |
   |------|--------|
   | `VITE_PLANNING_API_MODE` | `mock` |

   (İleride gerçek API: `real` + `VITE_PLANNING_API_BASE_URL`.)

6. **Deploy** tıkla → 2–4 dk sonra **Visit** ile `*.vercel.app` adresini aç; ana sayfa ve `/blog` çalışmalı.

---

## 2. Domain bağlama (bahcelabs.com)

1. Vercel’de projeye gir → üst menü **Settings**.
2. Sol menü **Domains**.
3. Kutuya `bahcelabs.com` yaz → **Add**.
4. Aynı şekilde `www.bahcelabs.com` ekle.
5. Her domain satırında **Invalid Configuration** veya **DNS Records** / **Learn more** görünür → Vercel’in istediği kayıtları not al.

Tipik kayıtlar (panelde yazanlar esas alınır):

| Tip | Ad (Name / Host) | Değer (Value) |
|-----|------------------|---------------|
| **A** | `@` veya boş | `76.76.21.21` (Vercel’in gösterdiği IP) |
| **CNAME** | `www` | `cname.vercel-dns.com` (Vercel’in verdiği tam hostname) |

6. Domain satın aldığınız firada (GoDaddy, Cloudflare, Natro, İsimtescil, vb.) **DNS / DNS Yönetimi** bölümüne gir → yukarıdaki kayıtları ekle → kaydet.
7. Vercel **Domains** sayfasını yenile; **Valid Configuration** yeşil olana kadar bekle (dakikalar–saatler).

**Yönlendirme:** Domains listesinde birini “Primary” yapın; diğerini Vercel’in önerdiği **Redirect** ile ana domaine yönlendirin (ör. `www` → `bahcelabs.com` veya tersi).

---

## 3. Sonraki deploy’lar

`main` (veya bağladığınız branch)’e her push → Vercel otomatik yeniden build eder.

---

## Testler

Yerelde: `cd bahcelab-frontend && npm test`  
Vercel varsayılan olarak **test çalıştırmaz**; yalnızca build komutu önemli. Build Command alanına `npm test && npm run build` yazmadıysanız deploy hatası testten kaynaklanmaz.

**Node:** Proje Node **20.19+** ister (Vite 8). Vercel → Settings → General → **Node.js Version** → **22.x**.

---

## Sık sorunlar

| Sorun | Çözüm |
|--------|--------|
| **Deployment failed** | Deployments → başarısız satır → **Building** logunu aç; kırmızı satırı oku (çoğunlukla yanlış Output Directory veya eski Node). |
| Build hata veriyor | A şemasında Output `bahcelab-frontend/dist`; B şemasında Root `bahcelab-frontend` + Output `dist`. |
| `/blog/slug` 404 | `vercel.json` repoda mı, son deploy başarılı mı? |
| Domain hâlâ kırmızı | DNS’te eski A/CNAME kaldı mı; TTL sonrası tekrar dene. |
| Planlama API çalışmıyor | Canlıda backend ayrı host’ta; env `VITE_PLANNING_API_*` güncellenmeli. |

---

## Bana göndermeniz gerekmeyenler

DNS panel şifresi, API token veya tam zone export — güvenlik için paylaşmayın. Takılırsanız Vercel **Domains** ekranının ekran görüntüsü (şifre olmadan) yeterli.
