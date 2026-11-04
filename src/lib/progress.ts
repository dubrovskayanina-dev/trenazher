import type { MistakeEntry, QStat, Question } from '../types'
import { outcome } from './scoring'

/** Сколько правильных ответов подряд нужно, чтобы вопрос ушёл из «Работы над ошибками». */
export const STREAK_TO_CLEAR = 2

/**
 * Обновляет список ошибок по итогам попытки (чистая функция).
 * - неверный ответ → вопрос в списке, серия сбрасывается;
 * - верный ответ на вопрос из списка → серия +1, на второй подряд вопрос уходит;
 * - пропуск ничего не меняет.
 */
export function applyToMistakes(
  mistakes: Record<string, MistakeEntry>,
  questions: Question[],
  answers: (number | null)[],
  now: number = Date.now(),
): Record<string, MistakeEntry> {
  const next = { ...mistakes }
  questions.forEach((q, i) => {
    const o = outcome(q, answers[i])
    if (o === 'wrong') {
      const prev = next[q.id]
      next[q.id] = { streak: 0, wrong: (prev?.wrong ?? 0) + 1, lastAt: now }
    } else if (o === 'correct' && next[q.id]) {
      const streak = next[q.id].streak + 1
      if (streak >= STREAK_TO_CLEAR) delete next[q.id]
      else next[q.id] = { ...next[q.id], streak }
    }
  })
  return next
}

/** Статистика по каждому вопросу: сколько раз отвечала, сколько верно, последний ответ. */
export function applyToQStats(
  qstats: Record<string, QStat>,
  questions: Question[],
  answers: (number | null)[],
): Record<string, QStat> {
  const next = { ...qstats }
  questions.forEach((q, i) => {
    const o = outcome(q, answers[i])
    if (o === 'skipped') return
    const [seen, correct] = next[q.id] ?? [0, 0, 0]
    const ok = o === 'correct'
    next[q.id] = [seen + 1, correct + (ok ? 1 : 0), ok ? 1 : 0]
  })
  return next
}
