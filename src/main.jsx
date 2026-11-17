import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ─── Registro do Service Worker ───────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(registration => {
        console.log('[SW] Registrado com sucesso. Scope:', registration.scope);

        // Detecta quando uma nova versão do SW está disponível
        registration.addEventListener('updatefound', () => {
          const newSW = registration.installing;
          if (!newSW) return;

          newSW.addEventListener('statechange', () => {
            // Novo SW instalado e pronto — avisa o usuário para recarregar
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateToast();
            }
          });
        });
      })
      .catch(err => {
        console.warn('[SW] Falha no registro:', err);
      });

    // Detecta quando o app fica offline/online e exibe banner
    window.addEventListener('online',  () => showConnToast('online'));
    window.addEventListener('offline', () => showConnToast('offline'));
  });
}

// ─── Toast: atualização disponível ───────────────────────────────────────────
function showUpdateToast() {
  const toast = buildToast(
    '🔄 Nova versão disponível',
    'Recarregue para atualizar o app.',
    '#F5C518',
    true
  );
  document.body.appendChild(toast);
}

// ─── Toast: conexão perdida / restaurada ─────────────────────────────────────
function showConnToast(state) {
  // Remove toasts de conexão anteriores
  document.querySelectorAll('.copa-conn-toast').forEach(el => el.remove());

  const isOnline = state === 'online';
  const toast = buildToast(
    isOnline ? '✅ Conexão restaurada' : '📡 Você está offline',
    isOnline
      ? 'Os dados voltarão a ser atualizados em breve.'
      : 'O app continua funcionando com os últimos dados salvos.',
    isOnline ? '#4CAF84' : '#8DA3C4',
    false,
    'copa-conn-toast'
  );
  document.body.appendChild(toast);

  // Remove automaticamente após 4 s
  setTimeout(() => toast.remove(), 4000);
}

// ─── Fábrica de toast ─────────────────────────────────────────────────────────
function buildToast(title, body, accentColor, showReloadBtn, extraClass = '') {
  const el = document.createElement('div');
  if (extraClass) el.classList.add(extraClass);

  Object.assign(el.style, {
    position:     'fixed',
    bottom:       '20px',
    left:         '50%',
    transform:    'translateX(-50%)',
    background:   '#1E2D45',
    border:       `1px solid ${accentColor}55`,
    borderLeft:   `3px solid ${accentColor}`,
    borderRadius: '10px',
    padding:      '12px 16px',
    color:        '#E8EDF5',
    fontFamily:   "'Montserrat', sans-serif",
    fontSize:     '13px',
    fontWeight:   '600',
    zIndex:       '99999',
    display:      'flex',
    flexDirection:'column',
    gap:          '4px',
    minWidth:     '260px',
    maxWidth:     'calc(100vw - 40px)',
    boxShadow:    '0 8px 32px rgba(0,0,0,0.5)',
    animation:    'swToastIn 0.3s ease both',
  });

  // Injeta keyframe uma única vez
  if (!document.getElementById('sw-toast-style')) {
    const style = document.createElement('style');
    style.id = 'sw-toast-style';
    style.textContent = `
      @keyframes swToastIn {
        from { opacity: 0; transform: translateX(-50%) translateY(16px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  const titleEl = document.createElement('div');
  titleEl.style.cssText = `font-weight:800; font-size:13px; color:${accentColor};`;
  titleEl.textContent = title;

  const bodyEl = document.createElement('div');
  bodyEl.style.cssText = 'font-size:11px; color:#8DA3C4; font-weight:500; line-height:1.5;';
  bodyEl.textContent = body;

  el.appendChild(titleEl);
  el.appendChild(bodyEl);

  if (showReloadBtn) {
    const btn = document.createElement('button');
    btn.textContent = 'Recarregar agora';
    Object.assign(btn.style, {
      marginTop:    '8px',
      padding:      '6px 14px',
      background:   'transparent',
      border:       `1px solid ${accentColor}`,
      borderRadius: '6px',
      color:        accentColor,
      fontSize:     '11px',
      fontWeight:   '800',
      textTransform:'uppercase',
      letterSpacing:'0.5px',
      cursor:       'pointer',
      fontFamily:   "'Montserrat', sans-serif",
    });
    btn.onclick = () => window.location.reload();
    el.appendChild(btn);
  } else {
    // Clique no toast fecha ele
    el.style.cursor = 'pointer';
    el.onclick = () => el.remove();
  }

  return el;
}