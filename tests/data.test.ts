import { describe, expect, it } from 'vitest'
import { buildDataset } from '../src/data'
import { poolFor, DEFAULT_CONFIG } from '../src/lib/quiz'
import { loadData, readRaw } from './helpers'

describe('Проверка 1: все вопросы загружаются, ни один не теряется', () => {
  const raw = readRaw()
  const data = loadData()

  it('в базе ровно 3651 вопрос, как в meta.total', () => {
    expect(raw.meta.total).toBe(3651)
    expect(data.questions).toHaveLength(3651)
    expect(data.byId.size).toBe(3651)
  })

  it('id уникальны и каждый вопрос исходного файла есть в приложении', () => {
    for (const q of raw.questions) expect(data.byId.get(q.id)).toBeDefined()
  })

  it('тексты вопросов и вариантов совпадают с файлом символ в символ', () => {
    raw.questions.forEach((q, i) => {
      const a = data.questions[i]
      expect(a.q).toBe(q.q)
      expect(a.options).toEqual(q.options)
      expect(a.correct).toBe(q.correct)
      expect(a.lessons).toEqual(q.lessons)
    })
  })

  it('каждый вопрос попадает в свой тест; сумма по тестам = 3651; тестов 55', () => {
    const sum = [...data.bySource.values()].reduce((s, l) => s + l.length, 0)
    expect(sum).toBe(3651)
    expect(data.bySource.size).toBe(55)
    expect(new Set(data.sources)).toEqual(new Set(data.bySource.keys()))
  })

  it('822 вопроса без лекций — в группе «Вне пройденного», остальные — хотя бы в одной лекции', () => {
    expect(data.offTopic).toHaveLength(822)
    const inLessons = new Set<string>()
    for (const list of data.byLesson.values()) for (const q of list) inLessons.add(q.id)
    expect(inLessons.size).toBe(3651 - 822)
    expect(inLessons.size + data.offTopic.length).toBe(3651)
  })

  it('число вопросов в каждой лекции совпадает с lessons[].count (вопрос двух лекций — в обеих)', () => {
    for (const l of raw.lessons) expect(data.byLesson.get(l.id)!.length).toBe(l.count)
    const twoLessons = raw.questions.filter((q) => q.lessons.length > 1)
    expect(twoLessons.length).toBe(626)
    for (const q of twoLessons) for (const l of q.lessons) expect(data.byLesson.get(l)!.some((x) => x.id === q.id)).toBe(true)
  })

  it('экзамен «со всеми темами» охватывает все 3651, без них — 2829 и ни одного вопроса без лекций', () => {
    const all = poolFor(data, { ...DEFAULT_CONFIG.exam, includeOffTopic: true })
    expect(all).toHaveLength(3651)
    const studied = poolFor(data, DEFAULT_CONFIG.exam)
    expect(studied).toHaveLength(2829)
    expect(studied.every((q) => q.lessons.length > 0)).toBe(true)
  })

  it('в тренировку по лекции не подмешиваются вопросы вне пройденного', () => {
    for (const l of data.lessons) {
      const pool = poolFor(data, { ...DEFAULT_CONFIG.lesson, target: l.id })
      expect(pool.every((q) => q.lessons.includes(l.id))).toBe(true)
    }
  })
})

describe('Проверка 2: 3, 4 и 5 вариантов ответа', () => {
  const data = loadData()

  it('распределение по числу вариантов: ROMA 3, IMMOBILIARE/MERCEOLOGICO 4, один вопрос с 5', () => {
    const dist: Record<string, number> = {}
    for (const q of data.questions) {
      const k = `${q.bank}:${q.options.length}`
      dist[k] = (dist[k] ?? 0) + 1
    }
    expect(dist).toEqual({ 'ROMA:3': 1545, 'IMMOBILIARE:4': 1646, 'MERCEOLOGICO:4': 459, 'IMMOBILIARE:5': 1 })
  })

  it('correct — индекс внутри options у каждого вопроса', () => {
    for (const q of data.questions) {
      expect(Number.isInteger(q.correct)).toBe(true)
      expect(q.correct).toBeGreaterThanOrEqual(0)
      expect(q.correct).toBeLessThan(q.options.length)
    }
  })
})

describe('Пояснения', () => {
  it('подхватываются из explanations.json по id, не затирая поле explanation в самом вопросе', () => {
    const raw = readRaw()
    const [a, b] = raw.questions
    const rawWith = { ...raw, questions: [{ ...a, explanation: 'из domande.json' }, b] }
    const d = buildDataset(rawWith, { [a.id]: 'из explanations.json', [b.id]: 'пояснение B' })
    expect(d.byId.get(a.id)!.explanation).toBe('из domande.json')
    expect(d.byId.get(b.id)!.explanation).toBe('пояснение B')
    expect(d.explanationsCount).toBe(2)
  })

  it('сейчас пояснений нет — заглушки не генерируются', () => {
    expect(loadData().explanationsCount).toBe(0)
  })
})
