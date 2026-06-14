import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

if ('serviceWorker' in navigator) {
  const updateSW = registerSW({ 
    immediate: true,
    onRegistered(r) {
      if (r) {
        setInterval(() => {
          r.update();
        }, 15 * 60 * 1000); // Check for updates every 15 minutes
      }
    }
  });
  
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
