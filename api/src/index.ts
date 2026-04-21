import { Hono } from "hono";
import { cors } from "hono/cors";
import products from "./routes/products";
import checkout from "./routes/checkout";
import carts from "./routes/carts";
import users from "./routes/users";
import auth from "./routes/auth";
import { AppEnv } from "./types/app.env";
import { dbMiddleWare } from "./middleware/db.middleware";
import { HTTPException } from "hono/http-exception";

const app = new Hono<AppEnv>({ strict: false }).basePath('/api');


app.use(cors());
app.use(dbMiddleWare);


app.route('/products', products);
app.route('/cart', carts);
app.route('/checkout', checkout);
app.route('/users', users);
app.route('/auth', auth);

app.get('/health', (c) => {
  return c.json({
    success: true,
    message: 'Smart Cart API is running 🛒',
    timestamp: new Date(),
  });
});


app.notFound((c) => {
  return c.json({ success: false, message: 'Route not found' }, 404);
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ success: false, message: err.message }, err.status);
  }

  console.log(err);
  return c.json({ success: false, message: 'Internal server error' }, 500);
});

export default app;
