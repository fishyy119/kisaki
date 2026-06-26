import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from '@kisaki3/extension-cli/config'

export default defineConfig({
  ui: {
    plugins: [tailwindcss()]
  }
})
