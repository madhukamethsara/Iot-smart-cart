import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import products from "./routes/products"
import checkout from "./routes/checkout"
import carts from "./routes/carts"
import users from "./routes/products"
import { AppEnv } from "./types/app.env";
import { dbMiddleWare } from "./middleware/db.middleware";

const app = new Hono<AppEnv>().basePath('/api')

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(logger())
app.use(cors())
app.use(dbMiddleWare)

// ─── API Routes ───────────────────────────────────────────────────────────────
app.route('/products', products);
app.route('/cart', carts);
app.route('/checkout', checkout);
app.route('/users', users);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (c) => {
  return c.json({ success: true, message: 'Smart Cart API is running 🛒', timestamp: new Date() });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ success: false, message: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.onError((err, c) => {
  return c.json({ success: false, message: `Internal server error: ${err.message}` }, 500);
});

// app.listen(PORT, () => {
//   console.log(`\n🚀 Smart Cart Server running at http://localhost:${PORT}`);
//   console.log(`📦 API Base: http://localhost:${PORT}/api`);
//   console.log(`🛒 Customer View: http://localhost:${PORT}/customer`);
//   console.log(`💳 Cashier View:  http://localhost:${PORT}/cashier`);
//   console.log(`🔧 Admin View:    http://localhost:${PORT}/admin\n`);
// });

export default app
