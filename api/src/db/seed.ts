import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { cartItemsTable, cartsTable, productsTable, usersTable } from './schema';

const client = createClient({
  url: process.env.TURSO_CONNECTION_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client);

async function seed() {
  console.log('Seeding...');

  await db.insert(usersTable).values([
    { name: 'Admin User', password: 'hashed_password_here', role: 'admin' },
    { name: 'John Cashier', password: 'hashed_password_here', role: 'cashier' },
  ]);

  await db.insert(productsTable).values([
    { name: "Lay's Classic Chips", barcode: '4890008100309', price: 2.00, stock: 75, category: 'Snacks' },
    { name: 'Whole Milk 1L', barcode: '5010123456789', price: 1.20, stock: 50, category: 'Dairy' },
    { name: 'White Bread', barcode: '8901072002478', price: 0.99, stock: 60, category: 'Bakery' },
    { name: 'Mineral Water 1.5L', barcode: '8714100723609', price: 0.75, stock: 120, category: 'Beverages' },
    { name: 'Munchee Nice', barcode: '5000156478952', price: 100.00, stock: 200, category: 'Biscuits' },
  ]);

  await db.insert(cartsTable).values([
    { rfidCode: 'RFID-CART-001', qrCode: 'QR-CART-001-TOKEN-ABCD1234', status: 'available' },
    { rfidCode: '735BC20D', qrCode: 'QR-CART-002-TOKEN-EFGH5678', status: 'active' },
    { rfidCode: '43BA4D11', qrCode: 'QR-CART-003-TOKEN-IJKL9012', status: 'active' },
  ]);

  await db.insert(cartItemsTable).values([
    { cartId: 2, productId: 4, quantity: 3 },
    { cartId: 2, productId: 2, quantity: 1 },
    { cartId: 2, productId: 3, quantity: 2 },
  ]);

  console.log('Done!');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
