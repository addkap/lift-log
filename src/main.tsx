import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

// Start the offline service worker (it saves the app files on the phone).
registerSW({ immediate: true });

// Ask the browser not to delete our saved workouts when the phone is low on space.
// (Safari may say no unless the app is on the Home Screen. That is fine, it just asks again next time.)
try {
  void navigator.storage?.persist?.();
} catch {
  /* not supported: nothing to do */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
