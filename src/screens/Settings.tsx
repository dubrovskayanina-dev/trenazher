import { useRef, useState } from 'react'
import { useData } from '../data'
import { exportProgress, importProgress, resetProgress, updateSettings, useAppState } from '../lib/store'
import { Screen, Segmented } from '../components/ui'

export default function Settings() {
  const data = useData()
  const { settings, history, mistakes } = useAppState()
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const t = settings.threshold
  const setT = (v: number) => updateSettings({ threshold: Math.max(50, Math.min(100, v)) })

  async function doExport() {
    const json = exportProgress()
    const name = `trenazher-progress-${new Date().toISOString().slice(0, 10)}.json`
    const file = new File([json], name, { type: 'application/json' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Прогресс тренажёра' })
        setMsg('Файл передан.')
        return
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMsg('Файл сохранён.')
  }

  async function doImport(f: File) {
    try {
      importProgress(await f.text())
      setMsg('Прогресс восстановлен из файла.')
    } catch (e) {
      setMsg('Не получилось: ' + (e as Error).message)
    }
  }

  return (
    <Screen title="Настройки" backTo="#/">
      <div className="section-title">Порог сдачи</div>
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <button className="btn-ghost w-14" onClick={() => setT(t - 5)} aria-label="Меньше">
            −
          </button>
          <div className="flex-1 text-center text-[2rem] font-bold tabular-nums">{t} %</div>
          <button className="btn-ghost w-14" onClick={() => setT(t + 5)} aria-label="Больше">
            +
          </button>
        </div>
        <input
          type="range"
          min={50}
          max={100}
          step={1}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          className="mt-3 w-full accent-[var(--color-accent)]"
          aria-label="Порог сдачи, процентов"
        />
        <p className="mt-2 text-[0.8125rem] leading-snug text-muted">
          По умолчанию 80 %. Уточни правила своей Торговой палаты и поменяй здесь. Новый порог действует на следующие
          попытки, старые результаты не пересчитываются.
        </p>
      </div>

      <div className="section-title">Размер текста</div>
      <Segmented
        value={settings.fontScale}
        options={[
          { value: 'normal', label: 'Обычный' },
          { value: 'large', label: 'Крупный' },
        ]}
        onChange={(v) => updateSettings({ fontScale: v })}
      />

      <div className="section-title">Резервная копия прогресса</div>
      <div className="card p-4">
        <p className="text-[0.9375rem] leading-snug text-muted">
          Прогресс хранится только на этом устройстве. Если удалить приложение с экрана «Домой», он пропадёт — сохрани
          файл заранее.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <button className="btn-soft w-full" onClick={doExport}>
            Сохранить в файл
          </button>
          <button className="btn-ghost w-full" onClick={() => fileRef.current?.click()}>
            Восстановить из файла
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) doImport(f)
              e.target.value = ''
            }}
          />
        </div>
        {msg && <p className="mt-2 text-[0.9375rem]">{msg}</p>}
      </div>

      <div className="section-title">О данных</div>
      <div className="card divide-y divide-line overflow-hidden text-[0.9375rem]">
        <Row k="Вопросов в базе" v={data.questions.length} />
        <Row k="Лекций" v={data.lessons.length} />
        <Row k="Тестов (источников)" v={data.bySource.size} />
        <Row k="Вне пройденного" v={data.offTopic.length} />
        <Row k="С пояснениями" v={data.explanationsCount} />
        <Row k="Попыток в истории" v={history.length} />
        <Row k="Вопросов в работе над ошибками" v={Object.keys(mistakes).length} />
      </div>

      <button
        className="btn mt-6 w-full text-bad"
        onClick={() => {
          if (confirm('Удалить всю историю, статистику и список ошибок? Это нельзя отменить.')) {
            resetProgress()
            setMsg('Прогресс сброшен.')
          }
        }}
      >
        Сбросить весь прогресс
      </button>
      <p className="mt-4 text-center text-xs text-muted">Версия {__APP_VERSION__}</p>
    </Screen>
  )
}

function Row({ k, v }: { k: string; v: number | string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span>{k}</span>
      <span className="font-semibold tabular-nums">{v}</span>
    </div>
  )
}
