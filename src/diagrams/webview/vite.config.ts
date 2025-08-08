import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';
// Force-resolve vite-prerender-plugin to a local shim to avoid build-time ESM export issues
// when prerendering is not used. This keeps builds stable for packaging.
const aliasPrerender = resolve(__dirname, 'shims/vite-prerender-plugin.js');

export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: [
        // Avoid bundling d3 internals as external to bypass ESM named export variance
        'internmap'
      ],
      input: {
        main: resolve(__dirname, 'src/main.tsx')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    target: 'es2020',
    minify: false,
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
      , 'vite-prerender-plugin': aliasPrerender
    }
  }
}); 