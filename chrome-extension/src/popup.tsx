import { createRoot } from "react-dom/client"
import App from "./components/App"
import { I18nProvider } from "./lib/i18n"
import "./index.css"

const container = document.getElementById("root")
if (container) {
  const root = createRoot(container)
  root.render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  )
}
