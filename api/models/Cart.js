const db = require('../config/db');

const Cart = {
  // Get cart by QR code
  async getByQR(qr_code) {
    const [rows] = await db.query('SELECT * FROM carts WHERE qr_code = ?', [qr_code]);
    return rows[0];
  },

  // Get cart by RFID
  async getByRFID(rfid_code) {
    const [rows] = await db.query('SELECT * FROM carts WHERE rfid_code = ?', [rfid_code]);
    return rows[0];
  },

  // Get cart by ID
  async getById(id) {
    const [rows] = await db.query('SELECT * FROM carts WHERE id = ?', [id]);
    return rows[0];
  },

  // Get all carts
  async getAll() {
    const [rows] = await db.query('SELECT * FROM carts ORDER BY id ASC');
    return rows;
  },

  // Activate a cart (customer starts shopping)
  async activate(cartId) {
    await db.query("UPDATE carts SET status = 'active' WHERE id = ?", [cartId]);
  },

  // Mark cart as checked out
  async markCheckedOut(conn, cartId) {
    await conn.query("UPDATE carts SET status = 'checked_out' WHERE id = ?", [cartId]);
  },

  // Reset cart to available (after checkout complete)
  async reset(conn, cartId) {
    await conn.query("UPDATE carts SET status = 'available' WHERE id = ?", [cartId]);
  },

  // Get cart items with product details
  async getItems(cartId) {
    const [rows] = await db.query(
      `SELECT ci.id, ci.cart_id, ci.quantity, ci.added_at,
              p.id AS product_id, p.name, p.barcode, p.price, p.stock, p.category
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = ?`,
      [cartId]
    );
    return rows;
  },

  // Add item to cart (or increment quantity)
  async addItem(cartId, productId, quantity = 1) {
    await db.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
      [cartId, productId, quantity, quantity]
    );
  },

  // Update item quantity
  async updateItemQty(cartId, productId, quantity) {
    if (quantity <= 0) {
      return Cart.removeItem(cartId, productId);
    }
    await db.query(
      'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?',
      [quantity, cartId, productId]
    );
  },

  // Remove a specific item
  async removeItem(cartId, productId) {
    await db.query(
      'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?',
      [cartId, productId]
    );
  },

  // Clear all items (used after checkout)
  async clearItems(conn, cartId) {
    await conn.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
  },
};

module.exports = Cart;
