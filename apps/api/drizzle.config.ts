import { defineConfig } from 'drizzle-kit';
import invariant from 'tiny-invariant';


invariant(process.env.DATABASE_URL, 'DATABASE_URL is not set. Check env variables.');

export default defineConfig({
  schema: './src/db/honoSchema.ts',
  out: './drizzle',
  dialect: 'postgresql', // 'postgresql' | 'mysql' | 'sqlite'
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
