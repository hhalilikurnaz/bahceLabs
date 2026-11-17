import type { ElementType, ReactNode } from 'react'
import { useInViewReveal } from '../hooks/useInViewReveal'

interface RevealProps {
  children: ReactNode
  className?: string
  delayMs?: number
  /** Sarmalayıcı öğe: liste içinde `li` kullanın (ul > div geçersiz işaretleme, axe list/listitem) */
  as?: 'div' | 'li' | 'section' | 'article' | 'p'
}

export function Reveal({ children, className = '', delayMs = 0, as = 'div' }: RevealProps) {
  const { ref, visible } = useInViewReveal()
  const Tag = as as ElementType

  return (
    <Tag
      ref={ref}
      className={`transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
      } ${className}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </Tag>
  )
}
