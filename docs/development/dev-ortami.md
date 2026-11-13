# Geliştirme ortamı: tam yığın (API + arq işçisi + Vite)

**Tek komut:** `make dev` — Docker (PostgreSQL+PostGIS ve Redis) ayağa kalkar, migration'lar uygulanır, ardından **API** (`--reload`), **arq işçisi** (zamanlanmış işler) ve **Vite** birlikte başlar; `Ctrl+C` üçünü de durdurur.

| Parça | Komut (tek tek) | Not |
|---|---|---|
| DB + Redis | `make docker-up` | portlar kök `.env` |
| Migration | `make db-migrate` | `make dev` kendiliğinden yapar |
| API | `make backend-dev` | `JOB_BACKEND` verilmezse `inline`: işleri API süreci kendi içinde zamanlar |
| İşçi | `make worker` | `JOB_BACKEND=arq` + Redis gerekir; **API de `arq` ile açılmalı** (`make dev` ikisine de verir) |
| Bir işi şimdi koştur | `make job ad=refresh_validation` | ad vermezseniz iş listesi çıkar |

## Neden işçi?
Besleme, izleme (akış tazeliği, veri taraması, kaynak uyumu) ve IMERG/SMAP doğrulama gibi işler zamanlanmıştır (`jobs/registry.py`). `JOB_BACKEND=arq` iken API işleri **kendi içinde zamanlamaz**; işçi koşmuyorsa hiçbir zamanlanmış iş çalışmaz ve iç izleme ekranı (`/ic/kalite`) akışları «kopuk» gösterir (dev'de IMERG/SMAP/Sentinel akışları 28 Ekim'den beri koşmamıştı; o sırada ne API ne işçi açıktı). `make dev` bunu önler.

## Belirteç (Earthdata) notu
`make` hedefleri `env -u EARTHDATA_TOKEN` ile başlar: kök `.env`'deki boş `EARTHDATA_TOKEN=` satırı `bahcelab-backend/.env.local`'daki gerçek belirteci ezmesin. Belirteç yalnız `.env.local`'dan okunur. Belirteç süresi dolarsa (CMR/GES DISC 401) yenileyip `.env.local`'a yazın; kontrol: `make job ad=refresh_validation` ve ardından `dogrulama_gozlem` içinde IMERG/SMAP son günü (IMERG Late ≈ 1 gün gecikmeli).

## İşler ne zaman koşar?
Günlük işler belirli saatte (örn. `refresh_validation` 05:00, `refresh_izleme` günlük) koşar; işçi başlarken **hemen** koşmaz (`run_at_startup=False`). Taze veri için `make job ad=<iş>` kullanın.

## «Bugün» (saat dilimi)
Uygulama «bugün»ü `shared/clock.bugun(bahce)` ile alır (bahçenin `zaman_dilimi` alanı; varsayılan Europe/Istanbul). Servis/iş/betik kodunda `date.today()` ve `datetime.now(UTC).date()` yasaktır (`tests/test_tarih_yasagi.py`); web'de `todayIstanbul()` (`tests/bugunYasagi.test.ts`).
