import { useSyncExternalStore } from 'react'
import type { Attempt, Dataset, MistakeEntry, QStat, Question, Session, Settings } from '../types'
import { isPassed, score } from './scoring'
import { applyToMistakes, applyToQStats } from './progress'
import { newId } from './quiz'

/**
 * Весь прогресс хранится локально в localStorage этого браузера.
 * Ключи с префиксом версии, чтобы при смене формата можно было мигрировать.
 */
const PREFIX = 'rt.v1.'
const HISTORY_LIMIT = 500

export interface AppState {
  settings: Settings
  history: Attempt[]
  mistakes: Record<string, MistakeEntry>
  qstats: Record<string, QStat>
  session: Session | null
}

export const DEFAULT_SETTINGS: Settings = {
  threshold: 80,
  fontScale: 'normal',
  setups: {},
}

type Key = keyof AppState

function read<T>(key: Key, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: Key, value: unknown) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(PREFIX + key)
    else localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch (e) {
    console.error('Не удалось сохранить прогресс', e)
  }
}

function load(): AppState {
  return {
    settings: { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>('settings', {}) },
    history: read<Attempt[]>('history', []),
    mistakes: read<Record<string, MistakeEntry>>('mistakes', {}),
    qstats: read<Record<string, QStat>>('qstats', {}),
    session: read<Session | null>('session', null),
  }
}

let state: AppState = typeof localStorage !== 'undefined' ? load() : {
  settings: DEFAULT_SETTINGS,
  history: [],
  mistakes: {},
  qstats: {},
  session: null,
}
const listeners = new Set<() => void>()

export function getState(): AppState {
  return state
}

export function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch }
  for (const k of Object.keys(patch) as Key[]) write(k, patch[k])
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState)
}

export function updateSettings(patch: Partial<Settings>) {
  setState({ settings: { ...state.settings, ...patch } })
}

// ---- время текущего теста (пишется каждую секунду, поэтому отдельным маленьким ключом)

const ELAPSED_KEY = PREFIX + 'sessionElapsed'

export function readElapsed(sessionId: string): number {
  try {
    const raw = localStorage.getItem(ELAPSED_KEY)
    if (!raw) return 0
    const { id, ms } = JSON.parse(raw) as { id: string; ms: number }
    return id === sessionId ? ms : 0
  } catch {
    return 0
  }
}

export function writeElapsed(sessionId: string, ms: number) {
  try {
    localStorage.setItem(ELAPSED_KEY, JSON.stringify({ id: sessionId, ms }))
  } catch {
    /* ignore */
  }
}

export function startSession(session: Session) {
  writeElapsed(session.id, 0)
  setState({ session })
}

export function saveSession(session: Session) {
  setState({ session })
}

export function discardSession() {
  localStorage.removeItem(ELAPSED_KEY)
  setState({ session: null })
}

/** Завершает тест: считает результат, пишет в историю, обновляет ошибки и статистику. */
export function finishSession(data: Dataset, session: Session, elapsedMs: number, timedOut: boolean): Attempt {
  const questions = session.qids.map((id) => data.byId.get(id)).filter((q): q is Question => Boolean(q))
  const answers = session.qids
    .map((id, i) => (data.byId.has(id) ? session.answers[i] : undefined))
    .filter((a): a is number | null => a !== undefined)
  const s = score(questions, answers)
  const threshold = state.settings.threshold
  const attempt: Attempt = {
    id: newId(),
    title: session.title,
    config: session.config,
    startedAt: session.startedAt,
    finishedAt: Date.now(),
    durationMs: elapsedMs,
    timedOut,
    qids: questions.map((q) => q.id),
    answers,
    ...s,
    threshold,
    passed: isPassed(s.correct, s.total, threshold),
  }
  const history = [...state.history, attempt].slice(-HISTORY_LIMIT)
  localStorage.removeItem(ELAPSED_KEY)
  setState({
    history,
    mistakes: applyToMistakes(state.mistakes, questions, answers),
    qstats: applyToQStats(state.qstats, questions, answers),
    session: null,
  })
  return attempt
}

// ---- резервная копия

export function exportProgress(): string {
  return JSON.stringify(
    {
      app: 'trenazher-mediatore',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      history: state.history,
      mistakes: state.mistakes,
      qstats: state.qstats,
    },
    null,
    0,
  )
}

export function importProgress(json: string) {
  const d = JSON.parse(json)
  if (d?.app !== 'trenazher-mediatore') throw new Error('Это не файл прогресса тренажёра')
  setState({
    settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
    history: Array.isArray(d.history) ? d.history : [],
    mistakes: d.mistakes ?? {},
    qstats: d.qstats ?? {},
  })
}

export function resetProgress() {
  localStorage.removeItem(ELAPSED_KEY)
  setState({ history: [], mistakes: {}, qstats: {}, session: null })
}
