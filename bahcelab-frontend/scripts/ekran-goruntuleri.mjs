// Gerçek bahçeyle (geliştirme sunucuları: web 5173, API 8001) ekran görüntüsü alır; e2e değildir, veriye yazmaz.
// Kullanım: BAHCE=<bahçe id> EPOSTA=... SIFRE=... CIKTI=<klasör> PW_CHROME_PATH=<chrome> node scripts/ekran-goruntuleri.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const { BAHCE, EPOSTA, SIFRE, CIKTI, PW_CHROME_PATH, KUME = '9c', WEB = 'http://localhost:5173' } = process.env
if (!BAHCE || !EPOSTA || !SIFRE || !CIKTI) throw new Error('BAHCE, EPOSTA, SIFRE ve CIKTI gerekli')
mkdirSync(CIKTI, { recursive: true })
/** Dar ekranda görünüm geçici olarak uzatılır, öğe bütün hâliyle çekilir (yapışkan alt katmanlar kırpmasın). */
async function cekim(page, el, yol, dar) {
  const boyut = page.viewportSize()
  if (dar) await page.setViewportSize({ width: boyut.width, height: 1600 })
  await el.evaluate((n) => n.scrollIntoView({ block: 'start' }))
  await page.waitForTimeout(600)
  await el.screenshot({ path: yol })
  if (dar) await page.setViewportSize(boyut)
}
/** 9D: radar katmanları, tarih kutusu (yörünge), nokta inceleme, Su sekmesi şeridi ve (varsa) Durum'daki eski optik satırı. */
async function radarCekimleri(page, ad, width) {
  const menu = page.getByTestId('katman-menusu')
  const sec = async (id) => {
    await menu.getByRole('button').first().click()
    await page.getByTestId(`katman-${id}`).click()
    await page.waitForTimeout(2500)
  }
  await sec('radarVh')
  await page.screenshot({ path: join(CIKTI, `katman-radar-vh-${ad}.png`) })
  await page.getByTestId('tarih-kutusu').screenshot({ path: join(CIKTI, `tarih-kutusu-yorunge-${ad}.png`) })
  const harita = await page.getByTestId('harita-paneli').boundingBox()
  await page.mouse.click(harita.x + harita.width * 0.45, harita.y + harita.height * 0.55)
  await page.getByRole('dialog', { name: 'Nokta incelemesi' }).waitFor({ timeout: 15000 })
  await page.getByTestId('radar-mini-seri').waitFor({ timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(CIKTI, `nokta-inceleme-radar-${ad}.png`) })
  await page.getByRole('dialog', { name: 'Nokta incelemesi' }).getByRole('button', { name: 'Kapat' }).click()
  await sec('radarDegisim')
  await page.screenshot({ path: join(CIKTI, `katman-radar-degisim-${ad}.png`) })
  await page.goto(`${WEB}/bahceler/${BAHCE}/su`)
  const serit = page.getByTestId('bulut-altinda-gorus')
  await serit.waitFor({ timeout: 30000 })
  await page.waitForTimeout(1500)
  await cekim(page, serit, join(CIKTI, `su-bulut-altinda-gorus-${ad}.png`), width < 700)
  await page.goto(`${WEB}/bahceler/${BAHCE}`)
  await page.getByTestId('durum-karti').waitFor({ timeout: 30000 })
  if (await page.getByTestId('eski-optik-satiri').count()) await page.screenshot({ path: join(CIKTI, `durum-eski-optik-satiri-${ad}.png`) })
  else console.log(`[${ad}] eski optik satırı yok (son optik görüntü taze): görüntü alınmadı`)
}
const browser = await chromium.launch({ executablePath: PW_CHROME_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })

for (const [ad, width, height] of [['1440', 1440, 900], ['390', 390, 844]]) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'light' })
  const page = await context.newPage()
  await page.goto(`${WEB}/login`)
  await page.getByLabel(/e-posta/i).fill(EPOSTA)
  await page.getByLabel(/şifre/i).first().fill(SIFRE)
  await page.getByRole('button', { name: /giriş/i }).click()
  await page.waitForURL(/bahceler/)
  await page.goto(`${WEB}/bahceler/${BAHCE}`)
  await page.getByTestId('harita-paneli').waitFor({ timeout: 60000 })
  await page.waitForTimeout(5000)
  if (KUME === '9d') {
    await radarCekimleri(page, ad, width)
    await context.close()
    continue
  }
  await page.screenshot({ path: join(CIKTI, `durum-kademe-cipler-${ad}.png`) })
  const cubuk = page.getByTestId('gosterge-cubuklari')
  await cekim(page, cubuk, join(CIKTI, `durum-gosterge-cubuklari-${ad}.png`), width < 700)
  const sezon = page.getByTestId('sezon-egrisi')
  for (const [g, dosya] of [['ndvi', 'canlilik'], ['ndre', 'klorofil']]) {
    await sezon.scrollIntoViewIfNeeded()
    await page.getByTestId(`sezon-${g}`).click()
    await page.waitForTimeout(600)
    await cekim(page, sezon, join(CIKTI, `durum-sezon-${dosya}-${ad}.png`), width < 700)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  for (const [id, dosya] of [['klorofil', 'klorofil'], ['yaprakAlani', 'yaprak-alani'], ['tacToprak', 'tac-ve-toprak'], ['yaprakSuyu', 'yaprak-suyu']]) {
    await page.getByTestId('katman-menusu').getByRole('button').first().click()
    await page.getByTestId(`katman-${id}`).click()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: join(CIKTI, `katman-${dosya}-${ad}.png`) })
  }
  await context.close()
}
await browser.close()
