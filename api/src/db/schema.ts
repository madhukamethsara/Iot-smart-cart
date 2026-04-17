import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, real, unique } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod'

export const usersTable = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role', { enum: ['admin', 'cashier', 'product_adder'] }).notNull(),
  createdAt: text('created_at').default(sql`(current_timestamp)`),
});

export const productsTable = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  barcode: text('barcode').notNull().unique(),
  price: real('price').notNull(),
  stock: integer('stock').notNull().default(0),
  category: text('category'),
  imageUrl: text('image_url'),
  weight: integer('weight'),
  createdAt: text('created_at').default(sql`(current_timestamp)`),
  updatedAt: text('updated_at').default(sql`(current_timestamp)`),
});

export const cartsTable = sqliteTable('carts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  rfidCode: text('rfid_code').notNull().unique(),
  qrCode: text('qr_code').notNull().unique(),
  status: text('status', { enum: ['available', 'active', 'checked_out'] }).default('available'),
  createdAt: text('created_at').default(sql`(current_timestamp)`),
});

export const cartItemsTable = sqliteTable('cart_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cartId: integer('cart_id').notNull().references(() => cartsTable.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => productsTable.id),
  quantity: integer('quantity').notNull().default(1),
  addedAt: text('added_at').default(sql`(current_timestamp)`),
}, (t) => [
  unique('unique_cart_product').on(t.cartId, t.productId),
]);

export const billsTable = sqliteTable('bills', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  billNumber: text('bill_number').notNull().unique(),
  cartId: integer('cart_id').notNull().references(() => cartsTable.id),
  cashierId: integer('cashier_id').references(() => usersTable.id),
  totalAmount: real('total_amount').notNull(),
  paymentMethod: text('payment_method', { enum: ['cash', 'card', 'digital'] }).notNull(),
  status: text('status', { enum: ['paid', 'pending', 'cancelled'] }).default('paid'),
  createdAt: text('created_at').default(sql`(current_timestamp)`),
});

export const billItemsTable = sqliteTable('bill_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  billId: integer('bill_id').notNull().references(() => billsTable.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => productsTable.id),
  productName: text('product_name').notNull(),
  productBarcode: text('product_barcode').notNull(),
  unitPrice: real('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  subtotal: real('subtotal').notNull(),
});

export const productInsertSchema = createInsertSchema(productsTable)
export const cartItemUpdateSchema = createUpdateSchema(cartItemsTable)

export const userInsertSchema = createInsertSchema(usersTable)
export const userUpateSchema = createUpdateSchema(usersTable)

export const billInsertSchema = createInsertSchema(billsTable)

export const billItemsInsertSchema = createInsertSchema(billItemsTable)
