import { useMemo, useState } from 'react'
import type { Question } from '../types'
import { lessonShort, useData } from '../data'
import { setState, useAppState } from '../lib/store'
import { href } from '../lib/router'
import { STREAK_TO_CLEAR } from '../lib/progress'
import { nQuestions, plural } from '../lib/format'
import { Empty, Screen } from '../components/ui'

export default function Mistakes() {
  const data = useData()
  const { mistakes } = useAppState()
  const [limit, setLimit] = useState(30)

  const list = useMemo(
    () =>
      Object.entries(mistakes)
        .map(([id, m]) => ({ q: data.byId.get(id), m }))
        .filter((x): x is { q: Question; m: (typeof mistakes)[string] } => Boolean(x.q))
        .sort((a, b) => b.m.wrong - a.m.wrong || b.m.lastAt - a.m.lastAt),
    [data, mistakes],
  )

  const byLesson = useMemo(() => {
    const counts = new Map<string, number>()
    for (const { q } of list) {
      const keys = q.lessons.length ? q.lessons : ['—']
      for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [list])

  return (
    <Screen title="Работа над ошибками" backTo="#/">
      <div className="card mt-4 p-5 text-center">
        <div className={`text-[3rem] leading-none font-bold ${list.length ? 'text-bad' : 'text-ok'}`}>{list.length}</div>
        <div className="mt-1 text-muted">
          {list.length ? `${plural(list.length, ['вопрос', 'вопроса', 'вопросов'])} с ошибками` : 'ошибок нет'}
        </div>
        <p className="mt-3 text-[0.9375rem] leading-snug text-muted">
          Сюда попадает каждый вопрос, в котором ошиблась. Вопрос уходит из списка после {STREAK_TO_CLEAR} правильных
          ответов подряд — в любом режиме.
        </p>
        {list.length > 0 && (
          <a href={href('setup', 'mistakes')} className="btn-primary mt-4 w-full">
            Решать ошибки
          </a>
        )}
      </div>

      {byLesson.length > 0 && (
        <>
          <div className="section-title">По лекциям</div>
          <div className="flex flex-wrap gap-2">
            {byLesson.map(([k, n]) => {
              const l = data.lessons.find((x) => x.id === k)
              return (
                <span key={k} className="chip">
                  {l ? `${l.id} ${lessonShort(l.title)}` : 'Вне пройденного'} · {n}
                </span>
              )
            })}
          </div>
        </>
      )}

      <div className="section-title">Вопросы</div>
      {list.length === 0 ? (
        <Empty>Пока пусто. Ошибки из любых тестов будут собираться здесь.</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {list.slice(0, limit).map(({ q, m }) => (
            <div key={q.id} className="card p-4">
              <div className="text-[0.9375rem] leading-snug" lang="it">
                {q.q}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted">
                <span>
                  ошибок: <b className="text-bad">{m.wrong}</b>
                </span>
                <span>
                  верно подряд: <b className={m.streak ? 'text-ok' : ''}>{m.streak}</b> из {STREAK_TO_CLEAR}
                </span>
                <span>
                  {q.source} №{q.num}
                </span>
              </div>
            </div>
          ))}
          {list.length > limit && (
            <button className="btn-ghost w-full" onClick={() => setLimit((l) => l + 30)}>
              Показать ещё ({list.length - limit})
            </button>
          )}
          <button
            className="btn mt-4 w-full text-bad"
            onClick={() => {
              if (confirm(`Очистить список ошибок (${nQuestions(list.length)})?`)) setState({ mistakes: {} })
            }}
          >
            Очистить список
          </button>
        </div>
      )}
    </Screen>
  )
}
