const db = require('../config/db');

const Bill = {
  // Generate unique bill number: BILL-2026-0001
  async generateBillNumber() {
    const year = new Date().getFullYear();
    const [rows] = await db.query(
      "SELECT COUNT(*) AS count FROM bills WHERE YEAR(created_at) = ?",
      [year]
    );
    const count = rows[0].count + 1;
    return `BILL-${year}-${String(count).padStart(4, '0')}`;
  },

  // Create bill inside a transaction
  async create(conn, { bill_number, cart_id, cashier_id, total_amount, payment_method }) {
    const [result] = await conn.query(
      `INSERT INTO bills (bill_number, cart_id, cashier_id, total_amount, payment_method)
       VALUES (?, ?, ?, ?, ?)`,
      [bill_number, cart_id, cashier_id, total_amount, payment_method]
    );
    return result.insertId;
  },

  // Add bill items (snapshot of cart at checkout)
  async addItems(conn, billId, items) {
    const values = items.map(item => [
      billId,
      item.product_id,
      item.name,
      item.barcode,
      item.price,
      item.quantity,
      item.weight,
      item.price * item.quantity,
    ]);
    await conn.query(
      `INSERT INTO bill_items
       (bill_id, product_id, product_name, product_barcode, unit_price, quantity, weight, subtotal)
       VALUES ?`,
      [values]
    );
  },

  // Get bill with items
  async getById(billId) {
    const [bills] = await db.query('SELECT * FROM bills WHERE id = ?', [billId]);
    if (!bills[0]) return null;
    const [items] = await db.query('SELECT * FROM bill_items WHERE bill_id = ?', [billId]);
    return { ...bills[0], items };
  },

  // Get bill by bill_number
  async getByNumber(bill_number) {
    const [bills] = await db.query('SELECT * FROM bills WHERE bill_number = ?', [bill_number]);
    if (!bills[0]) return null;
    const [items] = await db.query('SELECT * FROM bill_items WHERE bill_id = ?', [bills[0].id]);
    return { ...bills[0], items };
  },

  // Get all bills (for admin/cashier)
  async getAll({ limit = 50, offset = 0 } = {}) {
    const [rows] = await db.query(
      'SELECT * FROM bills ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return rows;
  },
};

module.exports = Bill;
