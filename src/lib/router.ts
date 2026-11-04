import { useSyncExternalStore } from 'react'

/**
 * Маршрутизация через #/… — работает на GitHub Pages без настройки сервера
 * и поддерживает жест «назад» в Safari.
 */
function getHash() {
  return window.location.hash
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, getHash)
  return hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s)
      } catch {
        return s
      }
    })
}

export function href(...parts: string[]): string {
  return '#/' + parts.map(encodeURIComponent).join('/')
}

export function go(to: string, replace = false) {
  const url = to.startsWith('#') ? to : '#' + to
  if (replace) {
    window.history.replaceState(null, '', url)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = url
  }
}

export function back(fallback = '#/') {
  if (window.history.length > 1) window.history.back()
  else go(fallback, true)
}
