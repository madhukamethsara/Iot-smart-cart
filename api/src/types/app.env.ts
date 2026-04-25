import { CartHubDO } from '@/durable/cart-do'
import type { drizzle } from 'drizzle-orm/libsql'

export type AppEnv = {
  Bindings: {
    TURSO_CONNECTION_URL: string
    TURSO_AUTH_TOKEN: string
    JWT_SECRET: string
    CartHubDO: DurableObjectNamespace<CartHubDO>
  },
  Variables: {
    db: ReturnType<typeof drizzle>
    authUser: {
      id: number
      name: string
      role: 'admin' | 'cashier'
    }
  }
}
