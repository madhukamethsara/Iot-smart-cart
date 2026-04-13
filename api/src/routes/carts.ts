import { cartItemsTable, cartsTable, productInsertSchema, productsTable, cartItemUpdateSchema } from '@/db/schema'
import { AppEnv } from '@/types/app.env';
import * as z from 'zod'
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { db } from '@/middleware/db.middleware';

const app = new Hono<AppEnv>()
const extendedProductInsertSchema = productInsertSchema.extend({
  quantity: z.number().int().positive().default(1)
})

// Admin: list all carts
app.get('/', async (c) => {
  const carts = await db(c).select().from(cartsTable)
  return c.json({ success: true, data: carts });
});

// Customer: identify cart via QR scan
app.get('/qr/:qr_code', zValidator('param', z.string().min(1)), async (c) => {
  const qrCode = c.req.valid('param')

  const [cart] = await db(c).select().from(cartsTable).where(eq(cartsTable.qrCode, qrCode))
  if (!cart) return c.json({ success: false, message: 'Cart not found' }, 404)

  if (cart.status == 'available') {
    await db(c).update(cartsTable).set({ status: 'active' }).where(eq(cartsTable.id, cart.id))
  }

  const items = await db(c)
    .select({
      id: cartItemsTable.id,
      cartId: cartItemsTable.cartId,
      quantity: cartItemsTable.quantity,
      addedAt: cartItemsTable.addedAt,
      productId: productsTable.id,
      name: productsTable.name,
      barcode: productsTable.barcode,
      price: productsTable.price,
      stock: productsTable.stock,
      category: productsTable.category,
    })
    .from(cartItemsTable)
    .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
    .where(eq(cartItemsTable.cartId, cart.id))

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  c.json({ success: true, data: { cart, items, total: total.toFixed(2) } });
});

// Cashier: identify cart via RFID scan
app.get('/rfid/:rfid_code', zValidator('param', z.string().min(1)), async (c) => {
  const rfidCode = c.req.valid('param')

  const [cart] = await db(c).select()
    .from(cartsTable)
    .where(eq(cartsTable.rfidCode, rfidCode))

  if (!cart) return c.json({ success: false, message: 'Cart not found' }, 404);

  const items = await db(c)
    .select({
      id: cartItemsTable.id,
      cartId: cartItemsTable.cartId,
      quantity: cartItemsTable.quantity,
      addedAt: cartItemsTable.addedAt,
      productId: productsTable.id,
      name: productsTable.name,
      barcode: productsTable.barcode,
      price: productsTable.price,
      stock: productsTable.stock,
      category: productsTable.category,
    })
    .from(cartItemsTable)
    .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
    .where(eq(cartItemsTable.cartId, cart.id))

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  c.json({ success: true, data: { cart, items, total: total.toFixed(2) } });
});

// Cart items
app.get('/:cart_id/items', zValidator('param', z.number().int().positive()), async (c) => {
  const cartId = c.req.valid('param')

  const [cart] = await db(c).select()
    .from(cartsTable)
    .where(eq(cartsTable.id, cartId))

  if (!cart) return c.json({ success: false, message: 'Cart not found' }, 404);

  const items = await db(c)
    .select({
      id: cartItemsTable.id,
      cartId: cartItemsTable.cartId,
      quantity: cartItemsTable.quantity,
      addedAt: cartItemsTable.addedAt,
      productId: productsTable.id,
      name: productsTable.name,
      barcode: productsTable.barcode,
      price: productsTable.price,
      stock: productsTable.stock,
      category: productsTable.category,
    })
    .from(cartItemsTable)
    .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
    .where(eq(cartItemsTable.cartId, cart.id))

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  c.json({ success: true, data: { cart, items, total: total.toFixed(2) } });
});

// ESP32: scan barcode → add item to cart
app.post('/:cart_id/scan',
  zValidator('param', z.number().positive()),
  zValidator('json', extendedProductInsertSchema),
  async (c) => {
    const cartId = c.req.valid('param')
    const data = c.req.valid('json')

    const [cart] = await db(c)
      .select()
      .from(cartsTable)
      .where(eq(cartsTable.id, cartId))

    if (!cart) {
      return c.json({ success: false, message: 'Cart not found' }, 404)
    }

    if (cart.status !== 'active') {
      return c.json({ success: false, message: 'Cart is not active' }, 400)
    }

    const [product] = await db(c).select()
      .from(productsTable)
      .where(eq(productsTable.barcode, data.barcode))

    if (!product) {
      return c.json({ success: false, message: 'Product not found' }, 404)
    }

    if (product.stock < data.quantity) {
      return c.json({ success: false, message: 'Insufficient stock' }, 400)
    }

    await db(c).insert(cartItemsTable)
      .values({ cartId, productId: product.id, quantity: data.quantity })

    const items = await db(c)
      .select({
        id: cartItemsTable.id,
        cartId: cartItemsTable.cartId,
        quantity: cartItemsTable.quantity,
        addedAt: cartItemsTable.addedAt,
        productId: productsTable.id,
        name: productsTable.name,
        barcode: productsTable.barcode,
        price: productsTable.price,
        stock: productsTable.stock,
        category: productsTable.category,
      })
      .from(cartItemsTable)
      .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
      .where(eq(cartItemsTable.cartId, cart.id))

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    c.json({
      success: true,
      message: `${product.name} added to cart`,
      data: { product, items, total: total.toFixed(2) }
    })

  })

// Update item quantity
app.put('/:cart_id/items/:product_id',
  zValidator('param', z.object({
    cart_id: z.number().int().positive(),
    product_id: z.number().int().positive(),
  })),
  zValidator('json', cartItemUpdateSchema),
  async (c) => {
    const { cart_id: cartId, product_id: productId } = c.req.valid('param');
    const data = c.req.valid('json')

    await db(c).update(cartItemsTable)
      .set(data)
      .where(
        and(eq(cartItemsTable.cartId, cartId), eq(cartItemsTable.productId, productId))
      )
    return c.json({ success: true, message: 'Item updated' });
  }
);

// Remove item
app.delete('/:cart_id/items/:product_id',
  zValidator('param', z.object({
    cart_id: z.number().int().positive(),
    product_id: z.number().int().positive(),
  })),
  async (c) => {
    const { cart_id: cartId, product_id: productId } = c.req.valid('param');

    await db(c).delete(cartItemsTable)
      .where(
        and(eq(cartItemsTable.cartId, cartId), eq(cartItemsTable.productId, productId)))

    return c.json({ success: true, message: 'Item removed' });
  });

export default app;
