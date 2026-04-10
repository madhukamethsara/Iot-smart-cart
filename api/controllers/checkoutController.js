const db = require('../config/db');
const Cart = require('../models/Cart');
const Bill = require('../models/Bill');
const Product = require('../models/Product');

// POST /api/checkout
// Body: { cart_id, cashier_id, payment_method }
exports.checkout = async (req, res) => {
  const { cart_id, cashier_id, payment_method } = req.body;

  if (!cart_id || !payment_method) {
    return res.status(400).json({ success: false, message: 'cart_id and payment_method are required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Verify cart exists and is active
    const cart = await Cart.getById(cart_id);
    if (!cart) throw new Error('Cart not found');
    if (cart.status !== 'active') throw new Error(`Cart is ${cart.status}, cannot checkout`);

    // 2. Get cart items
    const items = await Cart.getItems(cart_id);
    if (items.length === 0) throw new Error('Cart is empty');

    // 3. Check stock and reduce for each item (atomic)
    for (const item of items) {
      const affected = await Product.reduceStock(conn, item.product_id, item.quantity);
      if (!affected) {
        throw new Error(`Insufficient stock for "${item.name}" (requested: ${item.quantity})`);
      }
    }

    // 4. Calculate total
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // 5. Generate bill number
    const bill_number = await Bill.generateBillNumber();

    // 6. Create bill record
    const bill_id = await Bill.create(conn, {
      bill_number,
      cart_id,
      cashier_id: cashier_id || null,
      total_amount: total.toFixed(2),
      payment_method,
    });

    // 7. Snapshot cart items into bill_items
    await Bill.addItems(conn, bill_id, items);

    // 8. Clear cart items
    await Cart.clearItems(conn, cart_id);

    // 9. Reset cart to available
    await Cart.reset(conn, cart_id);

    await conn.commit();

    // Fetch complete bill to return
    const bill = await Bill.getById(bill_id);

    res.status(201).json({
      success: true,
      message: 'Checkout successful!',
      data: { bill },
    });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

// GET /api/checkout/bill/:bill_number
exports.getBill = async (req, res) => {
  try {
    const bill = await Bill.getByNumber(req.params.bill_number);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });
    res.json({ success: true, data: { bill } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/checkout/bills
exports.getAllBills = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const bills = await Bill.getAll({ limit: parseInt(limit), offset: parseInt(offset) });
    res.json({ success: true, data: bills });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
