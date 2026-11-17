import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Garante que sw.js e manifest.json na pasta public/ sejam copiados para dist/
  // sem processamento (service workers precisam ficar na raiz, sem hash no nome)
  publicDir: 'public',

  build: {
    // Service workers precisam de sourcemaps desativados para funcionar corretamente
    sourcemap: false,

    rollupOptions: {
      // Não processa sw.js — ele já está em public/ e será copiado intacto
      // (esta linha é só para documentar; o Vite já faz isso automaticamente)
    },
  },

  server: {
    // Em dev, o SW não é ativado por padrão (Vite usa HMR).
    // Para testar o SW em dev, rode: vite build && vite preview
    headers: {
      // Necessário para que o SW possa ser registrado em localhost
      'Service-Worker-Allowed': '/',
    },
  },
})