import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { loadDataset } from './data'
import App from './App'

const root = createRoot(document.getElementById('root')!)

// Просим браузер не вычищать localStorage при нехватке места.
navigator.storage?.persist?.().catch(() => {})

loadDataset()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((e) => {
    console.error(e)
    document.getElementById('root')!.innerHTML =
      '<div class="boot">Не удалось загрузить вопросы. Обнови страницу.</div>'
  })
