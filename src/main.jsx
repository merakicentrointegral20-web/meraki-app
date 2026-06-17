// Cache Busting proactivo para solucionar pantallas en blanco y estilos viejos en PWA
const CACHE_VERSION = 'meraki-v2';
if (localStorage.getItem('meraki_cache_version') !== CACHE_VERSION) {
  if ('caches' in window) {
    caches.keys().then((names) => {
      return Promise.all(names.map(name => caches.delete(name)));
    }).then(() => {
      localStorage.setItem('meraki_cache_version', CACHE_VERSION);
      if ('serviceWorker' in navigator) {
        return navigator.serviceWorker.getRegistrations().then((registrations) => {
          return Promise.all(registrations.map(r => r.unregister()));
        });
      }
    }).then(() => {
      window.location.reload();
    }).catch(err => console.warn('Error clearing cache:', err));
  } else {
    localStorage.setItem('meraki_cache_version', CACHE_VERSION);
  }
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registrado con éxito:', reg))
      .catch(err => console.error('Error al registrar Service Worker:', err));
  });
}
