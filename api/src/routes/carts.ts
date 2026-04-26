import {
  cartItemsTable,
  cartsTable,
  cartItemUpdateSchema,
  productsTable,
} from '@/db/schema'
import { AppEnv } from '@/types/app.env'
import * as z from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { db } from '@/middleware/db.middleware'

const app = new Hono<AppEnv>()

const cartScanSchema = z.object({
  barcode: z.string().min(1, 'Barcode is required'),
  quantity: z.coerce.number().positive('Quantity must be a number').default(1),
  measuredWeight: z.coerce.number().positive('Measured weight is required'),
  delete: z.boolean().default(false)
})

// Admin: list all carts
app.get('/', async (c) => {
  const carts = await db(c).select().from(cartsTable)
  return c.json({ success: true, data: carts })
})

// Customer: identify cart via QR scan
app.get(
  '/qr/:qr_code',
  zValidator(
    'param',
    z.object({
      qr_code: z.string().min(1),
    })
  ),
  async (c) => {
    const { qr_code: qrCode } = c.req.valid('param')

    const [cart] = await db(c)
      .select()
      .from(cartsTable)
      .where(eq(cartsTable.qrCode, qrCode))

    if (!cart) {
      return c.json({ success: false, message: 'Cart not found' }, 404)
    }

    if (cart.status === 'available') {
      await db(c)
        .update(cartsTable)
        .set({ status: 'active' })
        .where(eq(cartsTable.id, cart.id))
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
        weight: productsTable.weight,
      })
      .from(cartItemsTable)
      .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
      .where(eq(cartItemsTable.cartId, cart.id))

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const expectedWeight = items.reduce(
      (sum, item) => sum + ((item.weight ?? 0) * item.quantity),
      0
    )

    return c.json({
      success: true,
      data: {
        cart,
        items,
        total,
        expectedWeight,
      },
    })
  }
)

// Cashier: identify cart via RFID scan
app.get(
  '/rfid/:rfid_code',
  zValidator(
    'param',
    z.object({
      rfid_code: z.string().min(1),
    })
  ),
  async (c) => {
    const { rfid_code: rfidCode } = c.req.valid('param')

    const [cart] = await db(c)
      .select()
      .from(cartsTable)
      .where(eq(cartsTable.rfidCode, rfidCode))

    if (!cart) {
      return c.json({ success: false, message: 'Cart not found' }, 404)
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
        weight: productsTable.weight,
      })
      .from(cartItemsTable)
      .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
      .where(eq(cartItemsTable.cartId, cart.id))

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const expectedWeight = items.reduce(
      (sum, item) => sum + ((item.weight ?? 0) * item.quantity),
      0
    )

    const env = c.env
    const id = env.CartHubDO.idFromName('global')
    const stub = env.CartHubDO.get(id)

    const payload = {
      success: true,
      data: {
        cart,
        items,
        total,
        expectedWeight,
      },
    }

    await stub.fetch(new Request(
      new URL('/publish', c.req.url), {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }))

    return c.json(payload)
  }
)


app.get('/latest', async (c) => {
  const env = c.env
  const id = env.CartHubDO.idFromName('global')
  const stub = env.CartHubDO.get(id)

  return stub.fetch(new Request(
    new URL('/ws', c.req.url), { headers: c.req.raw.headers }
  ))
})


// Cart items
app.get(
  '/:cart_id/items',
  zValidator(
    'param',
    z.object({
      cart_id: z.coerce.number().int().positive(),
    })
  ),
  async (c) => {
    const { cart_id: cartId } = c.req.valid('param')

    const [cart] = await db(c)
      .select()
      .from(cartsTable)
      .where(eq(cartsTable.id, cartId))

    if (!cart) {
      return c.json({ success: false, message: 'Cart not found' }, 404)
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
        weight: productsTable.weight,
      })
      .from(cartItemsTable)
      .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
      .where(eq(cartItemsTable.cartId, cart.id))

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const expectedWeight = items.reduce(
      (sum, item) => sum + ((item.weight ?? 0) * item.quantity),
      0
    )

    return c.json({
      success: true,
      data: {
        cart,
        items,
        total,
        expectedWeight,
      },
    })
  }
)

// ESP32 / Frontend: scan barcode -> add item to specific cart
app.post(
  '/:cart_id/scan',
  zValidator(
    'param',
    z.object({
      cart_id: z.coerce.number().int().positive(),
    })
  ),
  zValidator('json', cartScanSchema),
  async (c) => {
    const { cart_id: cartId } = c.req.valid('param')
    const { barcode, quantity, measuredWeight, delete: isDelete } = c.req.valid('json')

    const [cart] = await db(c)
      .select()
      .from(cartsTable)
      .where(eq(cartsTable.id, cartId))

    if (!cart) {
      return c.json({ success: false, message: 'Cart not found' }, 404)
    }

    if (cart.status !== 'active') {
      const [result] = await db(c)
        .update(cartsTable)
        .set({ status: 'active' })
        .where(eq(cartsTable.id, cartId))
        .returning()

      if (!result) {
        return c.json({ success: false, message: 'Cannot activate cart' }, 404)
      }
    }

    const [product] = await db(c)
      .select()
      .from(productsTable)
      .where(eq(productsTable.barcode, barcode))

    if (!product) {
      return c.json({ success: false, message: 'Product not found' }, 404)
    }

    if (product.weight == null) {
      return c.json({
        success: false,
        message: 'Product weight is not defined in database',
      }, 400)
    }

    const minWeight = product.weight - 20
    const maxWeight = product.weight + 20
    const weightMatched =
      measuredWeight >= minWeight && measuredWeight <= maxWeight

    if (!weightMatched) {
      return c.json({
        success: false,
        message: 'Weight mismatch',
        lcdMessage: `Weight Error`,
        data: {
          product: {
            id: product.id,
            name: product.name,
            barcode: product.barcode,
            expectedWeight: product.weight,
          },
          measuredWeight,
          allowedRange: {
            min: minWeight,
            max: maxWeight,
          },
        },
      }, 400)
    }

    const [existingItem] = await db(c)
      .select()
      .from(cartItemsTable)
      .where(
        and(
          eq(cartItemsTable.cartId, cartId),
          eq(cartItemsTable.productId, product.id)
        )
      )

    console.log(isDelete)

    if (existingItem) {
      let isReduced = false

      if (isDelete) {
        if (existingItem.quantity > 1) {
          await db(c)
            .update(cartItemsTable)
            .set({ quantity: existingItem.quantity - quantity })
            .where(eq(cartItemsTable.id, existingItem.id))

          isReduced = true
        } else {
          const [result] = await db(c)
            .delete(cartItemsTable)
            .where(eq(cartItemsTable.productId, product.id))
            .returning()

          if (!result) {
            return c.json({
              success: false,
              message: `Failed to delete item: ${product.name}`
            })
          } else {
            return c.json({
              success: true,
              message: `Item ${product.name} deleted`
            })
          }
        }
      }

      (isReduced) ||
        await db(c)
          .update(cartItemsTable)
          .set({ quantity: existingItem.quantity + quantity })
          .where(eq(cartItemsTable.id, existingItem.id))
    } else {
      await db(c)
        .insert(cartItemsTable)
        .values({
          cartId,
          productId: product.id,
          quantity,
        })
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
        weight: productsTable.weight,
      })
      .from(cartItemsTable)
      .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
      .where(eq(cartItemsTable.cartId, cartId))

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const expectedWeight = items.reduce(
      (sum, item) => sum + ((item.weight ?? 0) * item.quantity),
      0
    )

    return c.json({
      success: true,
      message: `${product.name} added to cart`,
      lcdMessage: `${product.name} OK`,
      data: {
        cartId,
        scannedProduct: {
          id: product.id,
          name: product.name,
          barcode: product.barcode,
          price: product.price,
          expectedWeight: product.weight,
          measuredWeight,
        },
        items,
        total,
        expectedWeight,
      },
    })
  }
)
// Update item quantity
app.put(
  '/:cart_id/items/:product_id',
  zValidator(
    'param',
    z.object({
      cart_id: z.coerce.number().int().positive(),
      product_id: z.coerce.number().int().positive(),
    })
  ),
  zValidator('json', cartItemUpdateSchema),
  async (c) => {
    const { cart_id: cartId, product_id: productId } = c.req.valid('param')
    const data = c.req.valid('json')

    await db(c)
      .update(cartItemsTable)
      .set(data)
      .where(
        and(
          eq(cartItemsTable.cartId, cartId),
          eq(cartItemsTable.productId, productId)
        )
      )

    return c.json({ success: true, message: 'Item updated' })
  }
)

// Remove item
app.delete(
  '/:cart_id/items/:product_id',
  zValidator(
    'param',
    z.object({
      cart_id: z.coerce.number().int().positive(),
      product_id: z.coerce.number().int().positive(),
    })
  ),
  async (c) => {
    const { cart_id: cartId, product_id: productId } = c.req.valid('param')

    await db(c)
      .delete(cartItemsTable)
      .where(
        and(
          eq(cartItemsTable.cartId, cartId),
          eq(cartItemsTable.productId, productId)
        )
      )

    return c.json({ success: true, message: 'Item removed' })
  }
)

export default app
