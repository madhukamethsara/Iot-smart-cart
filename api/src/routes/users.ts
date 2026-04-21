import { Hono } from 'hono';
import { AppEnv } from '@/types/app.env';
import { userInsertSchema, usersTable, userUpateSchema } from '@/db/schema';
import { zValidator } from '@/lib/validator';
import z from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/middleware/db.middleware';
import { requireAuth, requireRole } from '@/middleware/auth.middleware';

const app = new Hono<AppEnv>()

app.use('/*', requireAuth, requireRole('admin'))

app.get('/', async (c) => {
  const users = await db(c).select({
    id: usersTable.id,
    name: usersTable.name,
    role: usersTable.role,
    createdAt: usersTable.createdAt
  }).from(usersTable)
  return c.json({ success: true, data: users });
});

app.get('/:id',
  zValidator('param', z.object({
    id: z.coerce.number().int().positive()
  })),
  async (c) => {
    const { id } = c.req.valid('param')
    const [user] = await db(c).select().from(usersTable).where(eq(usersTable.id, id))

    if (!user) return c.json({ success: false, message: 'User not found' }, 404)
    return c.json({ success: true, data: user });
  }
);

app.post('/',
  zValidator('json', userInsertSchema),
  async (c) => {
    const data = c.req.valid('json')

    const [{ id }] = await db(c).insert(usersTable).values(data).returning()
    return c.json({ success: true, message: 'User created', data: { id } }, 201)
  });

app.put('/:id',
  zValidator('param', z.object({
    id: z.coerce.number().int().positive()
  })),
  zValidator('json', userUpateSchema),
  async (c) => {
    const { id: uid } = c.req.valid('param')
    const [user] = await db(c).select().from(usersTable).where(eq(usersTable.id, uid))

    if (!user) {
      return c.json({ success: false, mesasge: 'User not found' }, 404)
    }

    await db(c).update(usersTable)
      .set(c.req.valid('json'))
      .where(eq(usersTable.id, user.id))
    return c.json({ success: true, message: 'User updated' })
  }
);

app.delete('/:id',
  zValidator('param',
    z.object({
      id: z.coerce.number().int().positive()
    })),
  async (c) => {
    const { id: uid } = c.req.valid('param')
    const [user] = await db(c).select().from(usersTable).where(eq(usersTable.id, uid))

    if (!user) {
      return c.json({ success: false, mesasge: 'User not found' }, 404)
    }

    await db(c).delete(usersTable).where(eq(usersTable.id, user.id))
    return c.json({ success: true, message: 'User deleted' });
  })

export default app
