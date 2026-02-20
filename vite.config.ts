import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const plugins: any[] = [react()];

  if (mode === 'development') {
    try {
      const { componentTagger } = await import('lovable-tagger');
      plugins.push(componentTagger());
    } catch (e) {
      // console.warn('lovable-tagger not found, skipping...');
    }

    /* 
    // Add source info plugin for debug mode
    try {
      // @ts-ignore
      const sourceInfoPlugin = (await import('./vite-plugin-source-info')).default;
      plugins.push(sourceInfoPlugin());
    } catch (e) {
      console.error('Failed to load source info plugin:', e);
    }
    */
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
    server: {
      host: true,
      port: 5173,
    }
  };
});
