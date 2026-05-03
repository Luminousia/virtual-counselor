import { defineConfig, UserConfig } from 'electron-vite';
import { resolve } from 'path';

export default defineConfig({
  main: {
    root: 'src/electron',
    build: {
      outDir: 'dist-electron/main',
      lib: {
        entry: 'main.ts',
        formats: ['es'],
        fileName: () => 'index.js',
      },
      rollupOptions: {
        external: ['electron'],
      },
    },
  },
  preload: {
    root: 'src/electron',
    build: {
      outDir: 'dist-electron/preload',
      lib: {
        entry: 'preload.ts',
        formats: ['es'],
        fileName: () => 'index.js',
      },
      rollupOptions: {
        external: ['electron'],
      },
    },
  },
  renderer: {
    root: 'src',
    build: {
      outDir: 'dist-electron/renderer',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/index.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
  },
} as UserConfig);
