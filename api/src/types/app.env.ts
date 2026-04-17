import type { drizzle } from 'drizzle-orm/libsql'

export type AppEnv = {
  Bindings: {
    TURSO_CONNECTION_URL: string
    TURSO_AUTH_TOKEN: string | undefined
  },
  Variables: {
    db: ReturnType<typeof drizzle>
  }
}
