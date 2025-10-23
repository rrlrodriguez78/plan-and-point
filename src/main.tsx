import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initI18n } from "./i18n/config";

// Initialize i18n before rendering
initI18n();

createRoot(document.getElementById("root")!).render(<App />);
