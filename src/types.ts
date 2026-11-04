export type Bank = 'IMMOBILIARE' | 'MERCEOLOGICO' | 'ROMA'

export interface Question {
  id: string
  bank: Bank
  source: string
  sourceFile?: string
  num: number
  /** Лекции, к которым относится вопрос. Пустой массив — тема ещё не пройдена. */
  lessons: string[]
  q: string
  /** От 3 до 5 вариантов, порядок как в официальном банке. */
  options: string[]
  /** Индекс правильного варианта в options. */
  correct: number
  /**
   * Пояснение к ответу. Необязательное: дописывается постепенно —
   * прямо в domande.json или в explanations.json (по id вопроса).
   */
  explanation?: string
}

export interface Lesson {
  id: string
  title: string
  count: number
}

export interface RawData {
  meta: { total: number; sources: number; [k: string]: unknown }
  lessons: Lesson[]
  banks: Bank[]
  sources: string[]
  questions: Question[]
}

export interface Dataset {
  meta: RawData['meta']
  lessons: Lesson[]
  banks: Bank[]
  sources: string[]
  questions: Question[]
  byId: Map<string, Question>
  byLesson: Map<string, Question[]>
  bySource: Map<string, Question[]>
  sourceBank: Map<string, Bank>
  /** Вопросы без лекций — «Темы вне пройденного». */
  offTopic: Question[]
  explanationsCount: number
}

export type Mode = 'exam' | 'lesson' | 'offtopic' | 'source' | 'mistakes'

export interface QuizConfig {
  mode: Mode
  /** id лекции (lesson), название теста (source, offtopic) */
  target?: string
  /** 0 — все вопросы из пула */
  count: number
  shuffleQuestions: boolean
  shuffleOptions: boolean
  reveal: 'instant' | 'end'
  /** 0 — без ограничения */
  timeLimitMin: number
  /** Только для экзамена: подмешивать темы вне пройденного */
  includeOffTopic: boolean
  /** Только для экзамена: из каких банков брать вопросы */
  banks: Bank[]
}

export interface Session {
  id: string
  title: string
  config: QuizConfig
  startedAt: number
  qids: string[]
  /** Для каждого вопроса: позиция на экране → индекс варианта в options */
  orders: number[][]
  /** Выбранный ответ — индекс в options (не позиция на экране); null — нет ответа */
  answers: (number | null)[]
  /** В режиме «ответ сразу» ответ фиксируется после выбора */
  locked: boolean[]
  current: number
}

export interface Attempt {
  id: string
  title: string
  config: QuizConfig
  startedAt: number
  finishedAt: number
  durationMs: number
  timedOut: boolean
  qids: string[]
  answers: (number | null)[]
  total: number
  correct: number
  wrong: number
  skipped: number
  percent: number
  /** Порог, действовавший в момент попытки */
  threshold: number
  passed: boolean
}

export interface MistakeEntry {
  /** Сколько раз подряд ответила верно после последней ошибки (0 или 1) */
  streak: number
  /** Сколько всего раз ошиблась в этом вопросе */
  wrong: number
  lastAt: number
}

/** [сколько раз отвечала, сколько верно, последний ответ верный (1) или нет (0)] */
export type QStat = [number, number, 0 | 1]

export interface Settings {
  threshold: number
  fontScale: 'normal' | 'large'
  setups: Partial<Record<Mode, Partial<QuizConfig>>>
}
