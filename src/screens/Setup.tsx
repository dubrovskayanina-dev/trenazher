import { useMemo, useState } from 'react'
import type { Bank, Mode, QuizConfig } from '../types'
import { BANK_LABEL, lessonRu, useData } from '../data'
import { DEFAULT_CONFIG, createSession, poolFor, titleFor } from '../lib/quiz'
import { startSession, updateSettings, useAppState } from '../lib/store'
import { go } from '../lib/router'
import { nQuestions } from '../lib/format'
import { Chips, Empty, Screen, Segmented, Toggle } from '../components/ui'

const COUNTS = [10, 20, 30, 40, 50, 100]
const TIMES = [0, 10, 20, 30, 45, 60, 90, 120]

const BACK: Record<Mode, string> = {
  exam: '#/',
  lesson: '#/',
  offtopic: '#/offtopic',
  source: '#/sources',
  mistakes: '#/mistakes',
}

export default function Setup({ mode, target }: { mode: Mode; target?: string }) {
  const data = useData()
  const { settings, mistakes, session } = useAppState()

  const [cfg, setCfg] = useState<QuizConfig>(() => {
    const saved = settings.setups[mode] ?? {}
    return { ...DEFAULT_CONFIG[mode], ...saved, mode, target }
  })
  const set = (patch: Partial<QuizConfig>) => setCfg((c) => ({ ...c, ...patch }))

  const pool = useMemo(() => poolFor(data, cfg, mistakes), [data, cfg, mistakes])
  const title = titleFor(data, cfg)
  const effective = cfg.count > 0 ? Math.min(cfg.count, pool.length) : pool.length
  const countValue = cfg.count > 0 && cfg.count < pool.length ? cfg.count : 0

  const countOptions = [
    ...COUNTS.filter((n) => n < pool.length).map((n) => ({ value: n, label: String(n) })),
    { value: 0, label: `Все (${pool.length})` },
  ]

  function start() {
    if (!pool.length) return
    if (session && !confirm('Начать новый тест? Незаконченный тест будет удалён.')) return
    const { mode: _m, target: _t, ...persist } = cfg
    updateSettings({ setups: { ...settings.setups, [mode]: persist } })
    const s = createSession(data, { ...cfg, count: countValue }, mistakes)
    startSession(s)
    go('#/quiz')
  }

  const lesson = mode === 'lesson' ? data.lessons.find((l) => l.id === target) : undefined

  return (
    <Screen title="Настройка теста" backTo={BACK[mode]}>
      <div className="card mt-4 p-4">
        <div className="text-[1.375rem] leading-tight font-bold">{title}</div>
        {lesson && <div className="mt-1 text-[0.9375rem] text-muted">{lessonRu(lesson.title)}</div>}
        {mode === 'source' && target && (
          <div className="mt-1 text-[0.9375rem] text-muted">Банк {BANK_LABEL[data.sourceBank.get(target)!]}</div>
        )}
        {mode === 'exam' && (
          <div className="mt-1 text-[0.9375rem] text-muted">
            Смешанный вариант из всех {cfg.includeOffTopic ? 'тем' : 'пройденных лекций'} на время
          </div>
        )}
        {mode === 'mistakes' && (
          <div className="mt-1 text-[0.9375rem] text-muted">
            Вопрос уходит из списка после двух правильных ответов подряд
          </div>
        )}
        <div className="mt-2 text-[0.9375rem]">В пуле {nQuestions(pool.length)}</div>
      </div>

      {pool.length === 0 ? (
        <div className="mt-4">
          <Empty>{mode === 'mistakes' ? 'Ошибок пока нет — список пуст.' : 'Нет вопросов для этого набора.'}</Empty>
        </div>
      ) : (
        <>
          <div className="section-title">Сколько вопросов</div>
          <Chips value={countValue} options={countOptions} onChange={(v) => set({ count: v })} />

          <div className="section-title">Правильный ответ показывать</div>
          <Segmented
            value={cfg.reveal}
            options={[
              { value: 'instant', label: 'Сразу' },
              { value: 'end', label: 'Только в конце' },
            ]}
            onChange={(v) => set({ reveal: v })}
          />
          <p className="px-1 pt-1.5 text-[0.8125rem] text-muted">
            {cfg.reveal === 'instant'
              ? 'После выбора сразу видно, верно ли. Ответ фиксируется.'
              : 'Как на экзамене: ответ можно менять, пока не нажата «Завершить».'}
          </p>

          <div className="section-title">Ограничение по времени</div>
          <Chips
            value={cfg.timeLimitMin}
            options={TIMES.map((t) => ({ value: t, label: t ? `${t} мин` : 'Нет' }))}
            onChange={(v) => set({ timeLimitMin: v })}
          />

          <div className="section-title">Порядок</div>
          <div className="card divide-y divide-line overflow-hidden">
            <Toggle
              label="Перемешать вопросы"
              hint={cfg.shuffleQuestions ? 'случайная выборка' : 'по порядку, как в исходном тесте'}
              checked={cfg.shuffleQuestions}
              onChange={(v) => set({ shuffleQuestions: v })}
            />
            <Toggle
              label="Перемешивать варианты ответов"
              hint="чтобы не запоминать ответ по букве"
              checked={cfg.shuffleOptions}
              onChange={(v) => set({ shuffleOptions: v })}
            />
          </div>
        </>
      )}

      {mode === 'exam' && (
        <>
          <div className="section-title">Состав экзамена</div>
          <div className="card divide-y divide-line overflow-hidden">
            <Toggle
              label="Добавить темы вне пройденного"
              hint={`+${nQuestions(data.offTopic.filter((q) => cfg.banks.includes(q.bank)).length)} без лекций`}
              checked={cfg.includeOffTopic}
              onChange={(v) => set({ includeOffTopic: v })}
            />
            {data.banks.map((b: Bank) => (
              <Toggle
                key={b}
                label={`Банк ${BANK_LABEL[b]}`}
                checked={cfg.banks.includes(b)}
                onChange={(v) => {
                  const banks = v ? [...cfg.banks, b] : cfg.banks.filter((x) => x !== b)
                  if (banks.length) set({ banks })
                }}
              />
            ))}
          </div>
        </>
      )}

      <div className="h-24" />
      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 pt-3">
          <button className="btn-primary w-full" disabled={!pool.length} onClick={start}>
            Начать · {nQuestions(effective)}
            {cfg.timeLimitMin ? ` · ${cfg.timeLimitMin} мин` : ''}
          </button>
        </div>
      </div>
    </Screen>
  )
}
