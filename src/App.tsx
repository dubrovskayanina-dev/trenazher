import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import type { Mode } from './types'
import { useRoute } from './lib/router'
import { useAppState } from './lib/store'
import Home from './screens/Home'
import Setup from './screens/Setup'
import Quiz from './screens/Quiz'
import Result from './screens/Result'
import Mistakes from './screens/Mistakes'
import Stats from './screens/Stats'
import Settings from './screens/Settings'
import { OffTopic, Sources } from './screens/Lists'

const MODES: Mode[] = ['exam', 'lesson', 'offtopic', 'source', 'mistakes']

export default function App() {
  const route = useRoute()
  const { settings } = useAppState()
  const key = route.join('/')

  useEffect(() => {
    document.documentElement.classList.toggle('font-large', settings.fontScale === 'large')
  }, [settings.fontScale])

  useEffect(() => {
    if (route[0] !== 'quiz') window.scrollTo(0, 0)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  let screen
  const [a, b, c] = route
  if (!a) screen = <Home />
  else if (a === 'setup' && MODES.includes(b as Mode)) screen = <Setup key={key} mode={b as Mode} target={c} />
  else if (a === 'quiz') screen = <Quiz />
  else if (a === 'result' && b) screen = <Result id={b} />
  else if (a === 'mistakes') screen = <Mistakes />
  else if (a === 'stats') screen = <Stats />
  else if (a === 'settings') screen = <Settings />
  else if (a === 'sources') screen = <Sources />
  else if (a === 'offtopic') screen = <OffTopic />
  else screen = <Home />

  return (
    <>
      {screen}
      <UpdateBanner />
    </>
  )
}

/** Когда на GitHub Pages выходит новая версия, предлагаем обновиться (тест в процессе не теряется). */
function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-50 px-3">
      <div className="card mx-auto mb-2 flex max-w-xl items-center gap-3 p-3 shadow-lg ring-1 ring-line">
        <div className="min-w-0 flex-1 text-[0.9375rem]">Вышла новая версия тренажёра</div>
        <button className="btn-ghost min-h-10 px-3 text-sm" onClick={() => setNeedRefresh(false)}>
          Позже
        </button>
        <button className="btn-primary min-h-10 px-3 text-sm" onClick={() => updateServiceWorker(true)}>
          Обновить
        </button>
      </div>
    </div>
  )
}
