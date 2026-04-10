require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/carts'));
app.use('/api/checkout', require('./routes/checkout'));
app.use('/api/users', require('./routes/users'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Smart Cart API is running 🛒', timestamp: new Date() });
});

// ─── Frontend views ───────────────────────────────────────────────────────────
app.get('/cashier', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/views/cashier.html'));
});

app.get('/customer', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/views/customer.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/views/admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/views/index.html'));
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Smart Cart Server running at http://localhost:${PORT}`);
  console.log(`📦 API Base: http://localhost:${PORT}/api`);
  console.log(`🛒 Customer View: http://localhost:${PORT}/customer`);
  console.log(`💳 Cashier View:  http://localhost:${PORT}/cashier`);
  console.log(`🔧 Admin View:    http://localhost:${PORT}/admin\n`);
});
