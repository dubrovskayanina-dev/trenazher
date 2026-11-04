import type { ReactNode } from 'react'
import { go } from '../lib/router'

export function Screen({
  title,
  backTo,
  right,
  children,
}: {
  title?: ReactNode
  backTo?: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh">
      {(title || backTo || right) && (
        <header className="pt-safe sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto flex h-12 max-w-xl items-center gap-2 px-2">
            {backTo ? (
              <button
                className="flex h-11 min-w-11 items-center px-2 text-[1.0625rem] text-accent"
                onClick={() => go(backTo, true)}
                aria-label="Назад"
              >
                <span className="text-2xl leading-none">‹</span>
                <span className="ml-1">Назад</span>
              </button>
            ) : (
              <span className="w-2" />
            )}
            <h1 className="min-w-0 flex-1 truncate text-center text-[1.0625rem] font-semibold">{title}</h1>
            <div className="flex min-w-11 justify-end">{right}</div>
          </div>
        </header>
      )}
      <main className="pb-safe mx-auto max-w-xl px-4 pb-8">{children}</main>
    </div>
  )
}

export function ProgressBar({
  value,
  max,
  tone = 'accent',
  className = '',
}: {
  value: number
  max: number
  tone?: 'accent' | 'ok' | 'bad'
  className?: string
}) {
  const p = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const color = tone === 'ok' ? 'bg-ok' : tone === 'bad' ? 'bg-bad' : 'bg-accent'
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-line ${className}`}>
      <div className={`h-full rounded-full ${color} transition-[width]`} style={{ width: `${p}%` }} />
    </div>
  )
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: ReactNode
  hint?: ReactNode
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[1.0625rem]">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <span
        className={`relative h-8 w-13 shrink-0 rounded-full transition ${checked ? 'bg-ok' : 'bg-line'}`}
      >
        <span
          className={`absolute top-0.5 h-7 w-7 rounded-full bg-white shadow transition-[left] ${checked ? 'left-[1.375rem]' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-xl bg-line/70 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`min-h-10 flex-1 rounded-lg px-2 text-[0.9375rem] font-medium transition ${
            value === o.value ? 'bg-card shadow-sm' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chips<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string; disabled?: boolean }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`chip ${value === o.value ? 'chip-on' : ''} disabled:opacity-35`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Badge({ tone, children }: { tone: 'ok' | 'bad' | 'warn' | 'muted' | 'accent'; children: ReactNode }) {
  const cls = {
    ok: 'bg-ok-soft text-ok',
    bad: 'bg-bad-soft text-bad',
    warn: 'bg-warn-soft text-warn',
    muted: 'bg-line text-muted',
    accent: 'bg-accent-soft text-accent',
  }[tone]
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>
}

export function Chevron() {
  return <span className="shrink-0 text-xl leading-none text-muted/60">›</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card px-4 py-6 text-center text-muted">{children}</div>
}
