import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1600,
    // Phaser in its own chunk: it changes rarely, so browsers keep it cached between game updates.
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
});
