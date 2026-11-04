import type { Dataset, Question } from '../types'
import { lessonShort } from '../data'
import { plural } from './format'

export interface Score {
  total: number
  correct: number
  wrong: number
  skipped: number
  /** Процент верных, округлён до 0,1 */
  percent: number
}

export type Outcome = 'correct' | 'wrong' | 'skipped'

export function outcome(q: Question, answer: number | null | undefined): Outcome {
  if (answer === null || answer === undefined) return 'skipped'
  return answer === q.correct ? 'correct' : 'wrong'
}

/** answers[i] — индекс выбранного варианта в q.options (не позиция на экране). */
export function score(questions: Question[], answers: (number | null)[]): Score {
  let correct = 0
  let wrong = 0
  let skipped = 0
  questions.forEach((q, i) => {
    const o = outcome(q, answers[i])
    if (o === 'correct') correct++
    else if (o === 'wrong') wrong++
    else skipped++
  })
  const total = questions.length
  return { total, correct, wrong, skipped, percent: pct(correct, total) }
}

export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0
}

/** Сдала, если доля верных ≥ порога. Считаем без округления: 32 из 40 при пороге 80 % — сдала. */
export function isPassed(correct: number, total: number, threshold: number): boolean {
  return total > 0 && correct * 100 >= threshold * total
}

export interface TopicRow {
  key: string
  /** Л13 или «Вне пройденного» / название теста */
  code: string
  label: string
  total: number
  correct: number
  wrong: number
  skipped: number
  /** Ошибки по теме = неверные + пропущенные */
  errors: number
  percent: number
  below: boolean
}

export const OFFTOPIC_KEY = '__offtopic__'

function emptyRow(key: string, code: string, label: string): TopicRow {
  return { key, code, label, total: 0, correct: 0, wrong: 0, skipped: 0, errors: 0, percent: 0, below: false }
}

function finalize(rows: TopicRow[], threshold: number): TopicRow[] {
  for (const r of rows) {
    r.errors = r.wrong + r.skipped
    r.percent = pct(r.correct, r.total)
    r.below = !isPassed(r.correct, r.total, threshold)
  }
  return rows
}

/**
 * Разбивка по лекциям. Вопрос, относящийся к двум лекциям, учитывается в обеих.
 * Вопросы без лекций собираются в одну строку «Вне пройденного».
 */
export function breakdownByLesson(
  data: Dataset,
  questions: Question[],
  answers: (number | null)[],
  threshold: number,
): TopicRow[] {
  const rows = new Map<string, TopicRow>()
  for (const l of data.lessons) rows.set(l.id, emptyRow(l.id, l.id, lessonShort(l.title)))
  const off = emptyRow(OFFTOPIC_KEY, 'Вне пройденного', 'темы, которые ещё не проходили')

  questions.forEach((q, i) => {
    const o = outcome(q, answers[i])
    const targets = q.lessons.length ? q.lessons.map((l) => rows.get(l)!).filter(Boolean) : [off]
    for (const r of targets) {
      r.total++
      r[o]++
    }
  })

  const list = [...rows.values()].filter((r) => r.total > 0)
  if (off.total > 0) list.push(off)
  return finalize(list, threshold)
}

/** Разбивка по исходным тестам (source). */
export function breakdownBySource(
  questions: Question[],
  answers: (number | null)[],
  threshold: number,
): TopicRow[] {
  const rows = new Map<string, TopicRow>()
  questions.forEach((q, i) => {
    if (!rows.has(q.source)) rows.set(q.source, emptyRow(q.source, q.bank, q.source))
    const r = rows.get(q.source)!
    r.total++
    r[outcome(q, answers[i])]++
  })
  return finalize([...rows.values()], threshold).sort((a, b) => a.label.localeCompare(b.label))
}

export interface Recommendation {
  key: string
  text: string
  /** куда вести кнопку «Тренировать» */
  link: string
  errors: number
}

/** «Что повторить»: темы с ошибками, по убыванию числа ошибок. */
export function recommendations(
  rows: TopicRow[],
  questions: Question[],
  answers: (number | null)[],
): Recommendation[] {
  const withErrors = rows
    .filter((r) => r.errors > 0)
    .sort((a, b) => b.errors - a.errors || a.percent - b.percent)

  return withErrors.map((r) => {
    const errWord = `${r.errors} ${plural(r.errors, ['ошибка', 'ошибки', 'ошибок'])} из ${r.total}`
    if (r.key === OFFTOPIC_KEY) {
      const bySource = new Map<string, number>()
      questions.forEach((q, i) => {
        if (q.lessons.length === 0 && outcome(q, answers[i]) !== 'correct') {
          bySource.set(q.source, (bySource.get(q.source) ?? 0) + 1)
        }
      })
      const parts = [...bySource.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([s, n]) => `${s} — ${n}`)
        .join('; ')
      return {
        key: r.key,
        errors: r.errors,
        link: '#/offtopic',
        text: `Темы вне пройденного — ${errWord}. Эти темы ещё не проходили на лекциях${parts ? `: ${parts}` : ''}.`,
      }
    }
    return {
      key: r.key,
      errors: r.errors,
      link: `#/setup/lesson/${encodeURIComponent(r.key)}`,
      text: `${r.code} ${r.label} — ${errWord}, повтори конспект по этой лекции`,
    }
  })
}
