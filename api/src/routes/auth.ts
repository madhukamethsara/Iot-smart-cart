import { usersTable } from '@/db/schema'
import { zValidator } from '@/lib/validator'
import { db } from '@/middleware/db.middleware'
import { AppEnv } from '@/types/app.env'
import { eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { sign } from 'hono/jwt'
import { compare, hash } from 'bcryptjs'
import z from 'zod'

const app = new Hono<AppEnv>()

const authPayloadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const createAuthToken = async (
  secret: string,
  user: { id: number; name: string; role: 'admin' | 'cashier' }
) => {
  const now = Math.floor(Date.now() / 1000)

  return sign(
    {
      sub: String(user.id),
      name: user.name,
      role: user.role,
      iat: now,
      exp: now + 60 * 60 * 6,
    },
    secret,
    'HS256'
  )
}

app.post('/signup', zValidator('json', authPayloadSchema), async (c) => {
  const { name, password } = c.req.valid('json')

  const [existingUser] = await db(c)
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.name, name))

  if (existingUser) {
    return c.json({ success: false, message: 'User already exists' }, 409)
  }

  const hashedPassword = await hash(password, 10)
  const [createdUser] = await db(c)
    .insert(usersTable)
    .values({
      name,
      password: hashedPassword,
      role: 'cashier',
    })
    .returning({
      id: usersTable.id,
      name: usersTable.name,
      role: usersTable.role,
    })

  if (!createdUser) {
    throw new HTTPException(500, { message: 'Failed to create user' })
  }

  const token = await createAuthToken(c.env.JWT_SECRET, {
    id: createdUser.id,
    name: createdUser.name,
    role: 'cashier',
  })

  return c.json(
    {
      success: true,
      message: 'Cashier signup successful',
      data: {
        user: createdUser,
        token,
      },
    },
    201
  )
})

app.post('/login', zValidator('json', authPayloadSchema), async (c) => {
  const { name, password } = c.req.valid('json')

  const [user] = await db(c)
    .select({
      id: usersTable.id,
      name: usersTable.name,
      password: usersTable.password,
      role: usersTable.role,
    })
    .from(usersTable)
    .where(eq(usersTable.name, name))

  if (!user || (user.role !== 'cashier' && user.role !== 'admin')) {
    return c.json({ success: false, message: 'Invalid credentials' }, 401)
  }

  const validPassword = await compare(password, user.password)
  if (!validPassword) {
    return c.json({ success: false, message: 'Invalid credentials' }, 401)
  }

  const token = await createAuthToken(c.env.JWT_SECRET, {
    id: user.id,
    name: user.name,
    role: user.role,
  })

  return c.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
      token,
    },
  })
})

app.post('/admin/create', zValidator('json', authPayloadSchema), async (c) => {
  const { name, password } = c.req.valid('json')

  const [existingUser] = await db(c)
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.name, name))

  if (existingUser) {
    return c.json({ success: false, message: 'User already exists' }, 409)
  }

  const [{ count: adminCount }] = await db(c)
    .select({ count: sql<number>`count(*)` })
    .from(usersTable)
    .where(eq(usersTable.role, 'admin'))

  if (Number(adminCount) > 0) {
    return c.json({ success: false, message: 'Admin bootstrap already completed' }, 403)
  }

  const hashedPassword = await hash(password, 10)
  const [createdAdmin] = await db(c)
    .insert(usersTable)
    .values({
      name,
      password: hashedPassword,
      role: 'admin',
    })
    .returning({
      id: usersTable.id,
      name: usersTable.name,
      role: usersTable.role,
    })

  if (!createdAdmin) {
    throw new HTTPException(500, { message: 'Failed to create admin user' })
  }

  const token = await createAuthToken(c.env.JWT_SECRET, {
    id: createdAdmin.id,
    name: createdAdmin.name,
    role: 'admin',
  })

  return c.json(
    {
      success: true,
      message: 'Admin user created',
      data: {
        user: createdAdmin,
        token,
      },
    },
    201
  )
})

export default app
