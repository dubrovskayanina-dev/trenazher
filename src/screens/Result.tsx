import { useMemo, useState } from 'react'
import type { Attempt, Question } from '../types'
import { BANK_LABEL, lessonShort, useData } from '../data'
import { useAppState } from '../lib/store'
import { href } from '../lib/router'
import { breakdownByLesson, breakdownBySource, outcome, recommendations, type TopicRow } from '../lib/scoring'
import { formatDuration, formatPercent, formatDate } from '../lib/format'
import { Badge, Empty, Screen, Segmented } from '../components/ui'

export default function Result({ id }: { id: string }) {
  const { history } = useAppState()
  const attempt = history.find((a) => a.id === id)
  if (!attempt) {
    return (
      <Screen title="Результат" backTo="#/">
        <div className="mt-4">
          <Empty>Попытка не найдена.</Empty>
        </div>
      </Screen>
    )
  }
  return <ResultView attempt={attempt} />
}

function ResultView({ attempt }: { attempt: Attempt }) {
  const data = useData()
  const { mistakes } = useAppState()
  const [by, setBy] = useState<'lesson' | 'source'>('lesson')
  const [filter, setFilter] = useState<'errors' | 'all'>('errors')
  const [limit, setLimit] = useState(50)

  const questions = useMemo(
    () => attempt.qids.map((id) => data.byId.get(id)).filter((q): q is Question => Boolean(q)),
    [data, attempt.qids],
  )
  const answers = attempt.answers
  const threshold = attempt.threshold

  const lessonRows = useMemo(() => breakdownByLesson(data, questions, answers, threshold), [data, questions, answers, threshold])
  const sourceRows = useMemo(() => breakdownBySource(questions, answers, threshold), [questions, answers, threshold])
  const recs = useMemo(() => recommendations(lessonRows, questions, answers), [lessonRows, questions, answers])
  const rows = by === 'lesson' ? lessonRows : sourceRows
  const hasSkipped = attempt.skipped > 0

  const items = questions
    .map((q, i) => ({ q, i, a: answers[i], o: outcome(q, answers[i]) }))
    .filter((x) => filter === 'all' || x.o !== 'correct')

  const mistakesCount = Object.keys(mistakes).length

  return (
    <Screen title={attempt.title} backTo="#/">
      <div className={`card mt-4 p-5 text-center ${attempt.passed ? 'bg-ok-soft' : 'bg-bad-soft'}`}>
        <div className={`text-[2.25rem] leading-none font-black tracking-wide ${attempt.passed ? 'text-ok' : 'text-bad'}`}>
          {attempt.passed ? 'СДАЛА' : 'НЕ СДАЛА'}
        </div>
        <div className="mt-2 text-[2.75rem] leading-none font-bold tabular-nums">{formatPercent(attempt.percent)}</div>
        <div className="mt-2 text-[0.9375rem] text-muted">
          {attempt.correct} из {attempt.total} верно · порог {threshold} %
          {attempt.timedOut ? ' · время вышло' : ''}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Верно" value={attempt.correct} tone="text-ok" />
        <Stat label="Ошибок" value={attempt.wrong} tone="text-bad" />
        <Stat label="Пропущено" value={attempt.skipped} tone="text-warn" />
        <Stat label="Время" value={formatDuration(attempt.durationMs)} />
      </div>
      <div className="mt-2 px-1 text-xs text-muted">{formatDate(attempt.finishedAt)}</div>

      <div className="section-title">Разбивка по темам</div>
      <Segmented
        value={by}
        options={[
          { value: 'lesson', label: 'По лекциям' },
          { value: 'source', label: 'По тестам' },
        ]}
        onChange={setBy}
      />
      <TopicTable rows={rows} />
      <p className="px-1 pt-1.5 text-xs text-muted">
        Красным — темы ниже порога {threshold} %.
        {by === 'lesson' && ' Вопрос, относящийся к двум лекциям, считается в обеих.'}
        {hasSkipped && ' Пропущенные вопросы считаются ошибкой.'}
      </p>

      <div className="section-title">Что повторить</div>
      {recs.length ? (
        <div className="card divide-y divide-line overflow-hidden">
          {recs.map((r) => (
            <div key={r.key} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 text-[0.9375rem] leading-snug">{r.text}</div>
              <a href={r.link} className="btn-soft min-h-9 shrink-0 px-3 text-sm">
                Тренировать
              </a>
            </div>
          ))}
        </div>
      ) : (
        <Empty>Ошибок нет — повторять нечего.</Empty>
      )}

      <div className="section-title">Вопросы</div>
      <Segmented
        value={filter}
        options={[
          { value: 'errors', label: `С ошибками (${attempt.wrong + attempt.skipped})` },
          { value: 'all', label: `Все (${attempt.total})` },
        ]}
        onChange={(v) => {
          setFilter(v)
          setLimit(50)
        }}
      />
      <div className="mt-3 flex flex-col gap-3">
        {items.length === 0 && <Empty>Ни одной ошибки.</Empty>}
        {items.slice(0, limit).map(({ q, i, a, o }) => (
          <ReviewCard key={q.id} q={q} index={i} answer={a} outcome={o} />
        ))}
        {items.length > limit && (
          <button className="btn-ghost w-full" onClick={() => setLimit((l) => l + 50)}>
            Показать ещё ({items.length - limit})
          </button>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {mistakesCount > 0 && (
          <a href={href('mistakes')} className="btn-primary w-full">
            Работа над ошибками ({mistakesCount})
          </a>
        )}
        <a href="#/" className="btn-ghost w-full">
          На главную
        </a>
      </div>
    </Screen>
  )
}

function Stat({ label, value, tone = '' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[0.8125rem] text-muted">{label}</div>
      <div className={`text-[1.375rem] font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  )
}

export function TopicTable({ rows }: { rows: TopicRow[] }) {
  return (
    <div className="card mt-3 overflow-hidden">
      <div className="grid grid-cols-[1fr_2.6rem_3.2rem_3.6rem] gap-x-2 border-b border-line px-3 py-2 text-xs font-semibold text-muted">
        <div>Тема</div>
        <div className="text-right">Было</div>
        <div className="text-right">Ошиб.</div>
        <div className="text-right">%</div>
      </div>
      {rows.map((r) => (
        <div
          key={r.key}
          className={`grid grid-cols-[1fr_2.6rem_3.2rem_3.6rem] items-center gap-x-2 border-b border-line px-3 py-2.5 last:border-b-0 ${
            r.below ? 'bg-bad-soft' : ''
          }`}
        >
          <div className="min-w-0 text-[0.9375rem] leading-snug">
            <span className="font-semibold">{r.code}</span> {r.label}
          </div>
          <div className="text-right tabular-nums">{r.total}</div>
          <div className={`text-right tabular-nums ${r.errors ? 'font-semibold text-bad' : ''}`}>{r.errors}</div>
          <div className={`text-right font-semibold tabular-nums ${r.below ? 'text-bad' : 'text-ok'}`}>
            {Math.round(r.percent)}%
          </div>
        </div>
      ))}
    </div>
  )
}

function ReviewCard({
  q,
  index,
  answer,
  outcome: o,
}: {
  q: Question
  index: number
  answer: number | null
  outcome: 'correct' | 'wrong' | 'skipped'
}) {
  const data = useData()
  const lessons = q.lessons.map((id) => data.lessons.find((l) => l.id === id)).filter(Boolean)
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-[0.8125rem] text-muted">
        <span className="font-semibold">№{index + 1}</span>
        {o === 'correct' && <Badge tone="ok">верно</Badge>}
        {o === 'wrong' && <Badge tone="bad">ошибка</Badge>}
        {o === 'skipped' && <Badge tone="warn">без ответа</Badge>}
      </div>
      <div className="mt-1.5 text-[1.0625rem] leading-snug font-medium" lang="it">
        {q.q}
      </div>

      <div className="mt-3 flex flex-col gap-2 text-[0.9375rem] leading-snug">
        {o !== 'correct' && (
          <div className="rounded-xl bg-bad-soft px-3 py-2">
            <div className="text-xs font-semibold text-bad">Мой ответ</div>
            <div lang="it">{answer === null ? '— нет ответа —' : q.options[answer]}</div>
          </div>
        )}
        <div className="rounded-xl bg-ok-soft px-3 py-2">
          <div className="text-xs font-semibold text-ok">Правильный ответ</div>
          <div lang="it">{q.options[q.correct]}</div>
        </div>
      </div>

      {q.explanation && (
        <div className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-[0.9375rem] leading-relaxed">
          <div className="text-xs font-semibold text-accent">Пояснение</div>
          <div className="whitespace-pre-line">{q.explanation}</div>
        </div>
      )}

      <div className="mt-3 text-[0.8125rem] leading-snug text-muted">
        Тест: {q.source} (№{q.num}) · {BANK_LABEL[q.bank]}
        <br />
        Лекция:{' '}
        {lessons.length ? lessons.map((l) => `${l!.id} ${lessonShort(l!.title)}`).join('; ') : 'вне пройденного'}
        <br />
        <span className="select-all">id {q.id}</span>
      </div>

      {o !== 'correct' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {q.lessons.length ? (
            q.lessons.map((l) => (
              <a key={l} href={href('setup', 'lesson', l)} className="btn-soft min-h-9 px-3 text-sm">
                Повторить тему {l}
              </a>
            ))
          ) : (
            <a href={href('setup', 'offtopic', q.source)} className="btn-soft min-h-9 px-3 text-sm">
              Повторить тему
            </a>
          )}
        </div>
      )}
    </div>
  )
}
