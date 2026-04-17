import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_CONNECTION_URL!,
    ...(process.env.TURSO_AUTH_TOKEN) && { authToken: process.env.TURSO_AUTH_TOKEN }
  },
});
