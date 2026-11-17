import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, buttonClass } from '@/components/ui'
import { authErrorMessage } from '../authErrors'
import { BEKLEME_URUNLERI, IL_ONERILERI, beklemeListesineKatil, type BeklemeUrun } from '../bekleme'
import { authFieldClass, authLabelClass } from './AuthShell'

/** Kayıtlar kapalıyken erken erişim listesi: e-posta + il + ürün + KVKK açık rıza (işaretsiz gelir). */
export function BeklemeFormu() {
  const [email, setEmail] = useState('')
  const [il, setIl] = useState('')
  const [urun, setUrun] = useState<BeklemeUrun | ''>('')
  const [riza, setRiza] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [bekliyor, setBekliyor] = useState(false)
  const [tamam, setTamam] = useState<string | null>(null)
  const ilListesi = useId()
  const rizaHata = useId()

  async function gonder(event: React.FormEvent) {
    event.preventDefault()
    if (!urun) return setHata('Ürününüzü seçin.')
    if (!riza) return setHata('Açık rıza vermeden kayıt alınamaz.')
    setBekliyor(true)
    setHata(null)
    try {
      await beklemeListesineKatil({ email, il, urun, riza })
      setTamam(email.trim())
    } catch (err) {
      setHata(authErrorMessage(err, 'Kaydınız alınamadı. Biraz sonra tekrar deneyin.'))
    } finally {
      setBekliyor(false)
    }
  }

  if (tamam) {
    return (
      <div className="space-y-5" role="status">
        <p className="text-body leading-relaxed text-mk-ink">
          <b>Kaydınız alındı.</b> Erişim açıldığında <b>{tamam}</b> adresine haber vereceğiz.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to="/blog" className={buttonClass({ variant: 'secondary', block: true, className: 'flex-1' })}>Bloga git</Link>
          <Link to="/" className={buttonClass({ variant: 'ghost', block: true, className: 'flex-1' })}>Ana sayfaya git</Link>
        </div>
      </div>
    )
  }

  return (
    <form className="space-y-4" onSubmit={gonder} noValidate={false}>
      {hata && (
        <p role="alert" className="rounded-lg border border-app-danger/25 bg-app-danger/8 px-3.5 py-2.5 text-small text-app-danger">
          {hata}
        </p>
      )}

      <label className="block">
        <span className={authLabelClass}>E-posta</span>
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={authFieldClass} placeholder="ornek@bahce.com" />
      </label>

      <label className="block">
        <span className={authLabelClass}>İl</span>
        <input type="text" autoComplete="address-level1" required minLength={2} maxLength={80} list={ilListesi} value={il} onChange={(e) => setIl(e.target.value)} className={authFieldClass} placeholder="Mersin" />
        <datalist id={ilListesi}>
          {IL_ONERILERI.map((i) => <option key={i} value={i} />)}
        </datalist>
      </label>

      <fieldset className="min-w-0 border-0 p-0">
        <legend className={authLabelClass}>Ürün</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BEKLEME_URUNLERI.map((u) => (
            <label key={u.deger} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-3 text-small font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-mk-accent ${urun === u.deger ? 'border-mk-accent bg-mk-accent/10 text-mk-ink' : 'border-mk-ink/20 bg-white text-mk-body hover:border-mk-accent'}`}>
              <input type="radio" name="urun" value={u.deger} required checked={urun === u.deger} onChange={() => setUrun(u.deger)} className="sr-only" />
              {u.etiket}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={riza} onChange={(e) => setRiza(e.target.checked)} aria-describedby={hata && !riza ? rizaHata : undefined} className="mt-0.5 h-5 w-5 shrink-0 accent-mk-accent" />
          <span className="text-small leading-relaxed text-mk-body">
            <Link to="/kvkk" target="_blank" rel="noopener" className="font-semibold text-mk-ink underline underline-offset-2">Aydınlatma metnini</Link> okudum.
            E-posta adresimin, ilimin ve ürünümün erken erişim bildirimi amacıyla işlenmesine açık rıza veriyorum.
          </span>
        </label>
        <span id={rizaHata} className="sr-only">Kayıt için açık rıza gerekli</span>
      </div>

      <Button type="submit" variant="primary" size="lg" block loading={bekliyor} className="mt-2">
        {bekliyor ? 'Kaydediliyor…' : 'Erken erişime katıl'}
      </Button>
    </form>
  )
}
