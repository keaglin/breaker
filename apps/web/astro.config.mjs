import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind'
import path from 'path';

import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  integrations: [react(), tailwind({
    applyBaseStyles: false
  })],
  output: 'hybrid',
  vite: {
    resolve: {
      alias: {
        "@ui": path.resolve("./src/components/ui")
      }
    }
  }
});
