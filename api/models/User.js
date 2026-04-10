const db = require('../config/db');

const User = {
  async getAll() {
    const [rows] = await db.query('SELECT id, name, email, role, created_at FROM users');
    return rows;
  },

  async getById(id) {
    const [rows] = await db.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0];
  },

  async getByEmail(email) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  },

  async create({ name, email, password, role }) {
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, password, role]
    );
    return result.insertId;
  },

  async update(id, { name, role }) {
    const [result] = await db.query(
      'UPDATE users SET name=?, role=? WHERE id=?',
      [name, role, id]
    );
    return result.affectedRows;
  },

  async delete(id) {
    const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows;
  },
};

module.exports = User;
