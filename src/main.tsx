import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';

// Inicializar monitor de base de datos
import './lib/dbMonitor';

// Handler global (solo en desarrollo) para capturar errores de promesas no gestionadas
if (import.meta.env.DEV) {
  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event.reason;
      // Filtrar errores conocidos de extensiones (browser-polyfill, cdp-session, etc.)
      const msg = reason instanceof Error ? reason.message : String(reason);
      if (msg.includes('Extension context invalidated') || msg.includes('browser-polyfill') || msg.includes('cdp-session')) {
        // Evitar spam en consola, pero mostrar una línea resumida para debug
        // eslint-disable-next-line no-console
        console.warn('[Dev] Ignored extension error:', msg);
        // Evitar que el error esté marcado como no manejado por otros handlers
        event.preventDefault();
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error handling unhandledrejection:', e);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>
);
