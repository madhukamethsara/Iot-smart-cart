import {
  billInsertSchema, billItemsInsertSchema,
  billItemsTable,
  billsTable,
  cartItemsTable,
  cartsTable,
  productsTable
} from '@/db/schema';
import { AppEnv } from '@/types/app.env'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { db } from '@/middleware/db.middleware'
import { and, count, eq, gte, sql } from 'drizzle-orm'
import z from 'zod'
import { requireAuth, requireRole } from '@/middleware/auth.middleware'

const app = new Hono<AppEnv>()

app.use('/*', requireAuth, requireRole('admin', 'cashier'))

const insertSchema = billInsertSchema.pick({
  cartId: true,
  cashierId: true,
  paymentMethod: true
}).partial({ cashierId: true })

// Finalize payment and generate bill
app.post('/',
  zValidator('json', insertSchema),
  async (c) => {
    const data = c.req.valid('json')
    let billId: number | undefined

    await db(c).transaction(async (tx) => {
      const [cart] = await tx.select().from(cartsTable).where(eq(cartsTable.id, data.cartId!))

      if (!cart) return c.json({ success: false, mesasge: 'Cart not found' }, 404)
      if (cart.status !== 'active') {
        return c.json({ success: false, message: 'Cart is not active, cannot checkout' }, 400)
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
          weight: productsTable.weight,
          stock: productsTable.stock,
          category: productsTable.category,
        })
        .from(cartItemsTable)
        .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
        .where(eq(cartItemsTable.cartId, cart.id))

      if (items.length === 0) {
        return c.json({ success: false, message: 'Cart is empty' }, 400)
      }

      await Promise.all(items.map(async item => {
        const [updatedProduct] = await tx.update(productsTable)
          .set({ stock: sql`${item.stock} - ${item.quantity}` })
          .where(
            and(
              eq(productsTable.id, item.productId), gte(productsTable.stock, item.quantity)
            )).returning()
        if (!updatedProduct) {
          tx.rollback()
          return c.json(
            {
              success: false,
              message: `Insufficient stock for ${item.name} (requested: ${item.quantity})`
            }, 400)
        }

      }))

      const year = new Date().getFullYear();
      const rows = await tx
        .select({ count: count() })
        .from(billsTable)
        .where(eq(sql`strftime('%Y', ${billsTable.createdAt})`, String(year)))

      const cn = rows[0].count + 1
      const billNumber = `BILL-${year}-${String(cn).padStart(4, '0')}`

      const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const billData = billInsertSchema
        .parse({
          billNumber,
          cartId: data.cartId,
          cashierId: data.cashierId,
          totalAmount: total,
          paymentMethod: data.paymentMethod
        })

      const [bill] = await tx.insert(billsTable).values(billData).returning()
      billId = bill.id

      const billItemData = z.array(billItemsInsertSchema)
        .parse(
          items.map(item => ({
            billId,
            productId: item.productId,
            productName: item.name,
            productBarcode: item.barcode,
            unitPrice: item.price,
            quantity: item.quantity,
            subtotal: item.price * item.quantity,
          })))

      await tx.insert(billItemsTable)
        .values(billItemData)

      await tx.delete(cartItemsTable).where(eq(cartItemsTable.id, data.cartId))

      await tx.update(cartsTable)
        .set({ status: 'available' })
        .where(eq(cartsTable.id, data.cartId))
    })

    if (!billId) {
      return c.json({ success: false, message: 'Checkout failed' }, 500)
    }

    const [bill] = await db(c)
      .select()
      .from(billsTable)
      .where(eq(billsTable.id, billId))

    return c.json({ success: true, message: 'Checkout successfull', data: { bill } })
  });

// Get all bills (admin/cashier report)
app.get('/bills',
  zValidator('query', z.object({
    limit: z.coerce.number().int().positive().default(50),
    offset: z.coerce.number().int().default(0)
  })),
  async (c) => {
    const { limit, offset } = c.req.valid('query')
    const bills = await db(c).select()
      .from(billsTable)
      .limit(limit)
      .offset(offset)

    return c.json({ success: true, data: bills })
  });

// Get specific bill by bill number
app.get('/bill/:bill_number',
  zValidator('param', z.object({
    bill_number: z.string().min(1)
  })),
  async (c) => {
    const { bill_number: billNumber } = c.req.valid('param')
    const [bill] = await db(c)
      .select().from(billsTable)
      .where(eq(billsTable.billNumber, billNumber))

    if (!bill) return c.json({ success: false, message: 'Bill not found' }, 404)
    return c.json({ success: true, data: bill })
  });

export default app;
