import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import packageJson from './package.json' with { type: 'json' };

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, 'src/index.ts'),
        core: resolve(import.meta.dirname, 'src/core/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: Object.keys(packageJson.dependencies),
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
    sourcemap: true,
    minify: 'oxc',
  },
});
