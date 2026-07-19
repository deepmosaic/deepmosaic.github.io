import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

// Vite builds Tailwind CSS + Svelte islands into assets/dist/ with FIXED,
// hash-free filenames (app.css / app.js) so Jekyll templates can reference
// them with stable paths and no manifest plumbing. Jekyll then copies
// assets/dist/ into _site during its own build.
export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  build: {
    outDir: 'assets/dist',
    emptyOutDir: true, // only ever holds generated files
    manifest: false,
    cssCodeSplit: false, // one app.css (includes Svelte component styles)
    rollupOptions: {
      input: 'src/main.js',
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'app-[name].js',
        assetFileNames: 'app.[ext]', // imported CSS emits as app.css
      },
    },
  },
});
