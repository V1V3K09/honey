import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  devToolbar: {
    enabled: false
  },
  vite: {
    ssr: {
      noExternal: ['three', 'gsap', 'canvas-confetti']
    }
  }
});
