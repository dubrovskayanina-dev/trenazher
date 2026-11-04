import { useMemo } from 'react'
import type { Bank } from '../types'
import { BANK_LABEL, useData } from '../data'
import { useAppState } from '../lib/store'
import { href } from '../lib/router'
import { bestPercent, masteredCount } from '../lib/selectors'
import { formatPercent, nQuestions } from '../lib/format'
import { Chevron, ProgressBar, Screen } from '../components/ui'

/** «Выбрать конкретный тест» — все исходные тесты, сгруппированные по банкам. */
export function Sources() {
  const data = useData()
  const { history, qstats, settings } = useAppState()

  const groups = useMemo(() => {
    const g = new Map<Bank, string[]>()
    for (const b of data.banks) g.set(b, [])
    for (const [src, bank] of data.sourceBank) g.get(bank)!.push(src)
    for (const list of g.values()) list.sort((a, b) => a.localeCompare(b, 'it', { numeric: true }))
    return g
  }, [data])

  return (
    <Screen title="Выбрать тест" backTo="#/">
      {[...groups.entries()].map(([bank, sources]) => (
        <div key={bank}>
          <div className="section-title">{BANK_LABEL[bank]}</div>
          <div className="card divide-y divide-line overflow-hidden">
            {sources.map((s) => {
              const qs = data.bySource.get(s) ?? []
              const best = bestPercent(history, 'source', s)
              const mastered = masteredCount(qs, qstats)
              return (
                <a key={s} href={href('setup', 'source', s)} className="flex items-center gap-3 px-4 py-3 active:bg-line/50">
                  <div className="min-w-0 flex-1">
                    <div className="text-[1rem] leading-snug font-medium" lang="it">
                      {s}
                    </div>
                    <div className="mt-0.5 text-[0.8125rem] text-muted">
                      {nQuestions(qs.length)} ·{' '}
                      <span className={best === null ? '' : best >= settings.threshold ? 'font-semibold text-ok' : 'font-semibold text-bad'}>
                        лучший {best === null ? '—' : formatPercent(best)}
                      </span>
                    </div>
                    <ProgressBar value={mastered} max={qs.length} className="mt-1.5" />
                  </div>
                  <Chevron />
                </a>
              )
            })}
          </div>
        </div>
      ))}
    </Screen>
  )
}

/** «Темы вне пройденного» — вопросы без лекций, отдельно от тренировок по лекциям. */
export function OffTopic() {
  const data = useData()
  const { qstats } = useAppState()

  const bySource = useMemo(() => {
    const m = new Map<string, number>()
    for (const q of data.offTopic) m.set(q.source, (m.get(q.source) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [data])

  const mastered = masteredCount(data.offTopic, qstats)

  return (
    <Screen title="Вне пройденного" backTo="#/">
      <p className="mt-4 px-1 text-[0.9375rem] leading-snug text-muted">
        Вопросы, которые пока не относятся ни к одной лекции: urbanistico, società e fallimento, condominio, titoli di
        credito, diritto di famiglia и другие. В тренировку по лекциям они не попадают, в экзамен — по желанию.
      </p>
      <a href={href('setup', 'offtopic')} className="card mt-3 flex items-center gap-3 p-4 active:opacity-80">
        <div className="min-w-0 flex-1">
          <div className="text-[1.0625rem] font-semibold">Все темы вне пройденного</div>
          <div className="text-sm text-muted">
            {nQuestions(data.offTopic.length)} · освоено {mastered}
          </div>
          <ProgressBar value={mastered} max={data.offTopic.length} className="mt-1.5" />
        </div>
        <Chevron />
      </a>

      <div className="section-title">По тестам</div>
      <div className="card divide-y divide-line overflow-hidden">
        {bySource.map(([s, n]) => (
          <a key={s} href={href('setup', 'offtopic', s)} className="flex items-center gap-3 px-4 py-3 active:bg-line/50">
            <div className="min-w-0 flex-1">
              <div className="text-[1rem] leading-snug" lang="it">
                {s}
              </div>
              <div className="text-[0.8125rem] text-muted">
                {nQuestions(n)} · {BANK_LABEL[data.sourceBank.get(s)!]}
              </div>
            </div>
            <Chevron />
          </a>
        ))}
      </div>
    </Screen>
  )
}
