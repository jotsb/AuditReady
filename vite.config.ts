import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'tanstack-vendor': ['@tanstack/react-query'],
          'pdf-vendor': ['jspdf', 'jspdf-autotable'],
          'pdfjs-vendor': ['pdfjs-dist'],
          'utils-vendor': ['lucide-react', 'isomorphic-dompurify', 'qrcode'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
