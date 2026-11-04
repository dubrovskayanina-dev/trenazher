import { beforeAll, describe, expect, it } from 'vitest'
import type { Question, Session } from '../src/types'
import { DEFAULT_CONFIG, applyChoice, createSession } from '../src/lib/quiz'
import { breakdownByLesson, breakdownBySource, isPassed, recommendations, score } from '../src/lib/scoring'
import { applyToMistakes } from '../src/lib/progress'
import { loadData, readRaw, seeded } from './helpers'

const data = loadData()
// Правильные ответы берём из исходного файла, а не из приложения — независимый эталон.
const truth = new Map(readRaw().questions.map((q) => [q.id, q]))

/** Позиция на экране, где стоит правильный (или заведомо неправильный) вариант. */
function displayOf(s: Session, i: number, want: 'correct' | 'wrong'): number {
  const q = truth.get(s.qids[i])!
  const order = s.orders[i]
  return want === 'correct' ? order.indexOf(q.correct) : order.findIndex((o) => o !== q.correct)
}

function tap(s: Session, i: number, displayIdx: number): Session {
  return applyChoice({ ...s, current: i }, displayIdx)
}

describe('Проверка 3: подсчёт результата на заведомо известных ответах', () => {
  // Экзамен 40 вопросов, варианты перемешаны, ответ «в конце».
  // План: 1–30 верно, 31–36 неверно, 37–40 пропущены → 30/40 = 75 % → НЕ СДАЛА при пороге 80 %.
  let s: Session
  let questions: Question[]

  beforeAll(() => {
    s = createSession(data, { ...DEFAULT_CONFIG.exam, count: 40, shuffleOptions: true, reveal: 'end' }, {}, seeded(7))
    questions = s.qids.map((id) => data.byId.get(id)!)
    for (let i = 0; i < 30; i++) s = tap(s, i, displayOf(s, i, 'correct'))
    for (let i = 30; i < 36; i++) s = tap(s, i, displayOf(s, i, 'wrong'))
  })

  it('в сессии 40 разных вопросов, у каждого перестановка своих 3/4/5 вариантов', () => {
    expect(new Set(s.qids).size).toBe(40)
    s.orders.forEach((o, i) => {
      expect([...o].sort()).toEqual(questions[i].options.map((_, k) => k))
    })
    // перемешивание реально было: хотя бы у части вопросов порядок не исходный
    expect(s.orders.some((o) => o.some((v, k) => v !== k))).toBe(true)
  })

  it('30 верно, 6 ошибок, 4 пропуска, 75 %, НЕ СДАЛА', () => {
    const r = score(questions, s.answers)
    expect(r).toEqual({ total: 40, correct: 30, wrong: 6, skipped: 4, percent: 75 })
    expect(isPassed(r.correct, r.total, 80)).toBe(false)
    expect(isPassed(r.correct, r.total, 75)).toBe(true)
  })

  it('порог считается без ошибок округления: 32/40 сдала, 31/40 нет', () => {
    expect(isPassed(32, 40, 80)).toBe(true)
    expect(isPassed(31, 40, 80)).toBe(false)
    expect(isPassed(8, 10, 80)).toBe(true)
    expect(isPassed(0, 0, 80)).toBe(false)
  })

  it('ответ меняется до «Завершить»: ошибка → исправила → засчитано верно', () => {
    let t = tap(s, 30, displayOf(s, 30, 'correct'))
    expect(score(questions, t.answers).correct).toBe(31)
    // повторное нажатие на тот же вариант снимает ответ → вопрос становится пропущенным
    t = tap(t, 30, displayOf(t, 30, 'correct'))
    expect(score(questions, t.answers)).toMatchObject({ correct: 30, wrong: 5, skipped: 5 })
  })

  it('режим «ответ сразу»: первый выбор фиксируется, поменять нельзя', () => {
    let t = createSession(data, { ...DEFAULT_CONFIG.lesson, target: 'Л6', count: 5, reveal: 'instant' }, {}, seeded(3))
    t = tap(t, 0, displayOf(t, 0, 'wrong'))
    t = tap(t, 0, displayOf(t, 0, 'correct'))
    const qs = t.qids.map((id) => data.byId.get(id)!)
    expect(score(qs, t.answers)).toMatchObject({ correct: 0, wrong: 1, skipped: 4 })
  })

  it('разбивка по лекциям совпадает с независимым пересчётом; вопрос двух лекций считается в обеих', () => {
    const rows = breakdownByLesson(data, questions, s.answers, 80)
    const expected = new Map<string, { total: number; correct: number }>()
    questions.forEach((q, i) => {
      const t = truth.get(q.id)!
      const keys = t.lessons.length ? t.lessons : ['__offtopic__']
      for (const k of keys) {
        const e = expected.get(k) ?? { total: 0, correct: 0 }
        e.total++
        if (s.answers[i] === t.correct) e.correct++
        expected.set(k, e)
      }
    })
    expect(rows.map((r) => r.key).sort()).toEqual([...expected.keys()].sort())
    for (const r of rows) {
      const e = expected.get(r.key)!
      expect(r.total).toBe(e.total)
      expect(r.correct).toBe(e.correct)
      expect(r.errors).toBe(e.total - e.correct)
      expect(r.below).toBe(e.correct * 100 < 80 * e.total)
    }
  })

  it('разбивка по тестам в сумме даёт все 40 вопросов', () => {
    const rows = breakdownBySource(questions, s.answers, 80)
    expect(rows.reduce((n, r) => n + r.total, 0)).toBe(40)
    expect(rows.reduce((n, r) => n + r.correct, 0)).toBe(30)
  })

  it('«Что повторить» отсортировано по числу ошибок и сформулировано по-человечески', () => {
    const rows = breakdownByLesson(data, questions, s.answers, 80)
    const recs = recommendations(rows, questions, s.answers)
    for (let i = 1; i < recs.length; i++) expect(recs[i - 1].errors).toBeGreaterThanOrEqual(recs[i].errors)
    expect(recs.length).toBe(rows.filter((r) => r.errors > 0).length)
  })
})

describe('Формулировка рекомендации', () => {
  it('«Л13 Credito, ipoteca, rappresentanza — 7 ошибок из 12, повтори конспект по этой лекции»', () => {
    const l13 = data.byLesson.get('Л13')!.filter((q) => q.lessons.length === 1).slice(0, 12)
    const answers = l13.map((q, i) => (i < 5 ? q.correct : (q.correct + 1) % q.options.length))
    const rows = breakdownByLesson(data, l13, answers, 80)
    const [rec] = recommendations(rows, l13, answers)
    expect(rec.text).toBe('Л13 Credito, ipoteca, rappresentanza — 7 ошибок из 12, повтори конспект по этой лекции')
  })

  it('склонения: 1 ошибка, 3 ошибки, 11 ошибок, 21 ошибка', () => {
    const l = data.byLesson.get('Л6')!.filter((q) => q.lessons.length === 1)
    for (const [n, word] of [
      [1, 'ошибка'],
      [3, 'ошибки'],
      [11, 'ошибок'],
      [21, 'ошибка'],
    ] as const) {
      const qs = l.slice(0, 30)
      const answers = qs.map((q, i) => (i < n ? null : q.correct))
      const [rec] = recommendations(breakdownByLesson(data, qs, answers, 80), qs, answers)
      expect(rec.text).toContain(`${n} ${word} из 30`)
    }
  })
})

describe('Работа над ошибками: уходит после двух правильных подряд', () => {
  const q = data.questions[0]
  const right = q.correct
  const wrong = (q.correct + 1) % q.options.length

  it('ошибка → в списке; верно → ещё в списке; верно второй раз → ушёл', () => {
    let m = applyToMistakes({}, [q], [wrong], 1)
    expect(m[q.id]).toMatchObject({ streak: 0, wrong: 1 })
    m = applyToMistakes(m, [q], [right], 2)
    expect(m[q.id]).toMatchObject({ streak: 1 })
    m = applyToMistakes(m, [q], [right], 3)
    expect(m[q.id]).toBeUndefined()
  })

  it('ошибка между правильными сбрасывает серию', () => {
    let m = applyToMistakes({}, [q], [wrong])
    m = applyToMistakes(m, [q], [right])
    m = applyToMistakes(m, [q], [wrong])
    expect(m[q.id]).toMatchObject({ streak: 0, wrong: 2 })
    m = applyToMistakes(m, [q], [right])
    expect(m[q.id]).toBeDefined()
  })

  it('пропуск не добавляет в список и не сбрасывает серию; верный ответ на новый вопрос ничего не добавляет', () => {
    let m = applyToMistakes({}, [q], [null])
    expect(m).toEqual({})
    m = applyToMistakes({}, [q], [right])
    expect(m).toEqual({})
    m = applyToMistakes(applyToMistakes({}, [q], [wrong]), [q], [right])
    m = applyToMistakes(m, [q], [null])
    expect(m[q.id]).toMatchObject({ streak: 1 })
  })
})
