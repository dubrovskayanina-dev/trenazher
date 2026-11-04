import type { Bank, Dataset, Question, RawData } from './types'

/**
 * Собирает индексы по сырому domande.json. Тексты вопросов и вариантов не трогаем:
 * объекты вопросов копируются как есть, добавляется только explanation из explanations.json,
 * если в самом вопросе его нет.
 */
export function buildDataset(raw: RawData, explanations: Record<string, string> = {}): Dataset {
  const questions: Question[] = raw.questions.map((q) => {
    const extra = explanations[q.id]
    if (!q.explanation && typeof extra === 'string' && extra.trim()) {
      return { ...q, explanation: extra }
    }
    return q
  })

  const byId = new Map<string, Question>()
  const byLesson = new Map<string, Question[]>()
  const bySource = new Map<string, Question[]>()
  const sourceBank = new Map<string, Bank>()
  const offTopic: Question[] = []

  for (const l of raw.lessons) byLesson.set(l.id, [])

  for (const q of questions) {
    byId.set(q.id, q)
    if (q.lessons.length === 0) offTopic.push(q)
    // Вопрос с двумя лекциями попадает в обе — это ожидаемо.
    for (const l of q.lessons) {
      if (!byLesson.has(l)) byLesson.set(l, [])
      byLesson.get(l)!.push(q)
    }
    if (!bySource.has(q.source)) bySource.set(q.source, [])
    bySource.get(q.source)!.push(q)
    if (!sourceBank.has(q.source)) sourceBank.set(q.source, q.bank)
  }

  for (const list of bySource.values()) list.sort((a, b) => a.num - b.num)

  return {
    meta: raw.meta,
    lessons: raw.lessons,
    banks: raw.banks,
    sources: raw.sources,
    questions,
    byId,
    byLesson,
    bySource,
    sourceBank,
    offTopic,
    explanationsCount: questions.filter((q) => q.explanation && q.explanation.trim()).length,
  }
}

let current: Dataset | null = null

export async function loadDataset(): Promise<Dataset> {
  if (current) return current
  const [raw, expl] = await Promise.all([
    import('../domande.json'),
    import('../explanations.json'),
  ])
  current = buildDataset(raw.default as unknown as RawData, expl.default as Record<string, string>)
  return current
}

export function useData(): Dataset {
  if (!current) throw new Error('Данные ещё не загружены')
  return current
}

/** «Credito, ipoteca, rappresentanza — кредит…» → «Credito, ipoteca, rappresentanza» */
export function lessonShort(title: string): string {
  const i = title.indexOf(' — ')
  return i > 0 ? title.slice(0, i) : title
}

export function lessonRu(title: string): string {
  const i = title.indexOf(' — ')
  return i > 0 ? title.slice(i + 3) : ''
}

export const BANK_LABEL: Record<Bank, string> = {
  IMMOBILIARE: 'IMMOBILIARE (ufficiale)',
  MERCEOLOGICO: 'MERCEOLOGICO (altro ramo)',
  ROMA: 'TEST ROMA',
}
