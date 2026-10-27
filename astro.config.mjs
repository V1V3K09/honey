import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  vite: {
    ssr: {
      noExternal: ['three', 'gsap', 'canvas-confetti']
    }
  }
});
