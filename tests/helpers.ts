import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildDataset } from '../src/data'
import type { RawData } from '../src/types'

const root = fileURLToPath(new URL('..', import.meta.url))

/** Читаем domande.json с диска заново — эталон, с которым сверяем то, что видит приложение. */
export function readRaw(): RawData {
  return JSON.parse(readFileSync(root + 'domande.json', 'utf8'))
}

export function readExplanations(): Record<string, string> {
  return JSON.parse(readFileSync(root + 'explanations.json', 'utf8'))
}

export function loadData() {
  return buildDataset(readRaw(), readExplanations())
}

/** Детерминированный генератор случайных чисел для воспроизводимых тестов. */
export function seeded(seed = 42) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
