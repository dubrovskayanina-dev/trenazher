import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Question, Session } from '../types'
import { useData } from '../data'
import { finishSession, getState, readElapsed, saveSession, useAppState, writeElapsed } from '../lib/store'
import { go, href } from '../lib/router'
import { applyChoice, letter } from '../lib/quiz'
import { formatClock, plural } from '../lib/format'
import { ProgressBar } from '../components/ui'

export default function Quiz() {
  const { session } = useAppState()
  useEffect(() => {
    if (!session) go('#/', true)
  }, [session])
  if (!session) return null
  return <QuizRunner key={session.id} session={session} />
}

function QuizRunner({ session }: { session: Session }) {
  const data = useData()
  const questions = useMemo(
    () => session.qids.map((id) => data.byId.get(id)).filter((q): q is Question => Boolean(q)),
    [data, session.qids],
  )
  const total = questions.length
  const cur = Math.min(session.current, total - 1)
  const q = questions[cur]
  const order = session.orders[cur]
  const answer = session.answers[cur]
  const locked = session.locked[cur]
  const instant = session.config.reveal === 'instant'
  const answeredCount = session.answers.filter((a) => a !== null).length
  const limitMs = session.config.timeLimitMin * 60_000

  const [elapsed, setElapsed] = useState(() => readElapsed(session.id))
  const [sheet, setSheet] = useState<'none' | 'nav' | 'finish'>('none')
  const finishedRef = useRef(false)
  const sessionRef = useRef(session)
  sessionRef.current = session
  const elapsedRef = useRef(elapsed)
  elapsedRef.current = elapsed

  const finish = useCallback(
    (timedOut: boolean) => {
      if (finishedRef.current) return
      finishedRef.current = true
      const attempt = finishSession(data, latest(), elapsedRef.current, timedOut)
      go(href('result', attempt.id), true)
    },
    [data],
  )

  // Таймер идёт, только пока тест открыт на экране. Время сохраняется каждую секунду,
  // поэтому при закрытии вкладки и возврате таймер продолжит с того же места.
  useEffect(() => {
    let last = Date.now()
    const tick = () => {
      const now = Date.now()
      if (document.visibilityState === 'visible') {
        const delta = Math.min(now - last, 5_000)
        setElapsed((e) => {
          const next = e + delta
          writeElapsed(session.id, next)
          return next
        })
      }
      last = now
    }
    const id = window.setInterval(tick, 1000)
    const onVis = () => {
      last = Date.now()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [session.id])

  useEffect(() => {
    if (limitMs > 0 && elapsed >= limitMs) finish(true)
  }, [elapsed, limitMs, finish])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [cur])

  // Берём сессию прямо из хранилища — так быстрые повторные нажатия не теряются.
  const latest = () => getState().session ?? sessionRef.current

  function update(patch: Partial<Session>) {
    saveSession({ ...latest(), ...patch })
  }

  function choose(displayIdx: number) {
    saveSession(applyChoice(latest(), displayIdx))
  }

  function goTo(i: number) {
    if (i < 0) return
    if (i >= total) {
      setSheet('finish')
      return
    }
    update({ current: i })
  }

  const unanswered = useMemo(
    () => session.answers.map((a, i) => (a === null ? i : -1)).filter((i) => i >= 0),
    [session.answers],
  )

  if (!q) return null

  const remaining = limitMs > 0 ? limitMs - elapsed : 0
  const lowTime = limitMs > 0 && remaining < 60_000
  const isExam = session.config.mode === 'exam'

  return (
    <div className="min-h-dvh">
      <header className="pt-safe sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-xl items-center gap-2 px-2">
          <button className="flex h-11 w-11 items-center justify-center text-2xl text-muted" onClick={() => go('#/')} aria-label="Выйти, тест сохранится">
            ✕
          </button>
          <button className="min-w-0 flex-1 text-center" onClick={() => setSheet('nav')}>
            <div className="truncate text-[1.0625rem] font-semibold tabular-nums" aria-label={`Вопрос ${cur + 1} из ${total}`}>
              {cur + 1} <span className="font-normal text-muted">из {total}</span>
            </div>
          </button>
          <div className={`min-w-16 text-right font-mono text-[1.0625rem] tabular-nums ${lowTime ? 'font-bold text-bad' : 'text-muted'}`}>
            {limitMs > 0 ? formatClock(remaining) : formatClock(elapsed)}
          </div>
          <button className="ml-1 rounded-lg px-2 py-2 text-[0.9375rem] font-semibold text-accent" onClick={() => setSheet('finish')}>
            Завершить
          </button>
        </div>
        <div className="mx-auto max-w-xl px-4 pb-2">
          <ProgressBar value={answeredCount} max={total} />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pt-4 pb-40">
        {!isExam && (
          <div className="mb-2 text-[0.8125rem] text-muted">
            {q.source} · №{q.num}
            {q.lessons.length ? ` · ${q.lessons.join(', ')}` : ' · вне пройденного'}
          </div>
        )}
        <h2 className="text-[1.3125rem] leading-snug font-semibold" lang="it">
          {q.q}
        </h2>

        <div className="mt-5 flex flex-col gap-3">
          {order.map((orig, displayIdx) => {
            const selected = answer === orig
            const revealed = instant && locked
            const isCorrect = orig === q.correct
            let cls = 'bg-card ring-1 ring-line'
            let mark = ''
            if (revealed) {
              if (isCorrect) {
                cls = 'bg-ok-soft ring-2 ring-ok'
                mark = '✓'
              } else if (selected) {
                cls = 'bg-bad-soft ring-2 ring-bad'
                mark = '✗'
              } else cls = 'bg-card ring-1 ring-line opacity-60'
            } else if (selected) {
              cls = 'bg-accent-soft ring-2 ring-accent'
            }
            return (
              <button
                key={orig}
                onClick={() => choose(displayIdx)}
                className={`flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left transition active:scale-[0.99] ${cls}`}
                aria-pressed={selected}
                data-option={displayIdx}
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.9375rem] font-bold ${
                    selected && !revealed
                      ? 'bg-accent text-white dark:text-black'
                      : revealed && isCorrect
                        ? 'bg-ok text-white dark:text-black'
                        : revealed && selected
                          ? 'bg-bad text-white dark:text-black'
                          : 'bg-line text-muted'
                  }`}
                >
                  {mark || letter(displayIdx)}
                </span>
                <span className="min-w-0 flex-1 text-[1.0625rem] leading-snug" lang="it">
                  {q.options[orig]}
                </span>
              </button>
            )
          })}
        </div>

        {instant && locked && (
          <div className={`card mt-4 p-4 ${answer === q.correct ? 'bg-ok-soft' : 'bg-bad-soft'}`}>
            <div className={`font-semibold ${answer === q.correct ? 'text-ok' : 'text-bad'}`}>
              {answer === q.correct ? 'Верно' : `Неверно. Правильный ответ: ${letter(order.indexOf(q.correct))}`}
            </div>
            {q.explanation && (
              <p className="mt-2 text-[0.9375rem] leading-relaxed whitespace-pre-line">{q.explanation}</p>
            )}
            {isExam && (
              <div className="mt-2 text-[0.8125rem] text-muted">
                {q.source} · №{q.num}
                {q.lessons.length ? ` · ${q.lessons.join(', ')}` : ' · вне пройденного'}
              </div>
            )}
          </div>
        )}
      </main>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2 px-4 pt-3">
          <button className="btn-ghost w-24 shrink-0" disabled={cur === 0} onClick={() => goTo(cur - 1)}>
            ‹ Назад
          </button>
          {cur < total - 1 ? (
            <button
              className={answer === null && !locked ? 'btn-soft flex-1' : 'btn-primary flex-1'}
              onClick={() => goTo(cur + 1)}
              data-next
            >
              {answer === null ? 'Пропустить ›' : 'Далее ›'}
            </button>
          ) : (
            <button className="btn-primary flex-1" onClick={() => setSheet('finish')} data-next>
              Завершить
            </button>
          )}
        </div>
      </div>

      {sheet === 'nav' && (
        <Sheet onClose={() => setSheet('none')} title={`Отвечено ${answeredCount} из ${total}`}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2">
            {questions.map((qq, i) => {
              const a = session.answers[i]
              let cls = 'bg-card ring-1 ring-line'
              if (a !== null) {
                if (instant && session.locked[i]) cls = a === qq.correct ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad'
                else cls = 'bg-accent-soft text-accent'
              }
              return (
                <button
                  key={qq.id}
                  className={`h-11 rounded-lg text-[0.9375rem] font-semibold ${cls} ${i === cur ? 'outline-2 outline-offset-1 outline-ink' : ''}`}
                  onClick={() => {
                    goTo(i)
                    setSheet('none')
                  }}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
        </Sheet>
      )}

      {sheet === 'finish' && (
        <Sheet onClose={() => setSheet('none')} title="Завершить тест?">
          {unanswered.length > 0 ? (
            <>
              <p className="text-[1rem]">
                Без ответа {unanswered.length} {plural(unanswered.length, ['вопрос', 'вопроса', 'вопросов'])} — они будут
                засчитаны как неверные. Нажми номер, чтобы вернуться к вопросу:
              </p>
              <div className="mt-3 grid max-h-[40dvh] grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2 overflow-y-auto">
                {unanswered.map((i) => (
                  <button
                    key={i}
                    className="h-11 rounded-lg bg-warn-soft text-[0.9375rem] font-semibold text-warn"
                    onClick={() => {
                      goTo(i)
                      setSheet('none')
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[1rem]">Ответ дан на все {total} {plural(total, ['вопрос', 'вопроса', 'вопросов'])}.</p>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <button className="btn-primary w-full" onClick={() => finish(false)} data-finish>
              Завершить и посмотреть результат
            </button>
            <button className="btn-ghost w-full" onClick={() => setSheet('none')}>
              Вернуться к тесту
            </button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="pb-safe max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-bg px-4 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[1.1875rem] font-bold">{title}</h3>
          <button className="h-10 px-2 text-accent" onClick={onClose}>
            Закрыть
          </button>
        </div>
        {children}
        <div className="h-3" />
      </div>
    </div>
  )
}
