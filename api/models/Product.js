const db = require('../config/db');

const Product = {
  // Get all products
  async getAll() {
    const [rows] = await db.query('SELECT * FROM products ORDER BY name ASC');
    return rows;
  },

  // Get product by ID
  async getById(id) {
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    return rows[0];
  },

  // Get product by barcode
  async getByBarcode(barcode) {
    const [rows] = await db.query('SELECT * FROM products WHERE barcode = ?', [barcode]);
    return rows[0];
  },

  // Create product
  async create({ name, barcode, price, stock, category, image_url }) {
    const [result] = await db.query(
      'INSERT INTO products (name, barcode, price, stock, category, image_url) VALUES (?, ?, ?, ?, ?, ?)',
      [name, barcode, price, stock, category, image_url]
    );
    return result.insertId;
  },

  // Update product
  async update(id, fields) {
    const { name, price, stock, category, image_url } = fields;
    const [result] = await db.query(
      'UPDATE products SET name=?, price=?, stock=?, category=?, image_url=? WHERE id=?',
      [name, price, stock, category, image_url, id]
    );
    return result.affectedRows;
  },

  // Reduce stock (used during checkout)
  async reduceStock(conn, productId, quantity) {
    const [result] = await conn.query(
      'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
      [quantity, productId, quantity]
    );
    return result.affectedRows; // 0 if insufficient stock
  },

  // Delete product
  async delete(id) {
    const [result] = await db.query('DELETE FROM products WHERE id = ?', [id]);
    return result.affectedRows;
  },
};

module.exports = Product;
