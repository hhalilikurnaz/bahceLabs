import { journeySite } from './journeySite'

export function heroPosterUrl(mobile: boolean) {
  const seq = journeySite.heroSequence
  const src = mobile ? seq.mobile : seq.desktop
  return `${src.path}${'1'.padStart(seq.pad, '0')}.${src.ext}`
}
