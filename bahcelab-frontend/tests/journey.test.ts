import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { journeyMessages } from '@/features/marketing/journey/journeyMessages'
import { IMG_H, IMG_W, STOPS, TOTAL_LEN, camTransform, frameAt, mobileCam } from '@/features/marketing/journey/journeyTimeline'

const PUBLIC = join(import.meta.dirname, '..', 'public', 'media')
const kb = (p: string) => statSync(p).size / 1024

describe('journey zaman çizelgesi', () => {
  it('3 durak; toplam kaydırma 5 ekranın altında (eski: ≈10)', () => {
    expect(STOPS).toHaveLength(3)
    expect(TOTAL_LEN).toBeLessThan(5)
  })

  it('her kaydırma konumunda çerçeve sonlu ve sıralı: tarama 0→1, durak -1→2', () => {
    let sonTarama = 0
    let sonDurak = -1
    for (let s = 0; s <= TOTAL_LEN + 1; s += 0.01) {
      const f = frameAt(s)
      for (const v of [f.scan, f.stepIn, f.intro, f.cam.x, f.cam.y, f.cam.z, f.layers.rings, f.layers.zones, f.layers.water, f.layers.grade]) expect(Number.isFinite(v)).toBe(true)
      expect(f.scan).toBeGreaterThanOrEqual(sonTarama - 1e-9)
      expect(f.stop).toBeGreaterThanOrEqual(sonDurak)
      expect(f.stepIn).toBeGreaterThanOrEqual(0)
      expect(f.stepIn).toBeLessThanOrEqual(1)
      sonTarama = f.scan
      sonDurak = f.stop
    }
    expect(sonTarama).toBe(1)
    expect(sonDurak).toBe(2)
  })

  it('son durağın metni sonuna kadar görünür kalır (içerik üstüne kayarken okunur)', () => {
    expect(frameAt(TOTAL_LEN).stepIn).toBe(1)
  })

  it('kamera fotoğrafı her zaman ekranı kaplar (kenar boşluğu görünmez), masaüstü ve mobil', () => {
    for (const [W, H] of [[1440, 900], [1920, 1080], [390, 844], [768, 1024]] as const) {
      for (const stop of STOPS) {
        const cam = W < 768 ? mobileCam(stop.cam) : stop.cam
        const { k, tx, ty } = camTransform(cam, W, H)
        expect(tx).toBeLessThanOrEqual(1e-9)
        expect(tx + IMG_W * k).toBeGreaterThanOrEqual(W - 1e-6)
        expect(ty).toBeLessThanOrEqual(1e-9)
        expect(ty + IMG_H * k).toBeGreaterThanOrEqual(H - 1e-6)
      }
    }
  })
})

describe('hero görsel bütçesi (L1)', () => {
  const hero = join(PUBLIC, 'hero')

  it('kare dizisi yok; yalnız iki hero fotoğrafı', () => {
    expect(existsSync(join(PUBLIC, 'hero-frames'))).toBe(false)
    expect(readdirSync(hero).sort()).toEqual(['hero-1000.webp', 'hero-1920.webp'])
  })

  it('masaüstü toplam ≤ 1,5 MB; mobil ≤ 800 KB', () => {
    expect(kb(join(hero, 'hero-1920.webp'))).toBeLessThanOrEqual(1536)
    expect(kb(join(hero, 'hero-1000.webp'))).toBeLessThanOrEqual(800)
  })
})

describe('index.html statik ilk kare (#boot)', () => {
  const html = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8')
  const { hero } = journeyMessages

  it('hero metinleri ve CTA etiketleri journeyMessages ile aynı (kabuk ile React hero ayrışmaz)', () => {
    expect(html).toContain(hero.eyebrow)
    expect(html).toContain(`${hero.titleLine1}<br>${hero.titleLine2}`)
    expect(html).toContain(hero.subtitle)
    expect(html).toContain(`>${hero.cta}</a>`)
    expect(html).toContain(`>${hero.secondary}</a>`)
    expect(html).toContain("b.setAttribute('aria-hidden', 'true')") // kabuk erişilebilirlik ağacında çift içerik üretmez
  })

  it('LCP görseli: fetchpriority=high, srcset index.html ile journeySite aynı adaylar, yalnız ana sayfada eklenir', async () => {
    const { journeySite } = await import('@/features/marketing/journey/journeySite')
    expect(html).toContain('fetchpriority="high"')
    expect(html).toContain(`srcset="${journeySite.hero.srcSet}"`)
    expect(html).toContain("location.pathname === '/'")
    expect(html).not.toMatch(/Kayıtlar çok yakında/)
  })
})
