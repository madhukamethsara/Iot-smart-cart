import { AppEnv } from '@/types/app.env'
import { verify } from 'hono/jwt'
import { createMiddleware } from 'hono/factory'

type UserRole = 'admin' | 'cashier'

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authorization = c.req.header('Authorization')

  if (!authorization) {
    return c.json({ success: false, message: 'Missing authorization header' }, 401)
  }

  const [scheme, token] = authorization.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return c.json({ success: false, message: 'Invalid authorization format' }, 401)
  }

  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256')
    const role = payload?.role
    const sub = payload?.sub
    const name = payload?.name

    if ((role !== 'admin' && role !== 'cashier') || !sub || !name) {
      return c.json({ success: false, message: 'Invalid token payload' }, 401)
    }

    c.set('authUser', {
      id: Number(sub),
      name: String(name),
      role,
    })

    await next()
  } catch {
    return c.json({ success: false, message: 'Invalid or expired token' }, 401)
  }
})

export const requireRole = (...roles: UserRole[]) => {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('authUser')

    if (!roles.includes(user.role)) {
      return c.json({ success: false, message: 'Forbidden' }, 403)
    }

    await next()
  })
}
