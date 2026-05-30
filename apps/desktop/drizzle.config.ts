import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle',
  schema: './src/shared/db/schema',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'file:sqlite.db'
  }
})
