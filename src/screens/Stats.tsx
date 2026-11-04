import { useMemo, useState } from 'react'
import type { Attempt } from '../types'
import { lessonShort, useData } from '../data'
import { useAppState } from '../lib/store'
import { href } from '../lib/router'
import { accuracy, masteredCount } from '../lib/selectors'
import { formatDate, formatPercent, nQuestions, plural } from '../lib/format'
import { pct } from '../lib/scoring'
import { Badge, Empty, ProgressBar, Screen } from '../components/ui'

export default function Stats() {
  const data = useData()
  const { history, qstats, settings } = useAppState()
  const threshold = settings.threshold

  const touched = Object.keys(qstats).length
  const passed = history.filter((a) => a.passed).length
  const last10 = history.slice(-10)
  const avg10 = last10.length ? pct(last10.reduce((s, a) => s + a.percent, 0), last10.length * 100) : null

  const topicRows = useMemo(() => {
    const rows = data.lessons.map((l) => {
      const qs = data.byLesson.get(l.id) ?? []
      const acc = accuracy(qs, qstats)
      return {
        key: l.id,
        code: l.id,
        label: lessonShort(l.title),
        total: qs.length,
        touched: acc.touched,
        mastered: masteredCount(qs, qstats),
        percent: acc.seen ? pct(acc.correct, acc.seen) : null,
      }
    })
    const acc = accuracy(data.offTopic, qstats)
    rows.push({
      key: 'off',
      code: 'Вне',
      label: 'пройденного',
      total: data.offTopic.length,
      touched: acc.touched,
      mastered: masteredCount(data.offTopic, qstats),
      percent: acc.seen ? pct(acc.correct, acc.seen) : null,
    })
    return rows
  }, [data, qstats])

  return (
    <Screen title="Статистика" backTo="#/">
      {history.length === 0 ? (
        <div className="mt-4">
          <Empty>Здесь появится история попыток и динамика после первого завершённого теста.</Empty>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Tile label="Попыток" value={history.length} sub={`сдано ${passed}`} />
            <Tile label="Средний % (10 последних)" value={avg10 === null ? '—' : formatPercent(avg10)} />
            <Tile label="Вопросов решено" value={touched} sub={`из ${data.questions.length}`} />
            <Tile label="Порог" value={`${threshold} %`} sub="меняется в настройках" />
          </div>

          <div className="section-title">Динамика</div>
          <TrendChart attempts={history.slice(-30)} threshold={threshold} />
        </>
      )}

      <div className="section-title">Процент по темам (за всё время)</div>
      <div className="card overflow-hidden">
        {topicRows.map((r) => {
          const below = r.percent !== null && r.percent < threshold
          return (
            <div key={r.key} className={`border-b border-line px-4 py-3 last:border-b-0 ${below ? 'bg-bad-soft' : ''}`}>
              <div className="flex items-baseline gap-2">
                <div className="min-w-0 flex-1 text-[0.9375rem] leading-snug">
                  <span className="font-semibold">{r.code}</span> {r.label}
                </div>
                <div
                  className={`shrink-0 text-[1.0625rem] font-bold tabular-nums ${
                    r.percent === null ? 'text-muted' : below ? 'text-bad' : 'text-ok'
                  }`}
                >
                  {r.percent === null ? '—' : formatPercent(r.percent)}
                </div>
              </div>
              <ProgressBar value={r.mastered} max={r.total} className="mt-2" />
              <div className="mt-1 text-xs text-muted">
                решено {r.touched} из {r.total} · освоено {r.mastered}
              </div>
            </div>
          )
        })}
      </div>
      <p className="px-1 pt-1.5 text-xs text-muted">
        Процент — доля верных ответов по всем попыткам. «Освоено» — последний ответ на вопрос был верным.
      </p>

      {history.length > 0 && (
        <>
          <div className="section-title">История попыток</div>
          <div className="card divide-y divide-line overflow-hidden">
            {[...history].reverse().map((a) => (
              <a key={a.id} href={href('result', a.id)} className="flex items-center gap-3 px-4 py-3 active:bg-line/50">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[1rem] font-medium">{a.title}</div>
                  <div className="text-[0.8125rem] text-muted">
                    {formatDate(a.finishedAt)} · {nQuestions(a.total)} · {a.wrong}{' '}
                    {plural(a.wrong, ['ошибка', 'ошибки', 'ошибок'])}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[1.0625rem] font-bold tabular-nums">{formatPercent(a.percent)}</span>
                  {a.passed ? <Badge tone="ok">сдала</Badge> : <Badge tone="bad">не сдала</Badge>}
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </Screen>
  )
}

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[0.8125rem] leading-tight text-muted">{label}</div>
      <div className="mt-1 text-[1.5rem] leading-none font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  )
}

/** Столбики — процент каждой попытки, пунктир — порог. Тап по столбику показывает подробности. */
function TrendChart({ attempts, threshold }: { attempts: Attempt[]; threshold: number }) {
  const [sel, setSel] = useState<number>(attempts.length - 1)
  const W = 320
  const H = 140
  const padL = 28
  const padB = 4
  const plotW = W - padL
  const plotH = H - padB - 8
  const n = attempts.length
  const slot = plotW / Math.max(n, 6)
  const barW = Math.max(4, slot - 2)
  const y = (p: number) => 8 + plotH - (p / 100) * plotH
  const current = attempts[Math.min(sel, n - 1)]

  return (
    <div className="card p-4">
      <div className="min-h-10 text-[0.9375rem]">
        {current && (
          <>
            <span className="font-semibold">{formatPercent(current.percent)}</span>
            <span className="text-muted">
              {' '}
              · {current.title} · {formatDate(current.finishedAt)}
            </span>
          </>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Процент верных по последним попыткам">
        {[0, 50, 100].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="var(--color-muted)">
              {t}
            </text>
          </g>
        ))}
        {attempts.map((a, i) => {
          const x = padL + i * slot + (slot - barW) / 2
          const top = y(a.percent)
          const h = Math.max(2, y(0) - top)
          const r = Math.min(4, barW / 2, h)
          const active = i === sel
          // Скруглены только верхние углы — низ столбика стоит на оси.
          const d = `M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${y(0)} Z`
          return (
            <g key={a.id} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
              <rect x={padL + i * slot} y={0} width={slot} height={H} fill="transparent" />
              <path d={d} fill="var(--color-accent)" opacity={active ? 1 : 0.55} />
            </g>
          )
        })}
        <line
          x1={padL}
          x2={W}
          y1={y(threshold)}
          y2={y(threshold)}
          stroke="var(--color-ink)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <text x={W - 2} y={y(threshold) - 4} textAnchor="end" fontSize={10} fill="var(--color-ink)">
          порог {threshold}%
        </text>
      </svg>
      <div className="mt-1 text-xs text-muted">
        Последние {n} {plural(n, ['попытка', 'попытки', 'попыток'])}, слева старые. Нажми на столбик — подробности.
      </div>
    </div>
  )
}
