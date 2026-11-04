import type { Attempt, Mode, QStat, Question } from '../types'

/** Лучший результат среди попыток данного режима и цели. */
export function bestPercent(history: Attempt[], mode: Mode, target?: string): number | null {
  let best: number | null = null
  for (const a of history) {
    if (a.config.mode === mode && (target === undefined || a.config.target === target)) {
      if (best === null || a.percent > best) best = a.percent
    }
  }
  return best
}

/** «Освоено» — последний ответ на вопрос был верным. */
export function masteredCount(questions: Question[], qstats: Record<string, QStat>): number {
  let n = 0
  for (const q of questions) if (qstats[q.id]?.[2] === 1) n++
  return n
}

/** Точность по набору вопросов за всё время: сколько раз отвечала и сколько верно. */
export function accuracy(questions: Question[], qstats: Record<string, QStat>) {
  let seen = 0
  let correct = 0
  let touched = 0
  for (const q of questions) {
    const s = qstats[q.id]
    if (!s) continue
    touched++
    seen += s[0]
    correct += s[1]
  }
  return { seen, correct, touched }
}
