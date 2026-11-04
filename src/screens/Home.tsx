import { useMemo } from 'react'
import { lessonRu, lessonShort, useData } from '../data'
import { discardSession, useAppState } from '../lib/store'
import { href } from '../lib/router'
import { DEFAULT_CONFIG } from '../lib/quiz'
import { bestPercent, masteredCount } from '../lib/selectors'
import { formatPercent, nQuestions, plural } from '../lib/format'
import { Chevron, ProgressBar, Screen } from '../components/ui'

export default function Home() {
  const data = useData()
  const { history, mistakes, qstats, session, settings } = useAppState()
  const mistakesCount = Object.keys(mistakes).length
  const exam = { ...DEFAULT_CONFIG.exam, ...settings.setups.exam }

  const lessonRows = useMemo(
    () =>
      data.lessons.map((l) => {
        const qs = data.byLesson.get(l.id) ?? []
        return {
          lesson: l,
          total: qs.length,
          mastered: masteredCount(qs, qstats),
          best: bestPercent(history, 'lesson', l.id),
        }
      }),
    [data, history, qstats],
  )

  return (
    <Screen>
      <div className="pt-safe">
        <div className="flex items-center justify-between pt-4 pb-2">
          <div>
            <div className="text-[0.8125rem] font-medium text-muted">Agente d’affari in mediazione</div>
            <div className="text-[1.75rem] leading-tight font-bold">Тренажёр</div>
          </div>
          <div className="flex gap-1">
            <a href={href('stats')} className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-accent" aria-label="Статистика">
              📊
            </a>
            <a href={href('settings')} className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-accent" aria-label="Настройки">
              ⚙️
            </a>
          </div>
        </div>
      </div>

      {session && (
        <div className="card mt-2 border border-warn/40 bg-warn-soft p-4">
          <div className="font-semibold">Есть незаконченный тест</div>
          <div className="mt-0.5 text-[0.9375rem] text-muted">
            {session.title} · отвечено {session.answers.filter((a) => a !== null).length} из {session.qids.length}
          </div>
          <div className="mt-3 flex gap-2">
            <a href={href('quiz')} className="btn-primary flex-1">
              Продолжить
            </a>
            <button
              className="btn-ghost"
              onClick={() => {
                if (confirm('Удалить незаконченный тест? Ответы в нём не сохранятся.')) discardSession()
              }}
            >
              Удалить
            </button>
          </div>
        </div>
      )}

      <a href={href('setup', 'exam')} className="mt-3 block rounded-2xl bg-accent p-5 text-white active:opacity-90 dark:text-black">
        <div className="text-[1.625rem] font-bold">Экзамен</div>
        <div className="mt-1 text-[0.9375rem] opacity-90">
          {nQuestions(exam.count || 0)} вперемешку · {exam.timeLimitMin ? `${exam.timeLimitMin} мин` : 'без лимита времени'} · порог{' '}
          {settings.threshold} %
        </div>
      </a>

      <a href={href('mistakes')} className="card mt-3 flex items-center gap-3 p-4 active:opacity-80">
        <div
          className={`flex h-12 min-w-12 items-center justify-center rounded-xl px-2 text-lg font-bold ${
            mistakesCount ? 'bg-bad-soft text-bad' : 'bg-ok-soft text-ok'
          }`}
        >
          {mistakesCount}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[1.0625rem] font-semibold">Работа над ошибками</div>
          <div className="text-sm text-muted">
            {mistakesCount ? 'вопросы, в которых ошиблась' : 'ошибок пока нет'}
          </div>
        </div>
        <Chevron />
      </a>

      <div className="section-title">Лекции</div>
      <div className="card divide-y divide-line overflow-hidden">
        {lessonRows.map(({ lesson, total, mastered, best }) => (
          <a key={lesson.id} href={href('setup', 'lesson', lesson.id)} className="flex items-center gap-3 px-4 py-3 active:bg-line/50">
            <div className="w-10 shrink-0 text-[0.9375rem] font-bold text-accent">{lesson.id}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[1rem] leading-snug font-medium">{lessonShort(lesson.title)}</div>
              <div className="text-[0.8125rem] leading-snug text-muted">{lessonRu(lesson.title)}</div>
              <div className="mt-1.5 flex items-center gap-2 text-[0.8125rem] text-muted">
                <span>{nQuestions(total)}</span>
                <span>·</span>
                <span className={best === null ? '' : best >= settings.threshold ? 'font-semibold text-ok' : 'font-semibold text-bad'}>
                  лучший {best === null ? '—' : formatPercent(best)}
                </span>
              </div>
              <ProgressBar value={mastered} max={total} className="mt-1.5" />
              <div className="mt-1 text-xs text-muted">
                освоено {mastered} из {total}
              </div>
            </div>
            <Chevron />
          </a>
        ))}
      </div>

      <div className="section-title">Другие тесты</div>
      <div className="card divide-y divide-line overflow-hidden">
        <a href={href('offtopic')} className="flex items-center gap-3 px-4 py-3.5 active:bg-line/50">
          <div className="min-w-0 flex-1">
            <div className="text-[1.0625rem] font-medium">Темы вне пройденного</div>
            <div className="text-sm text-muted">
              {nQuestions(data.offTopic.length)}: urbanistico, società e fallimento, condominio, titoli di credito, famiglia…
            </div>
          </div>
          <Chevron />
        </a>
        <a href={href('sources')} className="flex items-center gap-3 px-4 py-3.5 active:bg-line/50">
          <div className="min-w-0 flex-1">
            <div className="text-[1.0625rem] font-medium">Выбрать конкретный тест</div>
            <div className="text-sm text-muted">{data.bySource.size} {plural(data.bySource.size, ['тест', 'теста', 'тестов'])} из банков IMMOBILIARE, MERCEOLOGICO, ROMA</div>
          </div>
          <Chevron />
        </a>
        <a href={href('stats')} className="flex items-center gap-3 px-4 py-3.5 active:bg-line/50">
          <div className="min-w-0 flex-1">
            <div className="text-[1.0625rem] font-medium">Статистика</div>
            <div className="text-sm text-muted">
              {history.length
                ? `${history.length} ${plural(history.length, ['попытка', 'попытки', 'попыток'])}, история и динамика`
                : 'появится после первого теста'}
            </div>
          </div>
          <Chevron />
        </a>
      </div>

      <p className="mt-6 px-1 text-center text-xs text-muted">
        {nQuestions(data.questions.length)} · работает без интернета · прогресс хранится только на этом устройстве
      </p>
    </Screen>
  )
}
