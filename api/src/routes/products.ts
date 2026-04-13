import { Hono } from 'hono';
import { AppEnv } from "@/types/app.env"
import { productInsertSchema, productsTable, } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as z from 'zod'
import { zValidator } from '@hono/zod-validator'
import { db } from '@/middleware/db.middleware';

const app = new Hono<AppEnv>()

// GET /api/products
app.get('/', async (c) => {
  const products = await db(c).select().from(productsTable)
  return c.json({ success: true, data: products });
});


// GET /api/products/barcode/:barcode
app.get('/barcode/:barcode', async (c) => {
  const barcode = c.req.param('barcode')
  const product = await db(c).select().from(productsTable).where(eq(productsTable.barcode, barcode))
  if (!product.length) return c.json({ success: false, message: 'Product not found' }, 404);
  return c.json({ success: true, data: product });
});  // must be before /:id


// GET /api/products/:id
app.get('/:id', zValidator('param', z.int().positive()), async (c) => {
  const productId = c.req.valid('param')
  const product = await db(c).select().from(productsTable).where(eq(productsTable.id, productId))
  if (!product) return c.json({ success: false, message: 'Product not found' }, 404);
  return c.json({ success: true, data: product });
});


// // POST /api/products
app.post('/', zValidator('json', productInsertSchema), async (c) => {
  const data = c.req.valid('json')
  // if (err.code === 'ER_DUP_ENTRY') {
  //   return c.json({ success: false, message: 'Barcode already exists' }, 409);
  // }
  const product = await db(c).insert(productsTable).values(data).returning()
  return c.json({ success: true, message: 'Product created', data: { product } }, 201);
})

// // PUT /api/products/:id
app.put('/products/:id',
  zValidator('param', z.number().int().positive()),
  zValidator('json', productInsertSchema),
  async (c) => {
    const id = c.req.valid('param')
    const data = c.req.valid('json')

    const updated = await db(c).update(productsTable).set(data).where(eq(productsTable.id, id)).returning()
    if (!updated.length) return c.json({ success: false, message: 'Product not found' }, 404)

    return c.json({ success: true, message: 'Product updated' });
  }
)

// DELETE /api/products/:id
app.delete('/:id',
  zValidator('param', z.number().int().positive()),
  async (c) => {
    const id = c.req.valid('param')
    const deleted = await db(c).delete(productsTable).where(eq(productsTable.id, id)).returning()
    if (!deleted.length) return c.json({ success: false, message: 'Product not found' }, 404);
    return c.json({ success: true, message: 'Product deleted' });
  });

export default app
