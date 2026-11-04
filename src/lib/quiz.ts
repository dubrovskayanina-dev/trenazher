import type { Dataset, MistakeEntry, Mode, Question, QuizConfig, Session } from '../types'
import { lessonShort } from '../data'

export type Rng = () => number

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

export const DEFAULT_CONFIG: Record<Mode, QuizConfig> = {
  exam: {
    mode: 'exam',
    count: 40,
    shuffleQuestions: true,
    shuffleOptions: true,
    reveal: 'end',
    timeLimitMin: 60,
    includeOffTopic: false,
    banks: ['IMMOBILIARE', 'MERCEOLOGICO', 'ROMA'],
  },
  lesson: {
    mode: 'lesson',
    count: 20,
    shuffleQuestions: true,
    shuffleOptions: true,
    reveal: 'instant',
    timeLimitMin: 0,
    includeOffTopic: false,
    banks: ['IMMOBILIARE', 'MERCEOLOGICO', 'ROMA'],
  },
  offtopic: {
    mode: 'offtopic',
    count: 20,
    shuffleQuestions: true,
    shuffleOptions: true,
    reveal: 'instant',
    timeLimitMin: 0,
    includeOffTopic: true,
    banks: ['IMMOBILIARE', 'MERCEOLOGICO', 'ROMA'],
  },
  source: {
    mode: 'source',
    count: 0,
    shuffleQuestions: false,
    shuffleOptions: false,
    reveal: 'instant',
    timeLimitMin: 0,
    includeOffTopic: true,
    banks: ['IMMOBILIARE', 'MERCEOLOGICO', 'ROMA'],
  },
  mistakes: {
    mode: 'mistakes',
    count: 0,
    shuffleQuestions: true,
    shuffleOptions: true,
    reveal: 'instant',
    timeLimitMin: 0,
    includeOffTopic: true,
    banks: ['IMMOBILIARE', 'MERCEOLOGICO', 'ROMA'],
  },
}

/** Пул вопросов для режима. Темы вне пройденного не попадают в тренировку по лекциям. */
export function poolFor(
  data: Dataset,
  config: Pick<QuizConfig, 'mode' | 'target' | 'includeOffTopic' | 'banks'>,
  mistakes: Record<string, MistakeEntry> = {},
): Question[] {
  switch (config.mode) {
    case 'exam': {
      const banks = new Set(config.banks)
      return data.questions.filter(
        (q) => banks.has(q.bank) && (config.includeOffTopic || q.lessons.length > 0),
      )
    }
    case 'lesson':
      return config.target ? (data.byLesson.get(config.target) ?? []) : []
    case 'offtopic':
      return config.target ? data.offTopic.filter((q) => q.source === config.target) : data.offTopic
    case 'source':
      return config.target ? (data.bySource.get(config.target) ?? []) : []
    case 'mistakes':
      return Object.keys(mistakes)
        .map((id) => data.byId.get(id))
        .filter((q): q is Question => Boolean(q))
  }
}

export function titleFor(data: Dataset, config: Pick<QuizConfig, 'mode' | 'target'>): string {
  switch (config.mode) {
    case 'exam':
      return 'Экзамен'
    case 'lesson': {
      const l = data.lessons.find((x) => x.id === config.target)
      return l ? `${l.id} ${lessonShort(l.title)}` : 'Лекция'
    }
    case 'offtopic':
      return config.target ? `Вне пройденного: ${config.target}` : 'Темы вне пройденного'
    case 'source':
      return config.target ?? 'Тест'
    case 'mistakes':
      return 'Работа над ошибками'
  }
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function createSession(
  data: Dataset,
  config: QuizConfig,
  mistakes: Record<string, MistakeEntry> = {},
  rng: Rng = Math.random,
): Session {
  const pool = poolFor(data, config, mistakes)
  const ordered = config.shuffleQuestions ? shuffle(pool, rng) : pool
  const picked = config.count > 0 ? ordered.slice(0, config.count) : ordered
  return {
    id: newId(),
    title: titleFor(data, config),
    config,
    startedAt: Date.now(),
    qids: picked.map((q) => q.id),
    orders: picked.map((q) =>
      config.shuffleOptions ? shuffle(range(q.options.length), rng) : range(q.options.length),
    ),
    answers: picked.map(() => null),
    locked: picked.map(() => false),
    current: 0,
  }
}

/**
 * Нажатие на вариант, стоящий на экране на позиции displayIdx.
 * В ответ записывается индекс варианта в options, поэтому перемешивание не влияет на подсчёт.
 * «Ответ сразу»: первый выбор фиксируется. «В конце»: ответ можно менять, повторное нажатие снимает выбор.
 */
export function applyChoice(session: Session, displayIdx: number): Session {
  const cur = session.current
  const orig = session.orders[cur][displayIdx]
  const answers = session.answers.slice()
  if (session.config.reveal === 'instant') {
    if (session.locked[cur]) return session
    const locked = session.locked.slice()
    answers[cur] = orig
    locked[cur] = true
    return { ...session, answers, locked }
  }
  answers[cur] = answers[cur] === orig ? null : orig
  return { ...session, answers }
}

/** Буквы вариантов строятся по позиции на экране: A, B, C, D, E… */
export function letter(i: number): string {
  return String.fromCharCode(65 + i)
}
