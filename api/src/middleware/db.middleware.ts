import { AppEnv } from "@/types/app.env";
import { drizzle } from 'drizzle-orm/libsql/web'
import { Context } from "hono";
import { createMiddleware } from "hono/factory";

export const db = (c: Context<AppEnv>) => {
  return c.get('db')
}

export const dbMiddleWare = createMiddleware<AppEnv>(async (c, next) => {
  const db = drizzle({
    connection: {
      url: c.env.TURSO_CONNECTION_URL,
      authToken: c.env.TURSO_AUTH_TOKEN
    }
  })
  c.set('db', db)
  await next()
})
