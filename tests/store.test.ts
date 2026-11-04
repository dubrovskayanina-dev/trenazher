import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, applyChoice, createSession } from '../src/lib/quiz'
import { loadData, seeded } from './helpers'

// Простая замена localStorage для Node — проверяем полный путь «прошла тест → результат сохранён».
class MemoryStorage {
  private m = new Map<string, string>()
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v))
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  get keys() {
    return [...this.m.keys()]
  }
}

const data = loadData()
let store: typeof import('../src/lib/store')
const ls = new MemoryStorage()

beforeAll(async () => {
  ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = ls
  store = await import('../src/lib/store')
})

describe('Завершение теста: история, ошибки, сохранение незаконченного', () => {
  it('незаконченный тест сохраняется и читается заново после «закрытия вкладки»', async () => {
    let s = createSession(data, { ...DEFAULT_CONFIG.lesson, target: 'Л4', count: 10 }, {}, seeded(1))
    store.startSession(s)
    s = applyChoice({ ...s, current: 2 }, 0)
    store.saveSession(s)
    store.writeElapsed(s.id, 61_000)
    const saved = JSON.parse(ls.getItem('rt.v1.session')!)
    expect(saved.qids).toEqual(s.qids)
    expect(saved.answers).toEqual(s.answers)
    expect(saved.current).toBe(2)
    expect(store.readElapsed(s.id)).toBe(61_000)
  })

  it('finishSession пишет попытку с верными числами и пополняет «Работу над ошибками»', () => {
    let s = createSession(data, { ...DEFAULT_CONFIG.exam, count: 20 }, {}, seeded(9))
    const qs = s.qids.map((id) => data.byId.get(id)!)
    qs.forEach((q, i) => {
      if (i < 15) s = applyChoice({ ...s, current: i }, s.orders[i].indexOf(q.correct))
      else if (i < 18) s = applyChoice({ ...s, current: i }, s.orders[i].findIndex((o) => o !== q.correct))
    })
    store.startSession(s)
    const a = store.finishSession(data, s, 125_000, false)
    expect(a).toMatchObject({ total: 20, correct: 15, wrong: 3, skipped: 2, percent: 75, passed: false, threshold: 80 })
    expect(a.durationMs).toBe(125_000)

    const st = store.getState()
    expect(st.session).toBeNull()
    expect(st.history.at(-1)!.id).toBe(a.id)
    expect(Object.keys(st.mistakes).sort()).toEqual(qs.slice(15, 18).map((q) => q.id).sort())
    expect(Object.keys(st.qstats)).toHaveLength(18) // пропущенные не считаются решёнными
    expect(JSON.parse(ls.getItem('rt.v1.history')!)).toHaveLength(1)
    expect(ls.getItem('rt.v1.session')).toBeNull()
  })

  it('порог из настроек применяется к новым попыткам', () => {
    store.updateSettings({ threshold: 70 })
    let s = createSession(data, { ...DEFAULT_CONFIG.exam, count: 10 }, {}, seeded(11))
    const qs = s.qids.map((id) => data.byId.get(id)!)
    qs.slice(0, 7).forEach((q, i) => (s = applyChoice({ ...s, current: i }, s.orders[i].indexOf(q.correct))))
    const a = store.finishSession(data, s, 1000, false)
    expect(a).toMatchObject({ correct: 7, percent: 70, threshold: 70, passed: true })
  })

  it('экспорт/импорт прогресса сохраняет историю и ошибки', () => {
    const json = store.exportProgress()
    const before = store.getState()
    store.resetProgress()
    expect(store.getState().history).toHaveLength(0)
    store.importProgress(json)
    expect(store.getState().history).toEqual(before.history)
    expect(store.getState().mistakes).toEqual(before.mistakes)
  })
})
