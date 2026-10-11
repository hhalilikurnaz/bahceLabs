# ADR 0009 — Zamanlanmış işler: Redis + arq (geliştirmede süreç içi)

**Durum:** kabul (Adım 8B)

**Bağlam.** Hava tazeleme, risk/uyarı hesabı ve bildirim üretimi periyodik çalışmalıdır; kullanıcı sayfayı açmasa da bildirim oluşmalıdır. Adım 9'da sahne işleme ve çok yıllık bölge hesapları da aynı altyapıda kuyruğa alınacaktır. Mevcut NDVI işleri süreç içi `asyncio` görevidir (süreç ölünce yarım kalır, ölçeklenmez).

**Karar.**
1. **Kuyruk/zamanlayıcı: Redis + [arq](https://arq-docs.helpmanual.io/).** Gerekçe: tamamen asyncio (FastAPI/SQLAlchemy async ile aynı model, iş gövdeleri doğrudan `await` edilir); küçük bağımlılık (Celery'nin ağır broker/serileştirme yığını ve ayrı sync/async köprüsü gerekmez); cron zamanlaması (`cron(...)`) ve `_job_id` ile tekilleştirme yerleşik; tek bir Redis konteyneri yeterli (docker compose `redis`). Alternatifler: *Celery* (güçlü ama senkron ağırlıklı, bu ölçek için fazla), *APScheduler* (kalıcı kuyruk/yeniden deneme yok, yatay ölçek yok), *PostgreSQL tabanlı kuyruk* (ek bağımlılık yok ama cron/izleme araçlarını kendimiz yazarız).
2. **Arayüz:** `jobs/registry.py` iş listesi (ad → gövde, aralık); `jobs/queue.py` `JobQueue` arayüzü: `InlineQueue` (hemen çalıştırır) ve `ArqQueue` (Redis'e koyar, sabit `_job_id` ile aynı iş iki kez sıraya girmez). **Adım 9'un işleri (sahne işleme vb.) bu arayüze iş olarak eklenecek**; yeni altyapı gerekmez.
3. **Çalışma biçimleri:** `JOB_BACKEND=inline` (varsayılan; Redis gerekmez): FastAPI `lifespan` içinde `InlineScheduler` periyodik görevleri başlatır — geliştirme ve tek sunucu. `JOB_BACKEND=arq`: `make worker` (`arq ...WorkerSettings`) cron ile çalıştırır; API yalnızca iş ekler. **Testler** işleri doğrudan (senkron) çağırır (`generate_notifications(factory, provider, workspace_id=…)`), zamanlayıcı/Redis gerekmez.
4. **İdempotans:** hava tazeleme 1 saatlik önbelleğe dayanır (tekrar çağrı sağlayıcıya gitmez); bildirimler `(workspace_id, dedupe_key)` tekil kısıtıyla `ON CONFLICT DO NOTHING` ile yazılır (aynı olay = tek bildirim, iş tekrarında çoğalmaz; ek kanallara yalnızca yeni kayıtlar iletilir); risk özeti `garden_risk_snapshots` üzerine yazılır. Bir bahçe/çalışma alanındaki hata diğerlerini durdurmaz (iş sonucu `hata` sayar).
5. **Bildirim kanalları:** uygulama içi kanal veritabanı kaydıdır; WhatsApp/SMS (Adım 18) `channels.registry.register(...)` ile aynı arayüze eklenir.

**Sonuçlar.** Üretimde ek bir servis (Redis) ve bir işçi süreci gerekir; geliştirmede hiçbiri gerekmez. Liste skoru zararlı riskini zamanlanmış işin son özetinden (`garden_risk_snapshots`) okur; bu yüzden liste, iş aralığı (varsayılan 60 dk) kadar eski olabilir; Durum sekmesi canlı hesaplar.

**Geri dönüş.** İş gövdeleri taşıyıcıdan bağımsızdır; arq yerine başka bir kuyruğa geçmek yalnızca `queue.py`/`arq_worker.py` değişikliğidir.
