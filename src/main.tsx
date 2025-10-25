import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initI18n } from "./i18n/config";

// Initialize i18n before rendering
initI18n();

// Register PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('✅ PWA Service Worker registered:', registration.scope);
      },
      (error) => {
        console.log('❌ PWA Service Worker registration failed:', error);
      }
    );
  });
}

createRoot(document.getElementById("root")!).render(<App />);
