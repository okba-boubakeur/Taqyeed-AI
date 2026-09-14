import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Initialize theme before rendering to avoid flashes and eliminate inline script CSP violations
try {
  const saved = localStorage.getItem('meeting-summarizer-settings');
  if (saved) {
    const parsed = JSON.parse(saved);
    const theme = parsed?.state?.settings?.theme || 'system';
    const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.add('light');
    }
  }
} catch (e) {
  // ignore
}

// Request unlimited persistent storage on Android WebView & browsers
import { ensureStoragePersistence } from './services/storagePersistence';
ensureStoragePersistence();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
