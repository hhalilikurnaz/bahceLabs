import { useMemo, type ReactNode } from 'react'
import { TimeDomainBaglami, type TimeDomainDegeri } from './timeDomainBaglam'

export function TimeDomainProvider({ imlec, setImlec, sec, children }: TimeDomainDegeri & { children: ReactNode }) {
  const value = useMemo(() => ({ imlec, setImlec, sec }), [imlec, setImlec, sec])
  return <TimeDomainBaglami.Provider value={value}>{children}</TimeDomainBaglami.Provider>
}
