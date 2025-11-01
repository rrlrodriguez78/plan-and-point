import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initI18n } from "./i18n/config";
import { initMobileOptimizations } from "./utils/mobileOptimizations";

// Initialize i18n before rendering
initI18n();

// Initialize mobile optimizations (touch targets, Samsung Galaxy, PWA, etc.)
initMobileOptimizations();

createRoot(document.getElementById("root")!).render(<App />);
